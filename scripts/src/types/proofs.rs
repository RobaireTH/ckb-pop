use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ScopeKind {
    Event,
    Hackathon,
    Program,
    Course,
    Campaign,
    Bounty,
    Membership,
    Custom,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ParticipationMode {
    InPerson,
    Online,
    Hybrid,
    Async,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QrPayload {
    pub event_id: String,
    pub timestamp: i64,
    pub hmac: String,
}

impl QrPayload {
    pub fn parse(data: &str) -> Option<Self> {
        let parts: Vec<&str> = data.split('|').collect();
        if parts.len() != 3 {
            return None;
        }
        Some(Self {
            event_id: parts[0].to_string(),
            timestamp: parts[1].parse().ok()?,
            hmac: parts[2].to_string(),
        })
    }

    pub fn encode(&self) -> String {
        format!("{}|{}|{}", self.event_id, self.timestamp, self.hmac)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AttendanceProof {
    pub event_id: String,
    pub attendee_address: String,
    pub qr_payload: QrPayload,
    pub attendee_signature: String,
    pub created_at: i64,
}

impl AttendanceProof {
    pub fn message_to_sign(event_id: &str, qr_timestamp: i64, attendee_address: &str) -> String {
        format!("CKB-PoP|{}|{}|{}", event_id, qr_timestamp, attendee_address)
    }

    pub fn signed_message(&self) -> String {
        Self::message_to_sign(
            &self.event_id,
            self.qr_payload.timestamp,
            &self.attendee_address,
        )
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WindowProof {
    pub event_id: String,
    pub window_start: i64,
    pub window_end: Option<i64>,
    pub creator_signature: String,
    pub window_secret_commitment: String,
}

impl WindowProof {
    pub fn is_open(&self) -> bool {
        let now = Utc::now().timestamp();
        now >= self.window_start && self.window_end.is_none_or(|end| now < end)
    }

    pub fn message_to_sign(event_id: &str, window_start: i64, window_end: Option<i64>) -> String {
        match window_end {
            Some(end) => format!("CKB-PoP-Window|{}|{}|{}", event_id, window_start, end),
            None => format!("CKB-PoP-Window|{}|{}|open", event_id, window_start),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EventMetadata {
    pub name: String,
    pub description: String,
    pub image_url: Option<String>,
    pub location: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub scope_kind: Option<ScopeKind>,
    pub participation_mode: Option<ParticipationMode>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EventIdPreimage {
    pub creator_address: String,
    pub timestamp: i64,
    pub nonce: String,
}

impl EventIdPreimage {
    pub fn compute_event_id(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(self.creator_address.as_bytes());
        hasher.update(self.timestamp.to_le_bytes());
        hasher.update(self.nonce.as_bytes());
        hex::encode(hasher.finalize())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PaymentIntent {
    pub event_id_preimage: EventIdPreimage,
    pub creator_address: String,
    pub creator_signature: String,
    pub event_metadata: EventMetadata,
    pub declared_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PaymentObservation {
    pub event_id: String,
    pub payment_tx_hash: String,
    pub payment_block_number: u64,
    pub observed_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ActiveEvent {
    pub event_id: String,
    pub metadata: EventMetadata,
    pub creator_address: String,
    pub payment_tx_hash: String,
    pub payment_block_number: u64,
    pub activated_at: DateTime<Utc>,
    pub window: Option<WindowProof>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BadgeObservation {
    pub event_id: String,
    pub holder_address: String,
    pub mint_tx_hash: String,
    pub mint_block_number: u64,
    pub verified_at_block: u64,
    pub observed_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SignedClaimProof {
    #[serde(alias = "scopeId", alias = "scope_id")]
    pub event_id: String,
    #[serde(alias = "recipientAddress")]
    pub recipient_address: String,
    #[serde(alias = "claimId")]
    pub claim_id: String,
    #[serde(alias = "proofDriver")]
    pub proof_driver: String,
    #[serde(alias = "proofRef")]
    pub proof_ref: String,
    #[serde(alias = "issuerAddress")]
    pub issuer_address: String,
    #[serde(alias = "issuedAt")]
    pub issued_at: i64,
    #[serde(alias = "expiresAt")]
    pub expires_at: Option<i64>,
    #[serde(alias = "issuerSignature")]
    pub issuer_signature: String,
}

impl SignedClaimProof {
    pub fn message_to_sign(
        event_id: &str,
        recipient_address: &str,
        claim_id: &str,
        proof_driver: &str,
        proof_ref: &str,
        issued_at: i64,
        expires_at: Option<i64>,
    ) -> String {
        let expires = expires_at
            .map(|value| value.to_string())
            .unwrap_or_else(|| "open".to_string());
        format!(
            "CKB-PoP-Claim|{}|{}|{}|{}|{}|{}|{}",
            event_id, recipient_address, claim_id, proof_driver, proof_ref, issued_at, expires
        )
    }

    pub fn signed_message(&self) -> String {
        Self::message_to_sign(
            &self.event_id,
            &self.recipient_address,
            &self.claim_id,
            &self.proof_driver,
            &self.proof_ref,
            self.issued_at,
            self.expires_at,
        )
    }

    pub fn encode_token(&self) -> String {
        use base64::Engine;
        base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(serde_json::to_vec(self).expect("claim proof should serialize"))
    }

    pub fn parse_token(data: &str) -> Option<Self> {
        use base64::Engine;
        let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(data)
            .ok()?;
        serde_json::from_slice(&bytes).ok()
    }

    pub fn is_expired(&self, now: i64) -> bool {
        self.expires_at.is_some_and(|expires| now > expires)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QrResponse {
    pub qr_data: String,
    pub ttl_seconds: u32,
    pub expires_at: i64,
    pub window_end: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub ckb_rpc: String,
    pub cache: String,
    pub last_block_observed: Option<u64>,
    pub note: String,
}

impl Default for HealthResponse {
    fn default() -> Self {
        Self {
            status: "operational".to_string(),
            ckb_rpc: "unknown".to_string(),
            cache: "unknown".to_string(),
            last_block_observed: None,
            note: "This backend is non-authoritative. Protocol functions without it.".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- QrPayload ---

    #[test]
    fn test_qr_payload_parse_valid() {
        let payload = QrPayload::parse("EVT001|1700000000|abcdef1234567890").unwrap();
        assert_eq!(payload.event_id, "EVT001");
        assert_eq!(payload.timestamp, 1700000000);
        assert_eq!(payload.hmac, "abcdef1234567890");
    }

    #[test]
    fn test_qr_payload_parse_too_few_parts() {
        assert!(QrPayload::parse("EVT001|1700000000").is_none());
    }

    #[test]
    fn test_qr_payload_parse_too_many_parts() {
        assert!(QrPayload::parse("a|b|c|d").is_none());
    }

    #[test]
    fn test_qr_payload_parse_non_integer_timestamp() {
        assert!(QrPayload::parse("EVT001|notanumber|hmac").is_none());
    }

    #[test]
    fn test_qr_payload_encode_roundtrip() {
        let original = QrPayload {
            event_id: "TEST".to_string(),
            timestamp: 12345,
            hmac: "abcd".to_string(),
        };
        let encoded = original.encode();
        assert_eq!(encoded, "TEST|12345|abcd");
        let parsed = QrPayload::parse(&encoded).unwrap();
        assert_eq!(parsed.event_id, original.event_id);
        assert_eq!(parsed.timestamp, original.timestamp);
        assert_eq!(parsed.hmac, original.hmac);
    }

    // --- AttendanceProof ---

    #[test]
    fn test_attendance_proof_message_format() {
        let msg = AttendanceProof::message_to_sign("EVT001", 1700000000, "ckt1qaddress");
        assert_eq!(msg, "CKB-PoP|EVT001|1700000000|ckt1qaddress");
    }

    #[test]
    fn test_attendance_proof_signed_message() {
        let proof = AttendanceProof {
            event_id: "EVT001".to_string(),
            attendee_address: "ckt1qaddr".to_string(),
            qr_payload: QrPayload {
                event_id: "EVT001".to_string(),
                timestamp: 1700000000,
                hmac: "hmac".to_string(),
            },
            attendee_signature: "sig".to_string(),
            created_at: 1700000005,
        };
        assert_eq!(
            proof.signed_message(),
            "CKB-PoP|EVT001|1700000000|ckt1qaddr"
        );
    }

    // --- WindowProof ---

    #[test]
    fn test_window_proof_is_open_within_range() {
        let now = Utc::now().timestamp();
        let window = WindowProof {
            event_id: "EVT001".to_string(),
            window_start: now - 100,
            window_end: Some(now + 100),
            creator_signature: "sig".to_string(),
            window_secret_commitment: "commit".to_string(),
        };
        assert!(window.is_open());
    }

    #[test]
    fn test_window_proof_is_open_no_end() {
        let now = Utc::now().timestamp();
        let window = WindowProof {
            event_id: "EVT001".to_string(),
            window_start: now - 100,
            window_end: None,
            creator_signature: "sig".to_string(),
            window_secret_commitment: "commit".to_string(),
        };
        assert!(window.is_open());
    }

    #[test]
    fn test_window_proof_is_closed_past_end() {
        let now = Utc::now().timestamp();
        let window = WindowProof {
            event_id: "EVT001".to_string(),
            window_start: now - 200,
            window_end: Some(now - 100),
            creator_signature: "sig".to_string(),
            window_secret_commitment: "commit".to_string(),
        };
        assert!(!window.is_open());
    }

    #[test]
    fn test_window_proof_is_closed_before_start() {
        let now = Utc::now().timestamp();
        let window = WindowProof {
            event_id: "EVT001".to_string(),
            window_start: now + 100,
            window_end: Some(now + 200),
            creator_signature: "sig".to_string(),
            window_secret_commitment: "commit".to_string(),
        };
        assert!(!window.is_open());
    }

    #[test]
    fn test_window_proof_message_to_sign_with_end() {
        let msg = WindowProof::message_to_sign("EVT001", 1000, Some(2000));
        assert_eq!(msg, "CKB-PoP-Window|EVT001|1000|2000");
    }

    #[test]
    fn test_window_proof_message_to_sign_open_end() {
        let msg = WindowProof::message_to_sign("EVT001", 1000, None);
        assert_eq!(msg, "CKB-PoP-Window|EVT001|1000|open");
    }

    // --- EventIdPreimage ---

    #[test]
    fn test_event_id_preimage_deterministic() {
        let p = EventIdPreimage {
            creator_address: "ckt1qaddr".to_string(),
            timestamp: 1700000000,
            nonce: "abc123".to_string(),
        };
        let id1 = p.compute_event_id();
        let id2 = p.compute_event_id();
        assert_eq!(id1, id2);
        assert_eq!(id1.len(), 64); // SHA256 hex = 64 chars
    }

    #[test]
    fn test_event_id_preimage_differs_by_nonce() {
        let p1 = EventIdPreimage {
            creator_address: "ckt1q".to_string(),
            timestamp: 1700000000,
            nonce: "aaa".to_string(),
        };
        let p2 = EventIdPreimage {
            creator_address: "ckt1q".to_string(),
            timestamp: 1700000000,
            nonce: "bbb".to_string(),
        };
        assert_ne!(p1.compute_event_id(), p2.compute_event_id());
    }

    #[test]
    fn test_event_id_preimage_differs_by_address() {
        let p1 = EventIdPreimage {
            creator_address: "addr_a".to_string(),
            timestamp: 1700000000,
            nonce: "n".to_string(),
        };
        let p2 = EventIdPreimage {
            creator_address: "addr_b".to_string(),
            timestamp: 1700000000,
            nonce: "n".to_string(),
        };
        assert_ne!(p1.compute_event_id(), p2.compute_event_id());
    }

    // --- Serialization round-trips ---

    #[test]
    fn test_event_metadata_json_roundtrip() {
        let meta = EventMetadata {
            name: "Test Event".to_string(),
            description: "A test".to_string(),
            image_url: Some("https://example.com/img.png".to_string()),
            location: Some("NYC".to_string()),
            start_time: Some(Utc::now()),
            end_time: None,
            scope_kind: Some(ScopeKind::Hackathon),
            participation_mode: Some(ParticipationMode::Online),
        };
        let json = serde_json::to_string(&meta).unwrap();
        let parsed: EventMetadata = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.name, "Test Event");
        assert_eq!(parsed.location, Some("NYC".to_string()));
        assert!(parsed.end_time.is_none());
        assert_eq!(parsed.scope_kind, Some(ScopeKind::Hackathon));
        assert_eq!(parsed.participation_mode, Some(ParticipationMode::Online));
    }

    #[test]
    fn test_badge_observation_json_roundtrip() {
        let badge = BadgeObservation {
            event_id: "EVT001".to_string(),
            holder_address: "ckt1qaddr".to_string(),
            mint_tx_hash: "0xabc".to_string(),
            mint_block_number: 12345,
            verified_at_block: 12346,
            observed_at: Utc::now(),
        };
        let json = serde_json::to_string(&badge).unwrap();
        let parsed: BadgeObservation = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.event_id, "EVT001");
        assert_eq!(parsed.mint_block_number, 12345);
    }

    #[test]
    fn test_health_response_default() {
        let h = HealthResponse::default();
        assert_eq!(h.status, "operational");
        assert_eq!(h.ckb_rpc, "unknown");
        assert!(h.last_block_observed.is_none());
    }

    #[test]
    fn test_signed_claim_proof_message_format() {
        let msg = SignedClaimProof::message_to_sign(
            "hack-1",
            "ckt1qaddress",
            "claim-1",
            "signed-claim",
            "submission-42",
            1700000000,
            Some(1700003600),
        );
        assert_eq!(
            msg,
            "CKB-PoP-Claim|hack-1|ckt1qaddress|claim-1|signed-claim|submission-42|1700000000|1700003600"
        );
    }

    #[test]
    fn test_signed_claim_proof_token_roundtrip() {
        let proof = SignedClaimProof {
            event_id: "hack-1".to_string(),
            recipient_address: "ckt1qaddress".to_string(),
            claim_id: "claim-1".to_string(),
            proof_driver: "signed-claim".to_string(),
            proof_ref: "submission-42".to_string(),
            issuer_address: "ckt1issuer".to_string(),
            issued_at: 1700000000,
            expires_at: Some(1700003600),
            issuer_signature: "0xsig".to_string(),
        };

        let token = proof.encode_token();
        let parsed = SignedClaimProof::parse_token(&token).unwrap();
        assert_eq!(parsed.claim_id, proof.claim_id);
        assert_eq!(parsed.recipient_address, proof.recipient_address);
        assert_eq!(parsed.proof_ref, proof.proof_ref);
    }
}
