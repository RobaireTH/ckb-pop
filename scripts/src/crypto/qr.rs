use chrono::Utc;
use hmac::{Hmac, Mac};
use sha2::Sha256;

use crate::types::QrPayload;

type HmacSha256 = Hmac<Sha256>;

const QR_TTL_SECONDS: i64 = 30;

pub fn derive_window_secret(event_id: &str, window_start: i64, creator_sig: &str) -> [u8; 32] {
    use sha2::Digest;
    let mut hasher = Sha256::new();
    hasher.update(event_id.as_bytes());
    hasher.update(window_start.to_le_bytes());
    hasher.update(creator_sig.as_bytes());
    hasher.finalize().into()
}

pub fn generate_qr_hmac(window_secret: &[u8; 32], timestamp: i64) -> String {
    let mut mac = HmacSha256::new_from_slice(window_secret).expect("HMAC accepts any key size");
    mac.update(&timestamp.to_le_bytes());
    hex::encode(mac.finalize().into_bytes())[..16].to_string()
}

pub fn verify_qr_hmac(window_secret: &[u8; 32], timestamp: i64, hmac_value: &str) -> bool {
    let expected = generate_qr_hmac(window_secret, timestamp);
    expected == hmac_value
}

pub fn generate_qr_payload(event_id: &str, window_secret: &[u8; 32]) -> QrPayload {
    let timestamp = Utc::now().timestamp();
    let hmac = generate_qr_hmac(window_secret, timestamp);
    QrPayload {
        event_id: event_id.to_string(),
        timestamp,
        hmac,
    }
}

pub fn validate_qr_freshness(
    qr_timestamp: i64,
    window_start: i64,
    window_end: Option<i64>,
) -> bool {
    let now = Utc::now().timestamp();

    if qr_timestamp < window_start {
        return false;
    }

    if let Some(end) = window_end {
        if qr_timestamp > end {
            return false;
        }
    }

    let age = now - qr_timestamp;
    (0..=QR_TTL_SECONDS * 2).contains(&age)
}

pub fn qr_ttl_seconds() -> u32 {
    QR_TTL_SECONDS as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_window_secret_deterministic() {
        let s1 = derive_window_secret("EVT001", 1700000000, "sig_abc");
        let s2 = derive_window_secret("EVT001", 1700000000, "sig_abc");
        assert_eq!(s1, s2);
    }

    #[test]
    fn test_derive_window_secret_differs_by_event() {
        let s1 = derive_window_secret("EVT001", 1700000000, "sig");
        let s2 = derive_window_secret("EVT002", 1700000000, "sig");
        assert_ne!(s1, s2);
    }

    #[test]
    fn test_derive_window_secret_differs_by_timestamp() {
        let s1 = derive_window_secret("EVT001", 1700000000, "sig");
        let s2 = derive_window_secret("EVT001", 1700000001, "sig");
        assert_ne!(s1, s2);
    }

    #[test]
    fn test_derive_window_secret_differs_by_signature() {
        let s1 = derive_window_secret("EVT001", 1700000000, "sig_a");
        let s2 = derive_window_secret("EVT001", 1700000000, "sig_b");
        assert_ne!(s1, s2);
    }

    #[test]
    fn test_generate_qr_hmac_is_16_hex_chars() {
        let secret = derive_window_secret("EVT001", 1700000000, "sig");
        let hmac = generate_qr_hmac(&secret, 1700000050);
        assert_eq!(hmac.len(), 16);
        assert!(hmac.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_generate_qr_hmac_deterministic() {
        let secret = derive_window_secret("EVT001", 1700000000, "sig");
        let h1 = generate_qr_hmac(&secret, 1700000050);
        let h2 = generate_qr_hmac(&secret, 1700000050);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_generate_qr_hmac_differs_by_timestamp() {
        let secret = derive_window_secret("EVT001", 1700000000, "sig");
        let h1 = generate_qr_hmac(&secret, 1700000050);
        let h2 = generate_qr_hmac(&secret, 1700000051);
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_verify_qr_hmac_valid() {
        let secret = derive_window_secret("EVT001", 1700000000, "sig");
        let ts = 1700000050i64;
        let hmac = generate_qr_hmac(&secret, ts);
        assert!(verify_qr_hmac(&secret, ts, &hmac));
    }

    #[test]
    fn test_verify_qr_hmac_invalid() {
        let secret = derive_window_secret("EVT001", 1700000000, "sig");
        assert!(!verify_qr_hmac(&secret, 1700000050, "badhmacinvalid00"));
    }

    #[test]
    fn test_verify_qr_hmac_wrong_timestamp() {
        let secret = derive_window_secret("EVT001", 1700000000, "sig");
        let hmac = generate_qr_hmac(&secret, 1700000050);
        assert!(!verify_qr_hmac(&secret, 1700000051, &hmac));
    }

    #[test]
    fn test_verify_qr_hmac_wrong_secret() {
        let s1 = derive_window_secret("EVT001", 1700000000, "sig_a");
        let s2 = derive_window_secret("EVT001", 1700000000, "sig_b");
        let hmac = generate_qr_hmac(&s1, 1700000050);
        assert!(!verify_qr_hmac(&s2, 1700000050, &hmac));
    }

    #[test]
    fn test_generate_qr_payload_has_valid_hmac() {
        let secret = derive_window_secret("EVT001", 1700000000, "sig");
        let payload = generate_qr_payload("EVT001", &secret);
        assert_eq!(payload.event_id, "EVT001");
        assert!(verify_qr_hmac(&secret, payload.timestamp, &payload.hmac));
    }

    #[test]
    fn test_validate_qr_freshness_valid() {
        let now = Utc::now().timestamp();
        let window_start = now - 3600;
        assert!(validate_qr_freshness(now, window_start, None));
    }

    #[test]
    fn test_validate_qr_freshness_before_window() {
        let now = Utc::now().timestamp();
        let window_start = now + 3600;
        assert!(!validate_qr_freshness(now - 100, window_start, None));
    }

    #[test]
    fn test_validate_qr_freshness_after_window_end() {
        let now = Utc::now().timestamp();
        let window_start = now - 7200;
        let window_end = Some(now - 3600);
        assert!(!validate_qr_freshness(now, window_start, window_end));
    }

    #[test]
    fn test_validate_qr_freshness_too_old() {
        let now = Utc::now().timestamp();
        let window_start = now - 3600;
        let old_timestamp = now - 120; // 2 minutes old, beyond 60s limit
        assert!(!validate_qr_freshness(old_timestamp, window_start, None));
    }

    #[test]
    fn test_validate_qr_freshness_within_ttl() {
        let now = Utc::now().timestamp();
        let window_start = now - 3600;
        let recent_timestamp = now - 10; // 10 seconds old, within 60s limit
        assert!(validate_qr_freshness(recent_timestamp, window_start, None));
    }

    #[test]
    fn test_qr_ttl_seconds_is_30() {
        assert_eq!(qr_ttl_seconds(), 30);
    }
}
