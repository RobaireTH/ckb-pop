# /contracts — On-Chain Components for CKB-PoP

**Contracts define verifiable facts. Scripts do observation and convenience only.**

The contracts in this directory define the minimal on-chain guarantees for CKB-PoP. They do not implement attendance logic, event management, or verification flows. Their sole responsibility is to enforce **ownership**, **uniqueness**, and **immutability** of participation badges and scope anchors. All verification logic is intentionally off-chain and cryptographically reproducible to preserve decentralization and backend replaceability.

---

## Design Principles (Hard Constraints)

These are non-negotiable for everything in `/contracts`:

| Constraint | Rationale |
|------------|-----------|
| Contracts never reference servers | Chain must not depend on any backend |
| Contracts never encode participation logic | Participation is proven off-chain |
| Contracts only validate structure and ownership | Minimal on-chain footprint |
| Contracts do not know what "events" are | Issuance scopes are an off-chain concept |
| Contracts do not know what "presence" is | Participation is cryptographic, not on-chain |
| Contracts only enforce who owns what and why it's unique | Core value prop |

**Presence is proven off-chain, anchored on-chain.**

---

## Directory Structure

```
/contracts
├── dob-badge/           # Presence badge (Spore / DOB) — REQUIRED
│   ├── README.md
│   ├── type.rs          # Badge identity + uniqueness
│   └── schema.json      # Metadata schema
├── event-anchor/        # Event anchor cell — OPTIONAL
│   ├── README.md
│   ├── type.rs
│   └── schema.json
└── common/
    ├── constants.rs
    └── utils.rs
```

---

## Contracts Overview

### DOB Badge (Required)

The only mandatory contract. Represents a cryptographically unique participation badge owned by a CKB address.

**The chain knows:** "This badge exists, it's unique, and this address owns it."

**The chain does NOT know:** How participation was verified, what QR or submission was used, what backend was used.

### Event Anchor (Optional)

Anchors an issuance scope's existence on-chain, immutably. Strengthens decentralization by removing backend as the first place a scope appears.

---

## What Contracts Explicitly Do NOT Do

| Contracts do NOT... | Why |
|---------------------|-----|
| Enforce attendance windows | Off-chain logic |
| Enforce QR freshness | Off-chain logic |
| Enforce "one completion per person" | Off-chain logic |
| Verify signatures for participation | Off-chain logic |
| Store participant lists | Off-chain data |
| Store scope state machines | Off-chain state |
| Call any oracle or backend | Decentralization |

---

## Separation of Concerns

| Concern | Where it lives |
|---------|----------------|
| Participation logic | Off-chain (scripts + signatures) |
| Freshness | Off-chain (QR + HMAC) |
| Verification | Off-chain (reproducible) |
| Ownership | **On-chain** |
| Uniqueness | **On-chain** |
| History | **On-chain** |
| Authority | **Nowhere** |

---

## The Decentralization Answer

You may ask...:

> "What if your backend lies?"

The answer is:

> "It doesn't matter. The chain won't accept a bad badge."
