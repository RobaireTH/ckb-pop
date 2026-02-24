import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PoapService, PoPEvent, Attendee, Badge } from '../../services/poap.service';
import { WalletService } from '../../services/wallet.service';
import { WalletModalComponent } from '../wallet-modal/wallet-modal.component';

type Tab = 'badges' | 'events';
type RoleFilter = 'all' | 'Attendee' | 'Organizer' | 'Certificate';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, WalletModalComponent, RouterLink],
  template: `
    <div class="min-h-screen pt-14 pb-20 px-4">
      <div class="max-w-5xl mx-auto pt-6">

        @if (!walletService.isConnected()) {
          <!-- Auth Required -->
          <div class="max-w-sm mx-auto mt-12">
            <div class="border border-white/[0.04] bg-black p-6 text-center">
              <div class="w-12 h-12 border border-zinc-800 mx-auto mb-4 flex items-center justify-center">
                <svg class="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div class="font-display text-lg text-white mb-1">Wallet Required</div>
              <div class="font-mono text-[10px] text-zinc-600 uppercase tracking-wider mb-5">Connect to view your attestations</div>
              <button (click)="showModal.set(true)" class="btn-action w-full">
                <span>Connect Wallet</span>
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </button>
            </div>
          </div>
        } @else {

          <!-- Header Row -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div class="min-w-0">
              <div class="font-mono text-[9px] text-zinc-600 uppercase tracking-wider mb-1">Connected Wallet</div>
              <button (click)="copyAddress()" class="flex items-center gap-2 group max-w-full">
                <!-- Mobile: truncated -->
                <span class="sm:hidden font-mono text-xs text-zinc-400 group-hover:text-white transition-colors truncate">
                  {{ truncateAddress(walletService.address(), 8, 6) }}
                </span>
                <!-- Desktop: full or longer -->
                <span class="hidden sm:inline font-mono text-xs text-zinc-400 group-hover:text-white transition-colors truncate max-w-[320px]">
                  {{ walletService.address() }}
                </span>
                @if (copied()) {
                  <span class="font-mono text-[8px] text-lime-400 uppercase flex-shrink-0">Copied!</span>
                } @else {
                  <svg class="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                }
              </button>
            </div>

            <!-- Tabs -->
            <div class="flex border border-white/[0.06] self-start sm:self-auto">
              <button
                (click)="activeTab.set('badges')"
                class="tab-btn"
                [class.tab-active]="activeTab() === 'badges'"
              >Attestations</button>
              <button
                (click)="activeTab.set('events')"
                class="tab-btn"
                [class.tab-active]="activeTab() === 'events'"
              >Events</button>
            </div>
          </div>

          <!-- Filters -->
          @if (activeTab() === 'badges') {
            <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div class="flex gap-1 flex-wrap">
                @for (role of roleFilters; track role) {
                  <button
                    (click)="roleFilter.set(role)"
                    class="filter-chip"
                    [class.filter-active]="roleFilter() === role"
                  >{{ role === 'all' ? 'All' : role }}</button>
                }
              </div>
              <div class="font-mono text-[9px] text-zinc-600 uppercase tracking-wider">
                {{ filteredBadges().length }} observed
              </div>
            </div>
          }

          <!-- Content -->
          @if (loading()) {
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              @for (i of [1,2,3,4,5,6,7,8]; track i) {
                <div class="border border-white/[0.04] bg-black animate-pulse">
                  <div class="aspect-[4/3] bg-zinc-900"></div>
                  <div class="p-3">
                    <div class="h-3 bg-zinc-900 w-3/4 mb-2"></div>
                    <div class="h-2 bg-zinc-900 w-1/2"></div>
                  </div>
                </div>
              }
            </div>
          } @else if (activeTab() === 'badges') {
            @if (filteredBadges().length === 0) {
              <div class="text-center py-16">
                <div class="w-12 h-12 border border-dashed border-zinc-800 mx-auto mb-4 flex items-center justify-center">
                  <svg class="w-5 h-5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div class="font-display text-base text-white mb-1">No Attestations Yet</div>
                <div class="font-mono text-[10px] text-zinc-600 uppercase tracking-wider mb-5">None observed for this address</div>
                <a routerLink="/check-in" class="btn-action inline-flex">
                  <span>Verify Attendance</span>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                  </svg>
                </a>
              </div>
            } @else {
              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                @for (badge of filteredBadges(); track badge.id) {
                  <div class="badge-card group">
                    <!-- Image -->
                    <div class="relative aspect-[4/3] overflow-hidden bg-zinc-900">
                      <img [src]="badge.imageUrl" [alt]="badge.eventName" class="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity">
                      <div class="absolute top-2 right-2">
                        <span class="badge-tag-verified">Verified</span>
                      </div>
                      <div class="absolute top-2 left-2">
                        <span class="badge-tag-role">{{ badge.role }}</span>
                      </div>
                    </div>

                    <!-- Info -->
                    <div class="p-3">
                      <div class="font-display text-xs text-white truncate mb-2 group-hover:text-lime-400 transition-colors">{{ badge.eventName }}</div>
                      <div class="space-y-1.5 pt-2 border-t border-white/[0.04]">
                        <div class="flex justify-between items-center">
                          <span class="font-mono text-[8px] text-zinc-600 uppercase">Tx</span>
                          <a
                            [href]="explorerTxUrl(badge.txHash)"
                            target="_blank"
                            rel="noopener"
                            (click)="$event.stopPropagation()"
                            class="font-mono text-[9px] text-zinc-400 hover:text-lime-400 transition-colors cursor-pointer"
                            [title]="badge.txHash"
                          >{{ badge.txHash | slice:0:6 }}...{{ badge.txHash | slice:-4 }}
                            <svg class="w-2.5 h-2.5 inline-block ml-0.5 -mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                            </svg>
                          </a>
                        </div>
                        <div class="flex justify-between items-center">
                          <span class="font-mono text-[8px] text-zinc-600 uppercase">Block</span>
                          @if (badge.blockNumber != null) {
                            <a
                              [href]="explorerBlockUrl(badge.blockNumber)"
                              target="_blank"
                              rel="noopener"
                              (click)="$event.stopPropagation()"
                              class="font-mono text-[9px] text-zinc-400 hover:text-lime-400 transition-colors cursor-pointer"
                            >#{{ badge.blockNumber.toLocaleString() }}</a>
                          } @else {
                            <span class="font-mono text-[9px] text-zinc-500 animate-pulse">#Pending</span>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          } @else {
            <!-- Events Tab -->
            @if (poapService.myCreatedEvents().length === 0) {
              <div class="text-center py-16">
                <div class="w-12 h-12 border border-dashed border-zinc-800 mx-auto mb-4 flex items-center justify-center">
                  <svg class="w-5 h-5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="font-display text-base text-white mb-1">No Events Created</div>
                <div class="font-mono text-[10px] text-zinc-600 uppercase tracking-wider mb-5">Deploy events to issue attestations</div>
                <a routerLink="/create" class="btn-action inline-flex">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                  </svg>
                  <span>Create Event</span>
                </a>
              </div>
            } @else {
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                @for (event of poapService.myCreatedEvents(); track event.id) {
                  <div (click)="openEventDetails(event)" class="event-card group">
                    <div class="relative aspect-video overflow-hidden">
                      <img [src]="event.imageUrl" class="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity">
                      <div class="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"></div>
                      <div class="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 px-2 py-1 border border-lime-400/20">
                        <span class="w-1.5 h-1.5 bg-lime-400 rounded-full animate-pulse"></span>
                        <span class="font-mono text-[8px] text-lime-400 uppercase tracking-wider">Live</span>
                      </div>
                      <div class="absolute bottom-3 left-3 right-3">
                        <div class="font-display text-sm text-white truncate mb-0.5">{{ event.name }}</div>
                        <div class="font-mono text-[9px] text-zinc-400 uppercase tracking-wider">{{ event.location }}</div>
                      </div>
                    </div>
                    <div class="p-2">
                      <a
                        [routerLink]="['/event', event.id, 'live']"
                        (click)="$event.stopPropagation()"
                        class="btn-qr-launch w-full"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
                        </svg>
                        <span>Launch QR</span>
                      </a>
                    </div>
                  </div>
                }
              </div>
            }

            <!-- Add a CLI-created event by pasting its event ID.
                 Events created on the CLI may use a different wallet address
                 than the one connected here.  Pasting the event ID links them
                 and persists the link in localStorage across sessions. -->
            <div class="mt-8 border border-white/[0.04] p-4">
              <div class="font-mono text-[9px] text-zinc-500 uppercase tracking-wider mb-3">Add CLI Event by ID</div>
              <div class="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste event ID printed by ckb-pop event create"
                  [value]="watchInput()"
                  (input)="watchInput.set($any($event.target).value)"
                  (keydown.enter)="handleWatchEvent()"
                  class="flex-1 bg-transparent border border-white/[0.06] px-3 py-2 font-mono text-xs text-zinc-400 placeholder-zinc-700 focus:outline-none focus:border-white/20"
                />
                <button
                  (click)="handleWatchEvent()"
                  [disabled]="watchLoading() || !watchInput().trim()"
                  class="btn-action whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {{ watchLoading() ? 'Adding...' : 'Add' }}
                </button>
              </div>
              @if (watchError()) {
                <div class="font-mono text-[9px] text-red-400 mt-2">{{ watchError() }}</div>
              }
            </div>
          }
        }
      </div>
    </div>

    <!-- Event Slide-over -->
    @if (selectedEvent()) {
      <div class="fixed inset-0 z-50 flex justify-end">
        <div class="absolute inset-0 bg-black/80" (click)="selectedEvent.set(null)"></div>
        <div class="relative w-full max-w-sm bg-black border-l border-white/[0.04] h-full flex flex-col">
          <!-- Header -->
          <div class="p-4 border-b border-white/[0.04] flex items-center justify-between">
            <div>
              <div class="font-mono text-[8px] text-zinc-600 uppercase tracking-wider">Event ID</div>
              <div class="font-mono text-[10px] text-zinc-400">{{ selectedEvent()?.id }}</div>
            </div>
            <button (click)="selectedEvent.set(null)" class="w-8 h-8 border border-white/[0.06] hover:border-white/[0.12] flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-4">
            <div class="aspect-video bg-zinc-900 mb-4 overflow-hidden">
              <img [src]="selectedEvent()?.imageUrl" class="w-full h-full object-cover opacity-70">
            </div>
            <div class="font-display text-lg text-white mb-1">{{ selectedEvent()?.name }}</div>
            <div class="font-mono text-[10px] text-zinc-600 uppercase tracking-wider mb-4">{{ selectedEvent()?.location }}</div>

            <div class="bg-zinc-900/50 border border-white/[0.04] p-3 mb-4">
              <div class="font-mono text-[8px] text-zinc-600 uppercase tracking-wider mb-1">Creator Address</div>
              <div class="font-mono text-[10px] text-zinc-400 break-all">{{ selectedEvent()?.issuer }}</div>
            </div>

            <div class="font-mono text-[9px] text-zinc-600 uppercase tracking-wider mb-2">Badge Holders</div>
            <div class="border border-white/[0.04]">
              @if (loadingAttendees()) {
                @for (i of [1,2,3]; track i) {
                  <div class="p-3 animate-pulse border-b border-white/[0.02] last:border-0">
                    <div class="h-3 bg-zinc-900 w-32"></div>
                  </div>
                }
              } @else {
                @for (attendee of attendees(); track attendee.txHash) {
                  <div class="flex items-center justify-between p-3 border-b border-white/[0.02] last:border-0">
                    <span class="font-mono text-[10px] text-zinc-400">{{ truncateAddress(attendee.address, 10, 6) }}</span>
                    <span class="font-mono text-[9px] text-zinc-600">{{ attendee.mintDate | date:'HH:mm' }}</span>
                  </div>
                } @empty {
                  <div class="p-6 text-center font-mono text-[10px] text-zinc-600">No attestations yet</div>
                }
              }
            </div>
          </div>

          <!-- Footer -->
          <div class="p-4 border-t border-white/[0.04]">
            <a [routerLink]="['/event', selectedEvent()?.id, 'live']" class="btn-action w-full justify-center">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
              </svg>
              <span>Activate QR Display</span>
            </a>
          </div>
        </div>
      </div>
    }

    @if (showModal()) {
      <app-wallet-modal (close)="showModal.set(false)"></app-wallet-modal>
    }
  `,
  styles: [`
    .tab-btn {
      padding: 8px 14px;
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #71717a;
      transition: all 0.15s ease;
    }
    .tab-btn.tab-active {
      background: linear-gradient(135deg, #a3e635, #84cc16);
      color: black;
    }

    .filter-chip {
      padding: 4px 10px;
      font-family: var(--font-mono);
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      border: 1px solid rgba(255,255,255,0.06);
      color: #71717a;
      transition: all 0.15s ease;
    }
    .filter-chip:hover {
      border-color: rgba(255,255,255,0.12);
      color: white;
    }
    .filter-chip.filter-active {
      background: #a3e635;
      border-color: #a3e635;
      color: black;
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      background: linear-gradient(135deg, #a3e635 0%, #65a30d 100%);
      color: black;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      transition: all 0.2s ease;
    }
    .btn-action:hover {
      box-shadow: 0 0 20px rgba(163, 230, 53, 0.3);
    }

    .btn-qr-launch {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px;
      background: rgba(163, 230, 53, 0.05);
      border: 1px solid rgba(163, 230, 53, 0.15);
      color: #a3e635;
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      transition: all 0.2s ease;
    }
    .btn-qr-launch:hover {
      background: #a3e635;
      border-color: #a3e635;
      color: black;
    }

    .badge-card {
      border: 1px solid rgba(255,255,255,0.04);
      background: black;
      transition: all 0.2s ease;
    }
    .badge-card:hover {
      border-color: rgba(163, 230, 53, 0.2);
    }

    .badge-tag-verified {
      display: inline-flex;
      padding: 2px 6px;
      background: linear-gradient(135deg, #a3e635, #65a30d);
      color: black;
      font-family: var(--font-mono);
      font-size: 7px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge-tag-role {
      display: inline-flex;
      padding: 2px 6px;
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(255,255,255,0.1);
      color: #d4d4d8;
      font-family: var(--font-mono);
      font-size: 7px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .event-card {
      border: 1px solid rgba(255,255,255,0.04);
      background: black;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .event-card:hover {
      border-color: rgba(255,255,255,0.08);
    }
  `]
})
export class GalleryComponent implements OnInit {
  poapService = inject(PoapService);
  walletService = inject(WalletService);

