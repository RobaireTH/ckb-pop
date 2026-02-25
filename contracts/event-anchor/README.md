# Event Anchor Contract

**Optional but powerful.**

## Purpose

Anchor an event's existence on-chain, immutably. This strengthens decentralization optics.

### This avoids:
- Backend being the first place an event appears
- Disputes over "when did this event exist?"

### What the Event Anchor Is

A single on-chain cell created by the event creator. It represents:

> "This event exists, and this address claims authorship."

---

## Type Script

### Responsibilities:

- Ensure immutability
- Ensure single creation per event
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
    event_id_hash: [u8; 20],        // sha256(event_id)[..20]
    creator_address_hash: [u8; 20], // sha256(creator_address)[..20]
}
```

Total: 40 bytes. Fields are truncated to 20 bytes (160-bit, matching CKB's blake160 security level).

---

## Anchor Metadata

Stored as immutable cell data:

```json
{
  "event_id": "string",
  "creator_address": "ckb1...",
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
1. Query chain for event anchor cell by `event_id_hash`
2. Verify creator authorship from cell data
3. Derive event legitimacy without trusting any server

---

## Why Optional?

The DOB Badge contract is sufficient for the core protocol. Event anchors add:

- Stronger provenance guarantees
- Earlier on-chain timestamp for events
- Reduced reliance on backend for event discovery

Projects can choose based on their trust model.
