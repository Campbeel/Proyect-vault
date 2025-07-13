import { ethers } from "ethers";
import FileVaultABI from "./FileVaultABI.json";

// === Configuración sensible: nunca subas la clave privada a GitHub ===
// Usa siempre variables de entorno (.env) para PRIVATE_KEY, RPC_URL y CONTRACT_ADDRESS
// Ejemplo de .env:
// PRIVATE_KEY=tu_clave_privada
// RPC_URL=https://sepolia.infura.io/v3/tu_api_key
// CONTRACT_ADDRESS=0x...

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL;
// ================================================================

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, FileVaultABI, provider);

// Obtener todos los hashes de una wallet
export async function getFiles(wallet: string): Promise<string[]> {
  return await contract.getFiles(wallet);
}

// Verificar si un hash existe para una wallet
export async function hasFile(wallet: string, ipfsHash: string): Promise<boolean> {
  const files: string[] = await getFiles(wallet);
  return files.some(hash => hash === ipfsHash);
}

// Agregar un hash (guardar archivo) usando la wallet firmante
export async function addFile(ipfsHash: string): Promise<any> {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY no definida en variables de entorno");
  const wallet = new ethers.Wallet(privateKey, provider);
  const contractWithSigner = contract.connect(wallet);
  const tx = await (contractWithSigner as any).addFile(ipfsHash);
  await tx.wait();
  return tx;
}

// Eliminar un hash (borrar archivo) usando la wallet firmante
export async function removeFile(ipfsHash: string): Promise<any> {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY no definida en variables de entorno");
  const wallet = new ethers.Wallet(privateKey, provider);
  const contractWithSigner = contract.connect(wallet);
  const tx = await (contractWithSigner as any).removeFile(ipfsHash);
  await tx.wait();
  return tx;
} 