  showModal = signal(false);
  activeTab = signal<Tab>('badges');
  loading = signal(false);
  loadingAttendees = signal(false);
  roleFilter = signal<RoleFilter>('all');
  roleFilters: RoleFilter[] = ['all', 'Attendee', 'Organizer', 'Certificate'];

  filteredBadges = computed(() => {
    let badges = [...this.poapService.myBadges()];
    if (this.roleFilter() !== 'all') {
      badges = badges.filter(b => b.role === this.roleFilter());
    }
    badges.sort((a, b) => new Date(b.mintDate).getTime() - new Date(a.mintDate).getTime());
    return badges;
  });

  selectedEvent = signal<PoPEvent | null>(null);
  attendees = signal<Attendee[]>([]);
  copied = signal(false);

  // Watch-by-ID state for CLI-created events.
  watchInput = signal('');
  watchLoading = signal(false);
  watchError = signal('');

  constructor() {
    effect(() => {
      if (this.walletService.isConnected()) {
        this.loadBadges();
      }
    });
  }

  ngOnInit() {
    if (this.walletService.isConnected()) {
      this.loadBadges();
    }
  }

  private async loadBadges() {
    this.loading.set(true);
    const address = this.walletService.address();
    if (address) {
      await Promise.all([
        this.poapService.loadBadgesFromBackend(address),
        this.poapService.loadMyEventsFromBackend(address),
      ]);
    }
    this.loading.set(false);
  }

