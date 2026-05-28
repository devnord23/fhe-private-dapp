import type { Metadata } from "next";
import { TransactionTable } from "@/components/history/TransactionTable";
import { HistoryStats } from "@/components/history/HistoryStats";

export const metadata: Metadata = {
  title: "Transfer History",
};

export default function HistoryPage() {
  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Transfer History</h1>
        <p className="mt-1 text-sm text-gray-400">
          Complete record of your shield, unshield, and confidential transfer activity.
          Private transfer amounts are shown as{" "}
          <span className="font-mono text-gray-300">***</span> — only you can decrypt them.
        </p>
      </div>

      <HistoryStats />

      <TransactionTable />
    </div>
  );
}
