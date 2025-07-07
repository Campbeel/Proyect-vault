import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import axios from 'axios';
import { GoogleGenerativeAI, Tool, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import CryptoJS from 'crypto-js';
import fsSync from 'fs'; // Para leer README de forma síncrona

interface SavedFile {
  id: string;
  ipfsUrl: string;
  originalFileName: string;
  fileType: string;
}

let backendSavedFiles: SavedFile[] = [];

const SAVED_FILES_PATH = path.join(__dirname, 'saved_files.json');

// --- Conversaciones cifradas ---

const CONVERSATIONS_PATH = path.join(__dirname, 'conversations.json');

interface MensajeConversacion {
  rol: 'usuario' | 'gemini';
  mensaje: string;
}

interface Conversacion {
  id: string; // timestamp o UUID
  mensajes: MensajeConversacion[];
}

interface ConversacionPorWallet {
  wallet: string;
  conversaciones: Conversacion[];
}

// Leer conversaciones desde disco
async function loadConversations(): Promise<ConversacionPorWallet[]> {
  try {
    const data = await fs.readFile(CONVERSATIONS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error('Error al cargar conversaciones:', error);
    return [];
  }
}

// Guardar conversaciones en disco
async function saveConversations(convs: ConversacionPorWallet[]): Promise<void> {
  try {
    await fs.writeFile(CONVERSATIONS_PATH, JSON.stringify(convs, null, 2), 'utf8');
  } catch (error) {
    console.error('Error al guardar conversaciones:', error);
  }
}

// Derivar clave AES desde la wallet (SHA-256)
function deriveKeyFromWallet(wallet: string): string {
  return CryptoJS.SHA256(wallet.toLowerCase()).toString();
}

// Cifrar mensajes
function encryptMessages(messages: MensajeConversacion[], key: string): string {
  return CryptoJS.AES.encrypt(JSON.stringify(messages), key).toString();
}

// Descifrar mensajes
function decryptMessages(ciphertext: string, key: string): MensajeConversacion[] {
  const bytes = CryptoJS.AES.decrypt(ciphertext, key);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  return JSON.parse(decrypted);
}

// --- Endpoints de conversaciones ---

declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}

// Configuración de Google Generative AI

dotenv.config();

const app: express.Application = express();
const port = process.env.PORT || 5000;

// --- Endpoints de conversaciones ---
app.post('/conversations', express.json(), async (req: Request, res: Response) => {
  const { wallet, mensajes } = req.body;
  if (!wallet || !mensajes || !Array.isArray(mensajes)) {
    res.status(400).json({ error: 'Faltan datos requeridos (wallet, mensajes).' });
    return;
  }
  const key = deriveKeyFromWallet(wallet);
  const convs = await loadConversations();
  let userConv = convs.find(c => c.wallet.toLowerCase() === wallet.toLowerCase());
  const nuevaConversacion: Conversacion = {
    id: new Date().toISOString(),
    mensajes: [], // se guarda cifrado
  };
  const encrypted = encryptMessages(mensajes, key);
  // Guardar como string cifrado en vez de array
  (nuevaConversacion as any).mensajes = encrypted;
  if (!userConv) {
    convs.push({ wallet: wallet.toLowerCase(), conversaciones: [nuevaConversacion] });
  } else {
    userConv.conversaciones.push(nuevaConversacion);
  }
  await saveConversations(convs);
  res.status(200).json({ message: 'Conversación guardada exitosamente.' });
});

app.get('/conversations/:wallet', async (req: Request, res: Response) => {
  const { wallet } = req.params;
  if (!wallet) {
    res.status(400).json({ error: 'Wallet requerida.' });
    return;
  }
  const key = deriveKeyFromWallet(wallet);
  const convs = await loadConversations();
  const userConv = convs.find(c => c.wallet.toLowerCase() === wallet.toLowerCase());
  if (!userConv) {
    res.status(404).json({ error: 'No hay conversaciones para esta wallet.' });
    return;
  }
  // Descifrar cada conversación
  const conversacionesDescifradas = userConv.conversaciones.map(conv => {
    try {
      const mensajes = decryptMessages((conv as any).mensajes, key);
      return { id: conv.id, mensajes };
    } catch (e) {
      return { id: conv.id, mensajes: [] };
    }
  });
  res.status(200).json({ conversaciones: conversacionesDescifradas });
});

async function loadSavedFiles(): Promise<SavedFile[]> {
  try {
    const data = await fs.readFile(SAVED_FILES_PATH, 'utf8');
    console.log('Archivos guardados cargados desde el disco.');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('saved_files.json no encontrado, iniciando con un array vacío.');
      return [];
    }
    console.error('Error al cargar archivos guardados:', error);
    return [];
  }
}

