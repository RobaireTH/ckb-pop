use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sha2::Digest;

use crate::crypto::{qr, signatures};
use crate::module;
use crate::observe::{self, ObserveError, PaymentObserveError};
use crate::relay::{self, RelayError};
use crate::state::AppState;
use crate::types::{
    ActiveEvent, BadgeObservation, EventIdPreimage, EventMetadata, HealthResponse, PaymentIntent,
    QrPayload, QrResponse, WindowProof,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/module/manifest", get(module_manifest))
        .route("/events/intent", post(submit_intent))
        .route("/events/create", post(create_event))
        .route("/events", get(list_events))
        .route("/events/:id", get(get_event))
        .route("/events/:id/window", post(submit_window))
        .route("/events/:id/qr", get(get_qr))
        .route("/events/:id/activate", post(activate_event))
        .route("/events/:id/badge-holders", get(get_badge_holders))
        .route("/badges/observe", get(observe_badges))
        .route("/badges/build", post(build_badge))
        .route("/badges/broadcast", post(broadcast_badge))
        .route("/badges/record", post(record_badge))
        .route("/tx/:hash", get(get_tx_status))
        .route("/payments/:tx_hash", get(get_payment))
        .route("/qr/parse", get(parse_qr))
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    let ckb_status = if state.rpc.is_connected().await {
        "connected"
    } else {
        "disconnected"
    };

    let cache_status = if state.cache.is_available().await {
        "available"
    } else {
        "unavailable"
    };

    // Opportunistically clean up expired replay log entries.
    let _ = state
        .cache
        .cleanup_expired_replay_log(Utc::now() - Duration::hours(24))
        .await;

    Json(HealthResponse {
        status: "operational".to_string(),
        ckb_rpc: ckb_status.to_string(),
        cache: cache_status.to_string(),
        last_block_observed: state.rpc.last_observed_block().await,
        note: "This backend is non-authoritative. Protocol functions without it.".to_string(),
    })
}

async fn module_manifest(State(state): State<AppState>) -> Json<module::ModuleManifest> {
    Json(module::manifest(&state))
}

#[derive(Deserialize)]
pub struct IntentRequest {
    pub creator_address: String,
    pub creator_signature: String,
    pub nonce: String,
    pub metadata: EventMetadata,
}

#[derive(Serialize)]
pub struct IntentResponse {
    pub event_id: String,
    pub expires_at: i64,
}

async fn submit_intent(
    State(state): State<AppState>,
    Json(req): Json<IntentRequest>,
) -> Result<Json<IntentResponse>, AppError> {
    let now = Utc::now();
    let preimage = EventIdPreimage {
        creator_address: req.creator_address.clone(),
        timestamp: now.timestamp(),
        nonce: req.nonce,
    };

    let intent = PaymentIntent {
        event_id_preimage: preimage.clone(),
        creator_address: req.creator_address,
        creator_signature: req.creator_signature,
        event_metadata: req.metadata,
        declared_at: now,
        expires_at: now + Duration::hours(24),
    };

    let event_id = observe::submit_payment_intent(&state.cache, intent)
        .await
        .map_err(AppError::Observe)?;

    Ok(Json(IntentResponse {
        event_id,
        expires_at: (now + Duration::hours(24)).timestamp(),
    }))
}

async fn create_event(
    State(state): State<AppState>,
    Json(req): Json<IntentRequest>,
) -> Result<Json<ActiveEvent>, AppError> {
    let now = Utc::now();
    let preimage = EventIdPreimage {
        creator_address: req.creator_address.clone(),
        timestamp: now.timestamp(),
        nonce: req.nonce,
    };

    let intent = PaymentIntent {
        event_id_preimage: preimage,
        creator_address: req.creator_address,
        creator_signature: req.creator_signature,
        event_metadata: req.metadata,
        declared_at: now,
        expires_at: now + Duration::hours(24),
    };

    let active_event = observe::create_and_activate_event(&state.cache, intent)
        .await
        .map_err(AppError::Observe)?;

    Ok(Json(active_event))
}

#[derive(Deserialize)]
pub struct VerifyQuery {
    #[serde(default)]
    pub verify: bool,
}

