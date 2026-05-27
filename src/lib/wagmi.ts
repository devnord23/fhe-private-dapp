import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia, baseSepolia } from "wagmi/chains";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo_project_id";

export const wagmiConfig = getDefaultConfig({
  appName: "Confidential Transfer",
  projectId,
  chains: [sepolia, baseSepolia],
  ssr: true,
});

export { sepolia, baseSepolia };
