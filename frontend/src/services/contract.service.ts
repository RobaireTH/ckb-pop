import { Injectable, inject } from '@angular/core';
import { ccc } from '@ckb-ccc/ccc';
import { WalletService } from './wallet.service';

/**
 * Contract configuration for deployed type scripts.
 * These MUST match the deployed contracts exactly.
 *
 * Args schema (defined by contracts, mirrored here):
 *   - DOB Badge:    type_id (20) || SHA256(event_id)[..20] (20) || SHA256(recipient_address)[..20] (20) = 60 bytes
 *   - Event Anchor: SHA256(event_id)[..20] (20) || SHA256(creator_address)[..20] (20) = 40 bytes
 */
export interface ContractConfig {
  codeHash: string;
  hashType: 'type' | 'data' | 'data1' | 'data2';
  cellDep: {
    outPoint: {
      txHash: string;
      index: number;
    };
    depType: 'code' | 'depGroup';
  };
}

/**
 * Contract deployment configs - loaded from environment at build time.
 * In production, these come from: import.meta.env.VITE_DOB_BADGE_CODE_HASH etc.
 */
const DOB_BADGE_CONFIG: ContractConfig = {
  codeHash: import.meta.env.VITE_DOB_BADGE_CODE_HASH || '0x0000000000000000000000000000000000000000000000000000000000000001',
  hashType: (import.meta.env.VITE_DOB_BADGE_HASH_TYPE as ContractConfig['hashType']) || 'type',
  cellDep: {
    outPoint: {
      txHash: import.meta.env.VITE_DOB_BADGE_DEP_TX_HASH || '0x0000000000000000000000000000000000000000000000000000000000000000',
      index: Number(import.meta.env.VITE_DOB_BADGE_DEP_INDEX) || 0,
    },
    depType: 'code',
  },
};

const EVENT_ANCHOR_CONFIG: ContractConfig = {
  codeHash: import.meta.env.VITE_EVENT_ANCHOR_CODE_HASH || '0x0000000000000000000000000000000000000000000000000000000000000002',
  hashType: (import.meta.env.VITE_EVENT_ANCHOR_HASH_TYPE as ContractConfig['hashType']) || 'type',
  cellDep: {
    outPoint: {
      txHash: import.meta.env.VITE_EVENT_ANCHOR_DEP_TX_HASH || '0x0000000000000000000000000000000000000000000000000000000000000000',
      index: Number(import.meta.env.VITE_EVENT_ANCHOR_DEP_INDEX) || 0,
    },
    depType: 'code',
  },
};

/**
 * Check if contracts are deployed (non-placeholder code hashes)
 */
const CONTRACTS_DEPLOYED = !DOB_BADGE_CONFIG.codeHash.endsWith('0001');

/**
 * Cell data format (binary, versioned):
 * [ version: u8 | flags: u8 | content_hash: 32 bytes ]
 *
 * Version 1 flags:
 *   0x01 = has off-chain metadata
 */
const DATA_VERSION = 1;
const FLAG_HAS_METADATA = 0x01;

/**
 * Transaction rejection error with chain details
 */
export class ChainRejectionError extends Error {
  constructor(
    message: string,
    public readonly errorCode?: number,
    public readonly scriptError?: string
  ) {
    super(message);
    this.name = 'ChainRejectionError';
  }

  static fromCkbError(err: unknown): ChainRejectionError {
    const message = err instanceof Error ? err.message : String(err);

    // Parse CKB script errors
    if (message.includes('ValidationFailure')) {
      const match = message.match(/error code (\d+)/);
      const code = match ? parseInt(match[1], 10) : undefined;

      // Map known error codes
      let reason = 'Transaction rejected by type script';
      if (code === 1) reason = 'Invalid script args format';
      if (code === 2) reason = 'Type ID validation failed';

      return new ChainRejectionError(reason, code, message);
    }

    return new ChainRejectionError(message);
  }
}

@Injectable({
  providedIn: 'root'
})
export class ContractService {
  private walletService = inject(WalletService);

  /**
   * SHA256 hash helper using Web Crypto API.
   * Mirrors the hashing used in contracts.
   */
  private async sha256(data: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return new Uint8Array(hashBuffer);
  }

