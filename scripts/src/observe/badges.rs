use std::collections::HashMap;

use bech32::ToBase32;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::Digest;

use crate::cache::Cache;
use crate::rpc::CkbRpcClient;
use crate::types::BadgeObservation;

#[derive(Debug, Serialize, Deserialize)]
pub struct BadgeListResponse {
    pub badges: Vec<BadgeObservation>,
    pub verified_at_block: Option<u64>,
    pub cached: bool,
}

pub async fn observe_badges_by_address(
    cache: &Cache,
    rpc: &CkbRpcClient,
    address: &str,
    verify: bool,
    chain_config: Option<(&str, &str)>,
) -> Result<BadgeListResponse, BadgeObserveError> {
    // Sync from chain before returning cached results.
    if let Some((code_hash, address_hrp)) = chain_config {
        if let Err(e) =
            sync_from_chain_for_address(cache, rpc, address, code_hash, address_hrp).await
        {
            tracing::warn!("Chain sync for address {address} failed: {e}");
        }
    }

    let badges = cache
        .get_badges_by_address(address)
        .await
        .map_err(BadgeObserveError::Cache)?;

    let verified_at_block = if verify {
        rpc.get_tip_block_number().await.ok()
    } else {
        None
    };

    Ok(BadgeListResponse {
        badges,
        verified_at_block,
        cached: !verify,
    })
}

pub async fn observe_badges_by_event(
    cache: &Cache,
    rpc: &CkbRpcClient,
    event_id: &str,
    verify: bool,
    chain_config: Option<(&str, &str)>,
) -> Result<BadgeListResponse, BadgeObserveError> {
    // Sync from chain before returning cached results.
    if let Some((code_hash, address_hrp)) = chain_config {
        if let Err(e) =
            sync_from_chain_for_event(cache, rpc, event_id, code_hash, address_hrp).await
        {
            tracing::warn!("Chain sync for event {event_id} failed: {e}");
        }
    }

    let badges = cache
        .get_badges_by_event(event_id)
        .await
        .map_err(BadgeObserveError::Cache)?;

    let verified_at_block = if verify {
        rpc.get_tip_block_number().await.ok()
    } else {
        None
    };

    Ok(BadgeListResponse {
        badges,
        verified_at_block,
        cached: !verify,
    })
}

pub async fn store_badge_observation(
    cache: &Cache,
    badge: BadgeObservation,
) -> Result<(), BadgeObserveError> {
    cache
        .store_badge_observation(&badge)
        .await
        .map_err(BadgeObserveError::Cache)?;
    Ok(())
}

/// Check pending badges (mint_block_number = 0) and resolve their block numbers
/// from the CKB chain. Called periodically by a background task.
pub async fn confirm_pending_badges(cache: &Cache, rpc: &CkbRpcClient) {
    let pending = match cache.get_pending_badges().await {
        Ok(badges) => badges,
        Err(e) => {
            tracing::warn!("Failed to fetch pending badges: {e}");
            return;
        }
    };

    if pending.is_empty() {
        return;
    }

    tracing::debug!("Confirming {} pending badge(s)", pending.len());

    for badge in pending {
        match rpc.get_transaction(&badge.mint_tx_hash).await {
            Ok(Some(info)) if info.confirmed => {
                if let Some(block_number) = info.block_number {
                    if let Err(e) = cache
                        .update_badge_block_number(&badge.mint_tx_hash, block_number)
                        .await
                    {
                        tracing::warn!(
                            "Failed to update badge block number for {}: {e}",
                            badge.mint_tx_hash
                        );
                    } else {
                        tracing::info!(
                            "Confirmed badge {} at block {block_number}",
                            badge.mint_tx_hash
                        );
                    }
                }
            }
            Ok(_) => {
                // Not yet confirmed or not found — will retry next cycle.
            }
            Err(e) => {
                tracing::debug!("RPC error checking tx {}: {e}", badge.mint_tx_hash);
            }
        }
    }
}

/// Rehydrate badge data from the CKB chain on startup.
///
/// Queries the CKB indexer for cells matching the DOB badge type script
/// (identified by `code_hash`). For each cell found, resolves the event_id
/// by matching SHA256 hashes against known events and derives the holder
/// address from the cell's lock script.
///
/// This ensures badge data survives partial database loss (badges wiped but
/// events intact) since the chain is the source of truth.
pub async fn rehydrate_from_chain(
    cache: &Cache,
    rpc: &CkbRpcClient,
    code_hash: &str,
    address_hrp: &str,
) {
    tracing::info!("Starting chain rehydration with code_hash={code_hash}");

    let event_hash_map = match build_event_hash_map(cache).await {
        Ok(map) => map,
        Err(e) => {
            tracing::warn!("Failed to build event hash map for rehydration: {e}");
            return;
        }
    };

    if event_hash_map.is_empty() {
        tracing::info!("No events in database — skipping chain rehydration");
        return;
    }

    let search_key = serde_json::json!({
        "script": {
            "code_hash": code_hash,
            "hash_type": "type",
            "args": "0x"
        },
        "script_type": "type",
        "script_search_mode": "prefix"
    });

    let total = sync_cells_from_search(cache, rpc, &search_key, &event_hash_map, address_hrp).await;
    tracing::info!("Rehydration complete: {total} badge(s) synced from chain");
}

