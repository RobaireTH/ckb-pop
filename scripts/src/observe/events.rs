use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::cache::Cache;
use crate::rpc::CkbRpcClient;
use crate::types::{ActiveEvent, PaymentIntent, WindowProof};

#[derive(Debug, Serialize, Deserialize)]
pub struct EventListResponse {
    pub events: Vec<ActiveEvent>,
    pub cached: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EventDetailResponse {
    pub event: ActiveEvent,
    pub verified_at_block: Option<u64>,
    pub cached: bool,
}

pub async fn observe_events(
    cache: &Cache,
    _rpc: &CkbRpcClient,
    _verify: bool,
) -> Result<EventListResponse, ObserveError> {
    let events = cache
        .list_active_events()
        .await
        .map_err(ObserveError::Cache)?;
    Ok(EventListResponse {
        events,
        cached: true,
    })
}

pub async fn observe_event(
    cache: &Cache,
    rpc: &CkbRpcClient,
    event_id: &str,
    verify: bool,
) -> Result<EventDetailResponse, ObserveError> {
    // Support prefix lookup for short IDs (< 64 hex chars)
    let event = if event_id.len() < 64 {
        cache
            .get_active_event_by_prefix(event_id)
            .await
            .map_err(ObserveError::Cache)?
            .ok_or(ObserveError::NotFound)?
    } else {
        cache
            .get_active_event(event_id)
            .await
            .map_err(ObserveError::Cache)?
            .ok_or(ObserveError::NotFound)?
    };

    let verified_at_block = if verify {
        rpc.get_tip_block_number().await.ok()
    } else {
        None
    };

    Ok(EventDetailResponse {
        event,
        verified_at_block,
        cached: !verify,
    })
}

pub async fn submit_payment_intent(
    cache: &Cache,
    intent: PaymentIntent,
) -> Result<String, ObserveError> {
    let event_id = intent.event_id_preimage.compute_event_id();
    cache
        .store_payment_intent(&intent)
        .await
        .map_err(ObserveError::Cache)?;
    Ok(event_id)
}

pub async fn activate_event_from_payment(
    cache: &Cache,
    rpc: &CkbRpcClient,
    event_id: &str,
    tx_hash: &str,
) -> Result<ActiveEvent, ObserveError> {
    let intent = cache
        .get_payment_intent(event_id)
        .await
        .map_err(ObserveError::Cache)?
        .ok_or(ObserveError::NotFound)?;

    let tx_info = rpc
        .get_transaction(tx_hash)
        .await
        .map_err(|e| ObserveError::Rpc(e.to_string()))?
        .ok_or(ObserveError::PaymentNotFound)?;

    if !tx_info.confirmed {
        return Err(ObserveError::PaymentNotConfirmed);
    }

    let block_number = tx_info
        .block_number
        .ok_or(ObserveError::PaymentNotConfirmed)?;

    super::payments::record_payment_observation(cache, event_id, tx_hash, block_number)
        .await
        .map_err(|e| match e {
            super::PaymentObserveError::Cache(sql_err) => ObserveError::Cache(sql_err),
            other => ObserveError::Rpc(other.to_string()),
        })?;

    let active_event = ActiveEvent {
        event_id: event_id.to_string(),
        metadata: intent.event_metadata,
        creator_address: intent.creator_address,
        payment_tx_hash: tx_hash.to_string(),
        payment_block_number: block_number,
        activated_at: Utc::now(),
        window: None,
    };

    cache
        .store_active_event(&active_event)
        .await
        .map_err(ObserveError::Cache)?;

    Ok(active_event)
}

pub async fn create_and_activate_event(
    cache: &Cache,
    intent: PaymentIntent,
) -> Result<ActiveEvent, ObserveError> {
    let event_id = intent.event_id_preimage.compute_event_id();

    cache
        .store_payment_intent(&intent)
        .await
        .map_err(ObserveError::Cache)?;

    let active_event = ActiveEvent {
        event_id,
        metadata: intent.event_metadata,
        creator_address: intent.creator_address,
        payment_tx_hash: String::new(),
        payment_block_number: 0,
        activated_at: Utc::now(),
        window: None,
    };

    cache
        .store_active_event(&active_event)
        .await
        .map_err(ObserveError::Cache)?;

    Ok(active_event)
}

pub async fn update_window(
    cache: &Cache,
    event_id: &str,
    window: WindowProof,
) -> Result<(), ObserveError> {
    cache
        .update_event_window(event_id, &window)
        .await
        .map_err(ObserveError::Cache)?;
    Ok(())
}

#[derive(Debug, thiserror::Error)]
pub enum ObserveError {
    #[error("cache error: {0}")]
    Cache(#[from] sqlx::Error),
    #[error("event not found")]
    NotFound,
    #[error("payment transaction not found")]
    PaymentNotFound,
    #[error("payment not yet confirmed")]
    PaymentNotConfirmed,
    #[error("rpc error: {0}")]
    Rpc(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::EventMetadata;
    use chrono::Utc;

    async fn test_cache() -> Cache {
        Cache::new("sqlite::memory:").await.unwrap()
    }

    fn test_rpc() -> CkbRpcClient {
        CkbRpcClient::new("http://localhost:1")
    }

    fn test_metadata() -> EventMetadata {
        EventMetadata {
            name: "Test".to_string(),
            description: "Desc".to_string(),
            image_url: None,
            location: None,
            start_time: None,
            end_time: None,
            scope_kind: None,
            participation_mode: None,
        }
    }

    #[tokio::test]
    async fn test_observe_events_empty() {
        let cache = test_cache().await;
        let rpc = test_rpc();
        let result = observe_events(&cache, &rpc, false).await.unwrap();
        assert!(result.events.is_empty());
        assert!(result.cached);
    }

    #[tokio::test]
    async fn test_observe_events_returns_stored() {
        let cache = test_cache().await;
        let rpc = test_rpc();

        let event = ActiveEvent {
            event_id: "evt1".to_string(),
            metadata: test_metadata(),
            creator_address: "ckt1q".to_string(),
            payment_tx_hash: "0xtx".to_string(),
            payment_block_number: 100,
            activated_at: Utc::now(),
            window: None,
        };
        cache.store_active_event(&event).await.unwrap();

        let result = observe_events(&cache, &rpc, false).await.unwrap();
        assert_eq!(result.events.len(), 1);
        assert_eq!(result.events[0].event_id, "evt1");
    }

    #[tokio::test]
    async fn test_observe_event_not_found() {
        let cache = test_cache().await;
        let rpc = test_rpc();
        let result = observe_event(&cache, &rpc, "nonexistent", false).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_observe_event_found() {
        let cache = test_cache().await;
        let rpc = test_rpc();

        let event = ActiveEvent {
            event_id: "evt1".to_string(),
            metadata: test_metadata(),
            creator_address: "ckt1q".to_string(),
            payment_tx_hash: "0xtx".to_string(),
            payment_block_number: 100,
            activated_at: Utc::now(),
            window: None,
        };
        cache.store_active_event(&event).await.unwrap();

        let result = observe_event(&cache, &rpc, "evt1", false).await.unwrap();
        assert_eq!(result.event.event_id, "evt1");
        assert!(result.cached);
        assert!(result.verified_at_block.is_none());
    }

    #[tokio::test]
    async fn test_submit_payment_intent() {
        let cache = test_cache().await;
        let intent = PaymentIntent {
            event_id_preimage: crate::types::EventIdPreimage {
                creator_address: "ckt1q".to_string(),
                timestamp: 1700000000,
                nonce: "n1".to_string(),
            },
            creator_address: "ckt1q".to_string(),
            creator_signature: "sig".to_string(),
            event_metadata: test_metadata(),
            declared_at: Utc::now(),
            expires_at: Utc::now() + chrono::Duration::hours(24),
        };

        let event_id = submit_payment_intent(&cache, intent).await.unwrap();
        assert_eq!(event_id.len(), 64); // SHA256 hex
    }

    #[tokio::test]
    async fn test_update_window() {
        let cache = test_cache().await;

        let event = ActiveEvent {
            event_id: "evt1".to_string(),
            metadata: test_metadata(),
            creator_address: "ckt1q".to_string(),
            payment_tx_hash: "0xtx".to_string(),
            payment_block_number: 100,
            activated_at: Utc::now(),
            window: None,
        };
        cache.store_active_event(&event).await.unwrap();

        let window = WindowProof {
            event_id: "evt1".to_string(),
            window_start: Utc::now().timestamp(),
            window_end: None,
            creator_signature: "sig".to_string(),
            window_secret_commitment: "commit".to_string(),
        };
        update_window(&cache, "evt1", window).await.unwrap();

        let loaded = cache.get_active_event("evt1").await.unwrap().unwrap();
        assert!(loaded.window.is_some());
    }
}
