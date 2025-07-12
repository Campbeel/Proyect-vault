import { Router } from "express";
import { getFiles, addFile, removeFile } from "../../../contract";

const router = Router();

// GET /api/files/:wallet - Consultar los hashes de una wallet
router.get("/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;
    const files = await getFiles(wallet);
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/files - Guardar un hash (añadir archivo)
router.post("/", async (req, res) => {
  try {
    const { ipfsHash } = req.body;
    if (!ipfsHash) return res.status(400).json({ error: "ipfsHash requerido" });
    const tx = await addFile(ipfsHash);
    res.json({ success: true, txHash: tx.hash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/files/:hash - Eliminar un hash
router.delete("/:hash", async (req, res) => {
  try {
    const { hash } = req.params;
    const tx = await removeFile(hash);
    res.json({ success: true, txHash: tx.hash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 