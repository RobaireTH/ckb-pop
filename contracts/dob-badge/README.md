# DOB Badge Contract

**Core contract. Required.**

## Purpose

Represent a cryptographically unique participation badge owned by a CKB address.

### The chain knows:
- This badge exists
- It's unique
- This address owns it

### The chain does NOT know:
- How participation was verified
- What QR was shown
- What backend was used

---

## Type Script

### Responsibilities (ONLY):

- Enforce one badge per `(scope_id, address)`
- Bind immutable metadata
- Prevent duplication

### It must NOT:

- Verify signatures
- Verify timestamps
- Verify participation logic
- Call any oracle or backend

---

## Badge Args

```rust
struct BadgeArgs {
    type_id: [u8; 20],                    // blake2b(first_input_outpoint || output_index)[..20]
    scope_id_hash: [u8; 20],              // sha256(scope_id)[..20]
    recipient_address_hash: [u8; 20],     // sha256(recipient_address)[..20]
}
```

Total: 60 bytes. All fields are truncated to 20 bytes (160-bit, matching CKB's blake160 security level).

The type script uses args to enforce uniqueness.

---

## Validation Rules

1. **Exactly one output badge** per `(scope_id_hash, recipient_address_hash)`
2. **Badge cannot be re-minted** with same args (checked via cell deps or type ID pattern)
3. **Metadata is immutable** after mint

---

## Badge Metadata

Stored as immutable cell data:

```json
{
  "protocol": "ckb-pop",
  "version": "1",
  "scope_id": "string",
  "scope_kind": "event|hackathon|program|course|campaign|bounty|membership|custom",
  "participation_mode": "in-person|online|hybrid|async",
  "event_id": "string",
  "issuer": "ckb1...",
  "issued_at_block": 123456,
  "proof_hash": "0x..."
}
```

### Important:

- `proof_hash` is **opaque** to the chain
- Chain does NOT interpret it
- It allows anyone to correlate off-chain proofs if they want

---

## Minting Flow

```
1. Off-chain: Participation proof verified cryptographically
2. Off-chain: Backend builds unsigned tx with badge type script
3. Client: Signs transaction (user custody)
4. On-chain: Type script validates uniqueness
5. On-chain: Badge cell created, owned by recipient
```

The type script only runs at mint time. It enforces structure, not policy.
