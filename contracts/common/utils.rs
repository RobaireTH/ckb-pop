use ckb_std::ckb_types::bytes::Bytes;

/// Compare two byte slices for equality.
#[inline]
pub fn bytes_eq(a: &[u8], b: &[u8]) -> bool {
	if a.len() != b.len() {
		return false;
	}
	a.iter().zip(b.iter()).all(|(x, y)| x == y)
}

/// Extract type_id from badge args (bytes 0–31).
#[inline]
pub fn extract_type_id(args: &Bytes) -> Option<&[u8]> {
	if args.len() >= 32 {
		Some(&args[0..32])
	} else {
		None
	}
}

/// Extract event_id_hash from badge args (bytes 32–63).
#[inline]
pub fn extract_event_id_hash(args: &Bytes) -> Option<&[u8]> {
	if args.len() >= 64 {
		Some(&args[32..64])
	} else {
		None
	}
}

/// Extract recipient/creator hash from badge args (bytes 64–95).
#[inline]
pub fn extract_address_hash(args: &Bytes) -> Option<&[u8]> {
	if args.len() >= 96 {
		Some(&args[64..96])
	} else {
		None
	}
}
