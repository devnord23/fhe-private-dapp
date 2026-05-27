"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { ChainBadge } from "@/components/wallet/ChainBadge";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transfer", label: "Transfer" },
  { href: "/history", label: "History" },
  { href: "/strategy", label: "Agent" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-surface-400/40 bg-surface-900/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 border border-brand-500/30">
              <svg
                className="h-4 w-4 text-brand-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-bold text-white tracking-tight leading-none">
                ConfidentialFi
              </span>
              <span className="text-[9px] text-gray-500 leading-none mt-0.5">
                Built for Base · Powered by Zama fhEVM
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150",
                  pathname === link.href
                    ? "bg-surface-500 text-white"
                    : "text-gray-400 hover:text-white hover:bg-surface-600"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ChainBadge />
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
}
