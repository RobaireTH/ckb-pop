# Security Policy

## Scope

This repository contains four security-relevant layers:

- `packages/ckb-presence/`
  Reusable TypeScript kit for scope modeling, proof helpers, and claim-token utilities.
- `frontend/`
  Reference web app for creating scopes, verifying participation, claiming badges, and exploring badges.
- `scripts/`
  Reference backend for claims, QR verification, badge observation, and API discovery.
- `contracts/`
  CKB on-chain scripts that enforce uniqueness, ownership, and immutability for badges and scope anchors.

## Reporting a Vulnerability

Do not open public GitHub issues for security-sensitive findings.

Instead, report privately to the maintainers through the security contact method you control for this project.

When reporting, include:

- a clear description of the issue
- affected layer(s): package, frontend, backend, contracts
- reproduction steps
- proof-of-concept if available
- impact assessment
- any suggested mitigation

## Response Expectations

The goal is to:

1. confirm the issue
2. assess impact and exploitability
3. fix the issue
4. release patched versions when needed
5. disclose responsibly after remediation

## Trust Model Summary

Important trust assumptions in this project:

- the backend is non-authoritative
- users retain custody of their keys and sign the final mint
- off-chain proofs determine eligibility
- on-chain scripts determine uniqueness and ownership

## What the Contracts Do and Do Not Protect

The contracts protect:

- one badge per `(scope_id, address)`
- one scope anchor per `(scope_id, creator)`
- immutability of those artifacts once created

The contracts do not protect:

- backend operator errors
- bad off-chain eligibility decisions
- leaked organizer signing keys
- phishing or wallet compromise
- incorrect frontend copy or UX

## High-Risk Areas

Review these areas carefully when changing code:

- claim token generation and parsing
- signature verification logic
- backend mint authorization flow
- event/scope identity hashing
- contract arg layouts and metadata schemas
- deployment configuration and secrets

## Secret Handling

Do not commit real secrets.

For deployment:

- keep API keys, tokens, and private configuration out of Git
- prefer platform secrets for runtime configuration
- avoid putting sensitive values directly in deploy manifests where possible

## Versioning and Security Fixes

Security fixes may require updates to:

- the npm package `ckb-pop-kit`
- the backend deployment
- the frontend deployment

Contract redeploys should be treated as exceptional and only done when the script logic itself must change.
