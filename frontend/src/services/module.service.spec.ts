import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ModuleService } from './module.service';

describe('ModuleService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns backend manifest when the endpoint succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        namespace: 'ckb-pop',
        name: 'CKB Presence Module',
        version: '0.1.0',
        summary: 'test',
        proof_drivers: [{ id: 'dynamic-qr', kind: 'proof', label: 'QR', summary: 'qr', status: 'reference' }],
        artifact_drivers: [],
        policy_extensions: [],
        api: { base_path: '/api', routes: [{ method: 'GET', path: '/module/manifest', purpose: 'discover' }] },
        runtime: { address_hrp: 'ckt', badge_sync_enabled: true, backend_authority: 'non-authoritative' },
        notes: ['ok'],
      }),
    }) as typeof fetch;

    const service = new ModuleService();
    const manifest = await service.getManifest();

    expect(manifest.runtime.addressHrp).toBe('ckt');
    expect(manifest.api.routes[0].path).toBe('/module/manifest');
    expect(manifest.notes).toEqual(['ok']);
  });

  it('falls back to the local reference manifest when the backend is unavailable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as typeof fetch;

    const service = new ModuleService();
    const manifest = await service.getManifest();

    expect(manifest.name).toBe('CKB Presence Module');
    expect(manifest.runtime.backendAuthority).toBe('frontend-fallback');
    expect(manifest.notes[0]).toContain('Backend manifest unavailable');
  });
});
