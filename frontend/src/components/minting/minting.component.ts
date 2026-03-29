import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { WalletService } from '../../services/wallet.service';
import { PoapService, PoPEvent, Badge } from '../../services/poap.service';
import { WalletModalComponent } from '../wallet-modal/wallet-modal.component';

type Step = 'confirm' | 'signing' | 'minting' | 'success';
type FlowKind = 'check-in' | 'claim';

@Component({
  selector: 'app-minting',
  standalone: true,
  imports: [CommonModule, RouterLink, WalletModalComponent],
  template: `
    <div class="min-h-screen pt-14 pb-20 px-4">
      <div class="max-w-md mx-auto pt-8">

        <!-- Progress -->
        <div class="border border-white/[0.04] bg-black p-4 mb-4">
          <div class="flex items-center justify-between mb-3">
            @for (step of steps; track step.id; let i = $index) {
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 flex items-center justify-center border text-[10px] font-mono"
                  [class.bg-lime-400]="getStepIndex() > i"
                  [class.text-black]="getStepIndex() > i"
                  [class.border-lime-400]="getStepIndex() >= i"
                  [class.text-lime-400]="getStepIndex() === i"
                  [class.border-zinc-800]="getStepIndex() < i"
                  [class.text-zinc-700]="getStepIndex() < i">
                  @if (getStepIndex() > i) { ✓ } @else { {{ i + 1 }} }
                </div>
                <span class="font-mono text-[9px] uppercase tracking-wider hidden sm:inline"
                  [class.text-lime-400]="getStepIndex() >= i"
                  [class.text-zinc-600]="getStepIndex() < i">
                  {{ step.label }}
                </span>
              </div>
              @if (i < steps.length - 1) {
                <div class="flex-1 h-px mx-2"
                  [class.bg-lime-400]="getStepIndex() > i"
                  [class.bg-zinc-800]="getStepIndex() <= i"></div>
              }
            }
          </div>
          @if (currentStep() !== 'success') {
            <div class="font-mono text-[9px] text-zinc-600 uppercase tracking-wider">
              {{ steps[getStepIndex()]?.status }}<span class="animate-pulse">_</span>
            </div>
          }
        </div>

        <!-- Confirm Step -->
        @if (currentStep() === 'confirm') {
          <div class="border border-white/[0.04] bg-black">
            <div class="p-4 border-b border-white/[0.04]">
              <div class="flex items-center justify-between">
                <span class="font-mono text-[9px] text-lime-400 uppercase tracking-wider">{{ readyLabel() }}</span>
                <span class="font-mono text-[9px] text-zinc-600">{{ event()?.date }}</span>
              </div>
            </div>

            <div class="p-4">
              <div class="font-display text-base text-white mb-1">{{ event()?.name }}</div>
              <div class="font-mono text-[10px] text-zinc-600 uppercase tracking-wider mb-4">{{ event()?.location }}</div>

              <div class="space-y-2 border-t border-b border-white/[0.04] py-3 mb-4">
                <div class="flex justify-between text-[10px]">
                  <span class="font-mono text-zinc-600 uppercase tracking-wider">Creator</span>
                  <span class="font-mono text-zinc-400">{{ event()?.issuer | slice:0:10 }}...{{ event()?.issuer | slice:-6 }}</span>
                </div>
                <div class="flex justify-between text-[10px]">
                  <span class="font-mono text-zinc-600 uppercase tracking-wider">Fee</span>
                  <span class="font-mono text-zinc-400">~0.0001 CKB</span>
                </div>
                <div class="flex justify-between text-[10px]">
                  <span class="font-mono text-zinc-600 uppercase tracking-wider">Type</span>
                  <span class="font-mono text-lime-400">{{ flowKind() === 'claim' ? 'Claimable SBT' : 'SBT' }}</span>
                </div>
                <div class="flex justify-between text-[10px]">
                  <span class="font-mono text-zinc-600 uppercase tracking-wider">Transfer</span>
                  <span class="font-mono text-zinc-500">Disabled</span>
                </div>
              </div>

              @if (!walletService.isConnected()) {
                <button (click)="showWalletModal.set(true)" class="btn-action w-full justify-center">
                  <span>Connect Wallet</span>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                  </svg>
                </button>
              } @else {
                <button (click)="showConfirmDialog.set(true)" class="btn-action w-full justify-center">
                  <span>{{ actionLabel() }}</span>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                  </svg>
                </button>
              }
            </div>
          </div>
        }

        <!-- Signing/Minting -->
        @if (currentStep() === 'signing' || currentStep() === 'minting') {
          <div class="border border-white/[0.04] bg-black p-4">
            <div class="text-center mb-4">
              <div class="font-mono text-2xl text-zinc-700 mb-2">
                {{ currentStep() === 'signing' ? '01' : '02' }}<span class="text-zinc-800">/02</span>
              </div>
              <div class="font-display text-base text-white">
                {{ currentStep() === 'signing' ? 'Awaiting Signature' : 'Broadcasting' }}
              </div>
            </div>

            <!-- Terminal -->
            <div class="bg-zinc-950 border border-white/[0.04] p-3 font-mono text-[10px] space-y-1">
              <div class="text-zinc-600">> init_signer({{ walletService.shortAddress() }})</div>
              <div class="text-zinc-600">> construct_cell_output(dob_v1)</div>
              @if (currentStep() === 'minting') {
                <div class="text-lime-400/70">> signature_verified: OK</div>
                <div class="text-lime-400/70">> encoding_witness_args</div>
                <div class="text-zinc-400 animate-pulse">> broadcasting_tx...</div>
              } @else {
                <div class="text-zinc-400 animate-pulse">> awaiting_signature...</div>
              }
            </div>
          </div>
        }

        <!-- Success -->
        @if (currentStep() === 'success' && earnedBadge()) {
          <div class="border border-white/[0.04] bg-black">
            <!-- Badge Preview -->
            <div class="relative aspect-[4/3] overflow-hidden">
              <img [src]="earnedBadge()?.imageUrl" class="absolute inset-0 w-full h-full object-cover opacity-40">
              <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
              <div class="absolute top-3 right-3">
                <span class="font-mono text-[8px] bg-lime-400 text-black px-2 py-0.5 uppercase tracking-wider">Verified</span>
              </div>
              <div class="absolute bottom-3 left-3 right-3">
                <div class="font-display text-base text-white mb-0.5">{{ earnedBadge()?.eventName }}</div>
                <div class="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">
                  {{ earnedBadge()?.role }} · {{ earnedBadge()?.mintDate | date:'MMM d, yyyy' }}
                </div>
              </div>
            </div>

            <!-- On-chain Data -->
            <div class="p-4 border-t border-white/[0.04]">
              <div class="space-y-2 mb-4">
                <div class="flex justify-between text-[10px]">
                  <span class="font-mono text-zinc-600 uppercase tracking-wider">Tx Hash</span>
                  <span class="font-mono text-zinc-400">{{ earnedBadge()?.txHash | slice:0:10 }}...{{ earnedBadge()?.txHash | slice:-6 }}</span>
                </div>
                <div class="flex justify-between text-[10px]">
                  <span class="font-mono text-zinc-600 uppercase tracking-wider">Status</span>
                  <span class="font-mono text-lime-400">Observed on-chain</span>
                </div>
              </div>

              <a routerLink="/gallery" class="btn-action w-full justify-center">
                <span>View Attestations</span>
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </a>
            </div>
          </div>
        }

      </div>
    </div>

    @if (showWalletModal()) {
      <app-wallet-modal (close)="showWalletModal.set(false)"></app-wallet-modal>
    }

    <!-- Confirm Dialog -->
    @if (showConfirmDialog()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/90" (click)="showConfirmDialog.set(false)"></div>

        <div class="relative w-full max-w-xs bg-black border border-white/[0.06] p-4">
          <div class="text-center mb-4">
            <div class="w-8 h-8 border border-lime-400/30 mx-auto mb-3 flex items-center justify-center">
              <svg class="w-4 h-4 text-lime-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div class="font-display text-sm text-white mb-1">{{ flowKind() === 'claim' ? 'Confirm Claim' : 'Confirm Transaction' }}</div>
            <div class="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">
              {{ flowKind() === 'claim' ? 'Eligibility verified, mint requires your signature' : 'Irreversible on-chain action' }}
            </div>
          </div>

          <div class="bg-zinc-950 border border-white/[0.04] p-3 mb-4 space-y-1.5">
            <div class="flex justify-between text-[10px]">
              <span class="font-mono text-zinc-600 uppercase">Event</span>
              <span class="font-mono text-white truncate ml-2">{{ event()?.name }}</span>
            </div>
            <div class="flex justify-between text-[10px]">
              <span class="font-mono text-zinc-600 uppercase">Fee</span>
              <span class="font-mono text-zinc-400">~0.0001 CKB</span>
            </div>
            <div class="flex justify-between text-[10px]">
              <span class="font-mono text-zinc-600 uppercase">Type</span>
              <span class="font-mono text-lime-400">{{ flowKind() === 'claim' ? 'Claimable SBT' : 'SBT' }}</span>
            </div>
          </div>

          <div class="flex gap-2">
            <button (click)="showConfirmDialog.set(false)" class="flex-1 py-2 border border-zinc-800 text-zinc-500 font-mono text-[10px] uppercase tracking-wider hover:border-zinc-700 hover:text-white transition-colors">
              Cancel
            </button>
            <button (click)="confirmAndMint()" class="btn-action flex-1 justify-center">
              <span>{{ flowKind() === 'claim' ? 'Claim' : 'Sign' }}</span>
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
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
  `]
})
export class MintingComponent implements OnInit {
  poapService = inject(PoapService);
  walletService = inject(WalletService);
  router = inject(Router);

