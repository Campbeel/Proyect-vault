import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import axios from 'axios';
import { GoogleGenerativeAI, Tool, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import CryptoJS from 'crypto-js';
image.pngimport fsSync from 'fs'; // Para leer README de forma síncrona

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

// Configuración de Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

const toolDeclarations: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "uploadToPinata",
        description: "Sube un archivo a IPFS usando Pinata.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            fileContent: {
              type: SchemaType.STRING,
              description: "Contenido del archivo en base64 o texto plano"
            },
            fileName: {
              type: SchemaType.STRING,
              description: "Nombre del archivo, incluyendo extensión"
            }
          },
          required: ["fileContent", "fileName"]
        }
      },
      {
        name: "listAllPinnedFiles",
        description: "Lista todos los archivos fijados por la aplicación en Pinata.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
          required: []
        }
      },
      {
        name: "findFilesByExtension",
        description: "Busca archivos fijados en Pinata por una extensión específica.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            extension: {
              type: SchemaType.STRING,
              description: "La extensión del archivo a buscar (por ejemplo, 'pdf', 'jpg', 'txt')."
            }
          },
          required: ["extension"]
        }
      },
      {
        name: "confirmFileUpload",
        description: "Confirma que un archivo ha sido subido exitosamente.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            fileName: {
              type: SchemaType.STRING,
              description: "El nombre del archivo que ha sido subido."
            }
          },
          required: ["fileName"]
        }
      },
      {
        name: "viewSavedFile",
        description: "Previsualiza un archivo guardado por su ID o nombre.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            fileId: {
              type: SchemaType.STRING,
              description: "El ID del archivo (URL de IPFS)."
            },
            fileName: {
              type: SchemaType.STRING,
              description: "El nombre del archivo a previsualizar."
            }
          },
          required: []
        }
      },
      {
        name: "downloadFile",
        description: "Prepara un archivo guardado para su descarga por su ID o nombre.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            fileId: {
              type: SchemaType.STRING,
              description: "El ID del archivo (URL de IPFS)."
            },
            fileName: {
              type: SchemaType.STRING,
              description: "El nombre del archivo a descargar."
            }
          },
          required: []
        }
      },
      {
        name: "deleteFile",
        description: "Elimina un archivo guardado tanto de Pinata como del registro local.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            fileId: {
              type: SchemaType.STRING,
              description: "El ID o URL de IPFS del archivo a eliminar."
            },
            fileName: {
              type: SchemaType.STRING,
              description: "El nombre original del archivo a eliminar."
            }
          },
          required: ["fileId", "fileName"]
        }
      }
    ]
  }
];

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: {
    temperature: 0.7,
    topP: 0.8,
    topK: 40
  },
  tools: toolDeclarations
});

