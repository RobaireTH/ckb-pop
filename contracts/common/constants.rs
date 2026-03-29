/// Protocol identifier
pub const PROTOCOL_ID: &str = "ckb-pop";

/// Current schema version
pub const SCHEMA_VERSION: &str = "1";

/// Length of truncated hash fields (first 20 bytes of SHA256 or blake2b).
/// 20 bytes matches CKB's blake160 security level used for lock script args.
pub const HASH_LEN: usize = 20;

/// Length of badge type script args (type_id + scope_id_hash + recipient_hash), each 20 bytes.
pub const BADGE_ARGS_LEN: usize = 60;

/// Length of event anchor type script args (scope_id_hash + creator_hash), each 20 bytes.
pub const ANCHOR_ARGS_LEN: usize = 40;

/// Error codes
pub mod error {
    /// Invalid args length
    pub const INVALID_ARGS: i8 = 1;

    /// Duplicate in outputs
    pub const DUPLICATE_OUTPUT: i8 = 2;

    /// Already exists (re-mint attempt)
    pub const ALREADY_EXISTS: i8 = 3;

    /// Invalid metadata format
    pub const INVALID_METADATA: i8 = 4;
}
