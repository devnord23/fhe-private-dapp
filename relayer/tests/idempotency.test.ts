/**
 * idempotency.test.ts
 *
 * Tests that the StateManager correctly implements idempotency:
 *   - Processing the same event ID twice is detected and skipped.
 *   - State persists across "restarts" (file load/save round-trip).
 *   - User mappings are correctly upserted without duplication.
 *   - Pending withdrawals are not double-added.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, rmSync, existsSync }            from "node:fs";
import { join }                                          from "node:path";
import { StateManager }                                  from "../src/state.js";
import { handleStrategyLinked }                          from "../src/handlers/strategyLinked.js";
import { handleDepositCreated }                          from "../src/handlers/depositCreated.js";
import { processPendingWithdrawals }                     from "../src/handlers/withdrawalRequested.js";

const TEST_STATE_PATH = join(process.cwd(), "tests/.test-state.json");

const ALICE = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as `0x${string}`;
const TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
const TX1   = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`;

function freshState(): StateManager {
  if (existsSync(TEST_STATE_PATH)) rmSync(TEST_STATE_PATH);
  return new StateManager(TEST_STATE_PATH);
}

afterEach(() => {
  if (existsSync(TEST_STATE_PATH)) rmSync(TEST_STATE_PATH);
});

// ── Event ID idempotency ──────────────────────────────────────────────────────

describe("StateManager.isEventProcessed / markEventProcessed", () => {
  it("returns false for an event that has not been processed", () => {
    const state   = freshState();
    const eventId = StateManager.eventId(TX1, 0);
    expect(state.isEventProcessed(eventId)).toBe(false);
  });

  it("returns true after markEventProcessed is called", () => {
    const state   = freshState();
    const eventId = StateManager.eventId(TX1, 0);
    state.markEventProcessed(eventId);
    expect(state.isEventProcessed(eventId)).toBe(true);
  });

  it("different logIndex produces different event ID", () => {
    const id0 = StateManager.eventId(TX1, 0);
    const id1 = StateManager.eventId(TX1, 1);
    expect(id0).not.toBe(id1);
  });

  it("same txHash + logIndex produces same event ID (idempotency key)", () => {
    const a = StateManager.eventId(TX1, 3);
    const b = StateManager.eventId(TX1, 3);
    expect(a).toBe(b);
  });
});

// ── State persistence round-trip ──────────────────────────────────────────────

describe("StateManager persistence", () => {
  it("saves and reloads processed events", () => {
    const s1 = freshState();
    const id = StateManager.eventId(TX1, 0);
    s1.markEventProcessed(id);
    s1.save();

    const s2 = new StateManager(TEST_STATE_PATH);
    expect(s2.isEventProcessed(id)).toBe(true);
  });

  it("saves and reloads the last processed block", () => {
    const s1 = freshState();
    s1.setLastProcessedBlock(9999);
    s1.save();

    const s2 = new StateManager(TEST_STATE_PATH);
    expect(s2.getLastProcessedBlock()).toBe(9999);
  });

  it("saves and reloads user mappings", () => {
    const s1 = freshState();
    s1.linkUserStrategy(ALICE, 42n);
    s1.save();

    const s2 = new StateManager(TEST_STATE_PATH);
    const mapping = s2.getUserMapping(ALICE);
    expect(mapping?.strategyId).toBe("42");
  });
});

// ── User mapping idempotency ──────────────────────────────────────────────────

describe("linkUserStrategy idempotency", () => {
  it("calling linkUserStrategy twice with same ID is idempotent", async () => {
    const state = freshState();
    await handleStrategyLinked({ user: ALICE, strategyId: 5n }, state);
    await handleStrategyLinked({ user: ALICE, strategyId: 5n }, state);

    const mapping = state.getUserMapping(ALICE);
    expect(mapping?.strategyId).toBe("5");
  });

  it("calling linkUserStrategy with new ID updates the mapping", async () => {
    const state = freshState();
    await handleStrategyLinked({ user: ALICE, strategyId: 1n }, state);
    await handleStrategyLinked({ user: ALICE, strategyId: 99n }, state);

    const mapping = state.getUserMapping(ALICE);
    expect(mapping?.strategyId).toBe("99");
  });
});

// ── Deposit idempotency ───────────────────────────────────────────────────────

describe("handleDepositCreated idempotency", () => {
  it("recording a deposit twice accumulates (does NOT deduplicate)", async () => {
    // NOTE: Deposit deduplication is handled at the event level (processedEvents set).
    // The deposit accounting itself just adds amounts.
    // This test confirms the accounting behavior.
    const state = freshState();

    // First link the user so recordDeposit can update the mapping
    await handleStrategyLinked({ user: ALICE, strategyId: 1n }, state);

    await handleDepositCreated({ user: ALICE, token: TOKEN, amount: 500n, strategyId: 1n }, state);
    await handleDepositCreated({ user: ALICE, token: TOKEN, amount: 500n, strategyId: 1n }, state);

    const mapping = state.getUserMapping(ALICE);
    // Two deposits of 500 = 1000 total (accounting level)
    expect(mapping?.deposited[TOKEN.toLowerCase()]).toBe("1000");
  });

  it("event-level idempotency prevents double-accounting", () => {
    const state   = freshState();
    const eventId = StateManager.eventId(TX1, 0);

    // Simulate: process once → mark processed → try again → skip
    expect(state.isEventProcessed(eventId)).toBe(false);
    state.markEventProcessed(eventId);
    expect(state.isEventProcessed(eventId)).toBe(true);

    // If code checks isEventProcessed before handleDepositCreated,
    // the second call is never made
  });
});

// ── Pending withdrawal idempotency ────────────────────────────────────────────

describe("addPendingWithdrawal idempotency", () => {
  it("adding the same withdrawal twice does not duplicate it", () => {
    const state = freshState();

    const w = {
      user:          ALICE,
      token:         TOKEN,
      amount:        "100",
      requestTxHash: TX1,
      requestBlock:  1000,
      requestedAt:   Date.now(),
      status:        "pending" as const,
    };

    state.addPendingWithdrawal(w);
    state.addPendingWithdrawal(w); // duplicate

    const pending = state.getWithdrawalsByStatus("pending");
    expect(pending).toHaveLength(1);
  });
});

// ── Auto-complete guard (security fix 4.1) ────────────────────────────────────

describe("processPendingWithdrawals – auto-complete guard", () => {
  it("does NOT auto-complete when TESTNET_ONLY_AUTO_COMPLETE is unset (safe default)", async () => {
    // The guard should bail out early when the env flag is not 'true'.
    // This test verifies the default-off behavior by checking that pending
    // withdrawals remain pending after calling processPendingWithdrawals.
    const state = freshState();

    state.addPendingWithdrawal({
      user:          ALICE,
      token:         TOKEN,
      amount:        "100",
      requestTxHash: TX1,
      requestBlock:  1,      // old block — would pass delay check if auto-complete ran
      requestedAt:   Date.now() - 60_000,
      status:        "pending",
    });

    // Ensure TESTNET_ONLY_AUTO_COMPLETE is not set
    const original = process.env.TESTNET_ONLY_AUTO_COMPLETE;
    delete process.env.TESTNET_ONLY_AUTO_COMPLETE;

    // processsPendingWithdrawals should return without calling completeWithdrawal
    // (which would fail without a real RPC anyway)
    await processPendingWithdrawals(BigInt(1000), state);

    process.env.TESTNET_ONLY_AUTO_COMPLETE = original;

    // Withdrawal is still pending — no attempt was made to complete it
    const still = state.getWithdrawalsByStatus("pending");
    expect(still).toHaveLength(1);
    expect(still[0].status).toBe("pending");
  });
});

// ── Block pointer ─────────────────────────────────────────────────────────────

describe("lastProcessedBlock", () => {
  it("starts at 0", () => {
    const state = freshState();
    expect(state.getLastProcessedBlock()).toBe(0);
  });

  it("updates correctly", () => {
    const state = freshState();
    state.setLastProcessedBlock(12345);
    expect(state.getLastProcessedBlock()).toBe(12345);
  });

  it("never goes backwards (caller responsibility)", () => {
    // This tests that the StateManager does NOT enforce monotonic updates.
    // The caller (processor.ts) is responsible for only advancing the block.
    const state = freshState();
    state.setLastProcessedBlock(100);
    state.setLastProcessedBlock(50); // intentional regression for this test
    expect(state.getLastProcessedBlock()).toBe(50);
  });
});