  /** First 20 bytes of SHA256 — matches the 20-byte truncated hash used in contract args. */
  private async sha256Truncated(data: string): Promise<Uint8Array> {
    return (await this.sha256(data)).slice(0, 20);
  }

  /** Convert a Uint8Array to a lowercase hex string (without 0x prefix). */
  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Build type script args for the event anchor contract:
   * SHA256(eventId)[..20] || SHA256(address)[..20] = 40 bytes
   */
  private async buildArgs(eventId: string, address: string): Promise<string> {
    const eventIdHash = await this.sha256Truncated(eventId);
    const addressHash = await this.sha256Truncated(address);

    const args = new Uint8Array(40);
    args.set(eventIdHash, 0);
    args.set(addressHash, 20);

    return '0x' + this.bytesToHex(args);
  }

  /**
   * Build versioned binary cell data.
   * Format: [ version | flags | content_hash ]
   */
  private async buildCellData(contentJson: object): Promise<string> {
    const contentStr = JSON.stringify(contentJson);
    const contentHash = await this.sha256(contentStr);

    const data = new Uint8Array(34); // 1 + 1 + 32
    data[0] = DATA_VERSION;
    data[1] = FLAG_HAS_METADATA;
    data.set(contentHash, 2);

    return '0x' + this.bytesToHex(data);
  }

  private configToScript(config: ContractConfig, args: string): ccc.Script {
    return ccc.Script.from({
      codeHash: config.codeHash,
      hashType: config.hashType,
      args: args,
    });
  }

  private configToCellDep(config: ContractConfig): ccc.CellDep {
    return ccc.CellDep.from({
      outPoint: ccc.OutPoint.from({
        txHash: config.cellDep.outPoint.txHash,
        index: config.cellDep.outPoint.index,
      }),
      depType: config.cellDep.depType,
    });
  }

  /**
   * Build a DOB Badge minting transaction skeleton.
   *
   * The type_id field in args (bytes 0-31) is set to zeros as a placeholder.
   * The caller MUST inject the real type_id after selecting inputs, because
   * the type_id is derived from the first input's outpoint — which is only
   * known after completeInputsByCapacity runs.
   *
   * The output is sized for 60-byte args so capacity calculation is correct.
   */
  async buildBadgeMintTx(
    eventId: string,
    eventIssuer: string,
    recipientAddress: string,
    proofHash?: string
  ): Promise<ccc.Transaction> {
    const signer = this.walletService.signer;
    if (!signer) {
      throw new Error('Wallet not connected');
    }

    const eventIdHash = await this.sha256Truncated(eventId);
    const addressHash = await this.sha256Truncated(recipientAddress);

    // 60-byte args: zero type_id placeholder (0-19) + event_id_hash (20-39) + recipient_hash (40-59)
    const args = new Uint8Array(60);
    args.set(eventIdHash, 20);
    args.set(addressHash, 40);

    const typeScript = this.configToScript(DOB_BADGE_CONFIG, '0x' + this.bytesToHex(args));
    const recipientLock = (await ccc.Address.fromString(recipientAddress, this.walletService.ckbClient)).script;

    // Build cell data (hash-only, full metadata stored off-chain)
    const cellData = await this.buildCellData({
      protocol: 'ckb-pop',
      version: 1,
      event_id: eventId,
      issuer: eventIssuer,
      proof_hash: proofHash,
    });

    const tx = ccc.Transaction.from({
      outputs: [{ lock: recipientLock, type: typeScript }],
      outputsData: [cellData],
    });

    tx.cellDeps.push(this.configToCellDep(DOB_BADGE_CONFIG));
    return tx;
  }

  /**
   * Build an Event Anchor creation transaction.
   * Immutability is enforced by the TYPE SCRIPT.
   */
  async buildEventAnchorTx(
    eventId: string,
    creatorAddress: string,
    metadataHash?: string
  ): Promise<ccc.Transaction> {
    const signer = this.walletService.signer;
    if (!signer) {
      throw new Error('Wallet not connected');
    }

    const args = await this.buildArgs(eventId, creatorAddress);
    const typeScript = this.configToScript(EVENT_ANCHOR_CONFIG, args);
    const creatorLock = (await ccc.Address.fromString(creatorAddress, this.walletService.ckbClient)).script;

    const cellData = await this.buildCellData({
      event_id: eventId,
      creator: creatorAddress,
      metadata_hash: metadataHash,
    });

    const tx = ccc.Transaction.from({
      outputs: [{ lock: creatorLock, type: typeScript }],
      outputsData: [cellData],
    });

    tx.cellDeps.push(this.configToCellDep(EVENT_ANCHOR_CONFIG));
    return tx;
  }

