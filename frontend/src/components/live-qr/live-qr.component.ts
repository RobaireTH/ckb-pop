import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { PoapService, PoPEvent } from '../../services/poap.service';
import { WalletService } from '../../services/wallet.service';
import { WalletModalComponent } from '../wallet-modal/wallet-modal.component';
import { buildWindowMessage } from '../../lib/ckb-presence';
import QRCode from 'qrcode';

@Component({
	selector: 'app-live-qr',
	standalone: true,
	imports: [CommonModule, RouterLink, WalletModalComponent],
	template: `
		<div class="min-h-screen bg-black flex items-center justify-center p-4">
			<div class="w-full max-w-lg border border-white/[0.04]">

				<!-- Terminal Header -->
				<div class="bg-zinc-900 border-b border-white/[0.04] px-4 py-2 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<div class="w-2 h-2 bg-red-500"></div>
						<div class="w-2 h-2 bg-yellow-500"></div>
						<div class="w-2 h-2 bg-green-500"></div>
					</div>
					<div class="font-mono text-[8px] text-zinc-600 uppercase tracking-wider">Kiosk Terminal</div>
				</div>

				@if (event()) {
					<!-- Event Info -->
					<div class="p-4 border-b border-white/[0.04]">
						<div class="flex items-start justify-between">
							<div>
								<div class="font-display text-lg text-white mb-0.5">{{ event()?.name }}</div>
								<div class="font-mono text-[10px] text-lime-400 uppercase tracking-wider">{{ event()?.location }}</div>
							</div>
							<div class="text-right">
								<div class="font-mono text-[8px] text-zinc-600 uppercase tracking-wider">ID</div>
								<div class="font-mono text-xs text-zinc-400">{{ event()?.id?.slice(0, 8) }}...</div>
							</div>
						</div>
					</div>

					@if (needsWallet()) {
						<!-- Creator must connect wallet to sign QR codes -->
						<div class="p-6 text-center">
							<div class="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-3">
								Connect wallet to generate attendance codes
							</div>
							<button (click)="showModal.set(true)" class="inline-flex items-center gap-2 px-4 py-2 bg-lime-400 text-black font-mono text-[10px] font-semibold uppercase tracking-wider">
								<span>Connect Wallet</span>
							</button>
						</div>
					} @else if (signingError()) {
						<div class="p-6 text-center">
							<div class="font-mono text-[10px] text-red-400 uppercase tracking-wider mb-1">Signing Error</div>
							<div class="font-mono text-[9px] text-zinc-500">{{ signingError() }}</div>
							<button (click)="startKiosk()" class="mt-3 font-mono text-[9px] text-lime-400 uppercase tracking-wider hover:underline">
								Retry
							</button>
						</div>
					} @else {

						<!-- QR Code -->
						<div class="p-6 flex justify-center">
							<div class="relative">
								<!-- Corner Brackets -->
								<div class="absolute -top-2 -left-2 w-4 h-4 border-l border-t border-lime-400"></div>
								<div class="absolute -top-2 -right-2 w-4 h-4 border-r border-t border-lime-400"></div>
								<div class="absolute -bottom-2 -left-2 w-4 h-4 border-l border-b border-lime-400"></div>
								<div class="absolute -bottom-2 -right-2 w-4 h-4 border-r border-b border-lime-400"></div>

								@if (qrUrl()) {
									<img [src]="qrUrl()" class="w-56 h-56 bg-white p-2" alt="QR">
								} @else {
									<div class="w-56 h-56 bg-zinc-900 flex items-center justify-center">
										<div class="font-mono text-[9px] text-zinc-600 uppercase tracking-wider animate-pulse">Generating...</div>
									</div>
								}
							</div>
						</div>

						<!-- Timer -->
						<div class="px-6 pb-4">
							<div class="flex items-center justify-between mb-2">
								<span class="font-mono text-[9px] text-zinc-600 uppercase tracking-wider">Key Validity</span>
								<span class="font-mono text-xs text-white">{{ secondsLeft() }}s</span>
							</div>
							<div class="h-1 bg-zinc-900 overflow-hidden">
								<div class="h-full bg-lime-400 transition-all duration-1000" [style.width.%]="progress()"></div>
							</div>
						</div>
					}

					<!-- Footer -->
					<div class="px-4 py-3 border-t border-white/[0.04] bg-zinc-950">
						<a routerLink="/gallery" class="block text-center font-mono text-[9px] text-zinc-600 hover:text-white uppercase tracking-wider transition-colors">
							[ESC] Return
						</a>
					</div>
				} @else {
					<div class="p-8 text-center">
						<div class="font-mono text-[10px] text-zinc-600 uppercase tracking-wider animate-pulse">Initializing...</div>
					</div>
				}

			</div>
		</div>

		@if (showModal()) {
			<app-wallet-modal (close)="onWalletModalClose()"></app-wallet-modal>
		}
	`
})
export class LiveQrComponent implements OnInit, OnDestroy {
	route = inject(ActivatedRoute);
	router = inject(Router);
	poapService = inject(PoapService);
	walletService = inject(WalletService);

