// =======================
// IMPORTS Y DEPENDENCIAS
// =======================
import { axios } from "../imports";

// =======================
// TIPOS Y INTERFACES
// =======================
interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

interface PinataMetadata {
  name: string;
  keyvalues?: Record<string, string>;
}

// =======================
// CONFIGURACIÓN DE PINATA
// =======================
const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

// =======================
// FUNCIONES DE SUBIDA A IPFS
// =======================

/**
 * Sube un archivo a IPFS usando Pinata
 * @param file - Archivo a subir
 * @param metadata - Metadatos opcionales del archivo
 * @param jwt - Token de autenticación de Pinata
 * @returns URL de IPFS del archivo subido
 */
export async function uploadToPinata(
  file: File,
  metadata?: PinataMetadata,
  jwt?: string
): Promise<string> {
  try {
    // Crear FormData con el archivo
    const formData = new FormData();
    formData.append('file', file);

    // Agregar metadatos si se proporcionan
    if (metadata) {
      formData.append('pinataMetadata', JSON.stringify(metadata));
    }

    // Configurar headers de autenticación
    const headers: Record<string, string> = {
      'Content-Type': 'multipart/form-data',
    };

    if (jwt) {
      headers['Authorization'] = `Bearer ${jwt}`;
    }

    // Realizar la petición a Pinata
    const response = await axios.post<PinataResponse>(
      `${PINATA_API_URL}/pinning/pinFileToIPFS`,
      formData,
      { headers }
    );

    // Retornar la URL de IPFS
    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error('Error al subir archivo a Pinata:', error);
    throw new Error('No se pudo subir el archivo a IPFS');
  }
}

/**
 * Obtiene la URL de gateway para un hash de IPFS
 * @param ipfsHash - Hash de IPFS
 * @returns URL completa del gateway
 */
export function getGatewayUrl(ipfsHash: string): string {
  // Remover el prefijo 'ipfs://' si existe
  const hash = ipfsHash.replace('ipfs://', '');
  return `${PINATA_GATEWAY}/${hash}`;
}

/**
 * Verifica si una URL es de IPFS
 * @param url - URL a verificar
 * @returns true si es una URL de IPFS
 */
export function isIpfsUrl(url: string): boolean {
  return url.startsWith('ipfs://') || url.includes('ipfs.io') || url.includes('gateway.pinata.cloud');
}

/**
 * Convierte una URL de IPFS a URL de gateway
 * @param ipfsUrl - URL de IPFS
 * @returns URL del gateway
 */
export function ipfsToGatewayUrl(ipfsUrl: string): string {
  if (ipfsUrl.startsWith('ipfs://')) {
    return getGatewayUrl(ipfsUrl);
  }
  return ipfsUrl;
} 