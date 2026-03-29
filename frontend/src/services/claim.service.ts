import { Injectable } from '@angular/core';
import {
  createReferenceCkbPresenceModule,
  type ReferenceActiveEvent,
} from '../lib/ckb-presence';
import type { PoPEvent } from './poap.service';

export interface ClaimResolution {
  event: PoPEvent;
  proofHash: string;
  claimId: string;
  proofDriver: string;
  proofRef: string;
  recipientAddress: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClaimService {
  private readonly backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api';
  private readonly presenceModule = createReferenceCkbPresenceModule();

  async verifyClaimToken(claimToken: string, address: string): Promise<ClaimResolution> {
    const res = await fetch(`${this.backendUrl}/claims/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claim_token: claimToken,
        address,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to verify claim token' }));
      throw new Error(error.error || 'Failed to verify claim token');
    }

    const data = await res.json() as {
      valid: boolean;
      proof_hash: string;
      claim: {
        claim_id: string;
        proof_driver: string;
        proof_ref: string;
        recipient_address: string;
      };
      event: ReferenceActiveEvent;
    };

    const eventRecord = this.presenceModule.mapReferenceScope(data.event);
    return {
      event: {
        id: eventRecord.id,
        name: eventRecord.metadata.name,
        date: eventRecord.metadata.startTime || eventRecord.activatedAt,
        issuer: eventRecord.creatorAddress,
        location: eventRecord.metadata.location || '',
        scopeKind: typeof eventRecord.metadata.scopeKind === 'string' ? eventRecord.metadata.scopeKind : undefined,
        participationMode: typeof eventRecord.metadata.participationMode === 'string' ? eventRecord.metadata.participationMode : undefined,
        description: eventRecord.metadata.description,
        imageUrl: eventRecord.metadata.imageUrl as string | undefined,
        anchorTxHash: eventRecord.anchorTxHash,
      },
      proofHash: data.proof_hash,
      claimId: data.claim.claim_id,
      proofDriver: data.claim.proof_driver,
      proofRef: data.claim.proof_ref,
      recipientAddress: data.claim.recipient_address,
    };
  }
}
