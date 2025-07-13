import { Router } from "express";
import { getFiles, addFile, removeFile } from "../../../contract";
import { verifyMessage } from "ethers";
import express from "express";

const router = Router();
// Asegurar que el router procese JSON
router.use(express.json());

// GET /api/files/:wallet - Consultar los archivos de una wallet (solo nombre y tipo)
router.get("/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;
    // 1. Obtener los hashes de la blockchain
    const hashes = await getFiles(wallet);
    // 2. Consultar a Pinata/IPFS para obtener nombre y tipo
    const files = await Promise.all(
      hashes.map(async (hash) => {
        try {
          // Consulta a Pinata gateway para obtener metadatos
          const url = `https://gateway.pinata.cloud/ipfs/${hash.replace('ipfs://', '')}`;
          const response = await fetch(url, { method: 'HEAD' });
          // Puedes intentar obtener el nombre y tipo del header si está disponible
          const fileName = response.headers.get('x-pinata-metadata') || 'Archivo';
          const fileType = response.headers.get('content-type') || 'desconocido';
          return { fileName, fileType };
        } catch {
          return { fileName: 'Archivo', fileType: 'desconocido' };
        }
      })
    );
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/files - Guardar un hash (añadir archivo)
router.post("/", async (req, res) => {
  try {
    const { ipfsHash, message, signature, wallet } = req.body;
    if (!ipfsHash) return res.status(400).json({ error: "ipfsHash requerido" });

    const signer = verifyMessage(message, signature);
    if (signer.toLowerCase() !== wallet.toLowerCase()) {
      return res.status(401).json({ error: "Firma inválida" });
    }

    const tx = await addFile(ipfsHash);
    res.json({ success: true, txHash: tx.hash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/files/:hash - Eliminar un hash
router.delete("/:hash", async (req, res) => {
  try {
    const { hash, message, signature, wallet } = req.body;
    if (!hash) return res.status(400).json({ error: "hash requerido" });

    const signer = verifyMessage(message, signature);
    if (signer.toLowerCase() !== wallet.toLowerCase()) {
      return res.status(401).json({ error: "Firma inválida" });
    }

    const tx = await removeFile(hash);
    res.json({ success: true, txHash: tx.hash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 