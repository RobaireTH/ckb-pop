# Event Anchor Contract

**Optional but powerful.**

## Purpose

Anchor an issuance scope's existence on-chain, immutably. This strengthens decentralization optics.

### This avoids:
- Backend being the first place a scope appears
- Disputes over "when did this scope exist?"

### What the Event Anchor Is

A single on-chain cell created by the event creator. It represents:

> "This issuance scope exists, and this address claims authorship."

---

## Type Script

### Responsibilities:

- Ensure immutability
- Ensure single creation per scope
- Bind creator address

### It does NOT:

- Manage attendance
- Know about badges
- Know about QR codes
- Enforce attendance windows
- Store attendee lists

---

## Event Anchor Args

```rust
struct EventAnchorArgs {
    scope_id_hash: [u8; 20],        // sha256(scope_id)[..20]
    creator_address_hash: [u8; 20], // sha256(creator_address)[..20]
}
```

Total: 40 bytes. Fields are truncated to 20 bytes (160-bit, matching CKB's blake160 security level).

---

## Anchor Metadata

Stored as immutable cell data:

```json
{
  "scope_id": "string",
  "scope_kind": "event|hackathon|program|course|campaign|bounty|membership|custom",
  "creator": "ckb1...",
  "metadata_hash": "0x...",
  "created_at_block": 123456
}
```

---

## Relationship to Backend

Backend logic becomes:

| Condition | Confidence |
|-----------|------------|
| Event anchor exists on-chain | High confidence event |
| Only payment tx exists | Still eligible |

Both are verifiable without backend trust.

**Backend = observer, not registrar.**

---

## Verification Flow

Anyone can:
1. Query chain for scope anchor cell by `scope_id_hash`
2. Verify creator authorship from cell data
3. Derive event legitimacy without trusting any server

---

## Why Optional?

The DOB Badge contract is sufficient for the core protocol. Event anchors add:

- Stronger provenance guarantees
- Earlier on-chain timestamp for scopes
- Reduced reliance on backend for scope discovery

Projects can choose based on their trust model.
