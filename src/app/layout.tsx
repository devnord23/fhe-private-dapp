import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Web3Provider } from "@/providers/Web3Provider";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";

export const metadata: Metadata = {
  title: {
    default: "ConfidentialFi – Private Token Transfers",
    template: "%s | ConfidentialFi",
  },
  description:
    "Transfer ERC-20 tokens confidentially using zero-knowledge proofs. Shield your balance and send privately on Ethereum.",
  keywords: ["defi", "privacy", "zk proof", "confidential transfer", "ethereum", "web3"],
  metadataBase: new URL("https://confidentialfi.vercel.app"),
  openGraph: {
    type: "website",
    title: "ConfidentialFi",
    description: "Private token transfers powered by zero-knowledge proofs",
    siteName: "ConfidentialFi",
  },
  twitter: {
    card: "summary_large_image",
    title: "ConfidentialFi",
    description: "Private token transfers powered by zero-knowledge proofs",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-surface-900 min-h-screen">
        <Web3Provider>
          <div className="relative min-h-screen flex flex-col">
            {/* Ambient background gradients */}
            <div
              aria-hidden
              className="pointer-events-none fixed inset-0 overflow-hidden"
            >
              <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/4 rounded-full blur-3xl" />
              <div className="absolute top-1/3 -right-20 w-72 h-72 bg-purple-500/3 rounded-full blur-3xl" />
              <div className="absolute bottom-20 left-1/4 w-64 h-64 bg-brand-500/3 rounded-full blur-3xl" />
            </div>

            <Navbar />

            <main className="relative flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
              {children}
            </main>

            <MobileNav />
          </div>
        </Web3Provider>
      </body>
    </html>
  );
}
