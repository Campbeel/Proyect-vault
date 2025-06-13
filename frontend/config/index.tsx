// config/index.tsx

import { createConfig, http } from "wagmi";
import { cookieStorage, createStorage } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { mainnet, arbitrum, avalanche, base, optimism, polygon } from "wagmi/chains";

// Get projectId from https://cloud.reown.com
export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;

if (!projectId) {
  throw new Error("Project ID is not defined");
}

// Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [
    { ...mainnet, rpcUrls: { default: { http: ["https://ethereum.publicnode.com"] } } },
    { ...arbitrum, rpcUrls: { default: { http: ["https://arbitrum-one.publicnode.com"] } } },
    { ...avalanche, rpcUrls: { default: { http: ["https://avalanche-fuji-c-chain.publicnode.com"] } } },
    { ...base, rpcUrls: { default: { http: ["https://base.publicnode.com"] } } },
    { ...optimism, rpcUrls: { default: { http: ["https://optimism.publicnode.com"] } } },
    { ...polygon, rpcUrls: { default: { http: ["https://polygon-bor.publicnode.com"] } } },
  ],
  chains: [
    mainnet,
    arbitrum,
    avalanche,
    base,
    optimism,
    polygon,
  ],
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [avalanche.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
  },
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
});

export const config = wagmiAdapter.wagmiConfig;
