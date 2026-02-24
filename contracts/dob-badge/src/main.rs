//! DOB Badge Type Script

#![no_std]
#![no_main]

ckb_std::default_alloc!();

use ckb_std::{
	ckb_types::{bytes::Bytes, prelude::*},
	high_level::load_script,
	type_id::check_type_id,
};

/// Args layout: type_id (32) + event_id_hash (32) + recipient_address_hash (32)
const ARGS_LEN: usize = 96;

/// Error codes
mod error {
	/// Script args length != 96 bytes.
	pub const INVALID_ARGS: i8 = 1;
	/// Type ID validation failed (duplicate mint, wrong ID, or multiple cells).
	pub const INVALID_TYPE_ID: i8 = 2;
}

ckb_std::entry!(main);

fn main() -> i8 {
	match validate() {
		Ok(_) => 0,
		Err(e) => e,
	}
}

fn validate() -> Result<(), i8> {
	let script = load_script().map_err(|_| error::INVALID_ARGS)?;
	let args: Bytes = script.args().unpack();

	if args.len() != ARGS_LEN {
		return Err(error::INVALID_ARGS);
	}

	// Validate the Type ID stored in the first 32 bytes of args.
	// This enforces global uniqueness: each badge is a singleton cell that
	// can only be minted once, transferred, or burned — never duplicated.
	check_type_id(0).map_err(|_| error::INVALID_TYPE_ID)?;

	Ok(())
}
