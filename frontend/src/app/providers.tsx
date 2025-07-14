// =======================
// IMPORTS Y DEPENDENCIAS
// =======================
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "../../config/index";
import { ReactNode } from "react";
import React from "react";

// =======================
// CONFIGURACIÓN DE QUERY CLIENT
// =======================
const queryClient = new QueryClient();

// =======================
// PROVEEDORES DE CONTEXTO PRINCIPALES
// =======================
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
} 