async fn list_events(
    State(state): State<AppState>,
    Query(query): Query<VerifyQuery>,
) -> Result<Json<observe::EventListResponse>, AppError> {
    let response = observe::observe_events(&state.cache, &state.rpc, query.verify)
        .await
        .map_err(AppError::Observe)?;
    Ok(Json(response))
}

async fn get_event(
    State(state): State<AppState>,
    Path(event_id): Path<String>,
    Query(query): Query<VerifyQuery>,
) -> Result<Json<observe::EventDetailResponse>, AppError> {
    let response = observe::observe_event(&state.cache, &state.rpc, &event_id, query.verify)
        .await
        .map_err(AppError::Observe)?;
    Ok(Json(response))
}

#[derive(Deserialize)]
pub struct WindowRequest {
    pub window_start: i64,
    pub window_end: Option<i64>,
    pub creator_signature: String,
}

async fn submit_window(
    State(state): State<AppState>,
    Path(event_id): Path<String>,
    Json(req): Json<WindowRequest>,
) -> Result<Json<WindowProof>, AppError> {
    // Verify the creator's signature over the window parameters.
    let event = state
        .cache
        .get_active_event(&event_id)
        .await
        .map_err(|e| AppError::Observe(ObserveError::Cache(e)))?
        .ok_or(AppError::Observe(ObserveError::NotFound))?;

    let message = WindowProof::message_to_sign(&event_id, req.window_start, req.window_end);
    signatures::verify_ckb_address_signature(
        &message,
        &req.creator_signature,
        &event.creator_address,
    )
    .map_err(|_| AppError::InvalidSignature)?;

    let window_secret =
        qr::derive_window_secret(&event_id, req.window_start, &req.creator_signature);
    let commitment = hex::encode(sha2::Sha256::digest(window_secret));

    let window = WindowProof {
        event_id: event_id.clone(),
        window_start: req.window_start,
        window_end: req.window_end,
        creator_signature: req.creator_signature,
        window_secret_commitment: commitment,
    };

    observe::update_window(&state.cache, &event_id, window.clone())
        .await
        .map_err(AppError::Observe)?;

    Ok(Json(window))
}

async fn get_qr(
    State(state): State<AppState>,
    Path(event_id): Path<String>,
) -> Result<Json<QrResponse>, AppError> {
    let event = state
        .cache
        .get_active_event(&event_id)
        .await
        .map_err(|e| AppError::Observe(ObserveError::Cache(e)))?
        .ok_or(AppError::Observe(ObserveError::NotFound))?;

    let window = event.window.as_ref().ok_or(AppError::WindowNotOpen)?;

    if !window.is_open() {
        return Err(AppError::WindowClosed);
    }

    let window_secret =
        qr::derive_window_secret(&event_id, window.window_start, &window.creator_signature);

    let payload = qr::generate_qr_payload(&event_id, &window_secret);
    let ttl = qr::qr_ttl_seconds();

    Ok(Json(QrResponse {
        qr_data: payload.encode(),
        ttl_seconds: ttl,
        expires_at: payload.timestamp + ttl as i64,
        window_end: window.window_end,
    }))
}

#[derive(Deserialize)]
pub struct ActivateRequest {
    pub tx_hash: String,
}

async fn activate_event(
    State(state): State<AppState>,
    Path(event_id): Path<String>,
    Json(req): Json<ActivateRequest>,
) -> Result<Json<ActiveEvent>, AppError> {
    // Check if already activated via a prior payment observation.
    if let Some(_existing) = state
        .cache
        .get_payment_observation(&event_id)
        .await
        .map_err(|e| AppError::Observe(ObserveError::Cache(e)))?
    {
        let event = state
            .cache
            .get_active_event(&event_id)
            .await
            .map_err(|e| AppError::Observe(ObserveError::Cache(e)))?
            .ok_or(AppError::Observe(ObserveError::NotFound))?;
        return Ok(Json(event));
    }

    let event =
        observe::activate_event_from_payment(&state.cache, &state.rpc, &event_id, &req.tx_hash)
            .await
            .map_err(AppError::Observe)?;
    Ok(Json(event))
}