async function saveSavedFiles(files: SavedFile[]): Promise<void> {
  try {
    await fs.writeFile(SAVED_FILES_PATH, JSON.stringify(files, null, 2), 'utf8');
    console.log('Archivos guardados en el disco.');
  } catch (error) {
    console.error('Error al guardar archivos:', error);
  }
}

app.use(cors({
  origin: 'http://localhost:3000',
}));

const upload = multer();

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No se proporcionó ningún archivo.' });
    return;
  }

  const pinataJWT = process.env.PINATA_JWT;

  if (!pinataJWT) {
    console.error('PINATA_JWT no está configurado en el backend.');
    res.status(500).json({ error: 'La clave de API de Pinata no está configurada en el servidor.' });
    return;
  }

  const { originalFileName, fileType } = req.body;

  if (!originalFileName || !fileType) {
    res.status(400).json({ error: 'Faltan metadatos esenciales para el archivo (nombre o tipo).' });
    return;
  }

  const formData = new FormData();
  const fileBlob = new Blob([req.file.buffer], { type: req.file.mimetype });
  formData.append('file', fileBlob, req.file.originalname);

  try {
    const pinataResponse = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        maxBodyLength: Infinity,
        headers: {
          'Authorization': `Bearer ${pinataJWT}`,
        },
      }
    );

    const ipfsHash = pinataResponse.data.IpfsHash;
    const ipfsUrl = `ipfs://${ipfsHash}`;

    const newSavedFile: SavedFile = {
      id: ipfsUrl,
      ipfsUrl,
      originalFileName: originalFileName,
      fileType: fileType,
    };
    backendSavedFiles.push(newSavedFile);
    await saveSavedFiles(backendSavedFiles);

    console.log('Archivo y metadatos guardados en el backend (en memoria y disco):', newSavedFile.originalFileName);

    res.status(200).json({ ipfsUrl });
  } catch (error) {
    console.error('Error al subir archivo a Pinata desde el backend:', error);
    res.status(500).json({ error: 'Error al subir el archivo a IPFS.' });
  }
});

// Endpoint para la interacción con el agente Gemini (ahora solo procesa acciones)
app.post('/chat/agent', express.json(), async (req: Request, res: Response): Promise<void> => {
  const { action, params, wallet } = req.body;

  if (!action || !wallet) {
    res.status(400).json({ error: 'No se proporcionó acción o wallet.' });
    return;
  }

  try {
    let result;
    const normalizedAction = (action || "").toLowerCase();
    switch (normalizedAction) {
      case 'listar_archivos':
      case 'listallpinnedfiles': {
        // Listar archivos guardados
        if (backendSavedFiles.length > 0) {
          const fileNamesList = backendSavedFiles.map((f: SavedFile) => `- ${f.originalFileName}`).join("\n");
          result = `Estos son tus archivos guardados:\n${fileNamesList}\nPuedes previsualizar o eliminar cualquier archivo solicitándolo.`;
        } else {
          result = "No tienes archivos guardados por ahora.";
        }
        break;
      }
      case 'eliminar_archivo':
      case 'deletefile': {
        result = 'Acción implementada como placeholder: eliminar archivo.';
        break;
      }
      case 'ver_archivo':
      case 'viewsavedfile': {
        result = 'Acción implementada como placeholder: ver archivo.';
        break;
      }
      case 'descargar_archivo':
      case 'downloadfile': {
        result = 'Acción implementada como placeholder: descargar archivo.';
        break;
      }
      case 'subir_archivo':
      case 'uploadtopinata': {
        result = 'Acción implementada como placeholder: subir archivo.';
        break;
      }
      case 'buscar_por_extension':
      case 'findfilesbyextension': {
        result = 'Acción implementada como placeholder: buscar archivos por extensión.';
        break;
      }
      case 'confirmar_subida':
      case 'confirmfileupload': {
        result = 'Acción implementada como placeholder: confirmar subida.';
        break;
      }
      default:
        result = `Acción no reconocida: ${action}`;
    }
    res.send(result);
  } catch (error) {
    console.error('Error al procesar la acción:', error);
    res.status(500).json({ error: 'Error al procesar la acción.' });
  }
});

