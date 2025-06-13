import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import axios from 'axios';
import { GoogleGenerativeAI, Tool, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';

interface SavedFile {
  id: string;
  ipfsUrl: string;
  originalFileName: string;
  fileType: string;
  encryptedFileKey: string;
  nonce: string;
}

let backendSavedFiles: SavedFile[] = [];

const SAVED_FILES_PATH = path.join(__dirname, 'saved_files.json');

declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}

// Configuración de Google Generative AI

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

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

  const { originalFileName, fileType, encryptedFileKey, nonce } = req.body;

  if (!originalFileName || !fileType || !encryptedFileKey || !nonce) {
    res.status(400).json({ error: 'Faltan metadatos esenciales para el archivo (nombre, tipo, clave de cifrado o nonce).' });
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
      encryptedFileKey: encryptedFileKey,
      nonce: nonce,
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
        name: "listSavedFiles",
        description: "Lista los archivos que han sido guardados y cifrados a través de esta aplicación.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
          required: []
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
    case "listSavedFiles": {
      let responseToUser = "No tienes archivos guardados en este momento a través de esta aplicación.";
      if (backendSavedFiles.length > 0) {
        const fileNames = backendSavedFiles.map(file => `"${file.originalFileName}"`).join(", ");
        responseToUser = `Tienes los siguientes archivos guardados a través de esta aplicación: ${fileNames}.`;
      }
      return { status: "success", message: responseToUser };
    }
    case "listAllPinnedFiles": {
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
        let responseToUser = "No se encontraron archivos fijados en tu cuenta de Pinata.";
        if (pinnedFiles && pinnedFiles.length > 0) {
          const fileNames = pinnedFiles.map((file: any) => `"${file.metadata.name || file.ipfs_pin_hash}"`).join(", ");
          responseToUser = `Se encontraron los siguientes archivos fijados en tu cuenta de Pinata: ${fileNames}.`;
        }
        return { status: "success", message: responseToUser };
      } catch (error) {
        console.error("Error al listar pines de Pinata:", error);
        throw new Error(`Error al intentar listar archivos de Pinata: ${error instanceof Error ? error.message : 'Error desconocido'}`);
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
      const fileIdToView = args.fileId as string; // Asumimos que fileId es el ipfsUrl
      const fileNameToView = args.fileName as string;

      console.log(`viewSavedFile: Intentando previsualizar - fileId: ${fileIdToView}, fileName: ${fileNameToView}`);

      if (!fileIdToView && !fileNameToView) {
        console.log("viewSavedFile: Error - Falta fileId o fileName.");
        return { status: "error", message: `Para previsualizar un archivo, necesito el 'fileId' (URL de IPFS) o el 'fileName' del archivo. Por favor, proporciona al menos uno de ellos.` };
      }

      const fileToPreview = backendSavedFiles.find(file => file.id === fileIdToView || file.originalFileName === fileNameToView);

      console.log(`viewSavedFile: Archivo encontrado en backendSavedFiles: ${fileToPreview ? fileToPreview.originalFileName : 'Ninguno'}`);

      if (fileToPreview) {
        return { status: "success", message: `Preparando previsualización de "${fileToPreview.originalFileName}". Por favor, haz clic en el botón 'Ver archivo' debajo del mensaje del agente para verlo.`, savedFileId: fileToPreview.id };
      } else {
        return { status: "info", message: `Lo siento, solo puedo previsualizar archivos que fueron subidos y cifrados a través de esta aplicación. El archivo "${fileNameToView || fileIdToView}" no fue encontrado con la información de cifrado necesaria. ¿Te gustaría que te liste los archivos que sí puedo previsualizar?` };
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
        const pinataResponse = await axios.post(
          'https://api.pinata.cloud/pinning/pinFileToIPFS',
          {
            file: fileContent,
            fileName: fileName
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.PINATA_JWT}`,
            },
          }
        );

        const ipfsHash = pinataResponse.data.IpfsHash;
        const ipfsUrl = `ipfs://${ipfsHash}`;

        const newSavedFile: SavedFile = {
          id: ipfsUrl,
          ipfsUrl,
          originalFileName: fileName,
          fileType: '',
          encryptedFileKey: '',
          nonce: '',
        };
        backendSavedFiles.push(newSavedFile);
        await saveSavedFiles(backendSavedFiles);

        console.log('Archivo subido a Pinata:', newSavedFile.originalFileName);

        return { status: "success", message: `Archivo subido exitosamente a IPFS: ${ipfsUrl}` };
      } catch (error) {
        console.error('Error al subir archivo a Pinata:', error);
        throw new Error(`Error al subir archivo a Pinata: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    }
    case "confirmFileUpload": {
      const fileName = args.fileName as string;
      return { status: "success", message: `Confirmado: el archivo "${fileName}" ha sido subido exitosamente.` };
    }
    default: {
      throw new Error(`Función desconocida: ${toolName}`);
    }
  }
}

// Endpoint para la interacción con el agente Gemini
app.post('/chat/agent', express.json(), async (req: Request, res: Response): Promise<void> => {
  const { message } = req.body;

  if (!message) {
    res.status(400).json({ error: 'No se proporcionó ningún mensaje.' });
    return;
  }

  console.log('Mensaje recibido del frontend:', message);

  try {
    console.log('Enviando mensaje a Gemini...');
    const chat = model.startChat({
      tools: toolDeclarations,
    });
    const result = await chat.sendMessage(message);
    const response = result.response;
    console.log('Respuesta completa de Gemini (result):', result);

    const toolCalls = response.functionCalls();

    if (toolCalls && toolCalls.length > 0) {
      console.log('Gemini solicitó llamadas a funciones:', toolCalls);
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
      console.log("Resultado final:", followup.response.text());
      res.json({ type: 'tool_calls', content: toolResults });

    } else {
      console.log('Texto de la respuesta de Gemini:', response.text());
      res.json({ type: 'text', content: response.text() });
    }
  } catch (error) {
    console.error('Error al comunicarse con el agente Gemini:', error);
    res.status(500).json({ error: 'Error al comunicarse con el agente Gemini.' });
  }
});

// Inicializar archivos guardados al iniciar el servidor
loadSavedFiles().then(files => {
  backendSavedFiles = files;
  app.listen(port, () => {
    console.log(`Servidor backend escuchando en http://localhost:${port}`);
  });
});
