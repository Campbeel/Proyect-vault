"use client";

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
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(to bottom, #111827 0%, #000 100%)",
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Header */}
      <header style={{
        width: "100%",
        padding: "24px 32px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "40px",
            height: "40px",
            background: "linear-gradient(to right, #34d399, #3b82f6)",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <svg width="24" height="24" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span style={{ fontSize: "2rem", fontWeight: "bold", color: "white" }}>VaultChain</span>
        </div>
        <button
          onClick={handleGoToChat}
          style={{
            padding: "8px 24px",
            background: "linear-gradient(to right, #22d3ee, #6366f1)",
            color: "white",
            borderRadius: "12px",
            fontWeight: "500",
            fontSize: "1rem",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
          }}
        >
          <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Ir al chat
        </button>
      </header>

      {/* Hero */}
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px"
      }}>
        <h1 style={{
          fontSize: "3rem",
          fontWeight: "bold",
          color: "white",
          textAlign: "center",
          marginBottom: "24px"
        }}>
          Tu Caja Fuerte Digital en <span style={{ color: "#22d3ee" }}>Blockchain</span>
        </h1>
        <p style={{
          fontSize: "1.25rem",
          color: "#d1d5db",
          textAlign: "center",
          marginBottom: "48px",
          maxWidth: "600px"
        }}>
          Guarda archivos y mensajes de forma privada y descentralizada. Solo tú puedes acceder a tus datos usando tu billetera como llave.
        </p>
        {/* Features */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "32px",
          width: "100%",
          maxWidth: "900px",
          marginTop: "40px"
        }}>
          <div style={{
            background: "rgba(31,41,55,0.7)",
            borderRadius: "18px",
            padding: "32px",
            border: "1px solid #374151",
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}>
            <div style={{
              width: "48px",
              height: "48px",
              background: "linear-gradient(to right, #34d399, #059669)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "24px"
            }}>
              <svg width="32" height="32" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "white", marginBottom: "16px" }}>Acceso Exclusivo con Billetera</h3>
            <p style={{ color: "#d1d5db", textAlign: "center" }}>
              Solo tú puedes abrir tu caja fuerte digital usando tu wallet. Sin contraseñas, sin intermediarios.
            </p>
          </div>
          <div style={{
            background: "rgba(31,41,55,0.7)",
            borderRadius: "18px",
            padding: "32px",
            border: "1px solid #374151",
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}>
            <div style={{
              width: "48px",
              height: "48px",
              background: "linear-gradient(to right, #3b82f6, #6366f1)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "24px"
            }}>
              <svg width="32" height="32" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "white", marginBottom: "16px" }}>Almacenamiento Descentralizado</h3>
            <p style={{ color: "#d1d5db", textAlign: "center" }}>
              Tus archivos se guardan en IPFS, fuera del control de cualquier empresa o servidor centralizado.
            </p>
          </div>
          <div style={{
            background: "rgba(31,41,55,0.7)",
            borderRadius: "18px",
            padding: "32px",
            border: "1px solid #374151",
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}>
            <div style={{
              width: "48px",
              height: "48px",
              background: "linear-gradient(to right, #a78bfa, #8b5cf6)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "24px"
            }}>
              <svg width="32" height="32" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "white", marginBottom: "16px" }}>Privacidad y Control Total</h3>
            <p style={{ color: "#d1d5db", textAlign: "center" }}>
              Nadie más puede acceder, ver ni eliminar tus archivos. Tú tienes el control absoluto de tus datos.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid #27272a",
          marginTop: "80px",
          background: "rgba(0,0,0,0.8)"
        }}
      >
        <div
          style={{
            maxWidth: "1120px",
            margin: "0 auto",
            padding: "48px 16px"
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                marginBottom: "24px"
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  background: "linear-gradient(to right, #34d399, #3b82f6)",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "white" }}>VaultChat</h3>
            </div>
            <p style={{ color: "#9ca3af", marginBottom: "24px" }}>
              La próxima generación de comunicación segura y descentralizada
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "24px",
                color: "#9ca3af"
              }}
            >
              <a href="#" style={{ color: "#9ca3af", textDecoration: "none" }}>Privacidad</a>
              <a href="#" style={{ color: "#9ca3af", textDecoration: "none" }}>Términos</a>
              <a href="#" style={{ color: "#9ca3af", textDecoration: "none" }}>Soporte</a>
              <a href="#" style={{ color: "#9ca3af", textDecoration: "none" }}>GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