async fn get_badge_holders(
    State(state): State<AppState>,
    Path(event_id): Path<String>,
    Query(query): Query<VerifyQuery>,
) -> Result<Json<observe::BadgeListResponse>, AppError> {
    let chain_config = state
        .dob_code_hash
        .as_deref()
        .map(|ch| (ch, state.address_hrp.as_str()));
    let response = observe::observe_badges_by_event(
        &state.cache,
        &state.rpc,
        &event_id,
        query.verify,
        chain_config,
    )
    .await
    .map_err(AppError::BadgeObserve)?;
    Ok(Json(response))
}

#[derive(Deserialize)]
pub struct BadgeQuery {
    pub address: String,
    #[serde(default)]
    pub verify: bool,
}

async fn observe_badges(
    State(state): State<AppState>,
    Query(query): Query<BadgeQuery>,
) -> Result<Json<observe::BadgeListResponse>, AppError> {
    let chain_config = state
        .dob_code_hash
        .as_deref()
        .map(|ch| (ch, state.address_hrp.as_str()));
    let response = observe::observe_badges_by_address(
        &state.cache,
        &state.rpc,
        &query.address,
        query.verify,
        chain_config,
    )
    .await
    .map_err(AppError::BadgeObserve)?;
    Ok(Json(response))
}

async fn build_badge(
    State(state): State<AppState>,
    Json(req): Json<relay::BuildBadgeTxRequest>,
) -> Result<Json<relay::BuildBadgeTxResponse>, AppError> {
    let event_id = req.event_id.clone();
    let holder_address = req.address.clone();

    let response = relay::build_badge_tx(&state.cache, &state.rpc, req)
        .await
        .map_err(AppError::Relay)?;

    // Record a pending badge observation so badge-holders queries reflect
    // the mint intent immediately, before on-chain confirmation.
    let badge = BadgeObservation {
        event_id,
        holder_address,
        mint_tx_hash: response.tx_hash.clone(),
        mint_block_number: 0,
        verified_at_block: 0,
        observed_at: Utc::now(),
    };
    let _ = observe::store_badge_observation(&state.cache, badge).await;

    Ok(Json(response))
}

async fn broadcast_badge(
    State(state): State<AppState>,
    Json(req): Json<relay::BroadcastRequest>,
) -> Result<Json<relay::BroadcastResponse>, AppError> {
    let response = relay::broadcast_tx(&state.rpc, req)
        .await
        .map_err(AppError::Relay)?;
    Ok(Json(response))
}

#[derive(Deserialize)]
pub struct RecordBadgeRequest {
    pub event_id: String,
    pub holder_address: String,
    pub tx_hash: String,
}

#[derive(Serialize)]
pub struct RecordBadgeResponse {
    pub badge: BadgeObservation,
}

/// Accept a real on-chain tx hash from the frontend after a successful mint.
async fn record_badge(
    State(state): State<AppState>,
    Json(req): Json<RecordBadgeRequest>,
) -> Result<Json<RecordBadgeResponse>, AppError> {
    // Check if the event exists, but don't fail if it doesn't — the badge is
    // valid on-chain even if the backend lost its event record (e.g. DB wipe).
    match state.cache.get_active_event(&req.event_id).await {
        Ok(None) => tracing::warn!("Recording badge for unknown event {}", req.event_id),
        Err(e) => tracing::warn!("Cache error checking event {}: {e}", req.event_id),
        Ok(Some(_)) => {}
    }

    let badge = BadgeObservation {
        event_id: req.event_id,
        holder_address: req.holder_address,
        mint_tx_hash: req.tx_hash,
        mint_block_number: 0, // Pending confirmation — background task will resolve.
        verified_at_block: 0,
        observed_at: Utc::now(),
    };

    observe::store_badge_observation(&state.cache, badge.clone())
        .await
        .map_err(AppError::BadgeObserve)?;

    Ok(Json(RecordBadgeResponse { badge }))
}

#[derive(Serialize)]
pub struct TxStatusResponse {
    pub tx_hash: String,
    pub block_number: Option<u64>,
    pub confirmed: bool,
}

/// Proxy CKB RPC get_transaction to the frontend for block confirmation polling.
async fn get_tx_status(
    State(state): State<AppState>,
    Path(hash): Path<String>,
) -> Result<Json<TxStatusResponse>, AppError> {
    let info = state
        .rpc
        .get_transaction(&hash)
        .await
        .map_err(|e| AppError::Observe(ObserveError::Rpc(e.to_string())))?;

    match info {
        Some(tx_info) => Ok(Json(TxStatusResponse {
            tx_hash: tx_info.tx_hash,
            block_number: tx_info.block_number,
            confirmed: tx_info.confirmed,
        })),
        None => Ok(Json(TxStatusResponse {
            tx_hash: hash,
            block_number: None,
            confirmed: false,
        })),
    }
}

