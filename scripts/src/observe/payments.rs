use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::cache::Cache;
use crate::rpc::CkbRpcClient;
use crate::types::PaymentObservation;

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentStatusResponse {
    pub event_id: String,
    pub tx_hash: String,
    pub confirmed: bool,
    pub block_number: Option<u64>,
    pub cached: bool,
}

pub async fn observe_payment(
    cache: &Cache,
    rpc: &CkbRpcClient,
    tx_hash: &str,
    verify: bool,
) -> Result<PaymentStatusResponse, PaymentObserveError> {
    if !verify {
        if let Some(obs) = find_observation_by_tx(cache, tx_hash).await? {
            return Ok(PaymentStatusResponse {
                event_id: obs.event_id,
                tx_hash: obs.payment_tx_hash,
                confirmed: true,
                block_number: Some(obs.payment_block_number),
                cached: true,
            });
        }
    }

    let tx_info = rpc
        .get_transaction(tx_hash)
        .await
        .map_err(|e| PaymentObserveError::Rpc(e.to_string()))?
        .ok_or(PaymentObserveError::NotFound)?;

    Ok(PaymentStatusResponse {
        event_id: String::new(),
        tx_hash: tx_hash.to_string(),
        confirmed: tx_info.confirmed,
        block_number: tx_info.block_number,
        cached: false,
    })
}

async fn find_observation_by_tx(
    cache: &Cache,
    tx_hash: &str,
) -> Result<Option<PaymentObservation>, PaymentObserveError> {
    cache
        .get_payment_observation_by_tx(tx_hash)
        .await
        .map_err(PaymentObserveError::Cache)
}

pub async fn record_payment_observation(
    cache: &Cache,
    event_id: &str,
    tx_hash: &str,
    block_number: u64,
) -> Result<(), PaymentObserveError> {
    let obs = PaymentObservation {
        event_id: event_id.to_string(),
        payment_tx_hash: tx_hash.to_string(),
        payment_block_number: block_number,
        observed_at: Utc::now(),
    };

    cache
        .store_payment_observation(&obs)
        .await
        .map_err(PaymentObserveError::Cache)?;

    Ok(())
}

#[derive(Debug, thiserror::Error)]
pub enum PaymentObserveError {
    #[error("cache error: {0}")]
    Cache(#[from] sqlx::Error),
    #[error("payment not found")]
    NotFound,
    #[error("rpc error: {0}")]
    Rpc(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn test_cache() -> Cache {
        Cache::new("sqlite::memory:").await.unwrap()
    }

    #[tokio::test]
    async fn test_record_payment_observation() {
        let cache = test_cache().await;
        record_payment_observation(&cache, "evt1", "0xtx1", 500)
            .await
            .unwrap();

        let obs = cache.get_payment_observation("evt1").await.unwrap();
        assert!(obs.is_some());
        let obs = obs.unwrap();
        assert_eq!(obs.payment_tx_hash, "0xtx1");
        assert_eq!(obs.payment_block_number, 500);
    }
}
