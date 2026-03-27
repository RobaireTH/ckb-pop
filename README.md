# CKB Presence Module

Reusable presence primitives for applications building on Nervos CKB.

This repository still contains the PoP Network reference app, but the important boundary is now:

- `packages/ckb-presence/` is the reusable TypeScript package
- `scripts/` is the reference backend adapter
- `contracts/` are the CKB-enforced reference artifacts
- `frontend/src/components/` is a reference product that consumes the module

## What The Module Does

The module lets a CKB app:

1. define a presence event
2. issue or parse a proof locator such as a dynamic QR
3. apply verification policy such as timed windows
4. mint or observe a presence artifact on CKB
5. expose its capabilities to integrators through a backend manifest

The reference artifact is still a soulbound badge, but the module now exposes explicit extension points instead of assuming that one UX, one proof format, and one backend are the whole product.

## Reusable Surfaces

### TypeScript Kernel

`packages/ckb-presence/` includes:

- extension registries for proof drivers, artifact drivers, and policy modules
- event locator parsing and validation
- event creation payload shaping
- mapping helpers for reference backend event and badge records
- CKB helpers for anchor args, artifact args, and hashed cell data

### Backend Manifest

The Rust backend now exposes:

- `GET /api/module/manifest`

That endpoint describes:

- module name, namespace, and version
- installed proof, artifact, and policy extensions
- reference API routes
- runtime support such as HRP and badge sync availability

### Reference App

The Angular app remains useful, but it is no longer the boundary of the system. `poap.service.ts`, `contract.service.ts`, and `/integrate` now consume the shared package rather than owning the protocol logic themselves.

## Architecture

```text
packages/ckb-presence/         publishable TypeScript package
frontend/                       Angular 21 reference app
scripts/                        Rust reference backend (Axum, SQLite, CKB RPC)
contracts/                      RISC-V type scripts deployed on CKB
```

## Running Locally

### Prerequisites

- Node.js 20+
- Rust stable
- CKB devnet, testnet, or mainnet RPC access

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Configure via `.env`:

```text
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

```text
CKB_NETWORK=testnet
CKB_RPC_URL=https://testnet.ckb.dev/rpc
DATABASE_URL=sqlite:./ckb_pop.db?mode=rwc
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend.example
```

### Contracts

```bash
cd contracts
capsule build --release
```

## Design Decisions

**Why keep verification mostly off-chain?** It keeps contracts minimal and lets different apps plug in new proof drivers and policy layers without redeploying the chain layer.

**Why keep the backend non-authoritative?** The backend is an adapter, not the protocol. It can cache state, observe confirmations, and issue convenience APIs, but it does not get to override CKB invariants.

**Why add an integrator route?** A reusable module is not real if outside builders need to read source files just to discover its boundaries. `/integrate` and `/api/module/manifest` make the module legible.

**Why keep the PoP app at all?** A reusable module without a working reference consumer tends to rot. The PoP app proves the kernel, backend adapter, and contracts still compose into a real product.

## Publishing

The reusable package lives in `packages/ckb-presence/` and is set up to publish as `ckb-pop-presence`.

- Local package build: `npx --prefix frontend tsc -p packages/ckb-presence/tsconfig.build.json`
- CI validates the package with `.github/workflows/ci.yml`
- npm publishing is wired through `.github/workflows/publish-presence.yml` and expects `NPM_TOKEN`

## License

MIT
