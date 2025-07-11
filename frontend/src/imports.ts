// Archivo centralizado de imports para el frontend

// React y Next
export { useState, useEffect, useRef, useCallback } from "react";
export { useRouter } from "next/navigation";

// Wagmi y Web3
export { useAccount, useConnect, useDisconnect } from "wagmi";
export { readContract, writeContract } from "@wagmi/core";
export { injected } from "wagmi/connectors";

// Librerías externas
export { default as axios } from "axios";
export { default as CryptoJS } from "crypto-js";

// Componentes principales
export { default as ChatPage } from "./app/chat";
export { default as LandingPage } from "./app/page";
export { default as AppProviders } from "./app/providers";
export { default as AppLayout } from "./app/layout";

// Utilidades
export * from "./lib/pinata";

// (Agrega aquí más exports según crezca el proyecto) 