  truncateAddress(address: string | null, start: number, end: number): string {
    if (!address) return '';
    if (address.length <= start + end + 3) return address;
    return `${address.slice(0, start)}...${address.slice(-end)}`;
  }

  openEventDetails(event: PoPEvent) {
    this.selectedEvent.set(event);
    this.attendees.set([]);
    this.loadingAttendees.set(true);
    this.poapService.getAttendees(event.id).then(data => {
      this.attendees.set(data);
      this.loadingAttendees.set(false);
    });
  }

  copyAddress() {
    const addr = this.walletService.address();
    if (addr) {
      navigator.clipboard.writeText(addr).then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 1500);
      });
    }
  }

  /** Add a CLI-created event to My Events by pasting its event ID. */
  async handleWatchEvent(): Promise<void> {
    const id = this.watchInput().trim();
    if (!id) return;
    this.watchError.set('');
    this.watchLoading.set(true);
    try {
      await this.poapService.watchEventById(id);
      this.watchInput.set('');
    } catch (err) {
      this.watchError.set(err instanceof Error ? err.message : 'Could not add event.');
    } finally {
      this.watchLoading.set(false);
    }
  }

  explorerTxUrl(txHash: string): string {
    return `${this.poapService.explorerUrl}/transaction/${txHash}`;
  }

  explorerBlockUrl(blockNumber: number): string {
    return `${this.poapService.explorerUrl}/block/${blockNumber}`;
  }
}