  /**
   * Mint a DOB badge on-chain.
   *
   * The type_id is computed after inputs are selected and injected into
   * the badge output's type script args before the transaction is signed.
   */
  async mintBadge(
    eventId: string,
    eventIssuer: string,
    recipientAddress: string,
    proofHash?: string
  ): Promise<string> {
    if (!CONTRACTS_DEPLOYED) {
      // Simulation mode - contracts not yet deployed
      await new Promise(resolve => setTimeout(resolve, 1500));
      return '0x' + Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
    }

    const signer = this.walletService.signer;
    if (!signer) {
      throw new Error('Wallet not connected');
    }

    try {
      // 1. Build the transaction skeleton with a zero type_id placeholder.
      const tx = await this.buildBadgeMintTx(eventId, eventIssuer, recipientAddress, proofHash);

      // 2. Select capacity inputs. The first input's outpoint determines the type_id.
      await tx.completeInputsByCapacity(signer);

      // 3. Compute the type_id: blake2b(first_input_packed || output_index_u64_le), truncated to 20 bytes.
      const typeIdHex = ccc.hashTypeId(tx.inputs[0], 0).slice(2, 42); // first 40 hex chars = 20 bytes

      // 4. Replace the placeholder in args with the real type_id.
      const eventIdHex = this.bytesToHex(await this.sha256Truncated(eventId));
      const recipientHex = this.bytesToHex(await this.sha256Truncated(recipientAddress));
      tx.outputs[0].type!.args = `0x${typeIdHex}${eventIdHex}${recipientHex}`;

      // 5. Complete fee and send.
      await tx.completeFeeBy(signer);
      return signer.sendTransaction(tx);
    } catch (err) {
      throw ChainRejectionError.fromCkbError(err);
    }
  }

  /**
   * Create an event anchor on-chain.
   * Chain will reject if anchor already exists (error code 3).
   */
  async createEventAnchor(
    eventId: string,
    creatorAddress: string,
    metadataHash?: string
  ): Promise<string> {
    if (!CONTRACTS_DEPLOYED) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      return '0x' + Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
    }

    try {
      const tx = await this.buildEventAnchorTx(eventId, creatorAddress, metadataHash);
      return await this.walletService.sendTransaction(tx);
    } catch (err) {
      throw ChainRejectionError.fromCkbError(err);
    }
  }

  /**
   * UX HINT ONLY: Check if a badge might already exist.
   *
   * WARNING: This is for UI feedback only. Do NOT use for enforcement.
   * - Indexers lag behind chain tip
   * - Race conditions are possible
   * - The TYPE SCRIPT is the source of truth
   *
   * NOTE: With the Type ID args layout, the type_id occupies bytes 0-31 and
   * is unique per badge instance. A prefix search by (event_id, recipient)
   * is no longer possible via the indexer alone. This hint always returns
   * false until an alternative lookup (e.g. backend query) is implemented.
   */
  async badgeExistsHint(_eventId: string, _recipientAddress: string): Promise<boolean> {
    return false;
  }

  /**
   * UX HINT ONLY: Check if an event anchor might exist.
   */
  async eventAnchorExistsHint(eventId: string, creatorAddress: string): Promise<boolean> {
    if (!CONTRACTS_DEPLOYED) {
      return false;
    }

    try {
      const args = await this.buildArgs(eventId, creatorAddress);
      const typeScript = this.configToScript(EVENT_ANCHOR_CONFIG, args);

      const client = this.walletService.ckbClient;
      const cells = client.findCells({
        script: typeScript,
        scriptType: 'type',
        scriptSearchMode: 'exact',
      });

      for await (const _ of cells) {
        return true;
      }
    } catch {
      // Indexer errors shouldn't block UX
    }
    return false;
  }

  /**
   * Check if contracts are deployed and ready for real transactions.
   */
  isDeployed(): boolean {
    return CONTRACTS_DEPLOYED;
  }
}
