"use client";
import React, { type ReactNode } from "react";
import { WagmiConfig, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { createPublicClient, http } from "viem";

const config = createConfig({
  connectors: [injected()],
  chains: [mainnet],
  client({ chain }) {
    return createPublicClient({ chain, transport: http() });
  },
});

export default function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiConfig config={config}>
      {children}
    </WagmiConfig>
  );
} 