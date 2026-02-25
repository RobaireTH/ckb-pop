use ckb_std::ckb_types::bytes::Bytes;

/// Compare two byte slices for equality.
#[inline]
pub fn bytes_eq(a: &[u8], b: &[u8]) -> bool {
	if a.len() != b.len() {
		return false;
	}
	a.iter().zip(b.iter()).all(|(x, y)| x == y)
}

/// Extract type_id from badge args (bytes 0–19).
#[inline]
pub fn extract_type_id(args: &Bytes) -> Option<&[u8]> {
	if args.len() >= 20 {
		Some(&args[0..20])
	} else {
		None
	}
}

/// Extract event_id_hash from badge args (bytes 20–39).
#[inline]
pub fn extract_event_id_hash(args: &Bytes) -> Option<&[u8]> {
	if args.len() >= 40 {
		Some(&args[20..40])
	} else {
		None
	}
}

/// Extract recipient/creator hash from badge args (bytes 40–59).
#[inline]
pub fn extract_address_hash(args: &Bytes) -> Option<&[u8]> {
	if args.len() >= 60 {
		Some(&args[40..60])
	} else {
		None
	}
}
