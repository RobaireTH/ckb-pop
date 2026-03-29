import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="bottom-shell md:hidden" aria-label="Main">
      <div class="bottom-nav">
        @for (item of navItems; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="bottom-active"
            [routerLinkActiveOptions]="{exact: item.exact}"
            class="bottom-link"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" [attr.d]="item.icon"/>
            </svg>
            <span>{{ item.label }}</span>
          </a>
        }
      </div>
    </nav>
  `,
  styles: [`
    .bottom-shell {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 60;
      padding: 0 14px calc(env(safe-area-inset-bottom, 0px) + 12px);
      pointer-events: none;
    }
    .bottom-nav {
      pointer-events: auto;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 6px;
      padding: 8px;
      border-radius: 24px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(5, 5, 5, 0.82);
      backdrop-filter: blur(24px);
      box-shadow: 0 18px 40px rgba(0,0,0,0.35);
    }
    .bottom-link {
      min-height: 52px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      border-radius: 18px;
      color: rgba(255,255,255,0.45);
      font-family: var(--font-mono);
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      transition: color 0.2s ease, background 0.2s ease, transform 0.2s ease;
    }
    .bottom-link.bottom-active {
      color: black;
      background: linear-gradient(135deg, rgba(163,230,53,0.95), rgba(132,204,22,0.95));
      transform: translateY(-1px);
    }
  `]
})
export class BottomNavComponent {
  navItems = [
    {
      path: '/',
      label: 'Home',
      exact: true,
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
    },
    {
      path: '/check-in',
      label: 'Verify',
      exact: false,
      icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z'
    },
    {
      path: '/claim',
      label: 'Claim',
      exact: false,
      icon: 'M9 12l2 2 4-4m5-1a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
      path: '/create',
      label: 'Create',
      exact: false,
      icon: 'M12 4v16m8-8H4'
    },
    {
      path: '/gallery',
      label: 'Vault',
      exact: false,
      icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'
    }
  ];
}
