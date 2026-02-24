import { Injectable, signal, inject, computed } from '@angular/core';
import { WalletService } from './wallet.service';
import { ToastService } from './toast.service';
import { ContractService, ChainRejectionError } from './contract.service';

export interface PoPEvent {
  id: string;
  name: string;
  date: string;
  issuer: string;
  location: string;
  description?: string;
  imageUrl?: string;
  anchorTxHash?: string; // On-chain event anchor transaction
}

export interface Badge {
  id: string;
  eventId: string;
  eventName: string;
  mintDate: string;
  txHash: string;
  imageUrl: string;
  role: 'Attendee' | 'Organizer' | 'Certificate';
  blockNumber?: number;
}

export interface Attendee {
  address: string;
  mintDate: string;
  txHash: string;
}

@Injectable({
  providedIn: 'root'
})
export class PoapService {
  private walletService = inject(WalletService);
  private toast = inject(ToastService);
  private contractService = inject(ContractService);

  private readonly badgesSignal = signal<Badge[]>([]);

  // Store created events in memory.
  private readonly eventsSignal = signal<PoPEvent[]>([]);

  // localStorage key for event IDs watched via the CLI.
  private static readonly WATCHED_EVENTS_KEY = 'ckb-pop-watched-events';

  // Reactive set of watched event IDs (CLI-created events linked by ID).
  private readonly watchedIdsSignal = signal<string[]>(this.loadWatchedIdsFromStorage());

  readonly myBadges = this.badgesSignal.asReadonly();

  // Events created by the current wallet OR explicitly watched by event ID.
  // Watched IDs let CLI-created events appear even when the creator address
  // used on the CLI differs from the address connected in the browser.
  readonly myCreatedEvents = computed(() => {
    const address = this.walletService.address();
    if (!address) return [];
    const watchedIds = new Set(this.watchedIdsSignal());
    return this.eventsSignal().filter(
      e => e.issuer === address || watchedIds.has(e.id)
    );
  });

  async getEventByCode(code: string): Promise<PoPEvent> {
    // Handle QR formats:
    //   Simple ID:    "eventId"
    //   Unsigned QR:  "eventId|timestamp"        (fallback, no HMAC)
    //   Signed QR:    "eventId|timestamp|hmac"   (backend-signed)
    let targetId = code;
    let isDynamic = false;
    let timestampMs = 0;

    if (code.includes('|')) {
      const parts = code.split('|');
      targetId = parts[0];
      const rawTs = parseInt(parts[1], 10);
      isDynamic = true;

      // Normalize timestamp: backend sends seconds, fallback sends seconds too.
      // Detect by digit count: <1e12 = seconds, >=1e12 = milliseconds.
      timestampMs = rawTs < 1e12 ? rawTs * 1000 : rawTs;
    }

    // Dynamic QR expiry check (60 second validity window)
    if (isDynamic) {
      const now = Date.now();
      if (now - timestampMs > 60000) {
        throw new Error('QR Code Expired. Please scan the live screen again.');
      }
      if (timestampMs > now + 10000) {
        throw new Error('Invalid Time Check.');
      }
    }

    // Query backend (source of truth) for the event
    try {
      const res = await fetch(`${this.backendUrl}/events/${targetId}`);
      if (res.ok) {
        const data = await res.json();
        const evt = data.event;
        return {
          id: evt.event_id,
          name: evt.metadata.name,
          date: evt.metadata.start_time || evt.activated_at,
          issuer: evt.creator_address,
          location: evt.metadata.location || '',
          description: evt.metadata.description,
          imageUrl: evt.metadata.image_url,
          anchorTxHash: evt.payment_tx_hash,
        };
      }
    } catch {
      // Backend unreachable — fall back to local cache
      const localEvent = this.eventsSignal().find(e => e.id.toLowerCase() === targetId.toLowerCase());
      if (localEvent) return localEvent;
    }

    throw new Error('Event not found');
  }

  async getEventById(id: string): Promise<PoPEvent | undefined> {
    try {
      const res = await fetch(`${this.backendUrl}/events/${id}`);
      if (res.ok) {
        const data = await res.json();
        const evt = data.event;
        return {
          id: evt.event_id,
          name: evt.metadata.name,
          date: evt.metadata.start_time || evt.activated_at,
          issuer: evt.creator_address,
          location: evt.metadata.location || '',
          description: evt.metadata.description,
          imageUrl: evt.metadata.image_url,
          anchorTxHash: evt.payment_tx_hash,
        };
      }
    } catch {
      // Backend unreachable — fall back to local cache
      return this.eventsSignal().find(e => e.id === id);
    }
    return undefined;
  }

