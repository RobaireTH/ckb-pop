/// Protocol identifier
pub const PROTOCOL_ID: &str = "ckb-pop";

/// Current schema version
pub const SCHEMA_VERSION: &str = "1";

/// Length of hash fields (SHA256)
pub const HASH_LEN: usize = 32;

/// Length of badge type script args (type_id + event_id_hash + recipient_hash)
pub const BADGE_ARGS_LEN: usize = 96;

/// Length of event anchor type script args (event_id_hash + creator_hash)
pub const ANCHOR_ARGS_LEN: usize = 64;

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
