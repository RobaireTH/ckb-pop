import { Injectable } from '@angular/core';
import {
  createReferenceCkbPresenceModule,
  type PresenceBackendManifest,
} from '../lib/ckb-presence';

@Injectable({
  providedIn: 'root'
})
export class ModuleService {
  private readonly backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api';
  private readonly localModule = createReferenceCkbPresenceModule();
  private readonly network = import.meta.env.VITE_CKB_NETWORK || 'testnet';

  async getManifest(): Promise<PresenceBackendManifest> {
    try {
      const res = await fetch(`${this.backendUrl}/module/manifest`);
      if (!res.ok) {
        throw new Error(`Manifest request failed with ${res.status}`);
      }
      const data = await res.json();
      return this.normalizeBackendManifest(data);
    } catch {
      return this.buildFallbackManifest();
    }
  }

  private normalizeBackendManifest(data: Record<string, unknown>): PresenceBackendManifest {
    return {
      namespace: String(data['namespace'] || 'ckb-pop'),
      name: String(data['name'] || 'CKB Presence Module'),
      version: String(data['version'] || '0.1.0'),
      summary: String(data['summary'] || this.localModule.manifest().summary),
      proofDrivers: Array.isArray(data['proof_drivers']) ? data['proof_drivers'] as PresenceBackendManifest['proofDrivers'] : this.localModule.manifest().proofDrivers,
      artifactDrivers: Array.isArray(data['artifact_drivers']) ? data['artifact_drivers'] as PresenceBackendManifest['artifactDrivers'] : this.localModule.manifest().artifactDrivers,
      policyExtensions: Array.isArray(data['policy_extensions']) ? data['policy_extensions'] as PresenceBackendManifest['policyExtensions'] : this.localModule.manifest().policyExtensions,
      api: {
        basePath: String((data['api'] as Record<string, unknown> | undefined)?.['base_path'] || '/api'),
        routes: Array.isArray((data['api'] as Record<string, unknown> | undefined)?.['routes'])
          ? (data['api'] as Record<string, unknown>).routes as PresenceBackendManifest['api']['routes']
          : [],
      },
      runtime: {
        addressHrp: String((data['runtime'] as Record<string, unknown> | undefined)?.['address_hrp'] || this.defaultAddressHrp()),
        badgeSyncEnabled: Boolean((data['runtime'] as Record<string, unknown> | undefined)?.['badge_sync_enabled']),
        backendAuthority: String((data['runtime'] as Record<string, unknown> | undefined)?.['backend_authority'] || 'non-authoritative'),
      },
      notes: Array.isArray(data['notes']) ? (data['notes'] as string[]) : [],
    };
  }

  private buildFallbackManifest(): PresenceBackendManifest {
    const manifest = this.localModule.manifest();
    return {
      ...manifest,
      api: {
        basePath: '/api',
        routes: [],
      },
      runtime: {
        addressHrp: this.defaultAddressHrp(),
        badgeSyncEnabled: false,
        backendAuthority: 'frontend-fallback',
      },
      notes: [
        'Backend manifest unavailable. Showing the local reference module definition.',
      ],
    };
  }

  private defaultAddressHrp(): string {
    return this.network === 'mainnet' ? 'ckb' : 'ckt';
  }
}
