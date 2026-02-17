# PoP Network 

Soulbound attendance badges on Nervos CKB. Non-transferable, permissionless, on-chain.

CKB-PoP or PoP Network lets you issue cryptographic proof that someone was physically present. Attendees scan a QR code, sign with their wallet, and receive a badge permanently bound to their address. No one controls the protocol — the chain enforces uniqueness and ownership, everything else is off-chain.

## How it works

1. **Organizer creates an event** — metadata is signed and anchored on-chain.
2. **Organizer opens an attendance window** — a time-bound secret generates rotating QR codes.
3. **Attendee scans the QR** — signs an attendance proof with their wallet.
4. **Badge is minted** — a soulbound cell is created on CKB, one per person per event.

The QR codes rotate every 30 seconds with HMAC verification. Replay is impossible. The badge is a CKB cell with a type script that enforces: one badge per `(event_id, address)` pair, non-transferable, immutable.

## Architecture

```
frontend/          Angular 21 web app (Vite, Tailwind)
scripts/           Rust backend (Axum, SQLite, CKB RPC)
contracts/         RISC-V type scripts deployed on CKB
```

**Frontend** handles wallet connection (JoyID, MetaMask, UniSat, etc. via `@ckb-ccc/ccc`), QR scanning, transaction building, and badge display.

**Backend** coordinates event lifecycle, generates QR payloads, verifies attendance proofs, and observes badge cells from the chain. It does not hold keys or have special authority. It's a convenience layer that can be replaced.

**Contracts** are minimal. Two type scripts:

- **dob-badge** — Enforces badge uniqueness and ownership. Args: `SHA256(event_id) || SHA256(address)`. Rejects duplicates.
- **event-anchor** — Immutable on-chain record of an event. Optional but strengthens decentralization.

The contracts don't know what "attendance" or "events" are. They enforce structure. Presence is proven cryptographically off-chain.

## Running locally

### Prerequisites

- Node.js 20+
- Rust (latest stable)
- CKB devnet or testnet RPC access

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Configure via `.env`:

```
VITE_CKB_NETWORK=testnet
VITE_CKB_RPC_URL=https://testnet.ckb.dev/rpc
VITE_BACKEND_URL=http://localhost:3001/api
VITE_DOB_BADGE_CODE_HASH=0x...
VITE_DOB_BADGE_HASH_TYPE=type
VITE_DOB_BADGE_DEP_TX_HASH=0x...
VITE_DOB_BADGE_DEP_INDEX=0
VITE_EVENT_ANCHOR_CODE_HASH=0x...
VITE_EVENT_ANCHOR_HASH_TYPE=type
VITE_EVENT_ANCHOR_DEP_TX_HASH=0x...
VITE_EVENT_ANCHOR_DEP_INDEX=0
```

### Backend

```bash
cd scripts
cargo run
```

Configure via `.env`:

```
CKB_NETWORK=testnet
CKB_RPC_URL=https://testnet.ckb.dev/rpc
DATABASE_URL=sqlite:./ckb_pop.db?mode=rwc
```

### Contracts

Build with the CKB contracts toolchain:

```bash
cd contracts
capsule build --release
```

Deploy info lives in `contracts/deploy-info.json`.

## Deployment

- **Frontend** is deployed on Vercel.
- **Backend** runs on Fly.io (Singapore region, SQLite on persistent volume).
- **Contracts** are deployed to CKB testnet via `ckb-cli`.

## Design decisions

**Why soulbound?** Attendance proof loses meaning if you can sell it. The badge is bound to the address that was physically present.

**Why off-chain verification?** Keeping presence logic off-chain means the contracts stay tiny (under 100 lines each), gas costs are minimal, and the verification scheme can evolve without redeploying contracts. Anyone can independently verify a badge by checking the chain.

**Why CKB?** The cell model naturally represents unique, owned assets. Type scripts enforce invariants at the protocol level. RISC-V means contracts compile from standard Rust.

**Why a backend at all?** Convenience. The backend coordinates QR rotation, caches event state, and provides an API for the frontend. But it has no privileged access — it can't forge badges, alter events, or override the chain. A CLI or another backend could replace it entirely.

## License

MIT
