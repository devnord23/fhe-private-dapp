/**
 * eventParsing.test.ts
 *
 * Tests that BaseVault events are correctly parsed from raw ABI-encoded logs.
 *
 * These tests do NOT require a running node — they use viem's decodeEventLog
 * with known log data produced from the ABI definitions.
 */

import { describe, it, expect } from "vitest";
import { decodeEventLog, encodeEventTopics, encodeAbiParameters, keccak256, toHex, pad } from "viem";
import { BASE_VAULT_ABI } from "../src/abis.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const ALICE  = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as `0x${string}`;
const BOB    = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" as `0x${string}`;
const MOCKED_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;

function makeTopic(address: `0x${string}`): `0x${string}` {
  // ABI encodes address as 32-byte padded topic
  return pad(address, { size: 32 }).toLowerCase() as `0x${string}`;
}

// ── DepositCreated ────────────────────────────────────────────────────────────

describe("DepositCreated event parsing", () => {
  const abi = BASE_VAULT_ABI.find(
    (x) => x.type === "event" && x.name === "DepositCreated"
  )!;

  it("decodes correct user, token, amount, strategyId", () => {
    const amount = 1_000_000n; // 1 mUSDC (6 decimals)
    const strategyId = 42n;

    // Encode non-indexed data (amount + strategyId)
    const data = encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }],
      [amount, strategyId]
    );

    const log = {
      address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      data,
      topics: [
        keccak256(toHex("DepositCreated(address,address,uint256,uint256)")),
        makeTopic(ALICE),
        makeTopic(MOCKED_TOKEN),
      ] as [`0x${string}`, ...`0x${string}`[]],
    };

    const decoded = decodeEventLog({ abi: [abi], ...log });

    expect(decoded.eventName).toBe("DepositCreated");
    expect((decoded.args as { user: string }).user.toLowerCase()).toBe(ALICE.toLowerCase());
    expect((decoded.args as { token: string }).token.toLowerCase()).toBe(MOCKED_TOKEN.toLowerCase());
    expect((decoded.args as { amount: bigint }).amount).toBe(amount);
    expect((decoded.args as { strategyId: bigint }).strategyId).toBe(strategyId);
  });

  it("handles strategyId = 0 (no strategy linked)", () => {
    const data = encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }],
      [500n, 0n]
    );

    const log = {
      address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      data,
      topics: [
        keccak256(toHex("DepositCreated(address,address,uint256,uint256)")),
        makeTopic(ALICE),
        makeTopic(MOCKED_TOKEN),
      ] as [`0x${string}`, ...`0x${string}`[]],
    };

    const decoded = decodeEventLog({ abi: [abi], ...log });
    expect((decoded.args as { strategyId: bigint }).strategyId).toBe(0n);
  });
});

// ── WithdrawalRequested ───────────────────────────────────────────────────────

describe("WithdrawalRequested event parsing", () => {
  const abi = BASE_VAULT_ABI.find(
    (x) => x.type === "event" && x.name === "WithdrawalRequested"
  )!;

  it("decodes correct user, token, amount", () => {
    const amount = 250_000n;

    const data = encodeAbiParameters(
      [{ type: "uint256" }],
      [amount]
    );

    const log = {
      address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      data,
      topics: [
        keccak256(toHex("WithdrawalRequested(address,address,uint256)")),
        makeTopic(BOB),
        makeTopic(MOCKED_TOKEN),
      ] as [`0x${string}`, ...`0x${string}`[]],
    };

    const decoded = decodeEventLog({ abi: [abi], ...log });
    expect(decoded.eventName).toBe("WithdrawalRequested");
    expect((decoded.args as { user: string }).user.toLowerCase()).toBe(BOB.toLowerCase());
    expect((decoded.args as { amount: bigint }).amount).toBe(amount);
  });
});

// ── StrategyLinked ────────────────────────────────────────────────────────────

describe("StrategyLinked event parsing", () => {
  const abi = BASE_VAULT_ABI.find(
    (x) => x.type === "event" && x.name === "StrategyLinked"
  )!;

  it("decodes correct user and strategyId", () => {
    const strategyId = 7n;

    const data = encodeAbiParameters(
      [{ type: "uint256" }],
      [strategyId]
    );

    const log = {
      address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      data,
      topics: [
        keccak256(toHex("StrategyLinked(address,uint256)")),
        makeTopic(ALICE),
      ] as [`0x${string}`, ...`0x${string}`[]],
    };

    const decoded = decodeEventLog({ abi: [abi], ...log });
    expect(decoded.eventName).toBe("StrategyLinked");
    expect((decoded.args as { user: string }).user.toLowerCase()).toBe(ALICE.toLowerCase());
    expect((decoded.args as { strategyId: bigint }).strategyId).toBe(strategyId);
  });
});