/// Sync badges from chain for a specific holder address.
///
/// Searches the indexer for badge cells owned by the address's lock script,
/// matches event_id via SHA256 lookup, and stores any missing badges.
async fn sync_from_chain_for_address(
    cache: &Cache,
    rpc: &CkbRpcClient,
    address: &str,
    code_hash: &str,
    address_hrp: &str,
) -> Result<(), BadgeObserveError> {
    let (lock_code_hash, lock_hash_type, lock_args) =
        crate::crypto::signatures::parse_ckb_address(address)
            .map_err(|_| BadgeObserveError::InvalidAddress)?;

    let event_hash_map = build_event_hash_map(cache).await?;
    if event_hash_map.is_empty() {
        return Ok(());
    }

    let search_key = serde_json::json!({
        "script": {
            "code_hash": format!("0x{}", hex::encode(lock_code_hash)),
            "hash_type": hash_type_to_str(lock_hash_type),
            "args": format!("0x{}", hex::encode(&lock_args))
        },
        "script_type": "lock",
        "filter": {
            "script": {
                "code_hash": code_hash,
                "hash_type": "type",
                "args": "0x"
            }
        },
        "script_search_mode": "prefix"
    });

    sync_cells_from_search(cache, rpc, &search_key, &event_hash_map, address_hrp).await;
    Ok(())
}

/// Sync badges from chain for a specific event.
///
/// Scans all badge cells with the given code_hash and filters to the target
/// event inside process_badge_cell. A direct prefix search by event_id_hash
/// is no longer possible because the type_id occupies bytes 0–31 of the args
/// and the indexer only matches prefixes from byte 0.
async fn sync_from_chain_for_event(
    cache: &Cache,
    rpc: &CkbRpcClient,
    event_id: &str,
    code_hash: &str,
    address_hrp: &str,
) -> Result<(), BadgeObserveError> {
    let event_id_hash = hex::encode(&sha2::Sha256::digest(event_id.as_bytes())[..20]);

    let mut event_hash_map = HashMap::new();
    event_hash_map.insert(event_id_hash, event_id.to_string());

    let search_key = serde_json::json!({
        "script": {
            "code_hash": code_hash,
            "hash_type": "type",
            "args": "0x"
        },
        "script_type": "type",
        "script_search_mode": "prefix"
    });

    sync_cells_from_search(cache, rpc, &search_key, &event_hash_map, address_hrp).await;
    Ok(())
}

/// Paginate through indexer results and store badge observations for matching cells.
/// Returns the number of badges stored.
async fn sync_cells_from_search(
    cache: &Cache,
    rpc: &CkbRpcClient,
    search_key: &serde_json::Value,
    event_hash_map: &HashMap<String, String>,
    address_hrp: &str,
) -> u64 {
    let mut after_cursor: Option<String> = None;
    let mut total: u64 = 0;

    loop {
        let cells = match rpc
            .search_cells(search_key, after_cursor.as_deref(), 100)
            .await
        {
            Ok(result) => result,
            Err(e) => {
                tracing::debug!("Indexer query failed during sync: {e}");
                break;
            }
        };

        let objects = match cells.get("objects").and_then(|o| o.as_array()) {
            Some(arr) => arr,
            None => break,
        };

        if objects.is_empty() {
            break;
        }

        for cell in objects {
            if process_badge_cell(cache, rpc, cell, event_hash_map, address_hrp).await {
                total += 1;
            }
        }

        after_cursor = cells
            .get("last_cursor")
            .and_then(|c| c.as_str())
            .map(|s| s.to_string());

        if after_cursor.is_none() {
            break;
        }
    }

    total
}

/// Process a single badge cell: match event_id, derive holder address, store observation.
/// Returns true if a new badge was stored.
async fn process_badge_cell(
    cache: &Cache,
    rpc: &CkbRpcClient,
    cell: &serde_json::Value,
    event_hash_map: &HashMap<String, String>,
    address_hrp: &str,
) -> bool {
    let type_args = match cell
        .get("output")
        .and_then(|o| o.get("type"))
        .and_then(|t| t.get("args"))
        .and_then(|a| a.as_str())
    {
        Some(a) => a,
        None => return false,
    };

    let args_hex = type_args.trim_start_matches("0x");
    // Args are 60 bytes (120 hex chars): type_id (0–19) | event_id_hash (20–39) | recipient_hash (40–59)
    if args_hex.len() < 120 {
        return false;
    }

    let event_id = match event_hash_map.get(&args_hex[40..80]) {
        Some(id) => id.clone(),
        None => return false,
    };

    let holder_address = match encode_lock_as_address(cell, address_hrp) {
        Some(addr) => addr,
        None => return false,
    };

    let tx_hash = match cell
        .get("out_point")
        .and_then(|op| op.get("tx_hash"))
        .and_then(|h| h.as_str())
    {
        Some(h) => h.to_string(),
        None => return false,
    };

    let block_number = match rpc.get_transaction(&tx_hash).await {
        Ok(Some(info)) if info.confirmed => info.block_number.unwrap_or(0),
        _ => 0,
    };

    let badge = BadgeObservation {
        event_id,
        holder_address,
        mint_tx_hash: tx_hash,
        mint_block_number: block_number,
        verified_at_block: block_number,
        observed_at: Utc::now(),
    };

    cache.store_badge_observation(&badge).await.is_ok()
}

