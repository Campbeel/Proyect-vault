"use client";

// React
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Wagmi Hooks
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { readContract, writeContract } from "@wagmi/core";
import { injected } from "wagmi/connectors";

// Contract information Address and ABI
const SIMPLE_STORAGE_CONTRACT_ADDRESS =
  "0xcb8b8317ef7e5f5afb641813e07177cbd791bf8e";
import SimpleStorageContractABI from "../../contract/SimpleStorageContractABI.json";

// Config
import { config } from "../../config";

export default function Home() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [currentValue, setCurrentValue] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [isWriting, setIsWriting] = useState(false);

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  const handleReadValue = async () => {
    try {
      setIsLoading(true);
      const result = await readContract(config, {
        abi: SimpleStorageContractABI,
        address: SIMPLE_STORAGE_CONTRACT_ADDRESS as `0x${string}`,
        functionName: "get",
      });
      setCurrentValue(result as bigint);
    } catch (error) {
      console.error("Error al leer el valor:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWriteValue = async () => {
    try {
      setIsWriting(true);
      await writeContract(config, {
        abi: SimpleStorageContractABI,
        address: SIMPLE_STORAGE_CONTRACT_ADDRESS as `0x${string}`,
        functionName: "set",
        args: [BigInt(newValue)],
      });
      setNewValue("");
      handleReadValue();
    } catch (error) {
      console.error("Error al escribir el valor:", error);
    } finally {
      setIsWriting(false);
    }
  };

  return null;
}
