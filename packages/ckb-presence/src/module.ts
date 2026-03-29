import type {
  CreatePresenceEventInput,
  CreatePresenceScopeInput,
  CreatePresenceIntentPayload,
  PresenceArtifactDriver,
  PresenceArtifactRecord,
  PresenceCodePolicy,
  PresenceEventRecord,
  PresenceScopeKind,
  PresenceSignedClaim,
  ParticipationMode,
  PresenceExtensionKind,
  PresenceExtensionStatus,
  PresenceModuleConfig,
  PresenceModuleManifest,
  PresencePolicyExtension,
  PresenceProofDriver,
  PresenceProofResolution,
  ReferenceActiveEvent,
  ReferenceBadgeObservation,
} from './types';

const DEFAULT_DYNAMIC_QR_POLICY: PresenceCodePolicy = {
  delimiter: '|',
  maxAgeMs: 60_000,
  maxFutureMs: 10_000,
};

function toSummary(
  kind: PresenceExtensionKind,
  extension: { id: string; label: string; summary: string; status?: PresenceExtensionStatus }
) {
  return {
    id: extension.id,
    kind,
    label: extension.label,
    summary: extension.summary,
    status: extension.status ?? 'active',
  } as const;
}

function normalizeDate(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function encodeBase64Url(data: string): string {
  if (typeof globalThis.btoa === 'function') {
    return globalThis
      .btoa(data)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  const bufferCtor = (globalThis as { Buffer?: { from(data: string, encoding: string): { toString(encoding: string): string } } }).Buffer;
  if (!bufferCtor) {
    throw new Error('No base64 encoder available in this runtime.');
  }
  return bufferCtor.from(data, 'utf8').toString('base64url');
}

function decodeBase64Url(data: string): string {
  if (typeof globalThis.atob === 'function') {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    return globalThis.atob(padded);
  }

  const bufferCtor = (globalThis as { Buffer?: { from(data: string, encoding: string): { toString(encoding: string): string } } }).Buffer;
  if (!bufferCtor) {
    throw new Error('No base64 decoder available in this runtime.');
  }
  return bufferCtor.from(data, 'base64url').toString('utf8');
}

export function buildSignedClaimMessage(claim: Omit<PresenceSignedClaim, 'issuerSignature'>): string {
  const expiresAt = claim.expiresAt == null ? 'open' : claim.expiresAt.toString();
  return `CKB-PoP-Claim|${claim.scopeId}|${claim.recipientAddress}|${claim.claimId}|${claim.proofDriver}|${claim.proofRef}|${claim.issuedAt}|${expiresAt}`;
}

export function encodeSignedClaimToken(claim: PresenceSignedClaim): string {
  return encodeBase64Url(JSON.stringify({
    event_id: claim.scopeId,
    recipient_address: claim.recipientAddress,
    claim_id: claim.claimId,
    proof_driver: claim.proofDriver,
    proof_ref: claim.proofRef,
    issuer_address: claim.issuerAddress,
    issued_at: claim.issuedAt,
    expires_at: claim.expiresAt ?? null,
    issuer_signature: claim.issuerSignature,
  }));
}

export function parseSignedClaimToken(token: string): PresenceSignedClaim | null {
  try {
    const raw = JSON.parse(decodeBase64Url(token)) as Record<string, unknown>;
    const expiresAtRaw = raw.expiresAt ?? raw.expires_at;
    return {
      scopeId: String(raw.scopeId ?? raw.scope_id ?? raw.event_id ?? ''),
      recipientAddress: String(raw.recipientAddress ?? raw.recipient_address ?? ''),
      claimId: String(raw.claimId ?? raw.claim_id ?? ''),
      proofDriver: String(raw.proofDriver ?? raw.proof_driver ?? ''),
      proofRef: String(raw.proofRef ?? raw.proof_ref ?? ''),
      issuerAddress: String(raw.issuerAddress ?? raw.issuer_address ?? ''),
      issuedAt: Number(raw.issuedAt ?? raw.issued_at ?? 0),
      expiresAt: expiresAtRaw == null ? null : Number(expiresAtRaw),
      issuerSignature: String(raw.issuerSignature ?? raw.issuer_signature ?? ''),
    };
  } catch {
    return null;
  }
}

export function createPlainEventIdProofDriver(): PresenceProofDriver {
  return {
    id: 'plain-event-id',
    label: 'Plain Event ID',
    summary: 'Accepts raw event identifiers for manual entry and deep-link flows.',
    status: 'reference',
    parse(raw) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.includes('|')) {
        return null;
      }
      return {
        extensionId: 'plain-event-id',
        eventId: trimmed,
        raw: trimmed,
      };
    },
  };
}

