import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // ── Node.js module shims for browser builds ───────────────────────────────
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      // Shims for transitive deps of wagmi / walletconnect
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };

    // ── WASM support for fhevmjs ───────────────────────────────────────────────
    // fhevmjs loads a WASM module at runtime for the FHE operations.
    // Next.js requires explicit webpack configuration to handle .wasm files.
    if (!isServer) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
        layers: true,
      };
    }

    return config;
  },
};

export default nextConfig;
