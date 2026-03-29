import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaimService } from './claim.service';

describe('ClaimService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('verifies a claim token and maps the event payload', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        valid: true,
        proof_hash: '0xproof',
        claim: {
          claim_id: 'claim-1',
          proof_driver: 'signed-claim',
          proof_ref: 'submission-42',
          recipient_address: 'ckt1winner',
        },
        event: {
          event_id: 'hack-1',
          metadata: {
            name: 'Online Hackathon',
            location: null,
            start_time: '2026-04-01T09:00:00.000Z',
            scope_kind: 'hackathon',
            participation_mode: 'online',
          },
          creator_address: 'ckt1creator',
          activated_at: '2026-04-01T09:00:00.000Z',
          payment_tx_hash: '',
        },
      }),
    }) as typeof fetch;

    const service = new ClaimService();
    const result = await service.verifyClaimToken('token', 'ckt1winner');

    expect(result.proofHash).toBe('0xproof');
    expect(result.event.scopeKind).toBe('hackathon');
    expect(result.event.participationMode).toBe('online');
    expect(result.claimId).toBe('claim-1');
  });

  it('surfaces backend claim verification errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'claim expired' }),
    }) as typeof fetch;

    const service = new ClaimService();
    await expect(service.verifyClaimToken('token', 'ckt1winner')).rejects.toThrow('claim expired');
  });
});