export function createDynamicQrProofDriver(
  policy: Partial<PresenceCodePolicy> = {}
): PresenceProofDriver {
  const config = { ...DEFAULT_DYNAMIC_QR_POLICY, ...policy };

  return {
    id: 'dynamic-qr',
    label: 'Dynamic QR Proof',
    summary: 'Parses rotating QR payloads with timestamp validation for in-person presence flows.',
    status: 'reference',
    parse(raw) {
      const trimmed = raw.trim();
      if (!trimmed.includes(config.delimiter)) {
        return null;
      }

      const parts = trimmed.split(config.delimiter);
      if (parts.length < 2) {
        return null;
      }

      const eventId = parts[0]?.trim();
      const rawTimestamp = Number.parseInt(parts[1] ?? '', 10);
      if (!eventId || Number.isNaN(rawTimestamp)) {
        return null;
      }

      const timestampMs = rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp;
      const signature = parts[2]?.trim();

      return {
        extensionId: 'dynamic-qr',
        eventId,
        raw: trimmed,
        timestampMs,
        metadata: signature ? { signature } : undefined,
      };
    },
    validate(resolution, now) {
      if (resolution.timestampMs == null) {
        return;
      }
      if (now - resolution.timestampMs > config.maxAgeMs) {
        throw new Error('QR Code Expired. Please scan the live screen again.');
      }
      if (resolution.timestampMs > now + config.maxFutureMs) {
        throw new Error('Invalid Time Check.');
      }
    },
  };
}

export function createSignedClaimProofDriver(): PresenceProofDriver {
  return {
    id: 'signed-claim',
    label: 'Signed Claim Proof',
    summary: 'Parses organizer-issued claim tokens for online or asynchronous participation flows.',
    status: 'reference',
    parse(raw) {
      const trimmed = raw.trim();
      if (!trimmed.startsWith('claim:')) {
        return null;
      }
      const [, scopeId, claimRef] = trimmed.split(':');
      if (!scopeId || !claimRef) {
        return null;
      }
      return {
        extensionId: 'signed-claim',
        eventId: scopeId,
        raw: trimmed,
        metadata: { claimRef },
      };
    },
  };
}

export function createSubmissionProofDriver(): PresenceProofDriver {
  return {
    id: 'submission-proof',
    label: 'Submission Proof',
    summary: 'Parses submission or deliverable references for hackathons, bounties, and online programs.',
    status: 'reference',
    parse(raw) {
      const trimmed = raw.trim();
      if (!trimmed.startsWith('submission:')) {
        return null;
      }
      const [, scopeId, submissionRef] = trimmed.split(':');
      if (!scopeId || !submissionRef) {
        return null;
      }
      return {
        extensionId: 'submission-proof',
        eventId: scopeId,
        raw: trimmed,
        metadata: { submissionRef },
      };
    },
  };
}

export function createCkbParticipationBadgeArtifactDriver(): PresenceArtifactDriver {
  return {
    id: 'ckb-dob-badge',
    label: 'CKB Participation Badge',
    summary: 'Mints a non-transferable CKB cell that represents a unique participation artifact.',
    status: 'reference',
  };
}

export function createCkbBadgeArtifactDriver(): PresenceArtifactDriver {
  return createCkbParticipationBadgeArtifactDriver();
}

export function createCkbScopeAnchorArtifactDriver(): PresenceArtifactDriver {
  return {
    id: 'ckb-event-anchor',
    label: 'CKB Scope Anchor',
    summary: 'Anchors an issuance scope on-chain so off-chain proof systems have a stable CKB root.',
    status: 'reference',
  };
}

