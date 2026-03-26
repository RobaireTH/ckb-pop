import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WalletService } from '../../services/wallet.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="landing" [class.entered]="entered()">

      <!-- ═══════════ HERO ═══════════ -->
      <section class="hero-section">
        <div class="hero-inner">

          <!-- Left: Content -->
          <div class="hero-content">

            <!-- Status chip -->
            <div class="status-chip">
              <span class="status-dot-live"></span>
              <span>Live on Testnet</span>
            </div>

            <!-- Title block -->
            <h1 class="hero-title">
              <span class="hero-title-line1">Proof of</span>
              <span class="hero-title-line2">Presence</span>
            </h1>

            <!-- Subtitle -->
            <p class="hero-subtitle">
              <span class="text-zinc-400">Non-transferable attestations</span> on Nervos CKB.<br class="hidden sm:block">
              Verifiable proof you were there — permissionless, on-chain, permanent.
            </p>

            <!-- CTAs -->
            <div class="hero-ctas">
              @if (walletService.isConnected()) {
                <a routerLink="/check-in" class="cta-primary group">
                  <span>Verify Attendance</span>
                  <svg class="cta-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                  </svg>
                </a>
              } @else {
                <a routerLink="/check-in" class="cta-primary group">
                  <span>Get Started</span>
                  <svg class="cta-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                  </svg>
                </a>
              }
              <a routerLink="/create" class="cta-secondary">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4"/>
                </svg>
                <span>Create Event</span>
              </a>
              <a routerLink="/integrate" class="cta-secondary">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 9l4-4 4 4m0 6l-4 4-4-4"/>
                </svg>
                <span>Integrate Module</span>
              </a>
            </div>
          </div>

          <!-- Right: Protocol Seal (desktop only) -->
          <div class="hero-visual">
            <div class="seal-container">
              <svg class="seal-ring seal-ring-outer" viewBox="0 0 300 300" fill="none">
                <circle cx="150" cy="150" r="145" stroke="currentColor" stroke-width="1" stroke-dasharray="4 8"/>
              </svg>
              <svg class="seal-ring seal-ring-middle" viewBox="0 0 300 300" fill="none">
                <circle cx="150" cy="150" r="115" stroke="currentColor" stroke-width="1"/>
              </svg>
              <svg class="seal-ring seal-ring-inner" viewBox="0 0 300 300" fill="none">
                <polygon points="150,30 270,150 150,270 30,150" stroke="currentColor" stroke-width="1"/>
              </svg>
              <div class="seal-core">
                <div class="seal-core-text">PoP</div>
                <div class="seal-core-sub">Network</div>
              </div>
              <div class="seal-orbit">
                <div class="seal-dot"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════ STATS BAR ═══════════ -->
      <section class="stats-bar">
        <div class="stats-inner">
          @for (stat of stats; track stat.label) {
            <div class="stat-item">
              <span class="stat-value" [class.text-lime-400]="stat.accent">{{ stat.value }}</span>
              <span class="stat-label">{{ stat.label }}</span>
            </div>
          }
        </div>
      </section>

      <!-- ═══════════ FEATURES ═══════════ -->
      <section class="features-section">
        <div class="features-inner">
          <div class="features-header">
            <span class="section-label">Protocol</span>
            <h2 class="section-title">How it works</h2>
          </div>
          <div class="features-grid">
            @for (feature of features; track feature.title; let i = $index) {
              <div class="feature-item" [style.animation-delay.ms]="200 + i * 120">
                <div class="feature-number">0{{ i + 1 }}</div>
                <div class="feature-body">
                  <h3 class="feature-title">{{ feature.title }}</h3>
                  <p class="feature-desc">{{ feature.desc }}</p>
                </div>
                <div class="feature-icon-wrap">
                  <svg class="feature-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" [attr.d]="feature.icon"/>
                  </svg>
                </div>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- ═══════════ TECH STRIP ═══════════ -->
      <div class="tech-strip">
        <div class="marquee-track">
          <div class="marquee-slide">
            @for (item of techItems; track $index) {
              <span class="tech-item">{{ item }}</span>
              <span class="tech-sep">&#9670;</span>
            }
            @for (item of techItems; track $index) {
              <span class="tech-item">{{ item }}</span>
              <span class="tech-sep">&#9670;</span>
            }
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    /* ── Base ── */
    .landing {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding-top: 44px;
      opacity: 0;
      transition: opacity 0.4s ease;
    }
    .landing.entered {
      opacity: 1;
    }

    /* ── HERO ── */
    .hero-section {
      display: flex;
      align-items: center;
      padding: 40px 16px 24px;
    }
    @media (min-width: 768px) {
      .hero-section {
        flex: 1;
      }
    }

    .hero-inner {
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
      align-items: center;
    }

    @media (min-width: 768px) {
      .hero-inner {
        grid-template-columns: 1.1fr 0.9fr;
        gap: 64px;
      }
      .hero-section {
        padding: 64px 40px 40px;
      }
    }

    .hero-content {
      display: flex;
      flex-direction: column;
    }

    /* Status chip */
    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      align-self: flex-start;
      padding: 5px 14px;
      border: 1px solid rgba(163, 230, 53, 0.3);
      background: rgba(163, 230, 53, 0.05);
      font-family: var(--font-mono);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: #a3e635;
      margin-bottom: 24px;
    }

    .status-dot-live {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #a3e635;
      position: relative;
    }
    .status-dot-live::after {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      background: #a3e635;
      opacity: 0;
      animation: dot-ping 2.5s ease-out infinite;
    }
    @keyframes dot-ping {
      0% { transform: scale(0.8); opacity: 0.6; }
      100% { transform: scale(2.2); opacity: 0; }
    }

    /* Title */
    .hero-title {
      font-family: var(--font-display);
      font-weight: 700;
      line-height: 0.95;
      letter-spacing: -0.02em;
      margin-bottom: 24px;
    }

    .hero-title-line1 {
      display: block;
      font-size: clamp(2.5rem, 8vw, 4.5rem);
      color: white;
    }

    .hero-title-line2 {
      display: block;
      font-size: clamp(3rem, 11vw, 6rem);
      background: linear-gradient(135deg, #a3e635 0%, #65a30d 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Subtitle */
    .hero-subtitle {
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.7;
      color: #52525b;
      max-width: 400px;
      margin-bottom: 32px;
    }

    /* CTAs */
    .hero-ctas {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    @media (min-width: 480px) {
      .hero-ctas { flex-direction: row; gap: 12px; }
    }

    .cta-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 12px 28px;
      background: linear-gradient(135deg, #a3e635 0%, #65a30d 100%);
      color: black;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-decoration: none;
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    .cta-primary::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%);
      transform: translateX(-100%);
      transition: transform 0.5s ease;
    }
    .cta-primary:hover::after {
      transform: translateX(100%);
    }
    .cta-primary:hover {
      box-shadow: 0 0 30px rgba(163, 230, 53, 0.4), inset 0 0 20px rgba(255,255,255,0.1);
      transform: translateY(-1px);
    }
    .cta-primary:active {
      transform: translateY(0);
    }

    .cta-arrow {
      width: 16px;
      height: 16px;
      transition: transform 0.3s ease;
    }
    .cta-primary:hover .cta-arrow {
      transform: translateX(3px);
    }

    .cta-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 24px;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.7);
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    .cta-secondary:hover {
      border-color: rgba(163, 230, 53, 0.3);
      color: white;
      background: rgba(163, 230, 53, 0.05);
    }

    /* ── PROTOCOL SEAL ── */

    /* Hidden on mobile, shown on desktop */
    .hero-visual {
      display: none;
      align-items: center;
      justify-content: center;
      perspective: 800px;
    }
    @media (min-width: 768px) {
      .hero-visual {
        display: flex;
      }
    }

    .seal-container {
      position: relative;
      width: 320px;
      height: 320px;
      transform-style: preserve-3d;
      animation: seal-float 8s ease-in-out infinite;
    }

    @keyframes seal-float {
      0%, 100% { transform: rotateX(12deg) rotateY(0deg); }
      25% { transform: rotateX(8deg) rotateY(6deg); }
      50% { transform: rotateX(12deg) rotateY(0deg); }
      75% { transform: rotateX(8deg) rotateY(-6deg); }
    }

    .seal-ring {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      color: rgba(163, 230, 53, 0.5);
      transform-style: preserve-3d;
      backface-visibility: visible;
    }

    /* Outer ring — tilted forward, spins on Y */
    .seal-ring-outer {
      animation: ring-orbit-y 30s linear infinite;
      transform: rotateX(65deg);
    }

    /* Middle ring — tilted sideways, spins on Y reverse */
    .seal-ring-middle {
      color: rgba(163, 230, 53, 0.35);
      animation: ring-orbit-y 22s linear infinite reverse;
      transform: rotateX(75deg) rotateZ(30deg);
    }

    /* Inner diamond — tilted opposite, spins on Y */
    .seal-ring-inner {
      color: rgba(163, 230, 53, 0.3);
      animation: ring-orbit-y 40s linear infinite;
      transform: rotateX(55deg) rotateZ(-20deg);
    }

    @keyframes ring-orbit-y {
      from { transform: rotateX(65deg) rotateY(0deg); }
      to { transform: rotateX(65deg) rotateY(360deg); }
    }

    /* Override per-ring since each has a different base tilt */
    .seal-ring-outer {
      animation-name: ring-outer;
    }
    .seal-ring-middle {
      animation-name: ring-middle;
    }
    .seal-ring-inner {
      animation-name: ring-inner;
    }

    @keyframes ring-outer {
      from { transform: rotateX(65deg) rotateY(0deg); }
      to { transform: rotateX(65deg) rotateY(360deg); }
    }
    @keyframes ring-middle {
      from { transform: rotateX(75deg) rotateZ(30deg) rotateY(0deg); }
      to { transform: rotateX(75deg) rotateZ(30deg) rotateY(-360deg); }
    }
    @keyframes ring-inner {
      from { transform: rotateX(55deg) rotateZ(-20deg) rotateY(0deg); }
      to { transform: rotateX(55deg) rotateZ(-20deg) rotateY(360deg); }
    }

    /* Core text — stays facing camera */
    .seal-core {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) translateZ(20px);
      text-align: center;
    }
    .seal-core-text {
      font-family: var(--font-display);
      font-size: 36px;
      font-weight: 700;
      color: #a3e635;
      line-height: 1;
      text-shadow: 0 0 24px rgba(163, 230, 53, 0.5);
    }
    .seal-core-sub {
      font-family: var(--font-mono);
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.3em;
      color: rgba(163, 230, 53, 0.55);
      margin-top: 4px;
    }

    /* Orbiting dot — moves in 3D orbit */
    .seal-orbit {
      position: absolute;
      inset: 0;
      transform-style: preserve-3d;
      animation: orbit-3d 12s linear infinite;
    }
    @keyframes orbit-3d {
      from { transform: rotateX(70deg) rotateY(0deg); }
      to { transform: rotateX(70deg) rotateY(360deg); }
    }
    .seal-dot {
      position: absolute;
      top: 0;
      left: 50%;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #a3e635;
      box-shadow: 0 0 14px rgba(163, 230, 53, 0.8), 0 0 35px rgba(163, 230, 53, 0.3);
      transform: translateX(-50%);
    }

    /* ── STATS BAR ── */
    .stats-bar {
      border-top: 1px solid rgba(255,255,255,0.04);
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }

    .stats-inner {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
    }

    .stat-item {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding: 12px 16px;
      position: relative;
    }
    @media (min-width: 768px) {
      .stat-item {
        gap: 10px;
        padding: 16px 24px;
      }
    }
    .stat-item + .stat-item::before {
      content: '';
      position: absolute;
      left: 0;
      top: 25%;
      height: 50%;
      width: 1px;
      background: rgba(255,255,255,0.06);
    }

    .stat-value {
      font-family: var(--font-mono);
      font-size: 15px;
      font-weight: 500;
      color: white;
      letter-spacing: -0.02em;
    }
    @media (min-width: 768px) {
      .stat-value {
        font-size: 18px;
      }
    }
    .stat-label {
      font-family: var(--font-mono);
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #52525b;
    }
    @media (min-width: 768px) {
      .stat-label {
        font-size: 9px;
      }
    }

    /* ── FEATURES ── */
    .features-section {
      padding: 48px 16px 40px;
    }
    @media (min-width: 768px) {
      .features-section {
        padding: 64px 40px 56px;
      }
    }

    .features-inner {
      max-width: 1100px;
      margin: 0 auto;
    }

    .features-header {
      margin-bottom: 32px;
    }

    .section-label {
      display: block;
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: #a3e635;
      opacity: 0.7;
      margin-bottom: 6px;
    }
    .section-title {
      font-family: var(--font-display);
      font-size: clamp(1.4rem, 4vw, 2rem);
      color: white;
      font-weight: 600;
    }

    .features-grid {
      display: flex;
      flex-direction: column;
      gap: 1px;
      background: rgba(255,255,255,0.04);
    }

    .feature-item {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 16px;
      align-items: center;
      padding: 20px 16px;
      background: black;
      transition: background 0.2s ease;
    }
    .feature-item:hover {
      background: rgba(163, 230, 53, 0.02);
    }
    @media (min-width: 768px) {
      .feature-item {
        padding: 24px 28px;
        gap: 28px;
      }
    }

    .feature-number {
      font-family: var(--font-mono);
      font-size: 11px;
      color: rgba(163, 230, 53, 0.3);
      letter-spacing: 0.05em;
      min-width: 24px;
    }

    .feature-body {
      min-width: 0;
    }
    .feature-title {
      font-family: var(--font-display);
      font-size: 15px;
      font-weight: 500;
      color: white;
      margin-bottom: 3px;
    }
    .feature-desc {
      font-family: var(--font-sans);
      font-size: 13px;
      color: #52525b;
      line-height: 1.5;
    }

    .feature-icon-wrap {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(163, 230, 53, 0.15);
      background: rgba(163, 230, 53, 0.05);
      color: rgba(163, 230, 53, 0.5);
      flex-shrink: 0;
      transition: all 0.2s ease;
    }
    .feature-item:hover .feature-icon-wrap {
      border-color: rgba(163, 230, 53, 0.3);
      color: #a3e635;
      background: rgba(163, 230, 53, 0.08);
    }
    .feature-icon {
      width: 14px;
      height: 14px;
    }

    /* ── TECH STRIP ── */
    .tech-strip {
      border-top: 1px solid rgba(255,255,255,0.04);
      padding: 12px 0;
      overflow: hidden;
    }

    .marquee-track {
      display: flex;
      overflow: hidden;
    }
    .marquee-slide {
      display: flex;
      align-items: center;
      animation: marquee 25s linear infinite;
      white-space: nowrap;
    }
    @keyframes marquee {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    .tech-item {
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: #3f3f46;
      padding: 0 16px;
    }
    .tech-sep {
      font-size: 8px;
      color: rgba(163, 230, 53, 0.15);
    }
  `]
})
export class LandingComponent implements OnInit {
  walletService = inject(WalletService);

  entered = signal(false);

  stats = [
    { value: '12.8K', label: 'Attestations', accent: false },
    { value: '847', label: 'Events', accent: false },
    { value: '100%', label: 'On-chain', accent: true }
  ];

  features = [
    {
      title: 'Soulbound',
      desc: 'Non-transferable tokens permanently bound to your wallet. No trading.',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
    },
    {
      title: 'Verifiable',
      desc: 'Cryptographic proofs stored on CKB. Anyone can audit independently.',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
    },
    {
      title: 'Permissionless',
      desc: 'No admins, no approval. Protocol enforces rules autonomously.',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z'
    }
  ];

  techItems = ['Nervos CKB', 'Cell Model', 'DOB Protocol', 'RISC-V', 'Layer 1', 'PoW Security'];

  ngOnInit() {
    requestAnimationFrame(() => this.entered.set(true));
  }
}
