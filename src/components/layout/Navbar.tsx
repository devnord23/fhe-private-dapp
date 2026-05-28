"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { ChainBadge } from "@/components/wallet/ChainBadge";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/contracts";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/vault",     label: "Vault" },
  { href: "/transfer",  label: "Transfer" },
  { href: "/history",   label: "History" },
  { href: "/strategy",  label: "Agent" },
];

export function Navbar() {
  const pathname = usePathname();
  const demo = isDemoMode();

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Glassmorphism bar */}
      <div
        className="border-b border-white/[0.06] bg-[#060609]/80 backdrop-blur-xl"
        style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04)" }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">

            {/* ── Logo ──────────────────────────────────────────────────────── */}
            <Link href="/dashboard" className="flex items-center gap-3 shrink-0 group">
              {/* Icon: interlocked B+Z */}
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-base-500/20 to-brand-500/20 border border-white/[0.08]" />
                <svg className="relative h-5 w-5" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="url(#logoGrad)" strokeWidth="1.5" />
                  <path d="M7 7h4a2 2 0 010 4H7v2h4a4 4 0 000-8H7v2z" fill="url(#logoGrad)" />
                  <defs>
                    <linearGradient id="logoGrad" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#0052FF" />
                      <stop offset="1" stopColor="#22c55e" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <div className="hidden sm:flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white tracking-tight leading-none">
                    ConfidentialFi
                  </span>
                  {demo && (
                    <span className="rounded-md bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 text-[9px] font-bold text-orange-400 uppercase tracking-widest leading-none">
                      Demo
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-gray-600 leading-none font-mono tracking-wide">
                  Base · Zama fhEVM
                </span>
              </div>
            </Link>

            {/* ── Desktop nav ───────────────────────────────────────────────── */}
            <nav className="hidden md:flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-1.5 py-1.5">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                      active
                        ? "bg-white/[0.08] text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* ── Right side ────────────────────────────────────────────────── */}
            <div className="flex items-center gap-2">
              <ChainBadge />
              <ConnectButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
