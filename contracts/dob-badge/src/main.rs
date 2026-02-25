//! DOB Badge Type Script

#![no_std]
#![no_main]

ckb_std::default_alloc!();

use ckb_hash::new_blake2b;
use ckb_std::{
	ckb_constants::Source,
	ckb_types::{bytes::Bytes, prelude::*},
	error::SysError,
	high_level::{load_input, load_script},
	syscalls::load_cell,
};

/// Args layout: type_id (20) + event_id_hash (20) + recipient_address_hash (20)
const ARGS_LEN: usize = 60;

/// First 20 bytes of the blake2b type_id hash stored in args.
/// Matches CKB's blake160 security level (160-bit collision resistance).
const TYPE_ID_LEN: usize = 20;

/// Error codes
mod error {
	/// Script args length != 60 bytes.
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

	// Validate the 20-byte truncated Type ID stored in the first 20 bytes of args.
	// This enforces global uniqueness: each badge is a singleton cell.
	check_truncated_type_id(&args)?;

	Ok(())
}

/// Returns true if a cell exists at (index, source).
fn cell_exists(index: usize, source: Source) -> bool {
	matches!(
		load_cell(&mut [], 0, index, source),
		Ok(_) | Err(SysError::LengthNotEnough(_))
	)
}

/// Validate the truncated Type ID in args[0..20].
///
/// Mirrors ckb-std's validate_type_id but compares only the first 20 bytes.
/// Uses GroupInput/GroupOutput so CKB scopes the uniqueness check to cells
/// sharing this exact type script (code_hash + args).
fn check_truncated_type_id(args: &Bytes) -> Result<(), i8> {
	// Reject if more than one input or output carries this type script.
	if cell_exists(1, Source::GroupInput) || cell_exists(1, Source::GroupOutput) {
		return Err(error::INVALID_TYPE_ID);
	}

	// Minting: no input with this type script, exactly one output.
	if !cell_exists(0, Source::GroupInput) {
		// Find output index by locating the first GroupOutput cell in global Output.
		// ckb-std finds index via load_script_hash; we replicate using load_input
		// for the hash, and locate_index via GroupOutput matching.
		let index = locate_output_index()?;

		// Compute type_id = blake2b(first_input.as_slice() || output_index_u64_le).
		let input = load_input(0, Source::Input).map_err(|_| error::INVALID_TYPE_ID)?;
		let mut hasher = new_blake2b();
		hasher.update(input.as_slice());
		hasher.update(&(index as u64).to_le_bytes());
		let mut full_hash = [0u8; 32];
		hasher.finalize(&mut full_hash);

		if &args[..TYPE_ID_LEN] != &full_hash[..TYPE_ID_LEN] {
			return Err(error::INVALID_TYPE_ID);
		}
	}

	// Transfer/burn: input exists, no hash check needed (args already validated at mint).
	Ok(())
}

/// Find the global output index of the first cell in GroupOutput.
///
/// Iterates global outputs until one matches GroupOutput[0] by comparing
/// the raw cell bytes. This is necessary because Group sources don't expose
/// the global index directly.
fn locate_output_index() -> Result<usize, i8> {
	use ckb_std::high_level::load_cell_type_hash;
	use ckb_std::high_level::load_script_hash;

	let script_hash = load_script_hash().map_err(|_| error::INVALID_TYPE_ID)?;

	let mut i = 0usize;
	loop {
		match load_cell_type_hash(i, Source::Output) {
			Ok(Some(h)) if h == script_hash => return Ok(i),
			Ok(_) => {}
			Err(SysError::IndexOutOfBound) => return Err(error::INVALID_TYPE_ID),
			Err(_) => return Err(error::INVALID_TYPE_ID),
		}
		i += 1;
	}
}
