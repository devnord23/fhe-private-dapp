"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import type { Transfer, TransferType, TransferStatus } from "@/types";
import { formatTokenAmount } from "@/lib/utils";

const storageKey = (address: string) =>
  `ct_transfers_${address.toLowerCase()}`;

/**
 * Seed a small set of demo transfers so the UI has something to display when
 * the user first connects (before they have made any real transactions).
 *
 * These are LOCAL records only – they are NOT on-chain and NOT encrypted.
 * The amounts shown for "confidential" type entries would normally be hidden
 * (shown as "***" in the UI), reflecting that real on-chain transfers reveal
 * no amount information.
 */
function seedDemoTransfers(address: `0x${string}`): Transfer[] {
  const now = Date.now();
  const peers: `0x${string}`[] = [
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
  ];

  const rows: Array<{
    type: TransferType;
    status: TransferStatus;
    amount: string;
    peer: `0x${string}`;
    ago: number;
  }> = [
    { type: "shield", status: "confirmed", amount: "500", peer: address, ago: 3 * 86_400_000 },
    { type: "confidential", status: "confirmed", amount: "120", peer: peers[0], ago: 2 * 86_400_000 },
    { type: "confidential", status: "confirmed", amount: "75.5", peer: peers[1], ago: 86_400_000 },
    { type: "unshield", status: "confirmed", amount: "50", peer: peers[2], ago: 43_200_000 },
    { type: "confidential", status: "pending", amount: "200", peer: peers[0], ago: 600_000 },
  ];

  return rows.map((row, i) => {
    // Demo amounts use 6 decimals (like USDC)
    const amountRaw = BigInt(Math.round(parseFloat(row.amount) * 1_000_000));
    return {
      id: `demo-${i}`,
      txHash: `0x${i.toString().padStart(2, "0")}${"ab".repeat(31)}` as `0x${string}`,
      from: row.type === "shield" || row.type === "confidential" ? address : row.peer,
      to: row.type === "unshield" || row.type === "confidential" ? row.peer : address,
      amount: amountRaw,
      amountFormatted: row.amount,
      tokenSymbol: "cUSDC",
      type: row.type,
      status: row.status,
      timestamp: now - row.ago,
    };
  });
}

export function useTransferHistory() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isConnected || !address) {
      setTransfers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const stored = localStorage.getItem(storageKey(address));
      if (stored) {
        const parsed: Transfer[] = JSON.parse(stored, (key, value) => {
          if (key === "amount" || key === "blockNumber") {
            return typeof value === "string" ? BigInt(value) : value;
          }
          return value;
        });
        setTransfers(parsed);
      } else {
        const demo = seedDemoTransfers(address as `0x${string}`);
        setTransfers(demo);
        persistTransfers(address, demo);
      }
    } catch {
      const demo = seedDemoTransfers(address as `0x${string}`);
      setTransfers(demo);
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, chainId]);

  function persistTransfers(acct: string, txs: Transfer[]) {
    try {
      localStorage.setItem(
        storageKey(acct),
        JSON.stringify(txs, (_, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      );
    } catch {
      // Storage quota exceeded – ignore
    }
  }

  function addTransfer(tx: Transfer) {
    if (!address) return;
    const next = [tx, ...transfers];
    setTransfers(next);
    persistTransfers(address, next);
  }

  function updateTransfer(id: string, patch: Partial<Transfer>) {
    if (!address) return;
    const next = transfers.map((t) => (t.id === id ? { ...t, ...patch } : t));
    setTransfers(next);
    persistTransfers(address, next);
  }

  const stats = {
    totalSent: transfers
      .filter((t) => t.status === "confirmed" && t.from === address)
      .reduce((sum, t) => sum + t.amount, 0n),
    totalReceived: transfers
      .filter((t) => t.status === "confirmed" && t.to === address)
      .reduce((sum, t) => sum + t.amount, 0n),
    count: transfers.length,
    confidentialCount: transfers.filter((t) => t.type === "confidential").length,
    formattedSent: "",
    formattedReceived: "",
  };
  stats.formattedSent = formatTokenAmount(stats.totalSent, 6);
  stats.formattedReceived = formatTokenAmount(stats.totalReceived, 6);

  return { transfers, isLoading, addTransfer, updateTransfer, stats };
}
