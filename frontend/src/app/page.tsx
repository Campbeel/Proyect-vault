"use client";

// React
import { useState, useEffect, useRouter, useAccount, useConnect, useDisconnect } from "../imports";
import { readContract, writeContract } from "@wagmi/core";
import { injected } from "wagmi/connectors";

// Contract information Address and ABI
const SIMPLE_STORAGE_CONTRACT_ADDRESS =
  "0xcb8b8317ef7e5f5afb641813e07177cbd791bf8e";
import SimpleStorageContractABI from "../../contract/SimpleStorageContractABI.json";

export default function Home() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [currentValue, setCurrentValue] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [isWriting, setIsWriting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [triedConnect, setTriedConnect] = useState(false);

  // useEffect(() => {
  //   if (isConnected) {
  //     router.push("/chat");
  //   }
  // }, [isConnected, router]);

  const handleGoToChat = async () => {
    if (!isConnected) {
      try {
        setIsConnecting(true);
        setTriedConnect(true);
        await connect({ connector: injected() });
        setIsConnecting(false);
        // No redirigir aquí, esperar a que isConnected sea true
      } catch (error) {
        setIsConnecting(false);
        setErrorMsg("Conexión rechazada o fallida. Por favor, inténtalo de nuevo.");
        setTriedConnect(false);
        return;
      }
    } else {
      router.push("/chat");
    }
  };

  // Redirigir solo si el usuario intentó conectar y la conexión fue exitosa
  useEffect(() => {
    if (triedConnect && isConnected) {
      router.push("/chat");
      setTriedConnect(false);
    }
  }, [isConnected, triedConnect, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-b from-gray-900/90 to-transparent backdrop-blur-md">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center py-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">BlockChat</h1>
          </div>
          <button
            onClick={handleGoToChat}
            disabled={isConnecting}
            className={`px-6 py-2 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-xl font-medium flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl ${isConnecting ? 'opacity-50 cursor-not-allowed' : 'hover:from-green-600 hover:to-blue-700'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>
              {isConnecting
                ? "Conectando..."
                : isConnected
                  ? "Acceder al chat "
                  : "Conectar billetera"}
            </span>
          </button>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=&quot;60&quot; height=&quot;60&quot; viewBox=&quot;0 0 60 60&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;%3E%3Cg fill=&quot;none&quot; fill-rule=&quot;evenodd&quot;%3E%3Cg fill=&quot;%239C92AC&quot; fill-opacity=&quot;0.05&quot;%3E%3Ccircle cx=&quot;30&quot; cy=&quot;30&quot; r=&quot;2&quot;/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-extrabold text-white text-center mb-6">
              Tu Caja Fuerte Digital en <span className="text-cyan-400">Blockchain</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-200 text-center mb-12 max-w-2xl mx-auto">
              Guarda archivos y mensajes de forma privada y descentralizada. Solo tú puedes acceder a tus datos usando tu billetera como llave.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-gray-600 transition-all duration-300 hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Acceso Exclusivo con Billetera</h3>
              <p className="text-gray-300 leading-relaxed">
                Solo tú puedes abrir tu caja fuerte digital usando tu wallet. Sin contraseñas, sin intermediarios.
              </p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-gray-600 transition-all duration-300 hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Almacenamiento Descentralizado</h3>
              <p className="text-gray-300 leading-relaxed">
                Tus archivos se guardan en IPFS, fuera del control de cualquier empresa o servidor centralizado.
              </p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-gray-600 transition-all duration-300 hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Privacidad y Control Total</h3>
              <p className="text-gray-300 leading-relaxed">
                Nadie más puede acceder, ver ni eliminar tus archivos. Tú tienes el control absoluto de tus datos.
              </p>
            </div>
          </div>

          {/* Stats Section */}
          <div className="mt-20 text-center">
            <h2 className="text-3xl font-bold text-white mb-12">¿Por qué elegir BlockChat?</h2>
            <div className="grid md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-green-400 mb-2">100%</div>
                <div className="text-gray-300">Seguro</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-400 mb-2">∞</div>
                <div className="text-gray-300">Almacenamiento</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-400 mb-2">0</div>
                <div className="text-gray-300">Intermediarios</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-yellow-400 mb-2">24/7</div>
                <div className="text-gray-300">Disponible</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">VaultChat</h3>
            </div>
            <p className="text-gray-400 mb-6">
              La próxima generación de comunicación segura y descentralizada
            </p>
            <div className="flex justify-center space-x-6 text-gray-400">
              <a href="#" className="hover:text-white transition-colors">Privacidad</a>
              <a href="#" className="hover:text-white transition-colors">Términos</a>
              <a href="#" className="hover:text-white transition-colors">Soporte</a>
              <a href="#" className="hover:text-white transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Popup de error */}
      {errorMsg && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-xl shadow-lg z-50 animate-fade-in flex items-center gap-4">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-4 text-white font-bold">X</button>
        </div>
      )}
    </div>
  );
}
