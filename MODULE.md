# CKB Presence Module

This repository now exposes CKB-PoP as a reusable presence module rather than only a branded event app.

## What Is Reusable

- `frontend/src/lib/ckb-presence/`
  Framework-agnostic TypeScript kernel for proof parsing, extension registration, event payload shaping, and CKB script/data helpers.
- `scripts/src/module/mod.rs`
  Reference backend manifest describing available proof drivers, artifact drivers, policy extensions, and runtime support.
- `contracts/`
  CKB type scripts that enforce uniqueness and immutability for the reference badge and anchor artifacts.

The Angular app in `frontend/src/components/` and the Rust backend routes in `scripts/src/routes.rs` are reference consumers of the module.

## Extension Points

The module currently exposes three extension families:

- Proof drivers
  `dynamic-qr`, `plain-event-id`
- Artifact drivers
  `ckb-dob-badge`, `ckb-event-anchor`
- Policy extensions
  `timed-window`, `backend-observation`

You can register your own implementations with the TypeScript kernel instead of modifying the reference app directly.

## TypeScript Kernel

```ts
import {
  createPresenceModule,
  createDynamicQrProofDriver,
} from './frontend/src/lib/ckb-presence';

const module = createPresenceModule({
  namespace: 'my-ckb-app',
  name: 'My CKB Presence Layer',
  summary: 'Presence primitives for my product',
  proofDrivers: [createDynamicQrProofDriver()],
  artifactDrivers: [
    {
      id: 'my-artifact',
      label: 'My Artifact',
      summary: 'Custom artifact minted by my app',
    },
  ],
  policyExtensions: [
    {
      id: 'my-policy',
      label: 'My Policy',
      summary: 'Custom verification policy',
    },
  ],
});

const locator = module.resolveEventLocator('event-123|1710000000|sig');
const manifest = module.manifest();
```

Useful helpers from the same module:

- `buildUniqueArtifactArgs(recordId, ownerAddress, typeIdHex?)`
- `buildIssuerAnchorArgs(recordId, issuerAddress)`
- `buildHashedCellData(content)`
- `buildCreateEventIntent({ creatorAddress, creatorSignature, nonce, event })`

## Backend Discovery

The reference backend exposes:

- `GET /api/module/manifest`

That manifest returns:

- module namespace, name, version, and summary
- proof, artifact, and policy extension metadata
- reference API routes
- runtime support such as `address_hrp` and whether badge sync is enabled

Use it when wiring your own organizer UI, mobile app, wallet flow, or alternate backend adapter.

## Product Boundary

- `frontend/src/lib/ckb-presence/` is the reusable kernel.
- `frontend/src/services/poap.service.ts` and `frontend/src/services/contract.service.ts` are reference app adapters.
- The PoP landing page, gallery, event creator, and check-in screens are examples of how to consume the module, not the only valid UX.
