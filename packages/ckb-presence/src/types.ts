export type PresenceExtensionKind = 'proof' | 'artifact' | 'policy';
export type PresenceExtensionStatus = 'reference' | 'active' | 'experimental';
export type PresenceScopeKind =
  | 'event'
  | 'hackathon'
  | 'program'
  | 'course'
  | 'campaign'
  | 'bounty'
  | 'membership'
  | 'custom';
export type ParticipationMode = 'in-person' | 'online' | 'hybrid' | 'async';

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

export interface PresenceSignedClaim {
  scopeId: string;
  recipientAddress: string;
  claimId: string;
  proofDriver: string;
  proofRef: string;
  issuerAddress: string;
  issuedAt: number;
  expiresAt?: number | null;
  issuerSignature: string;
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

export interface PresenceApiRoute {
  method: string;
  path: string;
  purpose: string;
}

export interface PresenceApiSurface {
  basePath: string;
  routes: PresenceApiRoute[];
}

export interface PresenceModuleRuntime {
  addressHrp: string;
  badgeSyncEnabled: boolean;
  backendAuthority: string;
}

export interface PresenceBackendManifest extends PresenceModuleManifest {
  api: PresenceApiSurface;
  runtime: PresenceModuleRuntime;
  notes: string[];
}

export interface PresenceScopeMetadata {
  name: string;
  description?: string;
  imageUrl?: string;
  location?: string;
  startTime?: string | null;
  endTime?: string | null;
  scopeKind?: PresenceScopeKind;
  participationMode?: ParticipationMode;
  [key: string]: unknown;
}

export interface PresenceScopeRecord {
  id: string;
  namespace: string;
  creatorAddress: string;
  activatedAt: string;
  anchorTxHash?: string;
  metadata: PresenceScopeMetadata;
}

export type PresenceEventMetadata = PresenceScopeMetadata;
export type PresenceEventRecord = PresenceScopeRecord;

export interface PresenceArtifactRecord {
  id: string;
  kind: string;
  scopeId: string;
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

export interface CreatePresenceScopeInput {
  name: string;
  date?: string;
  location?: string;
  description?: string;
  imageUrl?: string;
  scopeKind?: PresenceScopeKind;
  participationMode?: ParticipationMode;
}

export type CreatePresenceEventInput = CreatePresenceScopeInput;

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
    scope_kind: PresenceScopeKind | null;
    participation_mode: ParticipationMode | null;
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
    scope_kind?: PresenceScopeKind | null;
    participation_mode?: ParticipationMode | null;
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