  event = signal<PoPEvent | null>(null);
  currentStep = signal<Step>('confirm');
  earnedBadge = signal<Badge | null>(null);
  showWalletModal = signal(false);
  showConfirmDialog = signal(false);
  flowKind = signal<FlowKind>('check-in');
  proofHash = signal<string | undefined>(undefined);

  steps = [
    { id: 'confirm', label: 'Confirm', status: 'READY' },
    { id: 'sign', label: 'Sign', status: 'SIGNING' },
    { id: 'mint', label: 'Mint', status: 'MINTING' }
  ];

  ngOnInit() {
    const state = history.state;
    if (state && state.event) {
      this.event.set(state.event);
      this.flowKind.set(state.flowKind === 'claim' ? 'claim' : 'check-in');
      this.proofHash.set(state.proofHash);
    } else {
      this.router.navigate(['/check-in']);
    }
  }

  actionLabel() {
    return this.flowKind() === 'claim' ? 'Claim SBT' : 'Sign Transaction';
  }

  readyLabel() {
    return this.flowKind() === 'claim' ? 'Claim Ready' : 'Ready';
  }

  getStepIndex() {
    const stepMap: Record<Step, number> = {
      'confirm': 0,
      'signing': 1,
      'minting': 1,
      'success': 2
    };
    return stepMap[this.currentStep()];
  }

  confirmAndMint() {
    this.showConfirmDialog.set(false);
    this.startMinting();
  }

  startMinting() {
    this.currentStep.set('signing');
    setTimeout(() => {
      this.currentStep.set('minting');
      this.poapService.mintBadge(this.event()!, this.walletService.address()!, this.proofHash()).then(badge => {
        setTimeout(() => {
          this.earnedBadge.set(badge);
          this.currentStep.set('success');
        }, 1000);
      });
    }, 800);
  }
}
