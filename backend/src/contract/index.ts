import { ethers } from "ethers";
import FileVaultABI from "./FileVaultABI.json";

// === REEMPLAZAR estos valores cuando el usuario los proporcione ===
const CONTRACT_ADDRESS = "0xBA1a09D41F0b6334ef18De9F46597d95dC0c52bc"; // <-- Pega aquí la dirección
const RPC_URL = "https://sepolia.infura.io/v3/47df9777b0fe429686e584a221fc8221";    // <-- Pega aquí el RPC URL
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