import type {
  CreatePresenceEventInput,
  CreatePresenceIntentPayload,
  PresenceArtifactDriver,
  PresenceArtifactRecord,
  PresenceCodePolicy,
  PresenceEventRecord,
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

export function createCkbBadgeArtifactDriver(): PresenceArtifactDriver {
  return {
    id: 'ckb-dob-badge',
    label: 'CKB Presence Badge',
    summary: 'Mints a non-transferable CKB cell that represents a unique presence artifact.',
    status: 'reference',
  };
}

export function createEventAnchorArtifactDriver(): PresenceArtifactDriver {
  return {
    id: 'ckb-event-anchor',
    label: 'CKB Event Anchor',
    summary: 'Anchors event identity on-chain so off-chain proof systems have a stable CKB root.',
    status: 'reference',
  };
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
    resolveEventLocator(raw: string, now = Date.now()): PresenceProofResolution {
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
    mapReferenceEvent(event: ReferenceActiveEvent): PresenceEventRecord {
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
        },
      };
    },
    mapReferenceBadge(
      badge: ReferenceBadgeObservation,
      event?: PresenceEventRecord
    ): PresenceArtifactRecord {
      return {
        id: `${badge.event_id}-${badge.holder_address}`,
        kind: 'badge',
        eventId: badge.event_id,
        ownerAddress: badge.holder_address,
        mintedAt: badge.observed_at,
        txHash: badge.mint_tx_hash,
        blockNumber: badge.mint_block_number > 0 ? badge.mint_block_number : undefined,
        metadata: {
          eventName: event?.metadata.name || badge.event_id,
          imageUrl: event?.metadata.imageUrl,
          verifiedAtBlock: badge.verified_at_block,
        },
      };
    },
    buildCreateEventIntent(input: {
      creatorAddress: string;
      creatorSignature: string;
      nonce: string;
      event: CreatePresenceEventInput;
    }): CreatePresenceIntentPayload {
      return {
        creator_address: input.creatorAddress,
        creator_signature: input.creatorSignature,
        nonce: input.nonce,
        metadata: {
          name: input.event.name,
          description: input.event.description || '',
          image_url: input.event.imageUrl || null,
          location: input.event.location || null,
          start_time: normalizeDate(input.event.date),
          end_time: null,
        },
      };
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
    version: '0.1.0',
    summary: 'Reusable, extensible presence primitives for any application building on CKB.',
    proofDrivers: [
      createDynamicQrProofDriver(),
      createPlainEventIdProofDriver(),
    ],
    artifactDrivers: [
      createCkbBadgeArtifactDriver(),
      createEventAnchorArtifactDriver(),
    ],
    policyExtensions: [
      createTimedWindowPolicyExtension(),
      createBackendObservationPolicyExtension(),
    ],
  });
}
