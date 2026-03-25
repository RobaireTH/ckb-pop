export type PresenceExtensionKind = 'proof' | 'artifact' | 'policy';
export type PresenceExtensionStatus = 'reference' | 'active' | 'experimental';

export interface PresenceExtensionSummary {
  id: string;
  kind: PresenceExtensionKind;
  label: string;
  summary: string;
  status: PresenceExtensionStatus;
}

export interface PresenceProofResolution {
  extensionId: string;
  eventId: string;
  raw: string;
  timestampMs?: number;
  metadata?: Record<string, unknown>;
}

export interface PresenceProofDriver {
  id: string;
  label: string;
  summary: string;
  status?: PresenceExtensionStatus;
  parse(raw: string): PresenceProofResolution | null;
  validate?(resolution: PresenceProofResolution, now: number): void;
}

export interface PresenceArtifactDriver {
  id: string;
  label: string;
  summary: string;
  status?: PresenceExtensionStatus;
}

export interface PresencePolicyExtension {
  id: string;
  label: string;
  summary: string;
  status?: PresenceExtensionStatus;
}

export interface PresenceModuleManifest {
  namespace: string;
  name: string;
  version: string;
  summary: string;
  proofDrivers: PresenceExtensionSummary[];
  artifactDrivers: PresenceExtensionSummary[];
  policyExtensions: PresenceExtensionSummary[];
}

export interface PresenceEventMetadata {
  name: string;
  description?: string;
  imageUrl?: string;
  location?: string;
  startTime?: string | null;
  endTime?: string | null;
  [key: string]: unknown;
}

export interface PresenceEventRecord {
  id: string;
  namespace: string;
  creatorAddress: string;
  activatedAt: string;
  anchorTxHash?: string;
  metadata: PresenceEventMetadata;
}

export interface PresenceArtifactRecord {
  id: string;
  kind: string;
  eventId: string;
  ownerAddress: string;
  mintedAt: string;
  txHash: string;
  blockNumber?: number;
  metadata: Record<string, unknown>;
}

export interface PresenceCodePolicy {
  delimiter: string;
  maxAgeMs: number;
  maxFutureMs: number;
}

export interface PresenceModuleConfig {
  namespace: string;
  name: string;
  version?: string;
  summary: string;
  proofDrivers?: PresenceProofDriver[];
  artifactDrivers?: PresenceArtifactDriver[];
  policyExtensions?: PresencePolicyExtension[];
}

export interface CreatePresenceEventInput {
  name: string;
  date?: string;
  location?: string;
  description?: string;
  imageUrl?: string;
}

export interface CreatePresenceIntentPayload {
  creator_address: string;
  creator_signature: string;
  nonce: string;
  metadata: {
    name: string;
    description: string;
    image_url: string | null;
    location: string | null;
    start_time: string | null;
    end_time: string | null;
  };
}

export interface ReferenceActiveEvent {
  event_id: string;
  metadata: {
    name: string;
    description?: string;
    image_url?: string | null;
    location?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    [key: string]: unknown;
  };
  creator_address: string;
  payment_tx_hash?: string;
  activated_at: string;
}

export interface ReferenceBadgeObservation {
  event_id: string;
  holder_address: string;
  mint_tx_hash: string;
  mint_block_number: number;
  verified_at_block: number;
  observed_at: string;
}
