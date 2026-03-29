# Contributing

## Project Layout

- `packages/ckb-presence/`
  Publishable TypeScript kit.
- `frontend/`
  Angular reference app.
- `scripts/`
  Rust backend.
- `contracts/`
  CKB contracts.
- `docs/`
  Static docs site served separately.

## Prerequisites

- Node.js 20+
- Rust stable
- CKB testnet or devnet access for end-to-end work

## Local Setup

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd scripts
cargo run
```

### Package

```bash
npx --prefix frontend tsc -p packages/ckb-presence/tsconfig.build.json
```

### Contracts

```bash
cd contracts
cargo build
```

## Before Opening a PR

Run the relevant checks for the code you changed.

Typical checks:

```bash
cd frontend && npm test
cd frontend && npm run build
cd scripts && cargo test
cd contracts && cargo build
npx --prefix frontend tsc -p packages/ckb-presence/tsconfig.build.json
```

## Contribution Guidelines

- keep changes scoped
- do not mix unrelated refactors into one PR
- preserve the package/backend/contracts boundaries
- prefer additive extensibility over hardcoding one-off product behavior
- update docs when behavior changes

## Design Expectations

This project is not meant to look like a generic SaaS dashboard.

When changing frontend code:

- keep the existing ckb-pop visual system coherent
- preserve the product/protocol voice
- keep docs and app styling aligned when they are meant to feel related

## Commit Style

Recent history uses short imperative summaries.

Examples:

- `Add signed claim verification to the backend.`
- `Generalize the npm kit for scope-based participation.`
- `Rebuild the frontend shell and docs experience.`

## Pull Requests

Include:

- what changed
- which layer changed: package, frontend, backend, contracts, docs
- any deployment implications
- screenshots for meaningful UI changes

## What Not to Commit

- secrets
- local databases
- generated tarballs
- `node_modules`
- unrelated editor or scratch files

## Questions to Ask Before Adding Something

- Is this a protocol primitive, a backend policy, or just reference-app UX?
- Does this change who is eligible, how eligibility is proven, or only how it is displayed?
- Does this belong in `ckb-pop-kit`, the backend, the contracts, or only the reference frontend?
- Is this still generic enough for outside integrators, or is it hardcoded to one product flow?
- Does this preserve self-custody, or does it quietly move authority to the backend?
- Does this require a new npm package release, a backend redeploy, a frontend redeploy, or all three?
- Is the contract logic actually changing, or only the metadata/schema/docs around it?
- If this flow broke, would the chain still enforce the important invariant?
