# Architecture

## Overview

CKB PoP is split into five layers:

1. `packages/ckb-presence/`
   The publishable TypeScript kit (`ckb-pop-kit`).
2. `scripts/`
   The Rust backend.
3. `contracts/`
   The CKB on-chain scripts.
4. `frontend/`
   The Angular reference app.
5. `docs/`
   The separately served static docs site.

The important product rule is:

> The package and contracts define the reusable system.
> The backend and frontend are reference implementations of that system.

## Layer Responsibilities

### 1. Package: `packages/ckb-presence/`

This is the reusable developer-facing kit.

It owns:

- scope model
- proof driver registration
- artifact driver registration
- policy extension registration
- claim token helpers
- manifest shape
- CKB helper functions for args and cell data

It does **not** own:

- persistent storage
- network APIs
- contract execution
- UI

If an external product wants to integrate CKB PoP without using the reference app, this is the first layer it should consume.

### 2. Backend: `scripts/`

This is a reference backend, not protocol authority.

It owns:

- event/scope persistence
- QR proof serving
- signed claim issuing and verification
- badge observation
- manifest endpoint
- convenience APIs for the reference frontend

It does **not** own:

- final trust
- uniqueness guarantees
- badge ownership
- user custody

If the backend lies or breaks, the contracts still protect the important on-chain invariants.

### 3. Contracts: `contracts/`

These are the minimal on-chain primitives.

They own:

- uniqueness
- ownership
- immutability

They do **not** own:

- eligibility logic
- attendance logic
- participation policy
- claim verification
- QR freshness
- organizer workflows

The contracts should stay narrow. They are intentionally not an on-chain workflow engine.

### 4. Frontend: `frontend/`

This is the reference product UI.

It demonstrates:

- physical participation verification
- online claim-based badge issuance
- scope creation
- badge exploration
- integration surface discovery

It should consume the package and backend cleanly, not redefine protocol logic locally.

### 5. Docs: `docs/`

This is the builder-facing product documentation.

It explains:

- what the system is
- how to install the kit
- how flows work
- how to integrate the backend
- how contract metadata is shaped

Docs are builder-first. The app landing is product-first.

## Core Concept: Scope, Not Just Event

The central abstraction is now a **scope**.

A scope may be:

- an event
- a hackathon
- a program
- a course
- a campaign
- a bounty
- a membership
- a custom participation surface

Two important fields travel through the system:

- `scope_kind`
- `participation_mode`

This is what allows the same badge model to work across:

- physical attendance
- online completion
- hybrid participation
- async contribution

## Data Model

### Scope

A scope is the thing a badge is issued for.

Relevant fields:

- `scope_id`
- `scope_kind`
- `participation_mode`
- `creator_address`
- metadata such as name, date, location, image

### Badge

A badge is the non-transferable artifact minted to a participant.

Relevant fields:

- `scope_id`
- recipient address
- proof hash
- issuer

The current on-chain uniqueness rule is effectively:

> one badge per `(scope_id, address)`

### Proof

A proof is how eligibility is demonstrated off-chain before mint.

Current proof families:

- dynamic QR
- plain scope/event ID
- signed claim
- submission proof

## Main Flows

### Physical QR Flow

1. Organizer creates a scope.
2. Organizer opens a live QR window.
3. Participant scans QR.
4. Backend verifies freshness and HMAC.
5. Participant signs mint.
6. Contract enforces uniqueness.

### Online Claim Flow

1. Product backend decides a participant completed a requirement.
2. Product backend signs a claim token.
3. Participant opens claim link or pastes token.
4. Backend verifies claim issuer and recipient.
5. Participant signs mint.
6. Contract enforces uniqueness.

### Async Submission Flow

1. Submission or deliverable is reviewed.
2. A proof reference is recorded.
3. Claim token is issued.
4. Participant claims and signs mint.
5. Contract enforces uniqueness.

## Trust Model

### What the backend can do

- issue proofs
- verify proofs
- cache state
- serve convenience APIs

### What the backend cannot do

- silently mint on behalf of a user without their signature
- bypass uniqueness rules
- change contract ownership rules

### What the contracts guarantee

- uniqueness
- ownership
- immutability

### What the contracts do not guarantee

- proof quality
- organizer honesty
- submission correctness
- off-chain workflow integrity

## Release and Deployment Boundaries

### Change only the package

Requires:

- publish a new `ckb-pop-kit` version

Usually does **not** require:

- backend redeploy
- frontend redeploy
- contract redeploy

Unless the frontend or backend depends on the new package behavior.

### Change backend logic

Requires:

- backend redeploy

May require:

- package release if shared types/helpers changed
- frontend redeploy if the frontend depends on new endpoints or payloads

### Change frontend UI only

Requires:

- frontend redeploy

Usually does **not** require:

- backend redeploy
- contract redeploy

### Change contract logic

Requires:

- contract rebuild and redeploy
- frontend config updates for new code hash / dep cell info
- backend config updates if contract metadata changes

Contract changes are the most expensive class of change and should be treated carefully.

## What Belongs Where

### Add it to the package if:

- external integrators should use it
- it is generic protocol logic
- it is not tied to one UI or backend runtime

### Add it to the backend if:

- it needs persistence
- it needs network APIs
- it verifies claims or QR proofs
- it coordinates observation or convenience workflows

### Add it to the frontend if:

- it is presentation
- it is app-specific UX
- it is a reference flow for users

### Add it to contracts if:

- it must be enforced on-chain
- it protects uniqueness, ownership, or immutability

## Current Product Boundary

Today the correct mental model is:

- `ckb-pop-kit` = reusable protocol kit
- `scripts/` = reference backend service
- `contracts/` = reusable on-chain primitive
- `frontend/` = reference product
- `docs/` = builder docs

That is the boundary contributors should preserve.
