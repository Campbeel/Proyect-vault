import axios from 'axios';
import CryptoJS from 'crypto-js';

// La JWT de Pinata ahora se maneja de forma segura en el backend.
// const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT || '';

/**
 * Generates an encryption key from a nonce and a signature.
 * This ensures the key is deterministic based on user's wallet and a unique nonce.
 * @param nonce A unique string used once (number used once).
 * @param signature The cryptographic signature from the user's wallet.
 * @returns A string representation of the encryption key.
 */
export function generateEncryptionKey(nonce: string, signature: string): string {
  // Combine nonce and signature, then hash them to get a consistent key
  // Using SHA256 to ensure a fixed-size key, suitable for AES
  const combined = nonce + signature;
  return CryptoJS.SHA256(combined).toString();
}

/**
 * Encrypts a File object using AES and returns the encrypted data as a Blob.
 * @param file The File object to encrypt.
 * @param key The encryption key (string).
 * @returns A Promise that resolves to a Blob containing the encrypted data.
 */
export async function encryptFile(file: File, key: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wordArray = CryptoJS.lib.WordArray.create(reader.result as ArrayBuffer);
        const encrypted = CryptoJS.AES.encrypt(wordArray, key).toString(); // encrypted is a Base64 string
        const blob = new Blob([encrypted], { type: 'text/plain' }); // Store the Base64 string as a Blob
        resolve(blob);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Decrypts an encrypted Blob using AES and returns the original data as a Blob.
 * @param encryptedBlob The Blob containing the encrypted (Base64) data.
 * @param key The decryption key (string).
 * @param originalType The original MIME type of the file, to create the correct Blob.
 * @returns A Promise that resolves to a Blob containing the decrypted data.
 */
export async function decryptFile(encryptedBlob: Blob, key: string, originalType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const decryptedWordArray = CryptoJS.AES.decrypt(reader.result as string, key);
        // Convert WordArray to ArrayBuffer for Blob
        const decryptedBuffer = new Uint8Array(decryptedWordArray.sigBytes);
        for (let i = 0; i < decryptedWordArray.sigBytes; i++) {
          decryptedBuffer[i] = (decryptedWordArray.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        }
        const blob = new Blob([decryptedBuffer], { type: originalType });
        resolve(blob);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(encryptedBlob); // Read encrypted data as text (Base64 string)
  });
}

/**
 * Uploads an encrypted file to IPFS via the backend.
 * @param encryptedFileBlob The Blob containing the encrypted file data.
 * @param originalFileName The original name of the file (important for backend processing).
 * @param fileType The original MIME type of the file.
 * @param encryptedFileKey The encryption key for the file, encrypted with the session key.
 * @param nonce The nonce used to derive the file key.
 * @returns A Promise that resolves to the IPFS URL of the uploaded file.
 */
export async function uploadEncryptedFileToIPFS(encryptedFileBlob: Blob, originalFileName: string, fileType: string, encryptedFileKey: string, nonce: string): Promise<{ ipfsHash: string }> {
  const formData = new FormData();
  formData.append('file', encryptedFileBlob, originalFileName);
  formData.append('originalFileName', originalFileName);
  formData.append('fileType', fileType);
  formData.append('encryptedFileKey', encryptedFileKey);
  formData.append('nonce', nonce);

  try {
    const response = await axios.post(
      'http://localhost:5000/upload', // Apunta al endpoint de subida de tu backend
      formData,
      {
        headers: {
          // axios handles 'Content-Type' automatically for FormData
        },
      }
    );
    console.log('Encrypted file uploaded to IPFS via backend:', response.data);
    return { ipfsHash: response.data.ipfsUrl }; // El backend devuelve la URL de IPFS directamente
  } catch (error) {
    console.error('Error uploading encrypted file to IPFS from frontend:', error);
    throw new Error('Error al subir el archivo cifrado a IPFS a través del backend.');
  }
} 