// Nueva función para ejecutar herramientas
async function ejecutarTool(toolName: string, args: Record<string, any>): Promise<any> {
  switch (toolName) {
    case "listAllPinnedFiles": {
      // Eliminar referencias a Pinata y responder directamente
      const pinataJWT = process.env.PINATA_JWT;
      if (!pinataJWT) {
        throw new Error("PINATA_JWT no está configurado en el backend para listar todos los pines.");
      }
      try {
        const pinataResponse = await axios.get(
          'https://api.pinata.cloud/data/pinList',
          {
            headers: {
              'Authorization': `Bearer ${pinataJWT}`,
            },
          }
        );
        const pinnedFiles = pinataResponse.data.rows;
        const currentlyPinnedFiles = pinnedFiles.filter((file: any) => !file.date_unpinned);

        let responseToUser = "No tienes archivos guardados por ahora.";
        if (currentlyPinnedFiles && currentlyPinnedFiles.length > 0) {
          const detailedFiles = currentlyPinnedFiles.map((file: any) => ({
            id: `https://ipfs.io/ipfs/${file.ipfs_pin_hash}`,
            originalFileName: (file as any).metadata.name || (file as any).ipfs_pin_hash,
          }));
          const fileNamesList = detailedFiles.map((f: any) => `- ${f.originalFileName}`).join("\n");
          responseToUser = `Estos son sus archivos guardados:\n${fileNamesList}\nPuedes previsualizar o eliminar cualquier archivo solicitándolo.`;
          return { status: "success", message: responseToUser, foundFiles: detailedFiles };
        } else {
          return { status: "info", message: responseToUser };
        }
      } catch (error) {
        console.error("Error al listar pines de Pinata:", error);
        throw new Error(`Error al intentar listar archivos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    }
    case "findFilesByExtension": {
      const extension = args.extension as string;
      const pinataJWT = process.env.PINATA_JWT;
      if (!pinataJWT) {
        throw new Error("PINATA_JWT no está configurado en el backend para buscar archivos por extensión.");
      }
      try {
        const pinataResponse = await axios.get(
          'https://api.pinata.cloud/data/pinList',
          {
            headers: {
              'Authorization': `Bearer ${pinataJWT}`,
            },
          }
        );
        const pinnedFiles = pinataResponse.data.rows;
        const matchingFiles = pinnedFiles.filter((file: any) =>
          file.metadata && file.metadata.name && file.metadata.name.toLowerCase().endsWith(`.${extension.toLowerCase()}`)
        );
        if (matchingFiles.length > 0) {
          const mergedFiles = matchingFiles.map((file: any) => {
            const isPreviewable = backendSavedFiles.some(savedFile => savedFile.id === `https://ipfs.io/ipfs/${file.ipfs_pin_hash}`);
            return {
              id: `https://ipfs.io/ipfs/${file.ipfs_pin_hash}`,
              originalFileName: file.metadata.name,
              isPreviewable: isPreviewable
            };
          });
          return { status: "success", message: `He encontrado ${mergedFiles.length} archivos con la extensión "${extension}".`, foundFiles: mergedFiles };
        } else {
          return { status: "info", message: `No se encontraron archivos con la extensión "${extension}".` };
        }
      } catch (error) {
        console.error(`Error al buscar archivos con extensión .${extension} en Pinata:`, error);
        throw new Error(`Error al intentar buscar archivos por extensión: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    }
    case "viewSavedFile": {
      const { fileId, fileName } = args;
      let fileToView: SavedFile | undefined;

      if (fileId) {
        fileToView = backendSavedFiles.find(f => f.id === fileId);
      } else if (fileName) {
        fileToView = backendSavedFiles.find(f => f.originalFileName === fileName);
      }

      if (fileToView) {
        console.log("File to view details:", fileToView);
        const previewUrl = fileToView.ipfsUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
        return {
          message: `Preparando previsualización de "${fileToView.originalFileName}". Por favor, haz clic en el botón 'Ver archivo' debajo del mensaje del agente para verlo.`, 
          fileId: fileToView.id, // This is savedFileId in the frontend
          ipfsUrl: previewUrl,
          originalFileName: fileToView.originalFileName,
          fileType: fileToView.fileType
        };
      } else {
        return { message: `Lo siento, no pude encontrar el archivo '${fileName || fileId}' para previsualizar.` };
      }
    }
    case "downloadFile": {
      const fileIdToDownload = args.fileId as string;
      const fileNameToDownload = args.fileName as string;

      if (!fileIdToDownload && !fileNameToDownload) {
        return { status: "error", message: `Para descargar un archivo, necesito el 'fileId' (URL de IPFS) o el 'fileName' del archivo. Por favor, proporciona al menos uno de ellos.` };
      }

      // Buscar por fileId o por fileName
      const fileToDownload = backendSavedFiles.find(file =>
        (fileIdToDownload && (file.id === fileIdToDownload || file.ipfsUrl === fileIdToDownload)) ||
        (fileNameToDownload && file.originalFileName === fileNameToDownload)
      );

      if (fileToDownload) {
        // Enviamos la URL de descarga para que el frontend pueda construir el enlace
        return { status: "success", message: `Puedes descargar \"${fileToDownload.originalFileName}\" desde el siguiente enlace: /download-file?fileId=${encodeURIComponent(fileToDownload.ipfsUrl)}.`, fileToDownload: { id: fileToDownload.id, originalFileName: fileToDownload.originalFileName, ipfsUrl: fileToDownload.ipfsUrl, fileType: fileToDownload.fileType } };
      } else {
        return { status: "info", message: `Lo siento, el archivo \"${fileNameToDownload || fileIdToDownload}\" no fue encontrado entre los archivos guardados.` };
      }
    }
    case "uploadToPinata": {
      const fileContent = args.fileContent as string;
      const fileName = args.fileName as string;

      const pinataJWT = process.env.PINATA_JWT;
      if (!pinataJWT) {
        throw new Error("PINATA_JWT no está configurado en el backend para subir archivos.");
      }

      try {
        // Aquí deberías subir el contenido del archivo a Pinata.
        // Dado que el frontend es el que maneja la subida, esta función de herramienta
        // es más una confirmación o para futuros usos donde Gemini inicie la subida.
        // Por ahora, asumiremos que si Gemini llama a esto, es para confirmar que el archivo existe.
        // Si realmente necesitas subir el archivo desde Gemini, el `fileContent` debería ser un Buffer o Blob.
        // Esto es un placeholder para la lógica de subida real si Gemini crea el archivo.

        // Simulamos una subida y generamos un IPFS URL temporal para fines de demostración de la herramienta.
        const ipfsHash = `QmV${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}`; // Simula un hash IPFS
        const ipfsUrl = `ipfs://${ipfsHash}`;

        const newSavedFile: SavedFile = {
          id: ipfsUrl,
          ipfsUrl,
          originalFileName: fileName,
          fileType: 'application/octet-stream', // Tipo genérico para la simulación
        };
        backendSavedFiles.push(newSavedFile);
        await saveSavedFiles(backendSavedFiles);

        console.log('Archivo subido a Pinata (simulado):', newSavedFile.originalFileName);

        return { status: "success", message: `Archivo subido exitosamente (simulado) a IPFS: ${ipfsUrl}` };
      } catch (error) {
        console.error('Error al subir archivo a Pinata (simulado):', error);
        throw new Error(`Error al subir archivo a Pinata (simulado): ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    }
    case "confirmFileUpload": {
      const fileName = args.fileName as string;
      return { status: "success", message: `Confirmado: el archivo "${fileName}" ha sido subido exitosamente.` };
    }
    case "deleteFile": {
      const { fileId, fileName } = args;
      let fileToDelete = null;
      if (fileId) {
        fileToDelete = backendSavedFiles.find(f => (f.id === fileId || f.ipfsUrl === fileId));
      } else if (fileName) {
        fileToDelete = backendSavedFiles.find(f => f.originalFileName === fileName);
      }
      if (!fileToDelete) {
        return { status: "error", message: "No se encontró el archivo para eliminar." };
      }
      try {
        const ipfsHash = fileToDelete.ipfsUrl.replace('ipfs://', '').replace('https://ipfs.io/ipfs/', '');
        await axios.delete(`https://api.pinata.cloud/pinning/unpin/${ipfsHash}`, {
          headers: { 'Authorization': `Bearer ${process.env.PINATA_JWT}` }
        });
        const index = backendSavedFiles.findIndex(f => f.id === fileToDelete.id);
        if (index !== -1) {
          backendSavedFiles.splice(index, 1);
          await saveSavedFiles(backendSavedFiles);
        }
        return { status: "success", message: `El archivo "${fileToDelete.originalFileName}" fue eliminado correctamente.` };
      } catch (error) {
        console.error('Error al eliminar archivo:', error);
        return { status: "error", message: "Error al eliminar el archivo." };
      }
    }
    default: {
      throw new Error(`Función desconocida: ${toolName}`);
    }
  }
}