/// Convert hash_type byte to CKB RPC string representation.
fn hash_type_to_str(hash_type: u8) -> &'static str {
    match hash_type {
        0x00 => "data",
        0x01 => "type",
        0x02 => "data1",
        0x04 => "data2",
        _ => "data",
    }
}

/// Build a lookup map from SHA256(event_id) hex → event_id for all known events.
async fn build_event_hash_map(cache: &Cache) -> Result<HashMap<String, String>, sqlx::Error> {
    let event_ids = cache.list_all_event_ids().await?;
    let mut map = HashMap::with_capacity(event_ids.len());

    for event_id in event_ids {
        let hash = sha2::Sha256::digest(event_id.as_bytes());
        let hash_hex = hex::encode(&hash[..20]);
        map.insert(hash_hex, event_id);
    }

    Ok(map)
}

/// Encode a cell's lock script (from search_cells JSON) as a full-format CKB address.
fn encode_lock_as_address(cell: &serde_json::Value, hrp: &str) -> Option<String> {
    let lock = cell.get("output")?.get("lock")?;
    let code_hash_hex = lock.get("code_hash")?.as_str()?;
    let hash_type_str = lock.get("hash_type")?.as_str()?;
    let args_hex = lock.get("args")?.as_str()?;

    let code_hash = hex::decode(code_hash_hex.trim_start_matches("0x")).ok()?;
    if code_hash.len() != 32 {
        return None;
    }

    let hash_type_byte: u8 = match hash_type_str {
        "data" => 0x00,
        "type" => 0x01,
        "data1" => 0x02,
        "data2" => 0x04,
        _ => return None,
    };

    let args = hex::decode(args_hex.trim_start_matches("0x")).ok()?;

    // Full-format CKB address payload: 0x00 | code_hash(32) | hash_type(1) | args
    let mut payload = Vec::with_capacity(34 + args.len());
    payload.push(0x00);
    payload.extend_from_slice(&code_hash);
    payload.push(hash_type_byte);
    payload.extend_from_slice(&args);

    bech32::encode(hrp, payload.to_base32(), bech32::Variant::Bech32m).ok()
}

#[derive(Debug, thiserror::Error)]
pub enum BadgeObserveError {
    #[error("cache error: {0}")]
    Cache(#[from] sqlx::Error),
    #[error("invalid CKB address")]
    InvalidAddress,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::*;
    use chrono::Utc;

    async fn test_cache() -> Cache {
        Cache::new("sqlite::memory:").await.unwrap()
    }

    fn test_rpc() -> CkbRpcClient {
        CkbRpcClient::new("http://localhost:1")
    }

    #[tokio::test]
    async fn test_observe_badges_by_address_empty() {
        let cache = test_cache().await;
        let rpc = test_rpc();
        let result = observe_badges_by_address(&cache, &rpc, "addr1", false, None)
            .await
            .unwrap();
        assert!(result.badges.is_empty());
        assert!(result.cached);
    }

    #[tokio::test]
    async fn test_store_and_observe_badges_by_event() {
        let cache = test_cache().await;
        let rpc = test_rpc();

        let badge = BadgeObservation {
            event_id: "evt1".to_string(),
            holder_address: "addr1".to_string(),
            mint_tx_hash: "0xtx".to_string(),
            mint_block_number: 100,
            verified_at_block: 101,
            observed_at: Utc::now(),
        };
        store_badge_observation(&cache, badge).await.unwrap();

        let result = observe_badges_by_event(&cache, &rpc, "evt1", false, None)
            .await
            .unwrap();
        assert_eq!(result.badges.len(), 1);
        assert_eq!(result.badges[0].holder_address, "addr1");
    }

    #[tokio::test]
    async fn test_store_and_observe_badges_by_address() {
        let cache = test_cache().await;
        let rpc = test_rpc();

        let badge = BadgeObservation {
            event_id: "evt1".to_string(),
            holder_address: "myaddr".to_string(),
            mint_tx_hash: "0xtx1".to_string(),
            mint_block_number: 100,
            verified_at_block: 101,
            observed_at: Utc::now(),
        };
        store_badge_observation(&cache, badge).await.unwrap();

        let result = observe_badges_by_address(&cache, &rpc, "myaddr", false, None)
            .await
            .unwrap();
        assert_eq!(result.badges.len(), 1);
    }
}
