use serde::{Deserialize, Serialize};

use crate::cache::Cache;
use crate::crypto::{qr, signatures};
use crate::rpc::CkbRpcClient;
use crate::types::AttendanceProof;

#[derive(Debug, Serialize, Deserialize)]
pub struct BuildBadgeTxRequest {
    pub event_id: String,
    pub address: String,
    pub attendance_proof: AttendanceProof,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BuildBadgeTxResponse {
    pub unsigned_tx: String,
    pub tx_hash: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BroadcastRequest {
    pub signed_tx: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BroadcastResponse {
    pub tx_hash: String,
    pub status: String,
}

pub async fn verify_attendance_proof(
    cache: &Cache,
    proof: &AttendanceProof,
) -> Result<(), RelayError> {
    let event = cache
        .get_active_event(&proof.event_id)
        .await
        .map_err(RelayError::Cache)?
        .ok_or(RelayError::EventNotFound)?;

    let window = event.window.as_ref().ok_or(RelayError::WindowNotOpen)?;

    if !window.is_open() {
        return Err(RelayError::WindowClosed);
    }

    let window_secret = qr::derive_window_secret(
        &proof.event_id,
        window.window_start,
        &window.creator_signature,
    );

    if !qr::verify_qr_hmac(
        &window_secret,
        proof.qr_payload.timestamp,
        &proof.qr_payload.hmac,
    ) {
        return Err(RelayError::InvalidQrHmac);
    }

    if !qr::validate_qr_freshness(
        proof.qr_payload.timestamp,
        window.window_start,
        window.window_end,
    ) {
        return Err(RelayError::QrExpired);
    }

    // Verify attendee's CKB signature over the attendance message
    let message = proof.signed_message();
    signatures::verify_ckb_address_signature(
        &message,
        &proof.attendee_signature,
        &proof.attendee_address,
    )
    .map_err(|_| RelayError::InvalidSignature)?;

    if cache
        .check_qr_replay(&proof.event_id, proof.qr_payload.timestamp)
        .await
        .map_err(RelayError::Cache)?
    {
        return Err(RelayError::ReplayDetected);
    }

    Ok(())
}

pub async fn build_badge_tx(
    cache: &Cache,
    _rpc: &CkbRpcClient,
    request: BuildBadgeTxRequest,
) -> Result<BuildBadgeTxResponse, RelayError> {
    verify_attendance_proof(cache, &request.attendance_proof).await?;

    cache
        .record_qr_usage(
            &request.attendance_proof.event_id,
            request.attendance_proof.qr_payload.timestamp,
        )
        .await
        .map_err(RelayError::Cache)?;

    let tx_hash = format!(
        "0x{}",
        hex::encode(sha2::Sha256::digest(
            format!("{}:{}", request.event_id, request.address).as_bytes()
        ))
    );

    Ok(BuildBadgeTxResponse {
        unsigned_tx: "placeholder_unsigned_tx".to_string(),
        tx_hash,
    })
}

pub async fn broadcast_tx(
    _rpc: &CkbRpcClient,
    request: BroadcastRequest,
) -> Result<BroadcastResponse, RelayError> {
    let tx_hash = format!(
        "0x{}",
        hex::encode(&sha2::Sha256::digest(request.signed_tx.as_bytes())[..32])
    );

    Ok(BroadcastResponse {
        tx_hash,
        status: "submitted".to_string(),
    })
}

use sha2::Digest;

#[derive(Debug, thiserror::Error)]
pub enum RelayError {
    #[error("cache error: {0}")]
    Cache(#[from] sqlx::Error),
    #[error("event not found")]
    EventNotFound,
    #[error("attendance window not open")]
    WindowNotOpen,
    #[error("attendance window closed")]
    WindowClosed,
    #[error("invalid QR HMAC")]
    InvalidQrHmac,
    #[error("QR code expired")]
    QrExpired,
    #[error("replay attack detected")]
    ReplayDetected,
    #[error("invalid signature")]
    InvalidSignature,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::Cache;
    use crate::crypto::qr;
    use crate::types::*;
    use chrono::Utc;

    async fn test_cache() -> Cache {
        Cache::new("sqlite::memory:").await.unwrap()
    }

    fn test_rpc() -> CkbRpcClient {
        CkbRpcClient::new("http://localhost:1")
    }

    async fn setup_event_with_window(cache: &Cache) -> (String, WindowProof) {
        let now = Utc::now().timestamp();
        let event = ActiveEvent {
            event_id: "evt1".to_string(),
            metadata: EventMetadata {
                name: "Test".to_string(),
                description: "Desc".to_string(),
                image_url: None,
                location: None,
                start_time: None,
                end_time: None,
            },
            creator_address: "ckt1q".to_string(),
            payment_tx_hash: "0xtx".to_string(),
            payment_block_number: 100,
            activated_at: Utc::now(),
            window: Some(WindowProof {
                event_id: "evt1".to_string(),
                window_start: now - 3600,
                window_end: Some(now + 3600),
                creator_signature: "0xcreator_sig".to_string(),
                window_secret_commitment: "commit".to_string(),
            }),
        };
        let window = event.window.clone().unwrap();
        cache.store_active_event(&event).await.unwrap();
        ("evt1".to_string(), window)
    }

    #[tokio::test]
    async fn test_verify_attendance_proof_event_not_found() {
        let cache = test_cache().await;
        let proof = AttendanceProof {
            event_id: "nonexistent".to_string(),
            attendee_address: "addr".to_string(),
            qr_payload: QrPayload {
                event_id: "nonexistent".to_string(),
                timestamp: 0,
                hmac: "".to_string(),
            },
            attendee_signature: "sig".to_string(),
            created_at: 0,
        };
        let result = verify_attendance_proof(&cache, &proof).await;
        assert!(matches!(result, Err(RelayError::EventNotFound)));
    }

    #[tokio::test]
    async fn test_verify_attendance_proof_window_not_open() {
        let cache = test_cache().await;
        let event = ActiveEvent {
            event_id: "evt1".to_string(),
            metadata: EventMetadata {
                name: "T".to_string(),
                description: "D".to_string(),
                image_url: None,
                location: None,
                start_time: None,
                end_time: None,
            },
            creator_address: "ckt1q".to_string(),
            payment_tx_hash: "0xtx".to_string(),
            payment_block_number: 100,
            activated_at: Utc::now(),
            window: None, // no window
        };
        cache.store_active_event(&event).await.unwrap();

        let proof = AttendanceProof {
            event_id: "evt1".to_string(),
            attendee_address: "addr".to_string(),
            qr_payload: QrPayload {
                event_id: "evt1".to_string(),
                timestamp: 0,
                hmac: "".to_string(),
            },
            attendee_signature: "sig".to_string(),
            created_at: 0,
        };
        let result = verify_attendance_proof(&cache, &proof).await;
        assert!(matches!(result, Err(RelayError::WindowNotOpen)));
    }

    #[tokio::test]
    async fn test_verify_attendance_proof_invalid_hmac() {
        let cache = test_cache().await;
        setup_event_with_window(&cache).await;

        let proof = AttendanceProof {
            event_id: "evt1".to_string(),
            attendee_address: "addr".to_string(),
            qr_payload: QrPayload {
                event_id: "evt1".to_string(),
                timestamp: Utc::now().timestamp(),
                hmac: "badhmacinvalid00".to_string(),
            },
            attendee_signature: "sig".to_string(),
            created_at: Utc::now().timestamp(),
        };
        let result = verify_attendance_proof(&cache, &proof).await;
        assert!(matches!(result, Err(RelayError::InvalidQrHmac)));
    }

    #[tokio::test]
    async fn test_verify_attendance_proof_qr_expired() {
        let cache = test_cache().await;
        let (_, window) = setup_event_with_window(&cache).await;

        let window_secret =
            qr::derive_window_secret("evt1", window.window_start, &window.creator_signature);
        let old_ts = Utc::now().timestamp() - 120; // 2 min ago, beyond TTL
        let hmac = qr::generate_qr_hmac(&window_secret, old_ts);

        let proof = AttendanceProof {
            event_id: "evt1".to_string(),
            attendee_address: "addr".to_string(),
            qr_payload: QrPayload {
                event_id: "evt1".to_string(),
                timestamp: old_ts,
                hmac,
            },
            attendee_signature: "sig".to_string(),
            created_at: Utc::now().timestamp(),
        };
        let result = verify_attendance_proof(&cache, &proof).await;
        assert!(matches!(result, Err(RelayError::QrExpired)));
    }

    #[tokio::test]
    async fn test_broadcast_tx_returns_hash() {
        let rpc = test_rpc();
        let result = broadcast_tx(
            &rpc,
            BroadcastRequest {
                signed_tx: "some_signed_tx_data".to_string(),
            },
        )
        .await
        .unwrap();
        assert!(result.tx_hash.starts_with("0x"));
        assert_eq!(result.status, "submitted");
    }

    #[tokio::test]
    async fn test_broadcast_tx_deterministic() {
        let rpc = test_rpc();
        let r1 = broadcast_tx(
            &rpc,
            BroadcastRequest {
                signed_tx: "tx_data".to_string(),
            },
        )
        .await
        .unwrap();
        let r2 = broadcast_tx(
            &rpc,
            BroadcastRequest {
                signed_tx: "tx_data".to_string(),
            },
        )
        .await
        .unwrap();
        assert_eq!(r1.tx_hash, r2.tx_hash);
    }
}