  async createEvent(eventData: Pick<PoPEvent, 'name' | 'date' | 'location' | 'description' | 'imageUrl'>, issuerAddress: string): Promise<PoPEvent> {
    const nonce = crypto.randomUUID();

    // Sign creation intent with wallet
    const message = `CKB-PoP-CreateEvent|${nonce}`;
    const signature = await this.walletService.signMessage(message);

    // Submit to backend — gets cryptographic event ID
    // Backend expects Option<DateTime<Utc>> — convert date string to ISO 8601
    const startTime = eventData.date ? new Date(eventData.date).toISOString() : null;

    const res = await fetch(`${this.backendUrl}/events/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creator_address: issuerAddress,
        creator_signature: signature,
        nonce,
        metadata: {
          name: eventData.name,
          description: eventData.description || '',
          image_url: eventData.imageUrl || null,
          location: eventData.location || null,
          start_time: startTime,
          end_time: null,
        }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create event' }));
      throw new Error(err.error || 'Failed to create event');
    }

    const activeEvent = await res.json();
    const eventId = activeEvent.event_id;

    // Optional: create on-chain anchor using the backend-derived ID
    let anchorTxHash: string | undefined;
    try {
      const metadataJson = JSON.stringify({
        name: eventData.name,
        date: eventData.date,
        location: eventData.location,
        description: eventData.description,
      });
      const encoder = new TextEncoder();
      const metadataBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(metadataJson));
      const metadataHash = '0x' + Array.from(new Uint8Array(metadataBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      anchorTxHash = await this.contractService.createEventAnchor(
        eventId,
        issuerAddress,
        metadataHash
      );
    } catch (e) {
      console.warn("Event anchor creation failed (non-critical):", e);
    }

    const newEvent: PoPEvent = {
      id: eventId,
      name: eventData.name,
      date: eventData.date,
      location: eventData.location,
      issuer: issuerAddress,
      description: eventData.description,
      imageUrl: eventData.imageUrl || `https://picsum.photos/seed/${Date.now()}/600/400`,
      anchorTxHash
    };

    this.eventsSignal.update(evts => [newEvent, ...evts]);
    this.toast.success(`Event created: ${newEvent.name}`);

    return newEvent;
  }

  private readonly backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api';
  readonly explorerUrl = import.meta.env.VITE_EXPLORER_URL || 'https://pudge.explorer.nervos.org';

  async getAttendees(eventId: string): Promise<Attendee[]> {
    try {
      const res = await fetch(`${this.backendUrl}/events/${eventId}/badge-holders`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.badges || []).map((b: { holder_address: string; observed_at: string; mint_tx_hash: string }) => ({
        address: b.holder_address,
        mintDate: b.observed_at,
        txHash: b.mint_tx_hash,
      }));
    } catch {
      return [];
    }
  }

  async mintBadge(event: PoPEvent, address: string): Promise<Badge> {
    // Mint badge on-chain via ContractService
    // The TYPE SCRIPT enforces uniqueness - if badge exists, chain rejects
    let txHash: string;
    try {
      txHash = await this.contractService.mintBadge(
        event.id,
        event.issuer,
        address
      );
    } catch (err) {
      // Surface chain rejection to user
      if (err instanceof ChainRejectionError) {
        this.toast.error(err.message);
        throw err;
      }
      throw err;
    }

    // Record the mint in the backend with retry; stash in localStorage on failure.
    this.recordBadgeWithRetry(event.id, address, txHash);

    const newBadge: Badge = {
      id: crypto.randomUUID(),
      eventId: event.id,
      eventName: event.name,
      mintDate: new Date().toISOString(),
      txHash,
      imageUrl: event.imageUrl || `https://picsum.photos/seed/${event.id}/400/400`,
      role: 'Attendee'
    };

    this.badgesSignal.update(badges => [newBadge, ...badges]);
    this.toast.success(`Badge minted for ${event.name}`);

    // Start polling for block confirmation in the background.
    this.pollForConfirmation(txHash);

    return newBadge;
  }