// Endpoint para proxy a Gemini
app.post('/api/gemini', express.json(), (req: Request, res: Response) => {
  (async () => {
    const { input, wallet } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Falta el mensaje de entrada.' });
    }
    const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'No hay API Key de Gemini configurada.' });
    }
    // Leer prompt base desde README
    const promptPath = path.join(__dirname, 'agent', 'prompt', 'README.md');
    let promptBase = '';
    try {
      promptBase = fsSync.readFileSync(promptPath, 'utf8');
    } catch (e) {
      promptBase = 'Eres un asistente para gestión de archivos en bóveda blockchain.';
    }
    // Concatenar prompt base con el input del usuario
    const prompt = `${promptBase}\n\nUsuario: ${input}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }]
    };
    try {
      const response = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json' }
      });
      const data = response.data;
      const geminiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo obtener respuesta de Gemini.";
      res.json({ text: geminiText });
    } catch (error: any) {
      console.error('Error al llamar a Gemini:', error?.response?.data || error.message);
      res.status(500).json({ error: 'Error al llamar a Gemini.' });
    }
  })();
});

// Middleware para manejar la respuesta de descarga
const handleDownloadResponse = (req: Request, res: Response, next: (error?: any) => void) => {
  const downloadHandler = async () => {
    const { fileId } = req.query;

    if (!fileId || typeof fileId !== 'string') {
      return res.status(400).json({ error: 'Se requiere un ID válido de archivo.' });
    }

    const savedFile = backendSavedFiles.find(file => file.ipfsUrl === fileId);

    if (!savedFile) {
      return res.status(404).json({ error: 'Archivo no encontrado o no guardado a través de esta aplicación.' });
    }

    try {
      // Descargar el archivo desde IPFS directamente
      const ipfsGatewayUrl = savedFile.ipfsUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      const response = await axios.get(ipfsGatewayUrl, { responseType: 'arraybuffer' });
      const fileBuffer = Buffer.from(response.data);

      // Configurar encabezados para visualización en el navegador
      res.setHeader('Content-Type', savedFile.fileType || 'application/octet-stream');
      
      // Solo establecer Content-Disposition como attachment si el tipo de archivo no es visualizable
      const isViewableType = savedFile.fileType?.startsWith('image/') || 
                            savedFile.fileType === 'application/pdf' || 
                            savedFile.fileType?.startsWith('text/');
      
      if (!isViewableType) {
        res.setHeader('Content-Disposition', `attachment; filename="${savedFile.originalFileName}"`);
      }
      
      res.send(fileBuffer);

    } catch (error) {
      console.error('Error al descargar el archivo:', error);
      res.status(500).json({ error: 'Error al descargar el archivo.' });
    }
  };
  downloadHandler().catch(next); // Llama al manejador y pasa los errores a next
};

// Conectando el middleware a la ruta de descarga
app.get('/download-file', handleDownloadResponse);

// Endpoint para listar archivos guardados (sin filtrar por owner)
app.get('/files', (req, res) => {
  if (backendSavedFiles.length > 0) {
    const fileNamesList = backendSavedFiles.map((f: SavedFile) => `- ${f.originalFileName}`).join("\n");
    const responseToUser = `Estos son sus archivos guardados:\n${fileNamesList}\nPuedes previsualizar o eliminar cualquier archivo solicitándolo.`;
    res.status(200).json({ message: responseToUser });
  } else {
    res.status(200).json({ message: "No tienes archivos guardados por ahora." });
  }
});

// Inicializar archivos guardados al iniciar el servidor
async function startServer() {
  backendSavedFiles = await loadSavedFiles();
  app.listen(port, () => {
    console.log(`Servidor backend escuchando en http://localhost:${port}`);
  });
}

startServer();