export function createEventAnchorArtifactDriver(): PresenceArtifactDriver {
  return createCkbScopeAnchorArtifactDriver();
}

export function createTimedWindowPolicyExtension(): PresencePolicyExtension {
  return {
    id: 'timed-window',
    label: 'Timed Window Policy',
    summary: 'Constrains proof validity to a rolling event window for replay resistance.',
    status: 'reference',
  };
}

export function createBackendObservationPolicyExtension(): PresencePolicyExtension {
  return {
    id: 'backend-observation',
    label: 'Backend Observation Policy',
    summary: 'Allows reference backends to cache state and observe chain confirmations without gaining authority.',
    status: 'reference',
  };
}

export function createOrganizerAttestationPolicyExtension(): PresencePolicyExtension {
  return {
    id: 'organizer-attestation',
    label: 'Organizer Attestation Policy',
    summary: 'Allows an organizer or program operator to attest that a participant completed an online or hybrid requirement.',
    status: 'reference',
  };
}

export function createSubmissionReviewPolicyExtension(): PresencePolicyExtension {
  return {
    id: 'submission-review',
    label: 'Submission Review Policy',
    summary: 'Supports issuing badges after a submission, contribution, or deliverable has been reviewed.',
    status: 'reference',
  };
}

function normalizeScopeKind(kind?: PresenceScopeKind): PresenceScopeKind | null {
  return kind ?? null;
}

function normalizeParticipationMode(mode?: ParticipationMode): ParticipationMode | null {
  return mode ?? null;
}

function registerUnique<T extends { id: string }>(registry: Map<string, T>, value: T, label: string) {
  if (registry.has(value.id)) {
    throw new Error(`${label} "${value.id}" is already registered.`);
  }
  registry.set(value.id, value);
}

