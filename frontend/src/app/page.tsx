"use client";

import styles from "./page.module.css";

// React
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

export default function Home() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [triedConnect, setTriedConnect] = useState(false);

  const handleGoToChat = async () => {
    setTriedConnect(true);
    if (isConnected && address) {
      router.push("/chat");
    } else if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await (window.ethereum as any).request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          router.push("/chat");
        } else {
          alert("Por favor, conecta tu wallet antes de continuar.");
        }
      } catch {
        alert("Debes aceptar la conexión en MetaMask para continuar.");
      }
    } else {
      alert("No se detectó ninguna wallet instalada. Por favor, instala MetaMask.");
    }
  };

  useEffect(() => {
    if (triedConnect && isConnected && address) {
      router.push("/chat");
      setTriedConnect(false);
    }
  }, [triedConnect, isConnected, address, router]);

  return (
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>
            <svg width="24" height="24" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className={styles.logoText}>VaultChain</span>
        </div>
        <button
          onClick={handleGoToChat}
          className={styles.headerBtn}
        >
          <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Ir al chat
        </button>
      </header>

      {/* Hero */}
      <main className={styles.hero}>
        <h1 className={styles.heroTitle}>
          Tu Caja Fuerte Digital en <span className={styles.heroHighlight}>Blockchain</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Guarda archivos y mensajes de forma privada y descentralizada. Solo tú puedes acceder a tus datos usando tu billetera como llave.
        </p>
        {/* Features */}
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon1}>
              <svg width="32" height="32" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Acceso Exclusivo con Billetera</h3>
            <p className={styles.featureText}>
              Solo tú puedes abrir tu caja fuerte digital usando tu wallet. Sin contraseñas, sin intermediarios.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon2}>
              <svg width="32" height="32" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Almacenamiento Descentralizado</h3>
            <p className={styles.featureText}>
              Tus archivos se guardan en IPFS, fuera del control de cualquier empresa o servidor centralizado.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon3}>
              <svg width="32" height="32" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Privacidad y Control Total</h3>
            <p className={styles.featureText}>
              Nadie más puede acceder, ver ni eliminar tus archivos. Tú tienes el control absoluto de tus datos.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerCenter}>
            <div className={styles.footerLogoRow}>
              <div className={styles.footerLogoIcon}>
                <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className={styles.footerLogoText}>VaultChat</h3>
            </div>
            <p className={styles.footerDesc}>
              La próxima generación de comunicación segura y descentralizada
            </p>
            <div className={styles.footerLinks}>
              <a href="#">Privacidad</a>
              <a href="#">Términos</a>
              <a href="#">Soporte</a>
              <a href="#">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
            
      
