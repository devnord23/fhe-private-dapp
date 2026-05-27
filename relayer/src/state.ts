/**
 * state.ts — Persistent JSON file state management.
 *
 * The relayer stores all state in a single JSON file.
 * This is suitable for an MVP single-process relayer.
 *
 * For production, replace with:
 *   - PostgreSQL / SQLite for concurrent access
 *   - Redis for shared state across multiple relayer instances
 *   - Or a purpose-built relayer database schema
 *
 * IDEMPOTENCY GUARANTEE:
 *   Every processed event is stored by its unique ID (txHash + logIndex).
 *   Before processing any event, the relayer checks this set.
 *   On restart, already-processed events are skipped automatically.
 *
 * CONCURRENCY NOTE:
 *   This implementation is NOT safe for concurrent relayer instances.
 *   Only run ONE relayer at a time against the same state file.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RelayerState, UserMapping, PendingWithdrawal, WithdrawalStatus } from "./types.js";
import { logger } from "./logger.js";

const RELAYER_VERSION = "0.1.0";

/** Create an empty initial state. */
function emptyState(): RelayerState {
  return {
    lastProcessedBlock: 0,
    processedEvents:    {},
    userMappings:       {},
    pendingWithdrawals: {},
    meta: {
      startedAt: Date.now(),
      updatedAt: Date.now(),
      version:   RELAYER_VERSION,
    },
  };
}

export class StateManager {
  private filePath: string;
  private state: RelayerState;

  constructor(filePath: string) {
    // Resolve relative to cwd
    this.filePath = resolve(process.cwd(), filePath);
    this.state = this.load();
  }

  private load(): RelayerState {
    if (!existsSync(this.filePath)) {
      logger.info(`[state] No state file found at ${this.filePath}. Starting fresh.`);
      return emptyState();
    }
    try {
      const raw = readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as RelayerState;
      logger.info("[state] Loaded state", {
        lastProcessedBlock: parsed.lastProcessedBlock,
        processedEvents:    Object.keys(parsed.processedEvents).length,
        userMappings:       Object.keys(parsed.userMappings).length,
        pendingWithdrawals: Object.keys(parsed.pendingWithdrawals).length,
      });
      return parsed;
    } catch (err) {
      logger.error("[state] Failed to parse state file, starting fresh", {
        path:  this.filePath,
        error: err instanceof Error ? err.message : String(err),
      });
      return emptyState();
    }
  }

  /** Persist current state to disk. Called after each batch of events. */
  save(): void {
    this.state.meta.updatedAt = Date.now();
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), "utf-8");
    logger.debug("[state] Saved", { path: this.filePath });
  }

  // ── Block tracking ──────────────────────────────────────────────────────────

  getLastProcessedBlock(): number {
    return this.state.lastProcessedBlock;
  }

  setLastProcessedBlock(block: number): void {
    this.state.lastProcessedBlock = block;
  }

  // ── Idempotency ─────────────────────────────────────────────────────────────

  /** Returns true if this event has already been processed. */
  isEventProcessed(eventId: string): boolean {
    return eventId in this.state.processedEvents;
  }

  /** Mark an event as processed. Call AFTER successful handling. */
  markEventProcessed(eventId: string): void {
    this.state.processedEvents[eventId] = true;
  }

  /**
   * Returns the canonical event ID from a transaction hash and log index.
   * This uniquely identifies an event across all chains and blocks.
   */
  static eventId(txHash: `0x${string}`, logIndex: number): string {
    return `${txHash.toLowerCase()}-${logIndex}`;
  }

  // ── User mappings ───────────────────────────────────────────────────────────

  getUserMapping(address: `0x${string}`): UserMapping | undefined {
    return this.state.userMappings[address.toLowerCase()];
  }

  setUserMapping(address: `0x${string}`, mapping: UserMapping): void {
    this.state.userMappings[address.toLowerCase()] = mapping;
  }

  /** Upsert the strategy link for a user. */
  linkUserStrategy(address: `0x${string}`, strategyId: bigint): void {
    const key  = address.toLowerCase();
    const now  = Date.now();
    const prev = this.state.userMappings[key];
    this.state.userMappings[key] = {
      baseAddress: address,
      strategyId:  strategyId.toString(),
      deposited:   prev?.deposited ?? {},
      linkedAt:    prev?.linkedAt  ?? now,
      updatedAt:   now,
    };
  }

  /** Record a deposit for accounting purposes (no cross-chain verification). */
  recordDeposit(
    userAddress: `0x${string}`,
    tokenAddress: `0x${string}`,
    amount: bigint
  ): void {
    const key      = userAddress.toLowerCase();
    const tokenKey = tokenAddress.toLowerCase();
    const existing = this.state.userMappings[key];
    if (!existing) return; // no mapping yet — deposit will be re-mapped if StrategyLinked fires

    const prev      = BigInt(existing.deposited[tokenKey] ?? "0");
    existing.deposited[tokenKey] = (prev + amount).toString();
    existing.updatedAt = Date.now();
  }

  // ── Pending withdrawals ─────────────────────────────────────────────────────

  private withdrawalKey(user: `0x${string}`, token: `0x${string}`, txHash: `0x${string}`): string {
    // Include txHash so multiple withdrawal requests by the same user/token are tracked separately
    return `${user.toLowerCase()}_${token.toLowerCase()}_${txHash.toLowerCase()}`;
  }

  addPendingWithdrawal(withdrawal: PendingWithdrawal): void {
    const key = this.withdrawalKey(withdrawal.user, withdrawal.token, withdrawal.requestTxHash);
    if (this.state.pendingWithdrawals[key]) {
      logger.warn("[state] Duplicate pending withdrawal, skipping", { key });
      return;
    }
    this.state.pendingWithdrawals[key] = withdrawal;
  }

  updateWithdrawalStatus(
    user: `0x${string}`,
    token: `0x${string}`,
    txHash: `0x${string}`,
    status: WithdrawalStatus,
    extra?: Partial<PendingWithdrawal>
  ): void {
    const key = this.withdrawalKey(user, token, txHash);
    const w   = this.state.pendingWithdrawals[key];
    if (!w) return;
    this.state.pendingWithdrawals[key] = { ...w, status, ...extra };
  }

  /** Returns all withdrawals in a given status. */
  getWithdrawalsByStatus(status: WithdrawalStatus): PendingWithdrawal[] {
    return Object.values(this.state.pendingWithdrawals).filter((w) => w.status === status);
  }

  /** Return a snapshot of the full state (for inspection/testing). */
  getSnapshot(): Readonly<RelayerState> {
    return this.state;
  }
}