async fn get_payment(
    State(state): State<AppState>,
    Path(tx_hash): Path<String>,
    Query(query): Query<VerifyQuery>,
) -> Result<Json<observe::PaymentStatusResponse>, AppError> {
    let response = observe::observe_payment(&state.cache, &state.rpc, &tx_hash, query.verify)
        .await
        .map_err(AppError::PaymentObserve)?;
    Ok(Json(response))
}

#[derive(Deserialize)]
pub struct QrParseQuery {
    pub data: String,
}

#[derive(Serialize)]
pub struct QrParseResponse {
    pub event_id: String,
    pub timestamp: i64,
    pub valid: bool,
}

async fn parse_qr(
    State(state): State<AppState>,
    Query(query): Query<QrParseQuery>,
) -> Result<Json<QrParseResponse>, AppError> {
    let payload = QrPayload::parse(&query.data).ok_or(AppError::InvalidQrData)?;

    // Validate HMAC if the event exists and has an open window.
    let valid = if let Some(event) = state
        .cache
        .get_active_event(&payload.event_id)
        .await
        .map_err(|e| AppError::Observe(ObserveError::Cache(e)))?
    {
        if let Some(window) = event.window.as_ref() {
            let window_secret = qr::derive_window_secret(
                &payload.event_id,
                window.window_start,
                &window.creator_signature,
            );
            qr::verify_qr_hmac(&window_secret, payload.timestamp, &payload.hmac)
        } else {
            false
        }
    } else {
        false
    };

    Ok(Json(QrParseResponse {
        event_id: payload.event_id,
        timestamp: payload.timestamp,
        valid,
    }))
}

#[derive(Debug)]
pub enum AppError {
    Observe(ObserveError),
    BadgeObserve(observe::BadgeObserveError),
    PaymentObserve(PaymentObserveError),
    Relay(RelayError),
    WindowNotOpen,
    WindowClosed,
    InvalidSignature,
    InvalidQrData,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::Observe(ObserveError::NotFound) => (StatusCode::NOT_FOUND, "event not found"),
            AppError::Observe(ObserveError::PaymentNotFound) => {
                (StatusCode::NOT_FOUND, "payment not found")
            }
            AppError::Observe(ObserveError::PaymentNotConfirmed) => {
                (StatusCode::BAD_REQUEST, "payment not confirmed")
            }
            AppError::Observe(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal error"),
            AppError::BadgeObserve(e) => {
                tracing::error!("Badge observe error: {e}");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal error")
            }
            AppError::PaymentObserve(PaymentObserveError::NotFound) => {
                (StatusCode::NOT_FOUND, "payment not found")
            }
            AppError::PaymentObserve(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal error"),
            AppError::Relay(RelayError::EventNotFound) => {
                (StatusCode::NOT_FOUND, "event not found")
            }
            AppError::Relay(RelayError::WindowNotOpen) => {
                (StatusCode::FORBIDDEN, "window not open")
            }
            AppError::Relay(RelayError::WindowClosed) => (StatusCode::FORBIDDEN, "window closed"),
            AppError::Relay(RelayError::ReplayDetected) => {
                (StatusCode::CONFLICT, "replay detected")
            }
            AppError::Relay(RelayError::InvalidQrHmac) => (StatusCode::UNAUTHORIZED, "invalid qr"),
            AppError::Relay(RelayError::QrExpired) => (StatusCode::GONE, "qr expired"),
            AppError::Relay(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal error"),
            AppError::WindowNotOpen => (StatusCode::FORBIDDEN, "window not open"),
            AppError::WindowClosed => (StatusCode::FORBIDDEN, "window closed"),
            AppError::InvalidSignature => (StatusCode::UNAUTHORIZED, "invalid creator signature"),
            AppError::InvalidQrData => (StatusCode::BAD_REQUEST, "invalid QR data format"),
        };

        let body = serde_json::json!({ "error": message });
        (status, Json(body)).into_response()
    }
}
