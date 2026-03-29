import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClaimResolution, ClaimService } from '../../services/claim.service';
import { WalletService } from '../../services/wallet.service';
import { WalletModalComponent } from '../wallet-modal/wallet-modal.component';

@Component({
  selector: 'app-claim',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, WalletModalComponent],
  template: `
    <div class="min-h-screen pt-14 pb-20 px-4">
      <div class="max-w-md mx-auto pt-8">

        @if (!walletService.isConnected()) {
          <div class="border border-white/[0.04] bg-black p-6 text-center">
            <div class="font-display text-lg text-white mb-1">Wallet Required</div>
            <div class="font-mono text-[10px] text-zinc-600 uppercase tracking-wider mb-4">Connect to claim your badge</div>
            <button (click)="showWalletModal.set(true)" class="btn-action w-full justify-center">
              <span>Connect Wallet</span>
            </button>
          </div>
        } @else {
          <div class="mb-6">
            <div class="font-display text-lg text-white mb-1">Claim Participation Badge</div>
            <div class="font-mono text-[10px] text-zinc-600 uppercase tracking-wider">Use a claim token from an online or hybrid program</div>
          </div>

          @if (errorMsg()) {
            <div class="border border-red-500/20 bg-red-900/10 p-3 mb-4">
              <div class="font-mono text-[9px] text-red-400 uppercase tracking-wider mb-1">Claim Failed</div>
              <div class="text-xs text-red-300/70">{{ errorMsg() }}</div>
            </div>
          }

          <div class="border border-white/[0.04] bg-black p-4 mb-4">
            <label class="font-mono text-[9px] text-zinc-500 uppercase tracking-wider block mb-2">Claim Token</label>
            <textarea
              [formControl]="claimToken"
              rows="5"
              placeholder="Paste the claim token you received"
              class="w-full bg-zinc-900/50 border border-white/[0.04] px-3 py-2 text-white font-mono text-xs placeholder:text-zinc-700 focus:border-lime-400/30 focus:outline-none resize-none"
            ></textarea>
            <button
              (click)="verifyClaim()"
              [disabled]="claimToken.invalid || isVerifying()"
              class="btn-action w-full justify-center mt-3 disabled:opacity-40"
            >
              @if (isVerifying()) {
                <div class="w-3 h-3 border border-black/30 border-t-black animate-spin"></div>
              } @else {
                <span>Verify Claim</span>
              }
            </button>
          </div>

          @if (pendingClaim()) {
            <div class="border border-white/[0.04] bg-black p-4">
              <div class="font-mono text-[9px] text-lime-400 uppercase tracking-wider mb-2">{{ pendingClaim()?.event?.scopeKind || 'scope' }}</div>
              <div class="font-display text-base text-white mb-1">{{ pendingClaim()?.event?.name }}</div>
              <div class="font-mono text-[10px] text-zinc-600 uppercase tracking-wider mb-4">
                {{ pendingClaim()?.event?.participationMode || 'online' }} · {{ pendingClaim()?.proofDriver }}
              </div>

              <div class="space-y-2 border-t border-b border-white/[0.04] py-3 mb-4 text-[10px]">
                <div class="flex justify-between">
                  <span class="font-mono text-zinc-600 uppercase">Recipient</span>
                  <span class="font-mono text-zinc-400">{{ pendingClaim()?.recipientAddress | slice:0:12 }}...</span>
                </div>
                <div class="flex justify-between">
                  <span class="font-mono text-zinc-600 uppercase">Reference</span>
                  <span class="font-mono text-zinc-400">{{ pendingClaim()?.proofRef }}</span>
                </div>
              </div>

              <button (click)="continueToMint()" class="btn-action w-full justify-center">
                <span>Claim SBT</span>
              </button>
            </div>
          }
        }
      </div>
    </div>

    @if (showWalletModal()) {
      <app-wallet-modal (close)="showWalletModal.set(false)"></app-wallet-modal>
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
    .btn-action:hover:not(:disabled) {
      box-shadow: 0 0 20px rgba(163, 230, 53, 0.3);
    }
  `]
})
export class ClaimComponent implements OnInit {
  private readonly claimService = inject(ClaimService);
  protected readonly walletService = inject(WalletService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly showWalletModal = signal(false);
  protected readonly isVerifying = signal(false);
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly pendingClaim = signal<ClaimResolution | null>(null);

  protected readonly claimToken = new FormControl('', [
    Validators.required,
    Validators.minLength(16),
  ]);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.claimToken.setValue(token);
    }
  }

  async verifyClaim(): Promise<void> {
    const address = this.walletService.address();
    const token = this.claimToken.value?.trim();
    if (!address || !token) {
      return;
    }

    this.isVerifying.set(true);
    this.errorMsg.set(null);
    this.pendingClaim.set(null);

    try {
      this.pendingClaim.set(await this.claimService.verifyClaimToken(token, address));
    } catch (error) {
      this.errorMsg.set(error instanceof Error ? error.message : 'Failed to verify claim.');
    } finally {
      this.isVerifying.set(false);
    }
  }

  continueToMint(): void {
    const resolution = this.pendingClaim();
    if (!resolution) {
      return;
    }

    this.router.navigate(['/minting'], {
      state: {
        event: resolution.event,
        proofHash: resolution.proofHash,
        flowKind: 'claim',
      },
    });
  }
}
