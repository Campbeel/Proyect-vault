"use client";
import React, { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, cookieToInitialState, type Config } from "wagmi";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, polygon, optimism, arbitrum } from "wagmi/chains";
import '@rainbow-me/rainbowkit/styles.css';

const config = getDefaultConfig({
  appName: "BlockChat",
  projectId: "blockchat-rainbowkit-demo",
  chains: [mainnet, polygon, optimism, arbitrum],
  ssr: true,
});
const queryClient = new QueryClient();

export default function RainbowKitClientProvider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
  const initialState = cookieToInitialState(config, cookies);
  return (
    <WagmiProvider config={config} initialState={initialState}>
      <RainbowKitProvider theme={darkTheme()}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </RainbowKitProvider>
    </WagmiProvider>
  );
} 