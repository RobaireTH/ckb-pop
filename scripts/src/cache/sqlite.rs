use chrono::{DateTime, Utc};
use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};

use crate::types::{ActiveEvent, BadgeObservation, PaymentIntent, PaymentObservation, WindowProof};

/// Row type returned by active_events queries.
type EventRow = (String, String, String, String, i64, String, Option<String>);

pub struct Cache {
    pool: Pool<Sqlite>,
}

impl Cache {
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(database_url)
            .await?;

        let cache = Self { pool };
        cache.init_schema().await?;
        Ok(cache)
    }

    async fn init_schema(&self) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS payment_intents (
                event_id TEXT PRIMARY KEY,
                creator_address TEXT NOT NULL,
                creator_signature TEXT NOT NULL,
                metadata_json TEXT NOT NULL,
                preimage_json TEXT NOT NULL,
                declared_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS payment_observations (
                event_id TEXT PRIMARY KEY,
                payment_tx_hash TEXT NOT NULL,
                payment_block_number INTEGER NOT NULL,
                observed_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS active_events (
                event_id TEXT PRIMARY KEY,
                metadata_json TEXT NOT NULL,
                creator_address TEXT NOT NULL,
                payment_tx_hash TEXT NOT NULL,
                payment_block_number INTEGER NOT NULL,
                activated_at TEXT NOT NULL,
                window_json TEXT
            );

            CREATE TABLE IF NOT EXISTS badge_observations (
                event_id TEXT NOT NULL,
                holder_address TEXT NOT NULL,
                mint_tx_hash TEXT NOT NULL,
                mint_block_number INTEGER NOT NULL,
                verified_at_block INTEGER NOT NULL,
                observed_at TEXT NOT NULL,
                PRIMARY KEY (event_id, holder_address)
            );

            CREATE TABLE IF NOT EXISTS qr_replay_log (
                event_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                used_at TEXT NOT NULL,
                PRIMARY KEY (event_id, timestamp)
            );

            CREATE TABLE IF NOT EXISTS challenge_cache (
                challenge_id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                nonce TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            "#,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn store_payment_intent(&self, intent: &PaymentIntent) -> Result<(), sqlx::Error> {
        let event_id = intent.event_id_preimage.compute_event_id();
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO payment_intents
            (event_id, creator_address, creator_signature, metadata_json, preimage_json, declared_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&event_id)
        .bind(&intent.creator_address)
        .bind(&intent.creator_signature)
        .bind(serde_json::to_string(&intent.event_metadata).unwrap())
        .bind(serde_json::to_string(&intent.event_id_preimage).unwrap())
        .bind(intent.declared_at.to_rfc3339())
        .bind(intent.expires_at.to_rfc3339())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_payment_intent(
        &self,
        event_id: &str,
    ) -> Result<Option<PaymentIntent>, sqlx::Error> {
        let row: Option<(String, String, String, String, String, String)> = sqlx::query_as(
            "SELECT creator_address, creator_signature, metadata_json, preimage_json, declared_at, expires_at FROM payment_intents WHERE event_id = ?",
        )
        .bind(event_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(
            |(
                creator_address,
                creator_signature,
                metadata_json,
                preimage_json,
                declared_at,
                expires_at,
            )| {
                PaymentIntent {
                    event_id_preimage: serde_json::from_str(&preimage_json).unwrap(),
                    creator_address,
                    creator_signature,
                    event_metadata: serde_json::from_str(&metadata_json).unwrap(),
                    declared_at: DateTime::parse_from_rfc3339(&declared_at)
                        .unwrap()
                        .with_timezone(&Utc),
                    expires_at: DateTime::parse_from_rfc3339(&expires_at)
                        .unwrap()
                        .with_timezone(&Utc),
                }
            },
        ))
    }

    pub async fn store_payment_observation(
        &self,
        obs: &PaymentObservation,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT OR REPLACE INTO payment_observations (event_id, payment_tx_hash, payment_block_number, observed_at) VALUES (?, ?, ?, ?)",
        )
        .bind(&obs.event_id)
        .bind(&obs.payment_tx_hash)
        .bind(obs.payment_block_number as i64)
        .bind(obs.observed_at.to_rfc3339())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_payment_observation(
        &self,
        event_id: &str,
    ) -> Result<Option<PaymentObservation>, sqlx::Error> {
        let row: Option<(String, String, i64, String)> = sqlx::query_as(
            "SELECT event_id, payment_tx_hash, payment_block_number, observed_at FROM payment_observations WHERE event_id = ?",
        )
        .bind(event_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(
            |(event_id, payment_tx_hash, payment_block_number, observed_at)| PaymentObservation {
                event_id,
                payment_tx_hash,
                payment_block_number: payment_block_number as u64,
                observed_at: DateTime::parse_from_rfc3339(&observed_at)
                    .unwrap()
                    .with_timezone(&Utc),
            },
        ))
    }

    pub async fn get_payment_observation_by_tx(
        &self,
        tx_hash: &str,
    ) -> Result<Option<PaymentObservation>, sqlx::Error> {
        let row: Option<(String, String, i64, String)> = sqlx::query_as(
            "SELECT event_id, payment_tx_hash, payment_block_number, observed_at FROM payment_observations WHERE payment_tx_hash = ?",
        )
        .bind(tx_hash)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(
            |(event_id, payment_tx_hash, payment_block_number, observed_at)| PaymentObservation {
                event_id,
                payment_tx_hash,
                payment_block_number: payment_block_number as u64,
                observed_at: DateTime::parse_from_rfc3339(&observed_at)
                    .unwrap()
                    .with_timezone(&Utc),
            },
        ))
    }

    pub async fn store_active_event(&self, event: &ActiveEvent) -> Result<(), sqlx::Error> {
        let window_json = event
            .window
            .as_ref()
            .map(|w| serde_json::to_string(w).unwrap());
        sqlx::query(
            "INSERT OR REPLACE INTO active_events (event_id, metadata_json, creator_address, payment_tx_hash, payment_block_number, activated_at, window_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&event.event_id)
        .bind(serde_json::to_string(&event.metadata).unwrap())
        .bind(&event.creator_address)
        .bind(&event.payment_tx_hash)
        .bind(event.payment_block_number as i64)
        .bind(event.activated_at.to_rfc3339())
        .bind(window_json)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_active_event(
        &self,
        event_id: &str,
    ) -> Result<Option<ActiveEvent>, sqlx::Error> {
        let row: Option<EventRow> = sqlx::query_as(
            "SELECT event_id, metadata_json, creator_address, payment_tx_hash, payment_block_number, activated_at, window_json FROM active_events WHERE event_id = ?",
        )
        .bind(event_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(
            |(
                event_id,
                metadata_json,
                creator_address,
                payment_tx_hash,
                payment_block_number,
                activated_at,
                window_json,
            )| {
                ActiveEvent {
                    event_id,
                    metadata: serde_json::from_str(&metadata_json).unwrap(),
                    creator_address,
                    payment_tx_hash,
                    payment_block_number: payment_block_number as u64,
                    activated_at: DateTime::parse_from_rfc3339(&activated_at)
                        .unwrap()
                        .with_timezone(&Utc),
                    window: window_json.map(|w| serde_json::from_str(&w).unwrap()),
                }
            },
        ))
    }

    /// Look up an active event by prefix of its event_id.
    /// Returns the event if exactly one match is found.
    /// Returns an error if multiple events match (ambiguous prefix).
    pub async fn get_active_event_by_prefix(
        &self,
        prefix: &str,
    ) -> Result<Option<ActiveEvent>, sqlx::Error> {
        let pattern = format!("{}%", prefix);
        let rows: Vec<EventRow> = sqlx::query_as(
            "SELECT event_id, metadata_json, creator_address, payment_tx_hash, payment_block_number, activated_at, window_json FROM active_events WHERE event_id LIKE ? LIMIT 2",
        )
        .bind(&pattern)
        .fetch_all(&self.pool)
        .await?;

        if rows.len() > 1 {
            // Ambiguous prefix - caller should handle this
            return Ok(None);
        }

        Ok(rows.into_iter().next().map(
            |(
                event_id,
                metadata_json,
                creator_address,
                payment_tx_hash,
                payment_block_number,
                activated_at,
                window_json,
            )| {
                ActiveEvent {
                    event_id,
                    metadata: serde_json::from_str(&metadata_json).unwrap(),
                    creator_address,
                    payment_tx_hash,
                    payment_block_number: payment_block_number as u64,
                    activated_at: DateTime::parse_from_rfc3339(&activated_at)
                        .unwrap()
                        .with_timezone(&Utc),
                    window: window_json.map(|w| serde_json::from_str(&w).unwrap()),
                }
            },
        ))
    }

    pub async fn list_active_events(&self) -> Result<Vec<ActiveEvent>, sqlx::Error> {
        let rows: Vec<EventRow> = sqlx::query_as(
            "SELECT event_id, metadata_json, creator_address, payment_tx_hash, payment_block_number, activated_at, window_json FROM active_events",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    event_id,
                    metadata_json,
                    creator_address,
                    payment_tx_hash,
                    payment_block_number,
                    activated_at,
                    window_json,
                )| {
                    ActiveEvent {
                        event_id,
                        metadata: serde_json::from_str(&metadata_json).unwrap(),
                        creator_address,
                        payment_tx_hash,
                        payment_block_number: payment_block_number as u64,
                        activated_at: DateTime::parse_from_rfc3339(&activated_at)
                            .unwrap()
                            .with_timezone(&Utc),
                        window: window_json.map(|w| serde_json::from_str(&w).unwrap()),
                    }
                },
            )
            .collect())
    }

    pub async fn update_event_window(
        &self,
        event_id: &str,
        window: &WindowProof,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE active_events SET window_json = ? WHERE event_id = ?")
            .bind(serde_json::to_string(window).unwrap())
            .bind(event_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn check_qr_replay(
        &self,
        event_id: &str,
        timestamp: i64,
    ) -> Result<bool, sqlx::Error> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM qr_replay_log WHERE event_id = ? AND timestamp = ?",
        )
        .bind(event_id)
        .bind(timestamp)
        .fetch_one(&self.pool)
        .await?;
        Ok(count.0 > 0)
    }

    pub async fn record_qr_usage(&self, event_id: &str, timestamp: i64) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT OR IGNORE INTO qr_replay_log (event_id, timestamp, used_at) VALUES (?, ?, ?)",
        )
        .bind(event_id)
        .bind(timestamp)
        .bind(Utc::now().to_rfc3339())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn cleanup_expired_replay_log(
        &self,
        before: DateTime<Utc>,
    ) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM qr_replay_log WHERE used_at < ?")
            .bind(before.to_rfc3339())
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }

    pub async fn store_badge_observation(
        &self,
        badge: &BadgeObservation,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT OR REPLACE INTO badge_observations (event_id, holder_address, mint_tx_hash, mint_block_number, verified_at_block, observed_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&badge.event_id)
        .bind(&badge.holder_address)
        .bind(&badge.mint_tx_hash)
        .bind(badge.mint_block_number as i64)
        .bind(badge.verified_at_block as i64)
        .bind(badge.observed_at.to_rfc3339())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_badges_by_address(
        &self,
        address: &str,
    ) -> Result<Vec<BadgeObservation>, sqlx::Error> {
        let rows: Vec<(String, String, String, i64, i64, String)> = sqlx::query_as(
            "SELECT event_id, holder_address, mint_tx_hash, mint_block_number, verified_at_block, observed_at FROM badge_observations WHERE holder_address = ?",
        )
        .bind(address)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    event_id,
                    holder_address,
                    mint_tx_hash,
                    mint_block_number,
                    verified_at_block,
                    observed_at,
                )| {
                    BadgeObservation {
                        event_id,
                        holder_address,
                        mint_tx_hash,
                        mint_block_number: mint_block_number as u64,
                        verified_at_block: verified_at_block as u64,
                        observed_at: DateTime::parse_from_rfc3339(&observed_at)
                            .unwrap()
                            .with_timezone(&Utc),
                    }
                },
            )
            .collect())
    }

    pub async fn get_badges_by_event(
        &self,
        event_id: &str,
    ) -> Result<Vec<BadgeObservation>, sqlx::Error> {
        let rows: Vec<(String, String, String, i64, i64, String)> = sqlx::query_as(
            "SELECT event_id, holder_address, mint_tx_hash, mint_block_number, verified_at_block, observed_at FROM badge_observations WHERE event_id = ?",
        )
        .bind(event_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    event_id,
                    holder_address,
                    mint_tx_hash,
                    mint_block_number,
                    verified_at_block,
                    observed_at,
                )| {
                    BadgeObservation {
                        event_id,
                        holder_address,
                        mint_tx_hash,
                        mint_block_number: mint_block_number as u64,
                        verified_at_block: verified_at_block as u64,
                        observed_at: DateTime::parse_from_rfc3339(&observed_at)
                            .unwrap()
                            .with_timezone(&Utc),
                    }
                },
            )
            .collect())
    }

    /// Return all badges with `mint_block_number = 0` (pending confirmation).
    pub async fn get_pending_badges(&self) -> Result<Vec<BadgeObservation>, sqlx::Error> {
        let rows: Vec<(String, String, String, i64, i64, String)> = sqlx::query_as(
            "SELECT event_id, holder_address, mint_tx_hash, mint_block_number, verified_at_block, observed_at FROM badge_observations WHERE mint_block_number = 0",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    event_id,
                    holder_address,
                    mint_tx_hash,
                    mint_block_number,
                    verified_at_block,
                    observed_at,
                )| {
                    BadgeObservation {
                        event_id,
                        holder_address,
                        mint_tx_hash,
                        mint_block_number: mint_block_number as u64,
                        verified_at_block: verified_at_block as u64,
                        observed_at: DateTime::parse_from_rfc3339(&observed_at)
                            .unwrap()
                            .with_timezone(&Utc),
                    }
                },
            )
            .collect())
    }

    /// Update the block number for a confirmed badge transaction.
    pub async fn update_badge_block_number(
        &self,
        tx_hash: &str,
        block_number: u64,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE badge_observations SET mint_block_number = ?, verified_at_block = ? WHERE mint_tx_hash = ?",
        )
        .bind(block_number as i64)
        .bind(block_number as i64)
        .bind(tx_hash)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Return all event IDs from active_events.
    pub async fn list_all_event_ids(&self) -> Result<Vec<String>, sqlx::Error> {
        let rows: Vec<(String,)> = sqlx::query_as("SELECT event_id FROM active_events")
            .fetch_all(&self.pool)
            .await?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    pub async fn is_available(&self) -> bool {
        sqlx::query("SELECT 1").fetch_one(&self.pool).await.is_ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::*;

    async fn test_cache() -> Cache {
        Cache::new("sqlite::memory:")
            .await
            .expect("in-memory cache")
    }

    fn test_metadata() -> EventMetadata {
        EventMetadata {
            name: "Test Event".to_string(),
            description: "A test event".to_string(),
            image_url: None,
            location: Some("NYC".to_string()),
            start_time: None,
            end_time: None,
            scope_kind: None,
            participation_mode: None,
        }
    }

    fn test_preimage() -> EventIdPreimage {
        EventIdPreimage {
            creator_address: "ckt1qaddr".to_string(),
            timestamp: 1700000000,
            nonce: "test_nonce".to_string(),
        }
    }

    fn test_intent() -> PaymentIntent {
        PaymentIntent {
            event_id_preimage: test_preimage(),
            creator_address: "ckt1qaddr".to_string(),
            creator_signature: "0xsig".to_string(),
            event_metadata: test_metadata(),
            declared_at: Utc::now(),
            expires_at: Utc::now() + chrono::Duration::hours(24),
        }
    }

    // --- Health ---

    #[tokio::test]
    async fn test_cache_is_available() {
        let cache = test_cache().await;
        assert!(cache.is_available().await);
    }

    // --- Payment Intents ---

    #[tokio::test]
    async fn test_store_and_get_payment_intent() {
        let cache = test_cache().await;
        let intent = test_intent();
        let event_id = intent.event_id_preimage.compute_event_id();

        cache.store_payment_intent(&intent).await.unwrap();
        let loaded = cache.get_payment_intent(&event_id).await.unwrap();
        assert!(loaded.is_some());
        let loaded = loaded.unwrap();
        assert_eq!(loaded.creator_address, "ckt1qaddr");
    }

    #[tokio::test]
    async fn test_get_nonexistent_intent() {
        let cache = test_cache().await;
        let loaded = cache.get_payment_intent("nonexistent").await.unwrap();
        assert!(loaded.is_none());
    }

    // --- Payment Observations ---

    #[tokio::test]
    async fn test_store_and_get_payment_observation() {
        let cache = test_cache().await;
        let obs = PaymentObservation {
            event_id: "evt1".to_string(),
            payment_tx_hash: "0xtx1".to_string(),
            payment_block_number: 100,
            observed_at: Utc::now(),
        };

        cache.store_payment_observation(&obs).await.unwrap();
        let loaded = cache.get_payment_observation("evt1").await.unwrap();
        assert!(loaded.is_some());
        let loaded = loaded.unwrap();
        assert_eq!(loaded.payment_block_number, 100);
        assert_eq!(loaded.payment_tx_hash, "0xtx1");
    }

    // --- Active Events ---

    #[tokio::test]
    async fn test_store_and_get_active_event() {
        let cache = test_cache().await;
        let event = ActiveEvent {
            event_id: "evt1".to_string(),
            metadata: test_metadata(),
            creator_address: "ckt1q".to_string(),
            payment_tx_hash: "0xtx".to_string(),
            payment_block_number: 200,
            activated_at: Utc::now(),
            window: None,
        };

        cache.store_active_event(&event).await.unwrap();
        let loaded = cache.get_active_event("evt1").await.unwrap();
        assert!(loaded.is_some());
        let loaded = loaded.unwrap();
        assert_eq!(loaded.metadata.name, "Test Event");
        assert!(loaded.window.is_none());
    }

    #[tokio::test]
    async fn test_list_active_events() {
        let cache = test_cache().await;

        for i in 0..3 {
            let event = ActiveEvent {
                event_id: format!("evt{}", i),
                metadata: test_metadata(),
                creator_address: "ckt1q".to_string(),
                payment_tx_hash: format!("0xtx{}", i),
                payment_block_number: 100 + i as u64,
                activated_at: Utc::now(),
                window: None,
            };
            cache.store_active_event(&event).await.unwrap();
        }

        let events = cache.list_active_events().await.unwrap();
        assert_eq!(events.len(), 3);
    }

    #[tokio::test]
    async fn test_update_event_window() {
        let cache = test_cache().await;
        let event = ActiveEvent {
            event_id: "evt1".to_string(),
            metadata: test_metadata(),
            creator_address: "ckt1q".to_string(),
            payment_tx_hash: "0xtx".to_string(),
            payment_block_number: 200,
            activated_at: Utc::now(),
            window: None,
        };
        cache.store_active_event(&event).await.unwrap();

        let window = WindowProof {
            event_id: "evt1".to_string(),
            window_start: Utc::now().timestamp(),
            window_end: None,
            creator_signature: "0xsig".to_string(),
            window_secret_commitment: "commit".to_string(),
        };
        cache.update_event_window("evt1", &window).await.unwrap();

        let loaded = cache.get_active_event("evt1").await.unwrap().unwrap();
        assert!(loaded.window.is_some());
        assert_eq!(loaded.window.unwrap().creator_signature, "0xsig");
    }

    // --- Badge Observations ---

    #[tokio::test]
    async fn test_store_and_get_badges_by_address() {
        let cache = test_cache().await;
        let badge = BadgeObservation {
            event_id: "evt1".to_string(),
            holder_address: "ckt1qholder".to_string(),
            mint_tx_hash: "0xminttx".to_string(),
            mint_block_number: 300,
            verified_at_block: 301,
            observed_at: Utc::now(),
        };

        cache.store_badge_observation(&badge).await.unwrap();
        let badges = cache.get_badges_by_address("ckt1qholder").await.unwrap();
        assert_eq!(badges.len(), 1);
        assert_eq!(badges[0].mint_block_number, 300);
    }

    #[tokio::test]
    async fn test_get_badges_by_event() {
        let cache = test_cache().await;
        for i in 0..3 {
            let badge = BadgeObservation {
                event_id: "evt1".to_string(),
                holder_address: format!("addr{}", i),
                mint_tx_hash: format!("0xtx{}", i),
                mint_block_number: 300 + i as u64,
                verified_at_block: 301,
                observed_at: Utc::now(),
            };
            cache.store_badge_observation(&badge).await.unwrap();
        }

        let badges = cache.get_badges_by_event("evt1").await.unwrap();
        assert_eq!(badges.len(), 3);
    }

    #[tokio::test]
    async fn test_badge_uniqueness_by_event_and_address() {
        let cache = test_cache().await;
        let badge = BadgeObservation {
            event_id: "evt1".to_string(),
            holder_address: "addr1".to_string(),
            mint_tx_hash: "0xtx1".to_string(),
            mint_block_number: 300,
            verified_at_block: 301,
            observed_at: Utc::now(),
        };
        cache.store_badge_observation(&badge).await.unwrap();

        // Store again with updated tx_hash — should replace (PRIMARY KEY)
        let badge2 = BadgeObservation {
            event_id: "evt1".to_string(),
            holder_address: "addr1".to_string(),
            mint_tx_hash: "0xtx2_updated".to_string(),
            mint_block_number: 305,
            verified_at_block: 306,
            observed_at: Utc::now(),
        };
        cache.store_badge_observation(&badge2).await.unwrap();

        let badges = cache.get_badges_by_event("evt1").await.unwrap();
        assert_eq!(badges.len(), 1);
        assert_eq!(badges[0].mint_tx_hash, "0xtx2_updated");
    }

    // --- QR Replay ---

    #[tokio::test]
    async fn test_qr_replay_detection() {
        let cache = test_cache().await;
        let event_id = "evt1";
        let timestamp = 1700000000i64;

        assert!(!cache.check_qr_replay(event_id, timestamp).await.unwrap());

        cache.record_qr_usage(event_id, timestamp).await.unwrap();

        assert!(cache.check_qr_replay(event_id, timestamp).await.unwrap());
    }

    #[tokio::test]
    async fn test_qr_replay_different_timestamps_are_independent() {
        let cache = test_cache().await;
        cache.record_qr_usage("evt1", 1000).await.unwrap();
        assert!(cache.check_qr_replay("evt1", 1000).await.unwrap());
        assert!(!cache.check_qr_replay("evt1", 1001).await.unwrap());
    }

    #[tokio::test]
    async fn test_cleanup_expired_replay_log() {
        let cache = test_cache().await;
        cache.record_qr_usage("evt1", 1000).await.unwrap();
        cache.record_qr_usage("evt1", 2000).await.unwrap();

        let deleted = cache
            .cleanup_expired_replay_log(Utc::now() + chrono::Duration::hours(1))
            .await
            .unwrap();
        assert_eq!(deleted, 2);

        assert!(!cache.check_qr_replay("evt1", 1000).await.unwrap());
    }

    // --- Prefix Lookup ---

    #[tokio::test]
    async fn test_get_active_event_by_prefix_exact_match() {
        let cache = test_cache().await;
        let event = ActiveEvent {
            event_id: "abcdef1234567890".to_string(),
            metadata: test_metadata(),
            creator_address: "ckt1q".to_string(),
            payment_tx_hash: "0xtx".to_string(),
            payment_block_number: 200,
            activated_at: Utc::now(),
            window: None,
        };
        cache.store_active_event(&event).await.unwrap();

        let loaded = cache.get_active_event_by_prefix("abcdef").await.unwrap();
        assert!(loaded.is_some());
        assert_eq!(loaded.unwrap().event_id, "abcdef1234567890");
    }

    #[tokio::test]
    async fn test_get_active_event_by_prefix_no_match() {
        let cache = test_cache().await;
        let event = ActiveEvent {
            event_id: "abcdef1234567890".to_string(),
            metadata: test_metadata(),
            creator_address: "ckt1q".to_string(),
            payment_tx_hash: "0xtx".to_string(),
            payment_block_number: 200,
            activated_at: Utc::now(),
            window: None,
        };
        cache.store_active_event(&event).await.unwrap();

        let loaded = cache.get_active_event_by_prefix("zzz").await.unwrap();
        assert!(loaded.is_none());
    }

    // --- Pending Badges ---

    #[tokio::test]
    async fn test_get_pending_badges() {
        let cache = test_cache().await;
        // Pending badge (block_number = 0)
        let pending = BadgeObservation {
            event_id: "evt1".to_string(),
            holder_address: "addr_pending".to_string(),
            mint_tx_hash: "0xtx_pending".to_string(),
            mint_block_number: 0,
            verified_at_block: 0,
            observed_at: Utc::now(),
        };
        // Confirmed badge (block_number > 0)
        let confirmed = BadgeObservation {
            event_id: "evt1".to_string(),
            holder_address: "addr_confirmed".to_string(),
            mint_tx_hash: "0xtx_confirmed".to_string(),
            mint_block_number: 500,
            verified_at_block: 501,
            observed_at: Utc::now(),
        };
        cache.store_badge_observation(&pending).await.unwrap();
        cache.store_badge_observation(&confirmed).await.unwrap();

        let pending_badges = cache.get_pending_badges().await.unwrap();
        assert_eq!(pending_badges.len(), 1);
        assert_eq!(pending_badges[0].mint_tx_hash, "0xtx_pending");
    }

    #[tokio::test]
    async fn test_update_badge_block_number() {
        let cache = test_cache().await;
        let badge = BadgeObservation {
            event_id: "evt1".to_string(),
            holder_address: "addr1".to_string(),
            mint_tx_hash: "0xtx1".to_string(),
            mint_block_number: 0,
            verified_at_block: 0,
            observed_at: Utc::now(),
        };
        cache.store_badge_observation(&badge).await.unwrap();

        cache.update_badge_block_number("0xtx1", 42).await.unwrap();

        let badges = cache.get_badges_by_event("evt1").await.unwrap();
        assert_eq!(badges.len(), 1);
        assert_eq!(badges[0].mint_block_number, 42);
        assert_eq!(badges[0].verified_at_block, 42);

        // Should no longer be pending
        let pending = cache.get_pending_badges().await.unwrap();
        assert!(pending.is_empty());
    }

    #[tokio::test]
    async fn test_get_active_event_by_prefix_ambiguous() {
        let cache = test_cache().await;
        for suffix in &["aaa", "bbb"] {
            let event = ActiveEvent {
                event_id: format!("abc{}", suffix),
                metadata: test_metadata(),
                creator_address: "ckt1q".to_string(),
                payment_tx_hash: "0xtx".to_string(),
                payment_block_number: 200,
                activated_at: Utc::now(),
                window: None,
            };
            cache.store_active_event(&event).await.unwrap();
        }

        // "abc" matches both "abcaaa" and "abcbbb" — returns None (ambiguous)
        let loaded = cache.get_active_event_by_prefix("abc").await.unwrap();
        assert!(loaded.is_none());
    }
}
