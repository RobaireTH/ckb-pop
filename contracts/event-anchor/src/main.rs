//! Event Anchor Type Script
//!
//! Anchors event existence on-chain for the CKB-PoP protocol.
//! Creates an immutable record that an event was created by a specific address.
//!
//! This contract is OPTIONAL but strengthens decentralization by:
//!   - Removing backend as the first place an event appears
//!   - Providing verifiable on-chain timestamp for events
//!   - Enabling trustless event discovery
//!
//! Cell data should contain JSON metadata:
//!   { event_id, creator_address, metadata_hash, created_at_block }
//!
//! Args format (40 bytes):
//!   - bytes 0-19:  SHA256(event_id)[..20]
//!   - bytes 20-39: SHA256(creator_address)[..20]

#![no_std]
#![no_main]

ckb_std::default_alloc!();

use ckb_std::{
    ckb_constants::Source,
    ckb_types::{bytes::Bytes, prelude::*},
    error::SysError,
    high_level::{load_script, load_cell_type},
};

/// Args length: event_id_hash (20) + creator_address_hash (20)
const ARGS_LEN: usize = 40;

/// Error codes
mod error {
    /// Script args length != 40 bytes
    pub const INVALID_ARGS: i8 = 1;
    /// Multiple outputs with same type script args
    pub const DUPLICATE_OUTPUT: i8 = 2;
    /// Anchor already exists (re-creation attempt)
    pub const ALREADY_EXISTS: i8 = 3;
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
    let code_hash = script.code_hash();

    // Validate args length
    if args.len() != ARGS_LEN {
        return Err(error::INVALID_ARGS);
    }

    // Count outputs with same type script (code_hash + args)
    let output_count = count_matching_cells(Source::Output, &code_hash, &args);

    // Exactly one anchor per event per transaction
    if output_count != 1 {
        return Err(error::DUPLICATE_OUTPUT);
    }

    // Check inputs - anchors are immutable, reject any modification
    let input_count = count_matching_cells(Source::Input, &code_hash, &args);

    if input_count > 0 {
        // Anchor exists in inputs = attempt to modify/destroy
        // Reject to enforce immutability
        return Err(error::ALREADY_EXISTS);
    }

    Ok(())
}

/// Count cells with matching type script (same code_hash AND args)
fn count_matching_cells(
    source: Source,
    expected_code_hash: &ckb_std::ckb_types::packed::Byte32,
    expected_args: &[u8],
) -> usize {
    let mut count = 0;
    let mut index = 0;

    loop {
        match load_cell_type(index, source) {
            Ok(Some(script)) => {
                // Match both code_hash and args for precise comparison
                let code_hash = script.code_hash();
                let args: Bytes = script.args().unpack();

                if code_hash.as_slice() == expected_code_hash.as_slice()
                    && args.as_ref() == expected_args
                {
                    count += 1;
                }
            }
            Ok(None) => {
                // Cell has no type script, skip
            }
            Err(SysError::IndexOutOfBound) => {
                // No more cells
                break;
            }
            Err(_) => {
                // Other syscall error, skip
            }
        }
        index += 1;
    }

    count
}
