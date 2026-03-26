import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type PresenceBackendManifest } from '../../lib/ckb-presence';
import { ModuleService } from '../../services/module.service';

@Component({
  selector: 'app-integrate',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="integrate-shell">
      <section class="hero">
        <div class="hero-copy">
          <div class="eyebrow">Integrator Surface</div>
          <h1>Build on the CKB presence module without reverse-engineering the app.</h1>
          <p>
            This surface exposes the module manifest, runtime support, extension points, and
            reference API routes so another team can wire their own organizer console, wallet flow,
            or chain adapter.
          </p>
          <div class="hero-cta">
            <a routerLink="/create" class="btn-primary">Use Reference Flow</a>
            <a href="#manifest" class="btn-secondary">Read Manifest</a>
          </div>
        </div>
        <div class="hero-card card">
          <div class="meta-row">
            <span class="meta-label">Namespace</span>
            <span class="meta-value">{{ manifest()?.namespace || 'Loading' }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Version</span>
            <span class="meta-value">{{ manifest()?.version || '...' }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Authority</span>
            <span class="meta-value">{{ manifest()?.runtime?.backendAuthority || '...' }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Address HRP</span>
            <span class="meta-value">{{ manifest()?.runtime?.addressHrp || '...' }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Badge Sync</span>
            <span class="meta-value">{{ manifest()?.runtime?.badgeSyncEnabled ? 'Enabled' : 'Optional' }}</span>
          </div>
        </div>
      </section>

      <section class="section" id="manifest">
        <div class="section-header">
          <div>
            <div class="eyebrow">Module Manifest</div>
            <h2>Capability discovery</h2>
          </div>
          <div class="manifest-endpoint card">GET {{ endpoint() }}</div>
        </div>

        @if (isLoading()) {
          <div class="empty-state card">Loading manifest from the backend adapter…</div>
        } @else {
          <div class="manifest-grid">
            <div class="panel card">
              <div class="panel-title">Proof Drivers</div>
              @for (item of manifest()?.proofDrivers || []; track item.id) {
                <div class="item-row">
                  <div>
                    <div class="item-title">{{ item.label }}</div>
                    <div class="item-text">{{ item.summary }}</div>
                  </div>
                  <span class="item-chip">{{ item.status }}</span>
                </div>
              }
            </div>

            <div class="panel card">
              <div class="panel-title">Artifact Drivers</div>
              @for (item of manifest()?.artifactDrivers || []; track item.id) {
                <div class="item-row">
                  <div>
                    <div class="item-title">{{ item.label }}</div>
                    <div class="item-text">{{ item.summary }}</div>
                  </div>
                  <span class="item-chip">{{ item.status }}</span>
                </div>
              }
            </div>

            <div class="panel card">
              <div class="panel-title">Policy Extensions</div>
              @for (item of manifest()?.policyExtensions || []; track item.id) {
                <div class="item-row">
                  <div>
                    <div class="item-title">{{ item.label }}</div>
                    <div class="item-text">{{ item.summary }}</div>
                  </div>
                  <span class="item-chip">{{ item.status }}</span>
                </div>
              }
            </div>
          </div>
        }
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <div class="eyebrow">Reference API</div>
            <h2>Routes another product can consume</h2>
          </div>
        </div>

        <div class="panel card">
          @for (route of manifest()?.api?.routes || []; track route.method + route.path) {
            <div class="route-row">
              <div class="route-method">{{ route.method }}</div>
              <div class="route-body">
                <div class="route-path">{{ route.path }}</div>
                <div class="route-purpose">{{ route.purpose }}</div>
              </div>
            </div>
          } @empty {
            <div class="empty-state">No backend route metadata available in fallback mode.</div>
          }
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <div class="eyebrow">Integration Notes</div>
            <h2>What to wire next</h2>
          </div>
        </div>

        <div class="notes-grid">
          <div class="panel card">
            <div class="panel-title">Runtime Notes</div>
            @for (note of manifest()?.notes || []; track note) {
              <div class="note-row">{{ note }}</div>
            }
          </div>
          <div class="panel card">
            <div class="panel-title">Recommended Expansion</div>
            @for (item of expansionIdeas; track item.title) {
              <div class="note-block">
                <div class="item-title">{{ item.title }}</div>
                <div class="item-text">{{ item.text }}</div>
              </div>
            }
          </div>
        </div>
      </section>

      @if (error()) {
        <section class="section">
          <div class="warning card">{{ error() }}</div>
        </section>
      }
    </div>
  `,
  styles: [`
    .integrate-shell {
      max-width: 1160px;
      margin: 0 auto;
      padding: 88px 16px 120px;
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
    .hero {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
      align-items: stretch;
    }
    @media (min-width: 960px) {
      .hero {
        grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
      }
    }
    .hero-copy, .hero-card, .panel, .warning {
      padding: 20px;
      background: rgba(5, 5, 5, 0.92);
      border: 1px solid rgba(255,255,255,0.05);
    }
    .hero-copy h1, .section-header h2 {
      font-family: var(--font-display);
      color: white;
      letter-spacing: -0.03em;
    }
    .hero-copy h1 {
      font-size: clamp(2rem, 5vw, 3.4rem);
      line-height: 0.95;
      margin-bottom: 16px;
    }
    .hero-copy p, .item-text, .route-purpose, .note-row, .warning {
      font-family: var(--font-sans);
      color: #a1a1aa;
      line-height: 1.6;
      font-size: 14px;
    }
    .eyebrow, .meta-label, .manifest-endpoint, .item-chip, .route-method {
      font-family: var(--font-mono);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 10px;
    }
    .eyebrow {
      color: #a3e635;
      margin-bottom: 10px;
    }
    .hero-cta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 22px;
    }
    .btn-primary, .btn-secondary {
      text-decoration: none;
    }
    .hero-card {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 14px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      padding-bottom: 10px;
    }
    .meta-row:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
    .meta-label {
      color: #71717a;
    }
    .meta-value, .item-title, .route-path, .panel-title {
      color: white;
      font-family: var(--font-display);
    }
    .meta-value {
      font-size: 15px;
    }
    .section {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .section-header {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    @media (min-width: 720px) {
      .section-header {
        flex-direction: row;
        justify-content: space-between;
        align-items: end;
      }
    }
    .section-header h2 {
      font-size: 1.4rem;
    }
    .manifest-endpoint {
      color: #d4d4d8;
      padding: 10px 12px;
      align-self: flex-start;
    }
    .manifest-grid, .notes-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
    }
    @media (min-width: 900px) {
      .manifest-grid {
        grid-template-columns: repeat(3, 1fr);
      }
      .notes-grid {
        grid-template-columns: 1fr 1fr;
      }
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .panel-title {
      font-size: 1rem;
      margin-bottom: 4px;
    }
    .item-row, .route-row, .note-block {
      display: flex;
      gap: 12px;
      justify-content: space-between;
      border-top: 1px solid rgba(255,255,255,0.05);
      padding-top: 12px;
    }
    .item-row:first-of-type, .route-row:first-of-type, .note-block:first-of-type {
      border-top: 0;
      padding-top: 0;
    }
    .item-chip {
      color: #a3e635;
      border: 1px solid rgba(163,230,53,0.2);
      padding: 4px 8px;
      height: fit-content;
    }
    .route-method {
      min-width: 44px;
      color: #a3e635;
    }
    .route-path {
      font-size: 0.98rem;
      margin-bottom: 4px;
    }
    .empty-state {
      font-family: var(--font-mono);
      color: #71717a;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      padding: 16px;
      border: 1px dashed rgba(255,255,255,0.08);
    }
    .warning {
      color: #facc15;
      border-color: rgba(250, 204, 21, 0.18);
      background: rgba(38, 32, 3, 0.3);
    }
  `]
})
export class IntegrateComponent implements OnInit {
  private readonly moduleService = inject(ModuleService);

  protected readonly manifest = signal<PresenceBackendManifest | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly endpoint = computed(() => {
    const manifest = this.manifest();
    return `${manifest?.api.basePath || '/api'}/module/manifest`;
  });

  protected readonly expansionIdeas = [
    {
      title: 'More proof drivers',
      text: 'Add proximity, NFC, organizer attestation, or multi-witness drivers without rewriting the artifact layer.',
    },
    {
      title: 'More artifact drivers',
      text: 'Export the same presence proof into alternate CKB-native artifacts or downstream attestations.',
    },
    {
      title: 'Policy modules',
      text: 'Layer in threshold witnesses, venue rules, or anti-fraud heuristics as replaceable policy extensions.',
    },
  ];

  async ngOnInit(): Promise<void> {
    try {
      this.manifest.set(await this.moduleService.getManifest());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to load the module surface.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
