// context/index.tsx
"use client";

import { wagmiAdapter, projectId } from "../config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import {
  mainnet,
  arbitrum,
  avalanche,
  base,
  optimism,
  polygon
} from "wagmi/chains";
import React, { type ReactNode } from "react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";

// Set up queryClient
const queryClient = new QueryClient();

if (!projectId) {
  throw new Error("Project ID is not defined");
}

// Set up metadata
const metadata = {
  name: "Example",
  description: "AppKit Example",
  url: "https://reown.com/appkit", // origin must match your domain & subdomain
  icons: ["https://assets.reown.com/reown-profile-pic.png"],
};

// Create the modal
const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [
    { ...mainnet, rpcUrls: { default: { http: ["https://ethereum.publicnode.com"] } } },
    { ...arbitrum, rpcUrls: { default: { http: ["https://arbitrum-one.publicnode.com"] } } },
    { ...avalanche, rpcUrls: { default: { http: ["https://avalanche-fuji-c-chain.publicnode.com"] } } },
    { ...base, rpcUrls: { default: { http: ["https://base.publicnode.com"] } } },
    { ...optimism, rpcUrls: { default: { http: ["https://optimism.publicnode.com"] } } },
    { ...polygon, rpcUrls: { default: { http: ["https://polygon-bor.publicnode.com"] } } },
  ],
  defaultNetwork: mainnet,
  metadata: metadata,
  features: {
    analytics: true, // Optional - defaults to your Cloud configuration
  },
});

function ContextProvider({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null;
}) {
  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig as Config,
    cookies
  );

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export default ContextProvider;