  /**
   * Poll the backend for transaction confirmation.
   * Updates the badge's blockNumber once the tx is committed on-chain.
   */
  private async pollForConfirmation(txHash: string): Promise<void> {
    const poll = async () => {
      try {
        const res = await fetch(`${this.backendUrl}/tx/${txHash}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.confirmed && data.block_number) {
          this.badgesSignal.update(badges =>
            badges.map(b => b.txHash === txHash ? { ...b, blockNumber: data.block_number } : b)
          );
          return; // Confirmed — stop polling.
        }
      } catch {
        // Backend unreachable — will retry.
      }
      setTimeout(poll, 10_000);
    };
    setTimeout(poll, 5_000); // First check after 5 seconds.
  }

  /**
   * UX hint: Check if badge might already exist.
   * For display purposes only - not enforcement.
   */
  async checkBadgeExistsHint(eventId: string, address: string): Promise<boolean> {
    return this.contractService.badgeExistsHint(eventId, address);
  }

  /**
   * Load badges from the backend for the given address.
   * Merges backend observations with locally-minted badges.
   * Eagerly resolves block numbers for any pending badges via /api/tx/:hash.
   */
  async loadBadgesFromBackend(address: string): Promise<void> {
    // Flush any badge records that failed to POST in a previous session.
    await this.flushPendingRecords();

    try {
      const res = await fetch(`${this.backendUrl}/badges/observe?address=${encodeURIComponent(address)}`);
      if (!res.ok) return;
      const data = await res.json();
      const observations: Array<{
        event_id: string;
        holder_address: string;
        mint_tx_hash: string;
        mint_block_number: number;
        verified_at_block: number;
        observed_at: string;
      }> = data.badges || [];

      // Fetch event details for names and images
      const backendBadges: Badge[] = [];
      for (const obs of observations) {
        const event = await this.getEventById(obs.event_id);

        // If block number is 0 (pending), try resolving it now.
        let blockNumber = obs.mint_block_number > 0 ? obs.mint_block_number : undefined;
        if (!blockNumber) {
          blockNumber = await this.resolveBlockNumber(obs.mint_tx_hash);
        }

        backendBadges.push({
          id: `${obs.event_id}-${obs.holder_address}`,
          eventId: obs.event_id,
          eventName: event?.name || obs.event_id,
          mintDate: obs.observed_at,
          txHash: obs.mint_tx_hash,
          imageUrl: event?.imageUrl || `https://picsum.photos/seed/${obs.event_id}/400/400`,
          role: 'Attendee',
          blockNumber,
        });
      }

      // Merge: keep local badges that aren't in backend, add all backend badges
      const localOnly = this.badgesSignal().filter(
        b => !backendBadges.some(bb => bb.txHash === b.txHash)
      );
      this.badgesSignal.set([...backendBadges, ...localOnly]);

      // Start polling for any still-unconfirmed badges.
      for (const badge of backendBadges) {
        if (!badge.blockNumber) {
          this.pollForConfirmation(badge.txHash);
        }
      }
    } catch {
      // Backend unreachable — keep local badges only
    }
  }

  /**
   * Try to resolve a block number for a tx hash via the backend tx status endpoint.
   * Returns undefined if the tx is not yet confirmed or unreachable.
   */
  private async resolveBlockNumber(txHash: string): Promise<number | undefined> {
    try {
      const res = await fetch(`${this.backendUrl}/tx/${txHash}`);
      if (!res.ok) return undefined;
      const data = await res.json();
      if (data.confirmed && data.block_number) {
        return data.block_number;
      }
    } catch {
      // Unreachable — leave as pending.
    }
    return undefined;
  }

  private static readonly PENDING_RECORDS_KEY = 'ckb-pop-pending-badge-records';

  /**
   * POST to /badges/record with retry. On total failure, stash in localStorage
   * so the next login can flush it.
   */
  private async recordBadgeWithRetry(eventId: string, address: string, txHash: string): Promise<void> {
    const payload = { event_id: eventId, holder_address: address, tx_hash: txHash };
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const res = await fetch(`${this.backendUrl}/badges/record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) return;
      } catch {
        // Network error — will retry.
      }
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }

    // All retries exhausted — stash for next login.
    this.stashPendingRecord(payload);
  }

  private stashPendingRecord(record: { event_id: string; holder_address: string; tx_hash: string }): void {
    try {
      const raw = localStorage.getItem(PoapService.PENDING_RECORDS_KEY);
      const pending: Array<typeof record> = raw ? JSON.parse(raw) : [];
      if (!pending.some(r => r.tx_hash === record.tx_hash)) {
        pending.push(record);
        localStorage.setItem(PoapService.PENDING_RECORDS_KEY, JSON.stringify(pending));
      }
    } catch {
      // localStorage unavailable — best-effort.
    }
  }

  /**
   * Flush any stashed badge records to the backend.
   * Called on login before loading badges.
   */
  private async flushPendingRecords(): Promise<void> {
    let pending: Array<{ event_id: string; holder_address: string; tx_hash: string }>;
    try {
      const raw = localStorage.getItem(PoapService.PENDING_RECORDS_KEY);
      if (!raw) return;
      pending = JSON.parse(raw);
      if (!pending.length) return;
    } catch {
      return;
    }

    const remaining: typeof pending = [];
    for (const record of pending) {
      try {
        const res = await fetch(`${this.backendUrl}/badges/record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        });
        if (!res.ok) remaining.push(record);
      } catch {
        remaining.push(record);
      }
    }

    if (remaining.length) {
      localStorage.setItem(PoapService.PENDING_RECORDS_KEY, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(PoapService.PENDING_RECORDS_KEY);
    }
  }

  /**
   * Load events created by the given address from the backend.
   * Also loads any events that were watched by event ID (e.g. CLI-created
   * events whose creator address differs from the connected wallet).
   * Populates eventsSignal so myCreatedEvents works across sessions.
   */
  async loadMyEventsFromBackend(address: string): Promise<void> {
    try {
      const res = await fetch(`${this.backendUrl}/events`);
      if (!res.ok) return;
      const data = await res.json();

      type RawEvent = {
        event_id: string;
        metadata: { name: string; start_time?: string; description?: string; image_url?: string; location?: string };
        activated_at: string;
        creator_address: string;
        payment_tx_hash?: string;
      };

      const mapEvent = (e: RawEvent): PoPEvent => ({
        id: e.event_id,
        name: e.metadata.name,
        date: e.metadata.start_time || e.activated_at,
        issuer: e.creator_address,
        location: e.metadata.location || '',
        description: e.metadata.description,
        imageUrl: e.metadata.image_url,
        anchorTxHash: e.payment_tx_hash,
      });

      // Events owned by the connected wallet address.
      const owned: PoPEvent[] = (data.events as RawEvent[] || [])
        .filter(e => e.creator_address === address)
        .map(mapEvent);

      // Events watched by ID — CLI-created events linked by event ID so they
      // appear in My Events even when the CLI wallet differs from the browser
      // wallet.
      const watchedIds = this.watchedIdsSignal();
      const allEvents: Map<string, RawEvent> = new Map(
        (data.events as RawEvent[] || []).map(e => [e.event_id, e])
      );
      const watched: PoPEvent[] = watchedIds
        .filter(id => allEvents.has(id) && !owned.some(e => e.id === id))
        .map(id => mapEvent(allEvents.get(id)!));

      const toAdd = [...owned, ...watched];

      // Merge, avoiding duplicates already in the signal.
      const existingIds = new Set(this.eventsSignal().map(e => e.id));
      const newEvents = toAdd.filter(e => !existingIds.has(e.id));
      if (newEvents.length > 0) {
        this.eventsSignal.update(existing => [...existing, ...newEvents]);
      }
    } catch {
      // Backend unreachable — keep local events only.
    }
  }

  /**
   * Watch a CLI-created event by its event ID.
   * Fetches the event from the backend, saves the ID to localStorage so it
   * persists across sessions, and adds it to myCreatedEvents immediately.
   */
  async watchEventById(id: string): Promise<void> {
    const trimmed = id.trim().toLowerCase();
    if (!trimmed) throw new Error('Event ID is required.');

    const event = await this.getEventById(trimmed);
    if (!event) throw new Error(`No event found with ID: ${trimmed}`);

    // Persist to localStorage and update reactive signal.
    const current = this.watchedIdsSignal();
    if (!current.includes(trimmed)) {
      const updated = [...current, trimmed];
      try {
        localStorage.setItem(PoapService.WATCHED_EVENTS_KEY, JSON.stringify(updated));
      } catch {
        // localStorage unavailable — still work in-memory.
      }
      this.watchedIdsSignal.set(updated);
    }

    // Merge the event into the signal so myCreatedEvents picks it up.
    const existingIds = new Set(this.eventsSignal().map(e => e.id));
    if (!existingIds.has(trimmed)) {
      this.eventsSignal.update(events => [event, ...events]);
    }
  }

  /** Read watched event IDs from localStorage on service initialisation. */
  private loadWatchedIdsFromStorage(): string[] {
    try {
      const raw = localStorage.getItem(PoapService.WATCHED_EVENTS_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }
}