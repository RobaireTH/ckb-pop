import { describe, expect, it } from 'vitest';
import {
  buildHashedCellData,
  buildIssuerAnchorArgs,
  buildUniqueArtifactArgs,
} from './ckb';
import {
  createDynamicQrProofDriver,
  createPresenceModule,
  createReferenceCkbPresenceModule,
} from './module';

describe('ckb-presence module', () => {
  it('resolves dynamic QR payloads with second-based timestamps', () => {
    const module = createReferenceCkbPresenceModule();
    const now = 1_700_000_000_000;
    const resolution = module.resolveEventLocator('EVT001|1699999990|proof', now);

    expect(resolution.extensionId).toBe('dynamic-qr');
    expect(resolution.eventId).toBe('EVT001');
    expect(resolution.timestampMs).toBe(1_699_999_990_000);
  });

  it('rejects expired dynamic QR payloads', () => {
    const module = createReferenceCkbPresenceModule();
    const now = 1_700_000_000_000;

    expect(() => module.resolveEventLocator('EVT001|1699999930|proof', now)).toThrow(
      'QR Code Expired. Please scan the live screen again.'
    );
  });

  it('falls back to plain event ids for manual flows', () => {
    const module = createReferenceCkbPresenceModule();
    const resolution = module.resolveEventLocator('  abc123  ');

    expect(resolution.extensionId).toBe('plain-event-id');
    expect(resolution.eventId).toBe('abc123');
  });

  it('builds a reusable create-event intent payload', () => {
    const module = createReferenceCkbPresenceModule();
    const payload = module.buildCreateEventIntent({
      creatorAddress: 'ckt1creator',
      creatorSignature: '0xsig',
      nonce: 'nonce-1',
      event: {
        name: 'Hackathon',
        date: '2026-04-01T09:00:00Z',
        location: 'Lagos',
      },
    });

    expect(payload).toEqual({
      creator_address: 'ckt1creator',
      creator_signature: '0xsig',
      nonce: 'nonce-1',
      metadata: {
        name: 'Hackathon',
        description: '',
        image_url: null,
        location: 'Lagos',
        start_time: '2026-04-01T09:00:00.000Z',
        end_time: null,
      },
    });
  });

  it('rejects duplicate extension registrations', () => {
    const module = createPresenceModule({
      namespace: 'test',
      name: 'Test Module',
      summary: 'test',
    });
    const driver = createDynamicQrProofDriver();

    module.registerProofDriver(driver);
    expect(() => module.registerProofDriver(driver)).toThrow('Proof driver "dynamic-qr" is already registered.');
  });

  it('exposes a manifest with extension metadata', () => {
    const module = createReferenceCkbPresenceModule();
    const manifest = module.manifest();

    expect(manifest.name).toBe('CKB Presence Module');
    expect(manifest.proofDrivers.map(driver => driver.id)).toContain('dynamic-qr');
    expect(manifest.artifactDrivers.map(driver => driver.id)).toContain('ckb-dob-badge');
    expect(manifest.policyExtensions.map(driver => driver.id)).toContain('timed-window');
  });
});

describe('ckb-presence ckb helpers', () => {
  it('builds fixed-width artifact args', async () => {
    const args = await buildUniqueArtifactArgs('evt-1', 'ckt1owner');
    expect(args.startsWith('0x')).toBe(true);
    expect(args).toHaveLength(2 + 120);
  });

  it('builds fixed-width anchor args', async () => {
    const args = await buildIssuerAnchorArgs('evt-1', 'ckt1issuer');
    expect(args.startsWith('0x')).toBe(true);
    expect(args).toHaveLength(2 + 80);
  });

  it('builds versioned hashed cell data', async () => {
    const data = await buildHashedCellData({ event: 'evt-1' });
    expect(data.startsWith('0x01')).toBe(true);
    expect(data).toHaveLength(2 + 68);
  });
});
