import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { WalletService } from '../../services/wallet.service';
import { WalletModalComponent } from '../wallet-modal/wallet-modal.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, WalletModalComponent],
  template: `
    <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-1.5 focus:bg-lime-400 focus:text-black focus:font-mono focus:text-xs">
      Skip to main content
    </a>

    <header class="fixed top-0 z-50 w-full" role="banner">
      <div class="absolute inset-0 bg-black/95 border-b border-white/[0.04]"></div>

      <div class="relative max-w-5xl mx-auto px-4">
        <div class="h-11 flex items-center justify-between">

          <!-- Brand -->
          <a routerLink="/" class="flex items-center gap-2" aria-label="PoP Network">
            <div class="w-5 h-5 relative">
              <img src="assets/ckb-pop.png" alt="" class="w-full h-full object-contain">
            </div>
            <!-- Mobile: PoPNet -->
            <span class="sm:hidden font-display font-semibold text-white text-sm tracking-tight">
              PoP<span class="text-lime-400">Net</span>
            </span>
            <!-- Desktop: PoP Network -->
            <span class="hidden sm:flex items-baseline gap-1.5">
              <span class="font-display font-semibold text-white text-sm tracking-tight">PoP</span>
              <span class="font-mono text-[9px] text-zinc-500 uppercase tracking-[0.1em]">Network</span>
            </span>
          </a>

          <!-- Nav -->
          <nav class="hidden md:flex items-center" aria-label="Main">
            @for (item of navItems; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="active-link"
                [routerLinkActiveOptions]="{exact: item.path === '/'}"
                class="nav-link px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-500 hover:text-white transition-colors relative"
              >
                {{ item.label }}
              </a>
            }
          </nav>

          <!-- Wallet -->
          <div>
            @if (walletService.isConnected()) {
              <button
                (click)="showModal.set(true)"
                class="group flex items-center gap-2 px-2.5 py-1.5 border border-lime-400/20 hover:border-lime-400/40 bg-lime-400/5 hover:bg-lime-400/10 transition-all"
              >
                <span class="w-1.5 h-1.5 bg-lime-400 rounded-full"></span>
                <span class="font-mono text-[10px] text-lime-400/80 group-hover:text-lime-400 max-w-[70px] truncate">
                  {{ walletService.shortAddress() }}
                </span>
              </button>
            } @else {
              <button (click)="showModal.set(true)" class="btn-connect">
                <span class="btn-connect-text">Connect</span>
                <span class="btn-connect-icon">
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                  </svg>
                </span>
              </button>
            }
          </div>
        </div>
      </div>
    </header>

    @if (showModal()) {
      <app-wallet-modal (close)="showModal.set(false)"></app-wallet-modal>
    }
  `,
  styles: [`
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }

    .nav-link.active-link {
      color: #a3e635;
    }
    .nav-link.active-link::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 3px;
      height: 3px;
      background: #a3e635;
    }

    .btn-connect {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: linear-gradient(135deg, #a3e635 0%, #84cc16 100%);
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: black;
      position: relative;
      overflow: hidden;
      transition: all 0.2s ease;
    }
    .btn-connect::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: left 0.4s ease;
    }
    .btn-connect:hover::before {
      left: 100%;
    }
    .btn-connect:hover {
      box-shadow: 0 0 20px rgba(163, 230, 53, 0.3);
    }
    .btn-connect-icon {
      display: flex;
      transition: transform 0.2s ease;
    }
    .btn-connect:hover .btn-connect-icon {
      transform: translateX(2px);
    }
  `]
})
export class HeaderComponent {
  walletService = inject(WalletService);
  showModal = signal(false);

  navItems = [
    { path: '/check-in', label: 'Verify' },
    { path: '/claim', label: 'Claim' },
    { path: '/create', label: 'Create' },
    { path: '/gallery', label: 'Badges' },
    { path: '/integrate', label: 'Integrate' }
  ];
}