	event = signal<PoPEvent | null>(null);
	qrUrl = signal<string | null>(null);
	progress = signal(100);
	secondsLeft = signal(30);
	needsWallet = signal(false);
	signingError = signal<string | null>(null);
	showModal = signal(false);

	private intervalId: ReturnType<typeof setInterval> | null = null;
	private refreshRate = 30;
	// Signed once per kiosk session to avoid repeated wallet popups.
	private sessionSignature: string | null = null;

	async ngOnInit() {
		const id = this.route.snapshot.paramMap.get('id');
		if (!id) {
			this.router.navigate(['/gallery']);
			return;
		}

		const ev = await this.poapService.getEventById(id);
		if (!ev) {
			this.router.navigate(['/gallery']);
			return;
		}
		this.event.set(ev);
		await this.startKiosk();
	}

	ngOnDestroy() {
		if (this.intervalId) clearInterval(this.intervalId);
	}

	onWalletModalClose() {
		this.showModal.set(false);
		if (this.walletService.isConnected()) {
			this.startKiosk();
		}
	}

	async startKiosk() {
		this.signingError.set(null);
		this.needsWallet.set(false);

		if (!this.walletService.isConnected()) {
			this.needsWallet.set(true);
			return;
		}

		const ev = this.event();
		if (!ev) return;

		try {
			// Sign the standard attendance window message.
			const windowStart = Math.floor(Date.now() / 1000);
			const message = buildWindowMessage(ev.id, windowStart, null);
			const signature = await this.walletService.signMessage(message);

			// Register the window with the backend so HMACs can be verified.
			await this.poapService.registerWindow(ev.id, windowStart, null, signature);

			this.startRotation();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to sign attendance session.';
			this.signingError.set(message);
		}
	}

	private startRotation() {
		this.generateQr();
		let tick = 0;
		this.intervalId = setInterval(() => {
			tick++;
			const remaining = Math.max(0, this.secondsLeft() - 1);
			this.secondsLeft.set(remaining);
			this.progress.set((remaining / this.refreshRate) * 100);

			if (tick >= this.refreshRate) {
				this.generateQr();
				tick = 0;
			}
		}, 1000);
	}

	private async generateQr() {
		const ev = this.event();
		if (!ev) return;

		try {
			const { qr_data, expires_at } = await this.poapService.getQr(ev.id);

			const dataUrl = await QRCode.toDataURL(qr_data, {
				width: 300,
				margin: 1,
				color: { dark: '#0f172a', light: '#ffffff' },
				errorCorrectionLevel: 'L',
			});
			this.qrUrl.set(dataUrl);

			const now = Math.floor(Date.now() / 1000);
			const remaining = Math.max(1, expires_at - now);
			this.secondsLeft.set(remaining);
			this.refreshRate = remaining; // Sync local refresh rate with backend TTL.
			this.progress.set(100);
		} catch (err) {
			this.signingError.set('Failed to fetch rotating QR from backend.');
			if (this.intervalId) clearInterval(this.intervalId);
			this.intervalId = null;
			return;
		}
	}
}
