use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct CkbRpcClient {
    client: Client,
    endpoint: String,
    last_block: Arc<RwLock<Option<u64>>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TransactionInfo {
    pub tx_hash: String,
    pub block_number: Option<u64>,
    pub block_hash: Option<String>,
    pub confirmed: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum RpcError {
    #[error("request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("rpc error: {0}")]
    Rpc(String),
    #[error("parse error: {0}")]
    Parse(String),
}

impl CkbRpcClient {
    pub fn new(endpoint: &str) -> Self {
        Self {
            client: Client::new(),
            endpoint: endpoint.to_string(),
            last_block: Arc::new(RwLock::new(None)),
        }
    }

    async fn call(&self, method: &str, params: Value) -> Result<Value, RpcError> {
        let body = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params
        });

        let response = self
            .client
            .post(&self.endpoint)
            .json(&body)
            .send()
            .await?
            .json::<Value>()
            .await?;

        if let Some(error) = response.get("error") {
            return Err(RpcError::Rpc(error.to_string()));
        }

        Ok(response.get("result").cloned().unwrap_or(Value::Null))
    }

    pub async fn get_tip_block_number(&self) -> Result<u64, RpcError> {
        let result = self.call("get_tip_block_number", json!([])).await?;
        let hex_str = result
            .as_str()
            .ok_or_else(|| RpcError::Parse("expected string".into()))?;
        let num = u64::from_str_radix(hex_str.trim_start_matches("0x"), 16)
            .map_err(|e| RpcError::Parse(e.to_string()))?;

        *self.last_block.write().await = Some(num);
        Ok(num)
    }

    pub async fn get_transaction(
        &self,
        tx_hash: &str,
    ) -> Result<Option<TransactionInfo>, RpcError> {
        let result = self.call("get_transaction", json!([tx_hash])).await?;

        if result.is_null() {
            return Ok(None);
        }

        let tx_status = result.get("tx_status");
        let status = tx_status
            .and_then(|s| s.get("status"))
            .and_then(|s| s.as_str())
            .unwrap_or("unknown");

        let block_hash = tx_status
            .and_then(|s| s.get("block_hash"))
            .and_then(|s| s.as_str())
            .map(|s| s.to_string());

        let confirmed = status == "committed";

        let block_number = if let Some(ref bh) = block_hash {
            self.get_block_number_by_hash(bh).await.ok().flatten()
        } else {
            None
        };

        Ok(Some(TransactionInfo {
            tx_hash: tx_hash.to_string(),
            block_number,
            block_hash,
            confirmed,
        }))
    }

    async fn get_block_number_by_hash(&self, block_hash: &str) -> Result<Option<u64>, RpcError> {
        let result = self.call("get_block", json!([block_hash])).await?;

        if result.is_null() {
            return Ok(None);
        }

        let num_hex = result
            .get("header")
            .and_then(|h| h.get("number"))
            .and_then(|n| n.as_str());

        match num_hex {
            Some(hex) => {
                let num = u64::from_str_radix(hex.trim_start_matches("0x"), 16)
                    .map_err(|e| RpcError::Parse(e.to_string()))?;
                Ok(Some(num))
            }
            None => Ok(None),
        }
    }

    pub async fn is_connected(&self) -> bool {
        self.get_tip_block_number().await.is_ok()
    }

    /// Search cells using the CKB indexer RPC.
    pub async fn search_cells(
        &self,
        search_key: &Value,
        after_cursor: Option<&str>,
        limit: u64,
    ) -> Result<Value, RpcError> {
        let order = "asc";
        let limit_hex = format!("0x{:x}", limit);
        let cursor = after_cursor
            .map(|s| Value::String(s.to_string()))
            .unwrap_or(Value::Null);
        self.call("get_cells", json!([search_key, order, limit_hex, cursor]))
            .await
    }

    pub async fn last_observed_block(&self) -> Option<u64> {
        *self.last_block.read().await
    }
}