// Endpoint para la interacción con el agente Gemini
app.post('/chat/agent', express.json(), async (req: Request, res: Response): Promise<void> => {
  const { message, wallet } = req.body;

  if (!message || !wallet) {
    res.status(400).json({ error: 'No se proporcionó mensaje o wallet.' });
    return;
  }

  // 1. Leer prompt base
  const promptPath = path.join(__dirname, 'agent', 'prompt', 'README.md');
  let promptBase = '';
  try {
    promptBase = fsSync.readFileSync(promptPath, 'utf8');
  } catch (e) {
    promptBase = 'Eres un asistente para gestión de archivos en bóveda blockchain.';
  }

  // 2. Leer historial completo de la wallet
  const key = deriveKeyFromWallet(wallet);
  const convs = await loadConversations();
  const userConv = convs.find(c => c.wallet.toLowerCase() === wallet.toLowerCase());
  let historial = '';
  if (userConv && userConv.conversaciones.length > 0) {
    // Tomar todas las conversaciones y formatearlas
    historial = userConv.conversaciones.map(conv =>
      conv.mensajes ? decryptMessages((conv as any).mensajes, key).map(m => `${m.rol === 'usuario' ? 'Usuario' : 'Gemini'}: ${m.mensaje}`).join('\n') : ''
    ).join('\n');
  }

  // 3. Leer la última lista de archivos guardados
  let archivosGuardados = '';
  if (backendSavedFiles.length > 0) {
    archivosGuardados = 'Archivos guardados actualmente:\n' + backendSavedFiles.map(f => `- ${f.originalFileName}`).join('\n');
  } else {
    archivosGuardados = 'No hay archivos guardados actualmente.';
  }

  // 4. Construir el contexto
  const contexto = `${promptBase}\n\n---\n\n${historial}\n\n---\n\n${archivosGuardados}\n\n---\n\nUsuario: ${message}`;

  try {
    const chat = model.startChat({ tools: toolDeclarations });
    const result = await chat.sendMessage(contexto);
    const response = result.response;
    const toolCalls = response.functionCalls();

    if (toolCalls && toolCalls.length > 0) {
      const toolResults: any[] = [];
      for (const toolCall of toolCalls) {
        const toolName = toolCall.name;
        const args = toolCall.args;
        try {
          const toolResult = await ejecutarTool(toolName, args);
          toolResults.push({
            toolOutput: {
              toolCall: toolCall,
              result: toolResult
            }
          });
        } catch (error: any) {
          toolResults.push({
            toolOutput: {
              toolCall: toolCall,
              error: error.message
            }
          });
        }
      }
      const followup = await chat.sendMessage(
        toolResults.map(toolResult => ({
          functionResponse: {
            name: toolResult.toolOutput.toolCall.name,
            response: toolResult.toolOutput.result || { error: toolResult.toolOutput.error }
          }
        }))
      );
      res.json({ type: 'tool_calls', content: toolResults });
    } else {
      res.json({ type: 'text', content: response.text() });
    }
  } catch (error) {
    console.error('Error al comunicarse con el agente Gemini:', error);
    res.status(500).json({ error: 'Error al comunicarse con el agente Gemini.' });
  }
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