"use client";

import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const router = useRouter();
  const [showEnter, setShowEnter] = useState(false);

  useEffect(() => {
    if (isConnected) {
      setShowEnter(true);
    } else {
      setShowEnter(false);
    }
  }, [isConnected]);

  const handleEnter = () => {
    router.replace("/chat");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-white p-8 rounded-lg shadow-lg flex flex-col items-center gap-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {!isConnected ? "Inicia sesión con tu wallet" : "Wallet lista, bienvenido a su vault"}
        </h1>
        {!isConnected && (
          <button
            onClick={() => connect({ connector: injected() })}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
          >
            Conectar Wallet
          </button>
        )}
        {showEnter && (
          <button
            onClick={handleEnter}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl"
          >
            Ingresar al chat
          </button>
        )}
      </div>
    </main>
  );
} 