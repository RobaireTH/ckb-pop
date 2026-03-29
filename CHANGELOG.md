# Changelog

All notable changes to this project should be documented in this file.

## 2026-03-29

### Added

- Scope-based participation model in `ckb-pop-kit`
- Signed-claim and submission-proof drivers
- Backend claim issuance and verification endpoints
- Reference claim flow in the frontend
- Static docs site under `docs/`

### Changed

- Package generalized from event-only language to participation scopes
- Contract schemas and docs now describe participation scopes instead of only physical attendance
- Frontend shell and landing were rebuilt around the new visual and documentation surface

### Published

- `ckb-pop-kit@0.2.0`

## 2026-03-27

### Added

- Publishable npm package structure under `packages/ckb-presence/`
- CI and publish workflow scaffolding for the package

### Changed

- Frontend now consumes the packaged source of truth
- Package renamed to `ckb-pop-kit`

### Published

- `ckb-pop-kit@0.1.0`
- `ckb-pop-kit@0.1.1`

## 2026-03-26

### Added

- Integrator surface in the frontend
- Backend security-header and CORS hardening

### Changed

- `MODULE.md` removed from tracked repo state
- README updated to reflect the module/package framing

## 2026-03-25

### Added

- Reusable presence kernel types
- CKB presence helper primitives
- Extensible presence module registry
- Kernel entrypoint exports
- Unit tests for the kernel

### Changed

- Angular services refactored to consume the shared module
- Backend manifest endpoint added