export function createPresenceModule(config: PresenceModuleConfig) {
  const proofDrivers = new Map<string, PresenceProofDriver>();
  const artifactDrivers = new Map<string, PresenceArtifactDriver>();
  const policyExtensions = new Map<string, PresencePolicyExtension>();

  const api = {
    registerProofDriver(driver: PresenceProofDriver) {
      registerUnique(proofDrivers, driver, 'Proof driver');
      return api;
    },
    registerArtifactDriver(driver: PresenceArtifactDriver) {
      registerUnique(artifactDrivers, driver, 'Artifact driver');
      return api;
    },
    registerPolicyExtension(extension: PresencePolicyExtension) {
      registerUnique(policyExtensions, extension, 'Policy extension');
      return api;
    },
    listExtensions() {
      return {
        proofDrivers: Array.from(proofDrivers.values()).map(driver => toSummary('proof', driver)),
        artifactDrivers: Array.from(artifactDrivers.values()).map(driver => toSummary('artifact', driver)),
        policyExtensions: Array.from(policyExtensions.values()).map(extension => toSummary('policy', extension)),
      };
    },
    manifest(): PresenceModuleManifest {
      const extensions = api.listExtensions();
      return {
        namespace: config.namespace,
        name: config.name,
        version: config.version ?? '0.1.0',
        summary: config.summary,
        proofDrivers: extensions.proofDrivers,
        artifactDrivers: extensions.artifactDrivers,
        policyExtensions: extensions.policyExtensions,
      };
    },
    resolveScopeLocator(raw: string, now = Date.now()): PresenceProofResolution {
      const trimmed = raw.trim();
      if (!trimmed) {
        throw new Error('Presence locator cannot be empty.');
      }

      for (const driver of proofDrivers.values()) {
        const resolution = driver.parse(trimmed);
        if (!resolution) {
          continue;
        }
        driver.validate?.(resolution, now);
        return resolution;
      }

      throw new Error('Unsupported presence locator format.');
    },
    resolveEventLocator(raw: string, now = Date.now()): PresenceProofResolution {
      return api.resolveScopeLocator(raw, now);
    },
    mapReferenceScope(event: ReferenceActiveEvent): PresenceEventRecord {
      return {
        id: event.event_id,
        namespace: config.namespace,
        creatorAddress: event.creator_address,
        activatedAt: event.metadata.start_time || event.activated_at,
        anchorTxHash: event.payment_tx_hash || undefined,
        metadata: {
          name: event.metadata.name,
          description: event.metadata.description || undefined,
          imageUrl: event.metadata.image_url || undefined,
          location: event.metadata.location || undefined,
          startTime: event.metadata.start_time ?? null,
          endTime: event.metadata.end_time ?? null,
          scopeKind: event.metadata.scope_kind ?? 'event',
          participationMode: event.metadata.participation_mode ?? (event.metadata.location ? 'in-person' : undefined),
        },
      };
    },
    mapReferenceEvent(event: ReferenceActiveEvent): PresenceEventRecord {
      return api.mapReferenceScope(event);
    },
    mapReferenceArtifact(
      badge: ReferenceBadgeObservation,
      event?: PresenceEventRecord
    ): PresenceArtifactRecord {
      return {
        id: `${badge.event_id}-${badge.holder_address}`,
        kind: 'badge',
        scopeId: badge.event_id,
        eventId: badge.event_id,
        ownerAddress: badge.holder_address,
        mintedAt: badge.observed_at,
        txHash: badge.mint_tx_hash,
        blockNumber: badge.mint_block_number > 0 ? badge.mint_block_number : undefined,
        metadata: {
          scopeName: event?.metadata.name || badge.event_id,
          eventName: event?.metadata.name || badge.event_id,
          imageUrl: event?.metadata.imageUrl,
          scopeKind: event?.metadata.scopeKind || 'event',
          participationMode: event?.metadata.participationMode,
          verifiedAtBlock: badge.verified_at_block,
        },
      };
    },
    mapReferenceBadge(
      badge: ReferenceBadgeObservation,
      event?: PresenceEventRecord
    ): PresenceArtifactRecord {
      return api.mapReferenceArtifact(badge, event);
    },
    buildCreateScopeIntent(input: {
      creatorAddress: string;
      creatorSignature: string;
      nonce: string;
      scope: CreatePresenceScopeInput;
    }): CreatePresenceIntentPayload {
      return {
        creator_address: input.creatorAddress,
        creator_signature: input.creatorSignature,
        nonce: input.nonce,
        metadata: {
          name: input.scope.name,
          description: input.scope.description || '',
          image_url: input.scope.imageUrl || null,
          location: input.scope.location || null,
          start_time: normalizeDate(input.scope.date),
          end_time: null,
          scope_kind: normalizeScopeKind(input.scope.scopeKind),
          participation_mode: normalizeParticipationMode(input.scope.participationMode),
        },
      };
    },
    buildCreateEventIntent(input: {
      creatorAddress: string;
      creatorSignature: string;
      nonce: string;
      event: CreatePresenceEventInput;
    }): CreatePresenceIntentPayload {
      return api.buildCreateScopeIntent({
        creatorAddress: input.creatorAddress,
        creatorSignature: input.creatorSignature,
        nonce: input.nonce,
        scope: input.event,
      });
    },
  };

  for (const driver of config.proofDrivers || []) {
    api.registerProofDriver(driver);
  }
  for (const driver of config.artifactDrivers || []) {
    api.registerArtifactDriver(driver);
  }
  for (const extension of config.policyExtensions || []) {
    api.registerPolicyExtension(extension);
  }

  return api;
}

export function createReferenceCkbPresenceModule() {
  return createPresenceModule({
    namespace: 'ckb-pop',
    name: 'CKB Presence Module',
    version: '0.2.0',
    summary: 'Reusable, extensible presence and participation primitives for any application building on CKB.',
    proofDrivers: [
      createDynamicQrProofDriver(),
      createPlainEventIdProofDriver(),
      createSignedClaimProofDriver(),
      createSubmissionProofDriver(),
    ],
    artifactDrivers: [
      createCkbParticipationBadgeArtifactDriver(),
      createCkbScopeAnchorArtifactDriver(),
    ],
    policyExtensions: [
      createTimedWindowPolicyExtension(),
      createBackendObservationPolicyExtension(),
      createOrganizerAttestationPolicyExtension(),
      createSubmissionReviewPolicyExtension(),
    ],
  });
}
