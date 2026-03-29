import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { WalletService } from '../../services/wallet.service';
import { WalletModalComponent } from '../wallet-modal/wallet-modal.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, WalletModalComponent],
  template: `
    <a href="#main-content" class="skip-link">
      Skip to main content
    </a>

    <header class="header-shell" [class.header-scrolled]="isScrolled()" role="banner">
      <nav class="header-nav" [class.header-nav-floating]="isScrolled() || mobileMenuOpen()" aria-label="Main">
        <div class="header-bar">
          <a routerLink="/" class="brand-link" aria-label="CKB PoP">
            <div class="brand-mark">
              <img src="assets/ckb-pop.png" alt="" class="w-full h-full object-contain">
            </div>
            <div class="brand-copy">
              <span class="brand-wordmark">CKB PoP</span>
              <span class="brand-subtitle">Presence Protocol</span>
            </div>
          </a>

          <div class="header-links hidden md:flex">
            @for (item of navItems; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="active-link"
                [routerLinkActiveOptions]="{exact: item.exact ?? false}"
                class="nav-link"
              >
                {{ item.label }}
              </a>
            }
          </div>

          <div class="hidden md:flex items-center gap-3">
            @if (walletService.isConnected()) {
              <button (click)="showWalletModal.set(true)" class="wallet-pill">
                <span class="wallet-dot"></span>
                <span>{{ walletService.shortAddress() }}</span>
              </button>
            } @else {
              <button (click)="showWalletModal.set(true)" class="connect-pill">
                <span>Connect Wallet</span>
              </button>
            }
          </div>

          <button class="mobile-menu-toggle md:hidden" (click)="mobileMenuOpen.set(!mobileMenuOpen())" aria-label="Toggle navigation">
            @if (mobileMenuOpen()) {
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            } @else {
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M4 7h16M4 12h16M4 17h16"/>
              </svg>
            }
          </button>
        </div>
      </nav>

      <div class="mobile-overlay md:hidden" [class.mobile-overlay-open]="mobileMenuOpen()">
        <div class="mobile-panel">
          <div class="mobile-panel-header">
            <div class="mobile-section-label">Navigate</div>
            <button class="mobile-close" (click)="closeMobileMenu()" aria-label="Close navigation">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="mobile-links">
            @for (item of navItems; track item.path; let i = $index) {
              <a
                [routerLink]="item.path"
                (click)="closeMobileMenu()"
                class="mobile-link"
                [style.transition-delay.ms]="mobileMenuOpen() ? 50 + i * 45 : 0"
              >
                {{ item.label }}
              </a>
            }
          </div>
          <div class="mobile-actions">
            @if (walletService.isConnected()) {
              <button (click)="showWalletModal.set(true); closeMobileMenu()" class="connect-pill w-full justify-center">
                <span>{{ walletService.shortAddress() }}</span>
              </button>
            } @else {
              <button (click)="showWalletModal.set(true); closeMobileMenu()" class="connect-pill w-full justify-center">
                <span>Connect Wallet</span>
              </button>
            }
          </div>
        </div>
      </div>
    </header>

    @if (showWalletModal()) {
      <app-wallet-modal (close)="showWalletModal.set(false)"></app-wallet-modal>
    }
  `,
  styles: [`
    .skip-link {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
      z-index: 200;
    }
    .skip-link:focus {
      width: auto;
      height: auto;
      margin: 0;
      clip: auto;
      left: 16px;
      top: 16px;
      padding: 10px 14px;
      background: var(--lime);
      color: black;
      font-family: var(--font-mono);
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      border-radius: 999px;
    }
    .header-shell {
      position: fixed;
      inset: 0 0 auto 0;
      z-index: 70;
      pointer-events: none;
      transition: padding 0.45s ease;
    }
    .header-shell.header-scrolled {
      padding-top: 14px;
    }
    .header-nav {
      pointer-events: auto;
      max-width: 1380px;
      margin: 0 auto;
      transition: max-width 0.45s ease, padding 0.45s ease;
    }
    .header-nav.header-nav-floating {
      max-width: 1240px;
      padding: 0 16px;
    }
    .header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      min-height: 78px;
      padding: 0 24px;
      border-radius: 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      background: transparent;
      transition: min-height 0.45s ease, border-color 0.45s ease, background 0.45s ease, border-radius 0.45s ease, box-shadow 0.45s ease;
    }
    .header-nav-floating .header-bar {
      min-height: 60px;
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 22px;
      background: rgba(5, 5, 5, 0.78);
      backdrop-filter: blur(22px);
      box-shadow: 0 18px 45px rgba(0,0,0,0.25);
    }
    .brand-link {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .brand-mark {
      width: 36px;
      height: 36px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 30% 30%, rgba(163,230,53,0.22), rgba(255,255,255,0.03));
      border: 1px solid rgba(255,255,255,0.09);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
    }
    .brand-copy {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .brand-wordmark {
      font-family: var(--font-display);
      font-size: 1rem;
      letter-spacing: -0.03em;
      color: white;
      line-height: 1;
    }
    .brand-subtitle {
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: rgba(255,255,255,0.45);
      white-space: nowrap;
    }
    .header-links {
      align-items: center;
      gap: 28px;
    }
    .nav-link {
      position: relative;
      font-family: var(--font-mono);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: rgba(255,255,255,0.6);
      transition: color 0.25s ease, transform 0.25s ease;
    }
    .nav-link:hover {
      color: white;
      transform: translateY(-1px);
    }
    .nav-link.active-link {
      color: var(--lime);
    }
    .nav-link.active-link::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -8px;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--lime), transparent);
    }
    .wallet-pill,
    .connect-pill,
    .mobile-menu-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 16px;
      border-radius: 999px;
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.11em;
      text-transform: uppercase;
      transition: transform 0.25s ease, border-color 0.25s ease, background 0.25s ease, color 0.25s ease;
    }
    .wallet-pill {
      border: 1px solid rgba(163,230,53,0.18);
      background: rgba(163,230,53,0.06);
      color: var(--lime);
    }
    .wallet-pill:hover,
    .connect-pill:hover {
      transform: translateY(-1px);
    }
    .wallet-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--lime);
      box-shadow: 0 0 14px rgba(163,230,53,0.5);
    }
    .connect-pill {
      border: 1px solid rgba(163,230,53,0.22);
      background: linear-gradient(135deg, rgba(163,230,53,0.92), rgba(132,204,22,0.92));
      color: black;
      box-shadow: 0 10px 26px rgba(163,230,53,0.18);
    }
    .mobile-menu-toggle {
      width: 42px;
      padding: 0;
      border: 1px solid rgba(255,255,255,0.09);
      background: rgba(255,255,255,0.03);
      color: white;
    }
    @media (min-width: 768px) {
      .mobile-menu-toggle,
      .mobile-overlay {
        display: none !important;
      }
    }
    .mobile-overlay {
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.35s ease;
      background: rgba(3, 3, 3, 0.94);
      backdrop-filter: blur(20px);
    }
    .mobile-overlay.mobile-overlay-open {
      opacity: 1;
      pointer-events: auto;
    }
    .mobile-panel {
      min-height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 96px 28px 28px;
    }
    .mobile-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }
    .mobile-section-label {
      font-family: var(--font-mono);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: rgba(163,230,53,0.8);
      margin-bottom: 0;
    }
    .mobile-close {
      width: 44px;
      height: 44px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.03);
      color: white;
      flex-shrink: 0;
    }
    .mobile-links {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .mobile-link {
      font-family: var(--font-display);
      font-size: clamp(2rem, 10vw, 4rem);
      letter-spacing: -0.04em;
      color: white;
      opacity: 0;
      transform: translateY(14px);
      transition: opacity 0.45s ease, transform 0.45s ease, color 0.25s ease;
    }
    .mobile-overlay-open .mobile-link {
      opacity: 1;
      transform: translateY(0);
    }
    .mobile-link:hover {
      color: var(--lime);
    }
    .mobile-actions {
      padding-top: 24px;
      border-top: 1px solid rgba(255,255,255,0.08);
    }
  `]
})
export class HeaderComponent {
  walletService = inject(WalletService);
  showWalletModal = signal(false);
  isScrolled = signal(false);
  mobileMenuOpen = signal(false);

  navItems = [
    { path: '/', label: 'Home', exact: true },
    { path: '/check-in', label: 'Verify' },
    { path: '/claim', label: 'Claim' },
    { path: '/create', label: 'Create' },
    { path: '/gallery', label: 'Vault' },
    { path: '/integrate', label: 'Build' }
  ];

  @HostListener('window:scroll')
  onScroll() {
    this.isScrolled.set(window.scrollY > 20);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeMobileMenu();
  }

  closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }
}
