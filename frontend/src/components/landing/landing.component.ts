import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WalletService } from '../../services/wallet.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="landing-shell noise-overlay" [class.entered]="entered()">
      <section class="hero-section">
        <div class="hero-grid-lines" aria-hidden="true">
          @for (line of horizontalLines; track line) {
            <span class="hero-grid-line horizontal" [style.top.%]="line"></span>
          }
          @for (line of verticalLines; track line) {
            <span class="hero-grid-line vertical" [style.left.%]="line"></span>
          }
        </div>
        <div class="hero-orb" aria-hidden="true"></div>

        <div class="hero-content">
          <div class="eyebrow">
            <span class="eyebrow-line"></span>
            CKB presence protocol
          </div>

          <h1 class="hero-title">
            <span class="hero-title-line">Proof of presence.</span>
            <span class="hero-title-line">Built to <span class="rotating-word">{{ heroWords[activeWord()] }}</span>.</span>
          </h1>

          <div class="hero-subgrid">
            <p class="hero-copy">
              Verify real-world attendance, online hackathon completion, async program progress, and
              community milestones with claimable SBTs on Nervos CKB. Self-custody first. Chain-enforced uniqueness.
            </p>

            <div class="hero-actions">
              <a routerLink="/check-in" class="hero-primary">
                <span>{{ walletService.isConnected() ? 'Verify participation' : 'Get started' }}</span>
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </a>
              <a routerLink="/claim" class="hero-secondary">Claim online badge</a>
              <a routerLink="/create" class="hero-secondary">Create a scope</a>
            </div>
          </div>
        </div>

        <div class="hero-marquee">
          <div class="hero-marquee-track">
            @for (set of [0,1]; track set) {
              <div class="hero-marquee-group">
                @for (stat of heroStats; track stat.value + stat.label) {
                  <div class="hero-stat">
                    <span class="hero-stat-value">{{ stat.value }}</span>
                    <span class="hero-stat-label">
                      {{ stat.label }}
                      <span class="hero-stat-meta">{{ stat.meta }}</span>
                    </span>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </section>

      <section id="features" class="content-section">
        <div class="section-heading">
          <div class="eyebrow">
            <span class="eyebrow-line"></span>
            Why ckb-pop
          </div>
          <h2>One issuance system for physical, online, hybrid, and async participation.</h2>
          <p>
            The module is no longer boxed into rotating QR check-ins. The same SBT primitive now spans
            claims, submissions, organizer attestations, and chain-verifiable ownership.
          </p>
        </div>

        <div class="feature-grid">
          @for (feature of features; track feature.number) {
            <article class="feature-card hover-lift">
              <div class="feature-number">{{ feature.number }}</div>
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.description }}</p>
              <div class="feature-visual">{{ feature.visual }}</div>
            </article>
          }
        </div>
      </section>

      <section id="how-it-works" class="workflow-section">
        <div class="section-heading workflow-heading">
          <div>
            <div class="eyebrow">
              <span class="eyebrow-line"></span>
              How it works
            </div>
            <h2>Three steps. Many scope types.</h2>
          </div>
        </div>

        <div class="workflow-grid">
          <div class="workflow-steps">
            @for (step of workflowSteps; track step.number; let i = $index) {
              <button type="button" class="workflow-step" [class.active]="activeStep() === i" (click)="activeStep.set(i)">
                <div class="workflow-step-index">{{ step.number }}</div>
                <div class="workflow-step-copy">
                  <h3>{{ step.title }}</h3>
                  <p>{{ step.description }}</p>
                  @if (activeStep() === i) {
                    <span class="workflow-progress"></span>
                  }
                </div>
              </button>
            }
          </div>

          <div class="workflow-code-panel">
            <div class="workflow-code-header">
              <div class="workflow-code-dots">
                <span></span><span></span><span></span>
              </div>
              <span class="workflow-code-file">flow.ts</span>
            </div>
            <div class="workflow-code-body">
              @for (line of workflowSteps[activeStep()].code; track line; let lineIndex = $index) {
                <div class="workflow-code-line" [style.animation-delay.ms]="lineIndex * 55">
                  <span class="workflow-code-number">{{ lineIndex + 1 }}</span>
                  <span class="workflow-code-text">{{ line }}</span>
                </div>
              }
            </div>
            <div class="workflow-code-status">
              <span class="workflow-code-ping"></span>
              <span>ready</span>
            </div>
          </div>
        </div>
      </section>

      <section class="action-strip-section">
        <div class="action-strip">
          <div class="action-strip-copy">
            <div class="eyebrow">
              <span class="eyebrow-line"></span>
              Start here
            </div>
            <h2>Issue badges beyond physical attendance.</h2>
            <p>
              Claim a badge from an online completion flow or open the integration surface and wire the product into your own stack.
            </p>
          </div>
          <div class="hero-actions">
            <a routerLink="/claim" class="hero-primary">
              <span>Claim online badge</span>
            </a>
            <a routerLink="/integrate" class="hero-secondary">Open integration surface</a>
          </div>
        </div>
      </section>

      <section class="content-section scope-section">
        <div class="scope-grid">
          <div class="scope-copy">
            <div class="eyebrow">
              <span class="eyebrow-line"></span>
              Scope model
            </div>
            <h2>Event is just one scope kind.</h2>
            <p>
              Use the same contracts and package for summits, hackathons, programs, courses, campaigns,
              bounties, and memberships. The proof changes. The badge primitive stays stable.
            </p>
            <div class="scope-stat-grid">
              @for (item of scopeStats; track item.value + item.label) {
                <div class="scope-stat">
                  <div class="scope-stat-value">{{ item.value }}</div>
                  <div class="scope-stat-label">{{ item.label }}</div>
                </div>
              }
            </div>
          </div>

          <div class="scope-list-card">
            <div class="scope-list-header">
              <span>Issuance scopes</span>
              <span class="scope-badge">live model</span>
            </div>
            @for (scope of scopeRows; track scope.name; let i = $index) {
              <div class="scope-row" [class.scope-row-active]="activeScope() === i">
                <div>
                  <div class="scope-row-name">{{ scope.name }}</div>
                  <div class="scope-row-meta">{{ scope.mode }}</div>
                </div>
                <div class="scope-row-proof">{{ scope.proof }}</div>
              </div>
            }
          </div>
        </div>
      </section>

      <section id="studio" class="metric-section">
        <div class="section-heading metric-heading">
          <div>
            <div class="eyebrow">
              <span class="eyebrow-line"></span>
              Live protocol metrics
            </div>
            <h2>Primitives you can count.</h2>
          </div>
          <div class="metric-clock">
            <span class="metric-live-dot"></span>
            <span>{{ clock() }}</span>
          </div>
        </div>

        <div class="metric-grid">
          @for (metric of metricCards; track metric.label) {
            <div class="metric-card">
              <div class="metric-value">{{ metric.value }}</div>
              <div class="metric-label">{{ metric.label }}</div>
            </div>
          }
        </div>
      </section>

      <section id="integrations" class="integration-section">
        <div class="section-heading centered">
          <div class="eyebrow centered-label">
            <span class="eyebrow-line"></span>
            Integration examples
            <span class="eyebrow-line"></span>
          </div>
          <h2>Fits the products that already coordinate participation.</h2>
          <p>
            Products that coordinate participation can all issue the same style of badge through
            different proof drivers without changing the ownership primitive.
          </p>
        </div>

        <div class="integration-marquee">
          <div class="integration-track">
            @for (set of [0,1]; track set) {
              <div class="integration-group">
                @for (integration of integrations; track integration.name + integration.category) {
                  <div class="integration-card hover-lift">
                    <div class="integration-name">{{ integration.name }}</div>
                    <div class="integration-category">{{ integration.category }}</div>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <div class="integration-marquee reverse">
          <div class="integration-track reverse">
            @for (set of [0,1]; track set) {
              <div class="integration-group">
                @for (integration of reverseIntegrations; track integration.name + integration.category) {
                  <div class="integration-card hover-lift">
                    <div class="integration-name">{{ integration.name }}</div>
                    <div class="integration-category">{{ integration.category }}</div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </section>

      <section id="security" class="content-section security-section">
        <div class="security-grid">
          <div class="security-copy">
            <div class="eyebrow">
              <span class="eyebrow-line"></span>
              Trust model
            </div>
            <h2>Trust is not delegated to the backend.</h2>
            <p>
              CKB enforces ownership and uniqueness. The package standardizes proof and scope semantics.
              The backend remains an adapter that can be replaced by any integrator.
            </p>
            <div class="security-tags">
              @for (tag of securityTags; track tag) {
                <span>{{ tag }}</span>
              }
            </div>
          </div>
          <div class="security-list">
            @for (item of securityFeatures; track item.title) {
              <div class="security-item hover-lift">
                <div class="security-icon">{{ item.icon }}</div>
                <div>
                  <h3>{{ item.title }}</h3>
                  <p>{{ item.description }}</p>
                </div>
              </div>
            }
          </div>
        </div>
      </section>

      <section id="developers" class="content-section developer-section">
        <div class="developer-grid">
          <div class="developer-copy">
            <div class="eyebrow">
              <span class="eyebrow-line"></span>
              For developers
            </div>
            <h2>Built for products that need a reusable issuance layer.</h2>
            <p>
              Install the npm kit, issue claim tokens from your own backend, and let users sign the
              final mint. The reference backend and app remain optional.
            </p>
            <div class="developer-points">
              @for (item of developerFeatures; track item.title) {
                <div>
                  <h3>{{ item.title }}</h3>
                  <p>{{ item.description }}</p>
                </div>
              }
            </div>
          </div>

          <div class="developer-code-card">
            <div class="developer-tabs">
              @for (tab of developerTabs; track tab.label; let i = $index) {
                <button type="button" [class.developer-tab-active]="activeCodeTab() === i" (click)="activeCodeTab.set(i)">{{ tab.label }}</button>
              }
            </div>
            <div class="developer-code-body">
              @for (line of developerTabs[activeCodeTab()].code; track line; let i = $index) {
                <div class="developer-code-line" [style.animation-delay.ms]="i * 50">
                  <span>{{ line }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      </section>

      <section class="use-case-section">
        <div class="use-case-header">
          <span class="eyebrow">
            <span class="eyebrow-line"></span>
            Use case spotlight
          </span>
          <span class="use-case-counter">{{ activeUseCase() + 1 | number:'2.0' }}/{{ useCases.length | number:'2.0' }}</span>
        </div>

        <div class="use-case-grid">
          <div class="use-case-quote">
            “{{ useCases[activeUseCase()].quote }}”
            <div class="use-case-author">{{ useCases[activeUseCase()].author }}</div>
          </div>
          <div class="use-case-metric-card">
            <div class="use-case-metric-label">Key result</div>
            <div class="use-case-metric">{{ useCases[activeUseCase()].metric }}</div>
            <div class="use-case-dots">
              @for (item of useCases; track item.author; let i = $index) {
                <button type="button" [class.dot-active]="activeUseCase() === i" (click)="activeUseCase.set(i)"></button>
              }
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" class="adoption-section">
        <div class="section-heading adoption-heading">
          <div class="eyebrow">
            <span class="eyebrow-line"></span>
            Adoption paths
          </div>
          <h2>Start with the shape that fits your team.</h2>
          <p>
            Not every team needs the full stack on day one. Use the reference app, the npm kit, or
            the contracts alone depending on where your product already lives.
          </p>
        </div>

        <div class="adoption-grid">
          @for (track of adoptionTracks; track track.name) {
            <article class="adoption-card" [class.adoption-card-featured]="track.featured">
              @if (track.featured) {
                <div class="adoption-badge">Most complete</div>
              }
              <div class="adoption-index">{{ track.number }}</div>
              <h3>{{ track.name }}</h3>
              <p class="adoption-description">{{ track.description }}</p>
              <ul>
                @for (item of track.items; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
              <a [routerLink]="track.route" class="adoption-link">{{ track.cta }}</a>
            </article>
          }
        </div>
      </section>

    </div>
  `,
  styles: [`
    .landing-shell {
      position: relative;
      min-height: 100vh;
      overflow-x: hidden;
      padding-top: 24px;
      opacity: 0;
      transition: opacity 0.5s ease;
    }
    .landing-shell.entered {
      opacity: 1;
    }
    .noise-overlay::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.035;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
      z-index: 1;
    }
    .hero-section,
    .content-section,
    .integration-section,
    .metric-section,
    .workflow-section,
    .action-strip-section,
    .use-case-section,
    .adoption-section,
    .cta-section {
      position: relative;
      z-index: 2;
      padding: 0 24px;
    }
    .hero-section {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding-top: 110px;
      padding-bottom: 90px;
      max-width: 1440px;
      margin: 0 auto;
    }
    .hero-grid-lines {
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.28;
    }
    .hero-grid-line {
      position: absolute;
      background: rgba(255,255,255,0.06);
    }
    .hero-grid-line.horizontal {
      height: 1px;
      left: 0;
      right: 0;
    }
    .hero-grid-line.vertical {
      width: 1px;
      top: 0;
      bottom: 0;
    }
    .hero-orb {
      position: absolute;
      right: -8%;
      top: 50%;
      width: 760px;
      height: 760px;
      transform: translateY(-50%);
      pointer-events: none;
      opacity: 0.6;
      background:
        radial-gradient(circle at 35% 35%, rgba(163,230,53,0.24), transparent 26%),
        radial-gradient(circle at 50% 50%, rgba(163,230,53,0.18), rgba(5,5,5,0.02) 52%, transparent 68%),
        radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06), transparent 72%);
      filter: blur(2px);
      animation: orbFloat 14s ease-in-out infinite;
      border-radius: 999px;
    }
    @keyframes orbFloat {
      0%, 100% { transform: translateY(-50%) scale(1); }
      50% { transform: translateY(-53%) scale(1.04); }
    }
    .hero-content,
    .section-heading,
    .workflow-grid,
    .scope-grid,
    .security-grid,
    .developer-grid,
    .use-case-grid,
    .action-strip,
    .adoption-grid,
    .cta-card,
    .metric-grid,
    .feature-grid {
      max-width: 1400px;
      margin: 0 auto;
    }
    .eyebrow,
    .hero-stat-meta,
    .feature-number,
    .workflow-code-file,
    .workflow-code-status,
    .scope-row-meta,
    .scope-badge,
    .metric-clock,
    .integration-category,
    .use-case-counter,
    .use-case-metric-label,
    .adoption-index,
    .adoption-badge,
    .cta-note {
      font-family: var(--font-mono);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: rgba(255,255,255,0.58);
      margin-bottom: 22px;
    }
    .eyebrow-line {
      width: 34px;
      height: 1px;
      background: rgba(163,230,53,0.5);
    }
    .hero-title {
      font-family: var(--font-display);
      font-size: clamp(3rem, 11vw, 8.6rem);
      line-height: 0.88;
      letter-spacing: -0.055em;
      color: white;
      margin-bottom: 36px;
      max-width: 1080px;
    }
    .hero-title-line {
      display: block;
    }
    .rotating-word {
      display: inline-flex;
      min-width: 3.9ch;
      color: var(--lime);
      text-shadow: 0 0 32px rgba(163,230,53,0.15);
      animation: wordReveal 0.45s cubic-bezier(0.22, 1, 0.36, 1);
    }
    @keyframes wordReveal {
      from { opacity: 0; filter: blur(18px); transform: translateY(18px); }
      to { opacity: 1; filter: blur(0); transform: translateY(0); }
    }
    .hero-subgrid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 28px;
      align-items: end;
      max-width: 1180px;
    }
    .hero-copy {
      max-width: 640px;
      font-size: 1.1rem;
      line-height: 1.9;
      color: rgba(255,255,255,0.66);
    }
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      align-items: center;
    }
    .hero-primary,
    .hero-secondary,
    .adoption-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 54px;
      padding: 0 24px;
      border-radius: 999px;
      font-family: var(--font-mono);
      font-size: 11px;
      letter-spacing: 0.13em;
      text-transform: uppercase;
      transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease, background 0.25s ease, color 0.25s ease;
    }
    .hero-primary,
    .adoption-link {
      background: linear-gradient(135deg, rgba(163,230,53,0.95), rgba(132,204,22,0.92));
      color: black;
      box-shadow: 0 16px 36px rgba(163,230,53,0.18);
    }
    .hero-primary:hover,
    .hero-secondary:hover,
    .adoption-link:hover {
      transform: translateY(-2px);
    }
    .hero-secondary {
      border: 1px solid rgba(255,255,255,0.09);
      background: rgba(255,255,255,0.02);
      color: rgba(255,255,255,0.78);
      backdrop-filter: blur(12px);
    }
    .hero-marquee {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 70px;
      overflow: hidden;
      pointer-events: none;
    }
    .hero-marquee-track,
    .integration-track {
      display: flex;
      gap: 64px;
      width: max-content;
      animation: marquee 30s linear infinite;
    }
    .integration-track.reverse {
      animation-name: marqueeReverse;
      animation-duration: 28s;
    }
    @keyframes marquee {
      from { transform: translateX(0); }
      to { transform: translateX(-50%); }
    }
    @keyframes marqueeReverse {
      from { transform: translateX(-50%); }
      to { transform: translateX(0); }
    }
    .hero-marquee-group,
    .integration-group {
      display: flex;
      gap: 64px;
      align-items: center;
      flex-shrink: 0;
    }
    .hero-stat {
      display: flex;
      align-items: baseline;
      gap: 16px;
      white-space: nowrap;
    }
    .hero-stat-value {
      font-family: var(--font-display);
      font-size: clamp(2.2rem, 4vw, 4rem);
      color: white;
      letter-spacing: -0.04em;
    }
    .hero-stat-label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
      color: rgba(255,255,255,0.5);
    }
    .hero-stat-meta {
      color: rgba(163,230,53,0.72);
    }
    .content-section,
    .integration-section,
    .metric-section,
    .workflow-section,
    .use-case-section,
    .adoption-section {
      padding-top: 120px;
      padding-bottom: 120px;
    }
    .section-heading {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 56px;
    }
    .section-heading.centered,
    .centered-label {
      align-items: center;
      text-align: center;
    }
    .section-heading h2,
    .cta-copy h2 {
      font-family: var(--font-display);
      color: white;
      font-size: clamp(2.2rem, 4vw, 4.8rem);
      line-height: 0.95;
      letter-spacing: -0.045em;
      max-width: 960px;
    }
    .section-heading p,
    .scope-copy p,
    .security-copy p,
    .developer-copy p,
    .cta-copy p {
      max-width: 760px;
      color: rgba(255,255,255,0.62);
      font-size: 1rem;
      line-height: 1.8;
    }
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(1, minmax(0, 1fr));
      gap: 1px;
      background: rgba(255,255,255,0.09);
    }
    .feature-card,
    .scope-list-card,
    .workflow-code-panel,
    .metric-card,
    .integration-card,
    .security-item,
    .developer-code-card,
    .use-case-metric-card,
    .adoption-card,
    .cta-card {
      background: rgba(4, 4, 4, 0.9);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 22px 48px rgba(0,0,0,0.18);
    }
    .feature-card {
      min-height: 280px;
      padding: 30px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: transform 0.35s ease, border-color 0.35s ease;
    }
    .feature-card:hover {
      border-color: rgba(163,230,53,0.22);
    }
    .feature-number {
      color: rgba(163,230,53,0.8);
    }
    .feature-card h3,
    .workflow-step h3,
    .scope-row-name,
    .security-item h3,
    .developer-points h3,
    .adoption-card h3 {
      font-family: var(--font-display);
      font-size: 1.55rem;
      color: white;
      letter-spacing: -0.03em;
    }
    .feature-card p,
    .workflow-step p,
    .security-item p,
    .developer-points p,
    .adoption-description,
    .adoption-card li {
      color: rgba(255,255,255,0.62);
      line-height: 1.75;
      font-size: 14px;
    }
    .feature-visual {
      margin-top: auto;
      font-family: var(--font-mono);
      font-size: 11px;
      color: rgba(255,255,255,0.4);
      text-transform: uppercase;
      letter-spacing: 0.16em;
    }
    .workflow-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
    }
    .action-strip-section {
      padding-top: 24px;
      padding-bottom: 24px;
    }
    .action-strip {
      display: grid;
      grid-template-columns: 1fr;
      gap: 22px;
      align-items: center;
      padding: 28px 32px;
      border: 1px solid rgba(163,230,53,0.18);
      border-radius: 30px;
      background:
        radial-gradient(circle at top right, rgba(163,230,53,0.08), transparent 28%),
        rgba(6,6,6,0.92);
      box-shadow: 0 20px 42px rgba(0,0,0,0.24);
    }
    .action-strip-copy h2 {
      font-family: var(--font-display);
      font-size: clamp(1.9rem, 4vw, 3.4rem);
      line-height: 0.95;
      letter-spacing: -0.04em;
      color: white;
      margin: 0 0 10px;
    }
    .action-strip-copy p {
      max-width: 720px;
      color: rgba(255,255,255,0.62);
      line-height: 1.7;
      margin: 0;
    }
    .workflow-steps {
      display: flex;
      flex-direction: column;
      border-top: 1px solid rgba(255,255,255,0.08);
    }
    .workflow-step {
      width: 100%;
      display: flex;
      gap: 20px;
      text-align: left;
      padding: 28px 0;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      opacity: 0.42;
      transition: opacity 0.35s ease, transform 0.35s ease;
    }
    .workflow-step.active,
    .workflow-step:hover {
      opacity: 1;
    }
    .workflow-step-index {
      min-width: 34px;
      font-family: var(--font-display);
      font-size: 2rem;
      color: rgba(163,230,53,0.6);
    }
    .workflow-step-copy {
      position: relative;
      flex: 1;
    }
    .workflow-progress {
      display: block;
      margin-top: 16px;
      height: 1px;
      background: linear-gradient(90deg, var(--lime), rgba(163,230,53,0.08));
      animation: progressFill 4.8s linear forwards;
      transform-origin: left;
    }
    @keyframes progressFill {
      from { transform: scaleX(0); }
      to { transform: scaleX(1); }
    }
    .workflow-code-panel {
      overflow: hidden;
      position: relative;
    }
    .workflow-code-header,
    .workflow-code-status,
    .scope-list-header,
    .developer-tabs {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .workflow-code-dots {
      display: flex;
      gap: 6px;
    }
    .workflow-code-dots span {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: rgba(255,255,255,0.18);
    }
    .workflow-code-body,
    .developer-code-body {
      padding: 24px;
      min-height: 300px;
      background: rgba(255,255,255,0.015);
      font-family: var(--font-mono);
      font-size: 13px;
    }
    .workflow-code-line,
    .developer-code-line {
      display: flex;
      gap: 14px;
      line-height: 1.9;
      opacity: 0;
      transform: translateX(-8px);
      animation: lineEnter 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    @keyframes lineEnter {
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    .workflow-code-number {
      color: rgba(255,255,255,0.24);
      min-width: 16px;
    }
    .workflow-code-text,
    .developer-code-line span {
      color: rgba(255,255,255,0.78);
      white-space: pre-wrap;
    }
    .workflow-code-status {
      border-top: 1px solid rgba(255,255,255,0.08);
      border-bottom: 0;
      justify-content: flex-start;
      gap: 10px;
      color: rgba(255,255,255,0.45);
    }
    .workflow-code-ping,
    .metric-live-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--lime);
      box-shadow: 0 0 16px rgba(163,230,53,0.45);
      animation: ping 1.2s ease-in-out infinite;
    }
    @keyframes ping {
      0%, 100% { opacity: 0.65; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.15); }
    }
    .scope-grid,
    .security-grid,
    .developer-grid,
    .use-case-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 28px;
      align-items: start;
    }
    .scope-stat-grid,
    .developer-points,
    .adoption-grid {
      display: grid;
      gap: 18px;
    }
    .scope-stat-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 36px;
    }
    .scope-stat {
      padding-top: 14px;
      border-top: 1px solid rgba(255,255,255,0.08);
    }
    .scope-stat-value {
      font-family: var(--font-display);
      font-size: 2.2rem;
      color: white;
    }
    .scope-stat-label {
      font-size: 13px;
      color: rgba(255,255,255,0.55);
    }
    .scope-list-card {
      overflow: hidden;
      border-radius: 0;
    }
    .scope-list-header {
      color: rgba(255,255,255,0.58);
    }
    .scope-badge {
      color: var(--lime);
    }
    .scope-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 20px;
      border-top: 1px solid rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.48);
      transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease;
    }
    .scope-row.scope-row-active {
      background: rgba(163,230,53,0.06);
      color: white;
      border-color: rgba(163,230,53,0.14);
    }
    .scope-row-proof {
      font-family: var(--font-mono);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: rgba(163,230,53,0.8);
    }
    .metric-section {
      border-top: 1px solid rgba(255,255,255,0.08);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .metric-heading {
      flex-direction: column;
      justify-content: space-between;
    }
    .metric-clock {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: rgba(255,255,255,0.48);
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(1, minmax(0, 1fr));
      gap: 1px;
      background: rgba(255,255,255,0.08);
    }
    .metric-card {
      padding: 30px;
      background: rgba(3,3,3,0.92);
    }
    .metric-value {
      font-family: var(--font-display);
      font-size: clamp(3rem, 5vw, 5.5rem);
      color: white;
      letter-spacing: -0.05em;
    }
    .metric-label {
      margin-top: 12px;
      color: rgba(255,255,255,0.58);
      font-size: 16px;
    }
    .integration-section {
      overflow: hidden;
    }
    .integration-marquee {
      overflow: hidden;
      margin-bottom: 18px;
    }
    .integration-card {
      flex-shrink: 0;
      min-width: 240px;
      padding: 22px 26px;
      border-radius: 24px;
    }
    .integration-name {
      font-family: var(--font-display);
      font-size: 1.3rem;
      color: white;
      transition: transform 0.25s ease;
    }
    .integration-card:hover .integration-name {
      transform: translateX(4px);
    }
    .integration-category {
      margin-top: 6px;
      color: rgba(255,255,255,0.46);
    }
    .security-section {
      background: rgba(255,255,255,0.02);
    }
    .security-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 32px;
    }
    .security-tags span {
      padding: 10px 14px;
      border: 1px solid rgba(255,255,255,0.08);
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.62);
      border-radius: 999px;
    }
    .security-list {
      display: grid;
      gap: 18px;
    }
    .security-item {
      display: flex;
      gap: 16px;
      padding: 24px;
      border-radius: 24px;
    }
    .security-icon {
      width: 48px;
      height: 48px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--lime);
      font-family: var(--font-mono);
      font-size: 18px;
      flex-shrink: 0;
    }
    .developer-points {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 32px;
    }
    .developer-code-card {
      overflow: hidden;
      border-radius: 28px;
    }
    .developer-tabs {
      justify-content: flex-start;
      gap: 10px;
      flex-wrap: wrap;
    }
    .developer-tabs button {
      min-height: 36px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.08);
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.46);
      transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease;
    }
    .developer-tabs button.developer-tab-active {
      background: rgba(163,230,53,0.12);
      color: var(--lime);
      border-color: rgba(163,230,53,0.2);
    }
    .use-case-section {
      border-top: 1px solid rgba(255,255,255,0.08);
    }
    .use-case-header {
      max-width: 1400px;
      margin: 0 auto 42px;
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .use-case-counter {
      margin-left: auto;
      color: rgba(255,255,255,0.42);
    }
    .use-case-quote {
      font-family: var(--font-display);
      font-size: clamp(2rem, 4vw, 4rem);
      line-height: 1.08;
      color: white;
      letter-spacing: -0.04em;
    }
    .use-case-author {
      margin-top: 28px;
      font-family: var(--font-mono);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: rgba(255,255,255,0.46);
    }
    .use-case-metric-card {
      padding: 30px;
      border-radius: 28px;
    }
    .use-case-metric {
      font-family: var(--font-display);
      font-size: clamp(2rem, 4vw, 3.5rem);
      color: white;
      letter-spacing: -0.04em;
    }
    .use-case-dots {
      margin-top: 28px;
      display: flex;
      gap: 10px;
    }
    .use-case-dots button {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.16);
      transition: width 0.25s ease, background 0.25s ease;
    }
    .use-case-dots button.dot-active {
      width: 40px;
      background: var(--lime);
    }
    .adoption-grid {
      grid-template-columns: repeat(1, minmax(0, 1fr));
      gap: 1px;
      background: rgba(255,255,255,0.08);
    }
    .adoption-card {
      padding: 30px;
      position: relative;
      background: rgba(3,3,3,0.92);
    }
    .adoption-card-featured {
      border: 2px solid rgba(163,230,53,0.42);
      background: rgba(8, 11, 5, 0.94);
    }
    .adoption-badge {
      position: absolute;
      top: -14px;
      left: 30px;
      min-height: 28px;
      display: inline-flex;
      align-items: center;
      padding: 0 12px;
      border-radius: 999px;
      background: var(--lime);
      color: black;
    }
    .adoption-index {
      color: rgba(255,255,255,0.34);
      margin-bottom: 10px;
    }
    .adoption-card ul {
      display: grid;
      gap: 12px;
      margin: 20px 0 26px;
    }
    .adoption-card li {
      position: relative;
      padding-left: 18px;
    }
    .adoption-card li::before {
      content: '';
      position: absolute;
      left: 0;
      top: 9px;
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: rgba(163,230,53,0.7);
    }
    .hover-lift {
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .hover-lift:hover {
      transform: translateY(-4px);
    }
    @media (min-width: 900px) {
      .hero-subgrid,
      .workflow-grid,
      .scope-grid,
      .security-grid,
      .developer-grid,
      .use-case-grid,
      .action-strip,
      .metric-heading {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
      .metric-heading {
        display: flex;
        flex-direction: row;
        align-items: end;
      }
      .feature-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .metric-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .adoption-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    @media (min-width: 1100px) {
      .feature-grid,
      .metric-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .workflow-grid {
        grid-template-columns: minmax(0, 1fr) minmax(430px, 0.95fr);
        align-items: start;
      }
      .workflow-code-panel {
        position: sticky;
        top: 112px;
      }
    }
    @media (max-width: 899px) {
      .hero-orb {
        width: 420px;
        height: 420px;
        right: -120px;
      }
      .hero-marquee {
        position: static;
        margin-top: 48px;
      }
      .integration-card {
        min-width: 210px;
      }
      .use-case-header {
        flex-direction: column;
        align-items: start;
      }
      .use-case-counter {
        margin-left: 0;
      }
    }
  `]
})
export class LandingComponent implements OnInit, OnDestroy {
  walletService = inject(WalletService);

  entered = signal(false);
  activeWord = signal(0);
  activeStep = signal(0);
  activeScope = signal(0);
  activeCodeTab = signal(0);
  activeUseCase = signal(0);
  clock = signal(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  private intervals: number[] = [];

  heroWords = ['verify', 'claim', 'reward', 'anchor'];
  horizontalLines = [14, 27, 40, 53, 66, 79, 92];
  verticalLines = [8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96];

  heroStats = [
    { value: '8', label: 'scope kinds ready', meta: 'events to hackathons' },
    { value: '4', label: 'proof drivers live', meta: 'qr to signed claims' },
    { value: '4', label: 'participation modes', meta: 'in-person to async' },
    { value: '2', label: 'contracts reused', meta: 'badge + scope anchor' }
  ];

  features = [
    {
      number: '01',
      title: 'One badge model',
      description: 'The same non-transferable artifact works for conferences, hackathons, programs, courses, and communities without changing the ownership primitive.',
      visual: 'Scope-stable artifact'
    },
    {
      number: '02',
      title: 'Proof drivers, not one ritual',
      description: 'QR is just one proof path. Online claim tokens, submission references, and organizer attestations can all feed the same mint flow.',
      visual: 'Dynamic QR · Signed Claim · Submission'
    },
    {
      number: '03',
      title: 'Self-custody finalization',
      description: 'External apps can decide who is eligible, but the participant still signs the mint. Eligibility can be automated without centralizing custody.',
      visual: 'Issuer attests · User signs'
    },
    {
      number: '04',
      title: 'Backend replaceability',
      description: 'The npm kit, backend manifest, and contracts are explicit enough that teams can copy or reimplement the adapter layer without depending on your server.',
      visual: 'Package · Adapter · Contracts'
    }
  ];

  workflowSteps = [
    {
      number: 'I',
      title: 'Define a participation scope',
      description: 'Create a scope for a summit, hackathon, program, course, campaign, or bounty with the same underlying model.',
      code: [
        "import { createReferenceCkbPresenceModule } from 'ckb-pop-kit'",
        '',
        'const pop = createReferenceCkbPresenceModule()',
        'const intent = pop.buildCreateScopeIntent({',
        "  creatorAddress: 'ckt1...',",
        "  creatorSignature: '0x...',",
        "  nonce: 'scope-001',",
        "  scope: { name: 'CKB Hackathon', scopeKind: 'hackathon', participationMode: 'online' }",
        '})',
      ]
    },
    {
      number: 'II',
      title: 'Verify participation',
      description: 'Choose the proof driver that matches the scope: QR for physical presence, signed claims for online completion, submissions for async work.',
      code: [
        "const claimToken = encodeSignedClaimToken({",
        "  scopeId: 'hack-2026',",
        "  recipientAddress: 'ckt1winner...',",
        "  proofDriver: 'signed-claim',",
        "  proofRef: 'submission-42',",
        "  issuerAddress: 'ckt1organizer...',",
        '  issuedAt: Date.now(),',
        "  issuerSignature: '0x...' ",
        '})',
      ]
    },
    {
      number: 'III',
      title: 'Let the participant claim',
      description: 'The backend verifies the claim. The user signs the actual mint transaction. The badge is unique for that scope and their address.',
      code: [
        "const claim = await verifyClaimToken(token, address)",
        'const txHash = await mintBadge(',
        '  claim.event,',
        '  address,',
        '  claim.proofHash',
        ')',
        "console.log('Minted:', txHash)",
      ]
    }
  ];

  scopeRows = [
    { name: 'Physical event', mode: 'in-person', proof: 'dynamic-qr' },
    { name: 'Online hackathon', mode: 'online', proof: 'signed-claim' },
    { name: 'Async program', mode: 'async', proof: 'submission-proof' },
    { name: 'Hybrid summit', mode: 'hybrid', proof: 'mixed policy' },
    { name: 'Community campaign', mode: 'online', proof: 'organizer attestation' },
    { name: 'Bounty flow', mode: 'async', proof: 'submission-review' },
  ];

  scopeStats = [
    { value: '8', label: 'supported scope kinds' },
    { value: '4', label: 'participation modes' },
    { value: '2', label: 'artifact drivers' },
    { value: '3', label: 'claim-ready surfaces' },
  ];

  metricCards = [
    { value: '8', label: 'scope kinds in the kit' },
    { value: '4', label: 'proof drivers exposed' },
    { value: '4', label: 'policy modules ready' },
    { value: '2', label: 'contracts reused on-chain' },
  ];

  integrations = [
    { name: 'Hackathon app', category: 'Completion platform' },
    { name: 'Community ops', category: 'Member coordination' },
    { name: 'Learning program', category: 'Course completion' },
    { name: 'Bounty workflow', category: 'Async completion' },
    { name: 'Organizer console', category: 'Reference app' },
    { name: 'Wallet UX', category: 'Self-custody signing' },
    { name: 'Explorer', category: 'Verification surface' },
    { name: 'Campaign engine', category: 'Claim issuance' },
  ];

  reverseIntegrations = [...this.integrations].reverse();

  securityTags = ['chain uniqueness', 'self-custody', 'non-authoritative backend', 'replaceable adapters', 'opaque proof hashes'];

  securityFeatures = [
    { icon: '01', title: 'Chain-enforced uniqueness', description: 'The contracts remain the final guardrail. Backends can help verify eligibility, but they do not override ownership or uniqueness.' },
    { icon: '02', title: 'Self-custody required', description: 'Even if an external app decides someone completed a scope, the recipient still signs the final mint.' },
    { icon: '03', title: 'Scope-generic metadata', description: 'Artifacts now describe scope kind and participation mode, so online and physical proofs do not get collapsed into the same vague story.' },
    { icon: '04', title: 'Package + backend symmetry', description: 'Claim message helpers in the npm kit and claim verification in the backend use the same format so external apps do not invent their own dialect.' },
  ];

  developerFeatures = [
    { title: 'Published npm kit', description: 'Install ckb-pop-kit and generate scope intents, claim messages, and claim tokens without depending on the reference frontend.' },
    { title: 'Reference adapter routes', description: 'Use `/api/module/manifest`, `/api/claims/issue`, and `/api/claims/verify` as the starter backend surface.' },
    { title: 'Contract-stable primitives', description: 'The contracts still enforce the minimal facts: a unique badge exists and a scope anchor exists.' },
    { title: 'Reference UI included', description: 'The app demonstrates QR check-in, online claim, organizer creation, gallery review, and integrator discovery.' },
  ];

  developerTabs = [
    {
      label: 'Install',
      code: [
        'npm install ckb-pop-kit',
        '',
        '# backend reference',
        'cargo run',
      ]
    },
    {
      label: 'Claim',
      code: [
        "import { buildSignedClaimMessage } from 'ckb-pop-kit'",
        '',
        "const message = buildSignedClaimMessage({",
        "  scopeId: 'hack-2026',",
        "  recipientAddress: 'ckt1winner...',",
        "  claimId: 'claim-1',",
        "  proofDriver: 'signed-claim',",
        "  proofRef: 'submission-42',",
        "  issuerAddress: 'ckt1organizer...',",
        '  issuedAt: Date.now(),',
        '})',
      ]
    },
    {
      label: 'Verify',
      code: [
        "const res = await fetch('/api/claims/verify', {",
        "  method: 'POST',",
        "  headers: { 'Content-Type': 'application/json' },",
        "  body: JSON.stringify({ claim_token: token, address })",
        '})',
        'const claim = await res.json()',
      ]
    }
  ];

  useCases = [
    {
      quote: 'A participation app can mark a hacker complete, issue a signed claim, and let the winner self-custody the final SBT mint.',
      author: 'Online hackathon flow',
      metric: 'claim token -> user signature -> SBT'
    },
    {
      quote: 'An event operator can still run the old rotating QR flow, but that flow is now just one proof driver inside a broader issuance system.',
      author: 'Physical event flow',
      metric: 'dynamic QR -> signature -> SBT'
    },
    {
      quote: 'A course, program, or async workflow can issue badges after reviews or deliverable checks without pretending the user was physically present somewhere.',
      author: 'Async completion flow',
      metric: 'submission review -> claim -> SBT'
    },
    {
      quote: 'A community campaign can reward contributions with the same contracts and package, while changing only the off-chain proof and policy layer.',
      author: 'Community campaign flow',
      metric: 'attestation policy -> mint'
    }
  ];

  adoptionTracks = [
    {
      number: '01',
      name: 'Reference app',
      description: 'Use the ready-made UI and backend if you want the fastest way to stand up a branded issuance experience.',
      items: ['Create scopes', 'Verify QR flows', 'Claim online badges', 'View badge vault'],
      cta: 'Open flows',
      route: '/check-in',
      featured: false
    },
    {
      number: '02',
      name: 'Kit + custom backend',
      description: 'Install the npm package, issue claim tokens in your own product, and keep the contracts and metadata model consistent.',
      items: ['Package helpers', 'Signed claims', 'Submission proofs', 'Custom organizer logic'],
      cta: 'Read integrate surface',
      route: '/integrate',
      featured: true
    },
    {
      number: '03',
      name: 'Contracts only',
      description: 'Use the badge and scope anchor contracts with your own client and backend semantics if you already have a mature platform.',
      items: ['Minimal on-chain facts', 'Stable uniqueness rules', 'Opaque proof hashing', 'Adapter freedom'],
      cta: 'Create a scope',
      route: '/create',
      featured: false
    }
  ];

  ngOnInit() {
    this.entered.set(true);
    this.intervals.push(window.setInterval(() => this.activeWord.update(value => (value + 1) % this.heroWords.length), 2500));
    this.intervals.push(window.setInterval(() => this.activeStep.update(value => (value + 1) % this.workflowSteps.length), 5000));
    this.intervals.push(window.setInterval(() => this.activeScope.update(value => (value + 1) % this.scopeRows.length), 2200));
    this.intervals.push(window.setInterval(() => this.activeUseCase.update(value => (value + 1) % this.useCases.length), 5200));
    this.intervals.push(window.setInterval(() => this.clock.set(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000));
  }

  ngOnDestroy() {
    for (const id of this.intervals) {
      window.clearInterval(id);
    }
  }
}
