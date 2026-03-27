# ckb-pop-presence

Reusable presence primitives for applications building on Nervos CKB.

## Install

```bash
npm install ckb-pop-presence
```

## What It Provides

- proof driver registration
- artifact driver registration
- policy extension registration
- event locator parsing and validation
- reference manifest generation
- CKB helper functions for anchor args, artifact args, and hashed cell data

## Example

```ts
import {
  createPresenceModule,
  createDynamicQrProofDriver,
  buildUniqueArtifactArgs,
} from 'ckb-pop-presence';

const presence = createPresenceModule({
  namespace: 'my-app',
  name: 'My Presence Layer',
  summary: 'Presence flows for my CKB product',
  proofDrivers: [createDynamicQrProofDriver()],
});

const locator = presence.resolveEventLocator('event-123|1710000000|proof');
const args = await buildUniqueArtifactArgs(locator.eventId, 'ckt1...');
```

## Browser Compatibility

The hashing helpers use the Web Crypto API. They are intended for modern browsers and browser-like runtimes.
