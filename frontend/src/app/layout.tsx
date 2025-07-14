// =======================
// IMPORTS Y DEPENDENCIAS
// =======================
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

// =======================
// CONFIGURACIÓN DE FUENTES
// =======================
const inter = Inter({ subsets: ["latin"] });


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
      <body className={`${inter.className} bg-black text-white min-h-screen`}>
        {/* Proveedores de contexto (Web3, Wallet, etc.) */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
