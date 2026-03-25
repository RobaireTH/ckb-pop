use bech32::FromBase32;
use secp256k1::{ecdsa, Message, Secp256k1};

const CKB_HASH_PERSONALIZATION: &[u8] = b"ckb-default-hash";
const NERVOS_MESSAGE_PREFIX: &str = "Nervos Message:";

// secp256k1-blake160-sighash-all code_hash (mainnet & testnet, hash_type: type)
const SECP256K1_BLAKE160_CODE_HASH: [u8; 32] = [
    0x9b, 0xd7, 0xe0, 0x6f, 0x3e, 0xcf, 0x4b, 0xe0, 0xf2, 0xfc, 0xd2, 0x18, 0x8b, 0x23, 0xf1, 0xb9,
    0xfc, 0xc8, 0x8e, 0x5d, 0x4b, 0x65, 0xa8, 0x63, 0x7b, 0x17, 0x72, 0x3b, 0xbd, 0xa3, 0xcc, 0xe8,
];

// --- Hash functions ---

/// CKB message hash: blake2b("Nervos Message:" + message, personalization="ckb-default-hash").
pub fn hash_message_ckb(message: &str) -> [u8; 32] {
    let prefixed = format!("{}{}", NERVOS_MESSAGE_PREFIX, message);
    ckb_blake2b(prefixed.as_bytes())
}

/// CKB-standard blake2b (32-byte output, "ckb-default-hash" personalization).
fn ckb_blake2b(data: &[u8]) -> [u8; 32] {
    let mut hasher = blake2b_rs::Blake2bBuilder::new(32)
        .personal(CKB_HASH_PERSONALIZATION)
        .build();
    hasher.update(data);
    let mut hash = [0u8; 32];
    hasher.finalize(&mut hash);
    hash
}

/// First 20 bytes of CKB blake2b — derives lock script args from a compressed public key.
fn blake160(data: &[u8]) -> [u8; 20] {
    let hash = ckb_blake2b(data);
    let mut out = [0u8; 20];
    out.copy_from_slice(&hash[..20]);
    out
}

// --- CKB address-based verification ---

/// Verify a CKB secp256k1 recoverable signature against a CKB address.
///
/// Recovers the public key from the signature, computes its blake160 hash,
/// and compares it against the lock script args parsed from the address.
pub fn verify_ckb_address_signature(
    message: &str,
    signature_hex: &str,
    address: &str,
) -> Result<(), SignatureError> {
    let (code_hash, _hash_type, args) = parse_ckb_address(address)?;

    if code_hash != SECP256K1_BLAKE160_CODE_HASH {
        return Err(SignatureError::UnsupportedLockScript);
    }
    if args.len() != 20 {
        return Err(SignatureError::InvalidAddress);
    }

    let sig_hex = signature_hex.strip_prefix("0x").unwrap_or(signature_hex);
    let sig_bytes = hex::decode(sig_hex).map_err(|_| SignatureError::InvalidHex)?;
    if sig_bytes.len() != 65 {
        return Err(SignatureError::InvalidSignature);
    }

    let hash = hash_message_ckb(message);

    let recovery_id = ecdsa::RecoveryId::from_i32(sig_bytes[64] as i32)
        .map_err(|_| SignatureError::InvalidRecoveryId)?;
    let recoverable_sig = ecdsa::RecoverableSignature::from_compact(&sig_bytes[..64], recovery_id)
        .map_err(|_| SignatureError::InvalidSignature)?;

    let secp = Secp256k1::verification_only();
    let msg = Message::from_digest(hash);
    let pubkey = secp
        .recover_ecdsa(&msg, &recoverable_sig)
        .map_err(|_| SignatureError::RecoveryFailed)?;

    let pubkey_hash = blake160(&pubkey.serialize());
    if pubkey_hash[..] != args[..] {
        return Err(SignatureError::SignatureMismatch);
    }

    Ok(())
}

/// Parse a CKB bech32/bech32m address into (code_hash, hash_type, args).
pub fn parse_ckb_address(address: &str) -> Result<([u8; 32], u8, Vec<u8>), SignatureError> {
    let (hrp, data, _variant) =
        bech32::decode(address).map_err(|_| SignatureError::InvalidAddress)?;

    if hrp != "ckb" && hrp != "ckt" {
        return Err(SignatureError::InvalidAddress);
    }

    let payload = Vec::<u8>::from_base32(&data).map_err(|_| SignatureError::InvalidAddress)?;

    if payload.is_empty() {
        return Err(SignatureError::InvalidAddress);
    }

    match payload[0] {
        // Full format: 0x00 | code_hash(32) | hash_type(1) | args
        0x00 => {
            if payload.len() < 34 {
                return Err(SignatureError::InvalidAddress);
            }
            let mut code_hash = [0u8; 32];
            code_hash.copy_from_slice(&payload[1..33]);
            let hash_type = payload[33];
            let args = payload[34..].to_vec();
            Ok((code_hash, hash_type, args))
        }
        // Short format (deprecated): 0x01 | index(1) | args(20)
        0x01 => {
            if payload.len() < 22 {
                return Err(SignatureError::InvalidAddress);
            }
            let index = payload[1];
            let args = payload[2..22].to_vec();
            let code_hash = match index {
                0x00 => SECP256K1_BLAKE160_CODE_HASH,
                _ => return Err(SignatureError::UnsupportedLockScript),
            };
            Ok((code_hash, 0x01, args))
        }
        _ => Err(SignatureError::UnsupportedLockScript),
    }
}

#[derive(Debug, thiserror::Error)]
pub enum SignatureError {
    #[error("invalid hex encoding")]
    InvalidHex,
    #[error("invalid signature format")]
    InvalidSignature,
    #[error("invalid recovery id")]
    InvalidRecoveryId,
    #[error("failed to recover public key")]
    RecoveryFailed,
    #[error("signature does not match address")]
    SignatureMismatch,
    #[error("invalid CKB address")]
    InvalidAddress,
    #[error("unsupported lock script; only secp256k1-blake160 is supported")]
    UnsupportedLockScript,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ckb_blake2b_empty() {
        let hash = ckb_blake2b(b"");
        assert_eq!(
            hex::encode(hash),
            "44f4c69744d5f8c55d642062949dcae49bc4e7ef43d388c5a12f42b5633d163e"
        );
    }

    #[test]
    fn test_ckb_message_hash_has_prefix() {
        let hash = hash_message_ckb("hello");
        let expected = ckb_blake2b(b"Nervos Message:hello");
        assert_eq!(hash, expected);
    }

    #[test]
    fn test_parse_full_address() {
        let addr = "ckb1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqdnnw7qkdnnclfkg59uzn8umtfd2kwxceqxwquc4";
        let (code_hash, hash_type, args) = parse_ckb_address(addr).unwrap();
        assert_eq!(code_hash, SECP256K1_BLAKE160_CODE_HASH);
        assert_eq!(hash_type, 0x01);
        assert_eq!(args.len(), 20);
        assert_eq!(
            hex::encode(&args),
            "b39bbc0b3673c7d36450bc14cfcdad2d559c6c64"
        );
    }

    #[test]
    fn test_reject_invalid_address() {
        assert!(parse_ckb_address("not_an_address").is_err());
        assert!(parse_ckb_address("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4").is_err());
    }

    #[test]
    fn test_reject_wrong_length_signature() {
        let result = verify_ckb_address_signature(
            "test",
            "0xdeadbeef",
            "ckb1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqdnnw7qkdnnclfkg59uzn8umtfd2kwxceqxwquc4",
        );
        assert!(result.is_err());
    }
}
