"use client";

import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/Button";
import { shortenAddress } from "@/lib/utils";

export function ConnectButton() {
  return (
    <RainbowConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
            })}
          >
            {!connected ? (
              <Button variant="primary" size="md" onClick={openConnectModal}>
                Connect Wallet
              </Button>
            ) : chain.unsupported ? (
              <Button variant="danger" size="md" onClick={openChainModal}>
                Wrong Network
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={openChainModal}
                  className="hidden sm:flex items-center gap-1.5 rounded-xl bg-surface-600 border border-surface-400/50 px-3 py-2 text-xs text-gray-300 hover:bg-surface-500 transition-colors"
                >
                  {chain.hasIcon && chain.iconUrl && (
                    <img
                      src={chain.iconUrl}
                      alt={chain.name}
                      className="w-4 h-4 rounded-full"
                    />
                  )}
                  <span className="hidden md:inline">{chain.name}</span>
                </button>

                <button
                  onClick={openAccountModal}
                  className="flex items-center gap-2 rounded-xl bg-surface-600 border border-surface-400/50 px-3 py-2 text-sm text-white hover:bg-surface-500 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse-slow" />
                  <span className="font-mono text-xs text-gray-300">
                    {shortenAddress(account.address)}
                  </span>
                </button>
              </div>
            )}
          </div>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}
