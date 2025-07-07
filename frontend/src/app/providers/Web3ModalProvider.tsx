"use client";
import React, { type ReactNode, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, cookieToInitialState } from "wagmi";
import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react';
import { mainnet, polygon, arbitrum, optimism } from 'wagmi/chains';

const projectId = 'blockchat-web3modal-demo';
const metadata = {
  name: 'BlockChat',
  description: 'Chat seguro con blockchain',
  url: 'http://localhost:3000',
  icons: [''],
};
const chains = [mainnet, polygon, arbitrum, optimism];
const wagmiConfig = defaultWagmiConfig({ chains, projectId, metadata });
const queryClient = new QueryClient();

export default function Web3ModalProvider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
  const initialState = cookieToInitialState(wagmiConfig, cookies);

  useEffect(() => {
    createWeb3Modal({ wagmiConfig, projectId });
  }, []);

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
} 