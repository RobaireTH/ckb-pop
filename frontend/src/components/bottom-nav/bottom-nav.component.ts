import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="fixed bottom-0 left-0 right-0 z-40 md:hidden safe-area-bottom" aria-label="Main">
      <div class="absolute inset-0 bg-black/95 border-t border-white/[0.04]"></div>

      <div class="relative flex items-center justify-around py-1 px-2">
        @for (item of navItems; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{exact: item.exact}"
            class="nav-item flex flex-col items-center justify-center gap-0.5 py-1.5 px-3"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" [attr.d]="item.icon"/>
            </svg>
            <span class="text-[8px] font-mono uppercase tracking-wider">{{ item.label }}</span>
          </a>
        }
      </div>
    </nav>
  `,
  styles: [`
    .safe-area-bottom {
      padding-bottom: env(safe-area-inset-bottom, 0);
    }
    .nav-item {
      color: #52525b;
      min-width: 48px;
    }
    .nav-item.active {
      color: #a3e635;
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
      label: 'Badges',
      exact: false,
      icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'
    }
  ];
}
