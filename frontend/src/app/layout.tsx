// =======================
// IMPORTS Y DEPENDENCIAS
// =======================
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

// =======================
// CONFIGURACIÓN DE FUENTES
// =======================
const inter = Inter({ subsets: ["latin"] });

// =======================
// METADATOS DE LA APLICACIÓN
// =======================
export const metadata: Metadata = {
  title: "BlockChat - Tu Caja Fuerte Digital en Blockchain",
  description: "Guarda archivos y mensajes de forma privada y descentralizada usando tu billetera como llave.",
};

// =======================
// LAYOUT PRINCIPAL DE LA APLICACIÓN
// =======================
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {/* Proveedores de contexto (Web3, Wallet, etc.) */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
