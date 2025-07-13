// =======================
// IMPORTS Y DEPENDENCIAS
// =======================
import { express, Request, Response, cors, multer, dotenv, axios, path, fs, fsSync, CryptoJS, prisma } from "./imports";
import fileVaultRouter from "./internal/http/filevault/routes";
import { getFiles } from "./contract";

// =======================
// INTERFACES Y TIPOS
// =======================
interface MensajeConversacion {
  rol: 'usuario' | 'gemini';
  mensaje: string;
}

// =======================
// FUNCIONES UTILITARIAS
// =======================
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

// =======================
// CONFIGURACIÓN EXPRESS
// =======================
dotenv.config();
const app: express.Application = express();
const port = process.env.PORT || 5000;
app.use(cors({ origin: 'http://localhost:3000' }));
const upload = multer();

// Montar endpoints de blockchain
app.use("/api/files", fileVaultRouter);

// =======================
// ENDPOINTS DE ARCHIVOS
// =======================
// Subir archivo a Pinata y guardar en BD
app.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  // LOGS DE DEPURACIÓN
  console.log('req.body:', req.body);
  console.log('req.file:', req.file);
  if (!req.file) {
    res.status(400).json({ error: 'No se proporcionó ningún archivo.' });
    return;
  }
  const pinataJWT = process.env.PINATA_JWT;
  if (!pinataJWT) {
    res.status(500).json({ error: 'La clave de API de Pinata no está configurada en el servidor.' });
    return;
  }
  const { wallet } = req.body;
  if (!wallet) {
    res.status(400).json({ error: 'Falta la wallet.' });
    return;
  }
  // Tomar nombre y tipo del archivo desde req.file
  const originalFileName = req.file.originalname;
  const fileType = req.file.mimetype;
  // Buscar o crear usuario
  let user = await prisma.user.findUnique({ where: { wallet: wallet.toLowerCase() } });
  if (!user) {
    user = await prisma.user.create({ data: { wallet: wallet.toLowerCase() } });
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
    const file = await prisma.file.create({
      data: {
      ipfsUrl,
        originalName: originalFileName,
        fileType,
        fileSize: req.file.size,
        userId: user.id
      }
    });
    res.status(200).json({ ipfsUrl, file });
  } catch (error) {
    console.error('Error al subir archivo a Pinata desde el backend:', error);
    res.status(500).json({ error: 'Error al subir el archivo a IPFS.' });
  }
});

// Listar archivos guardados (de todos los usuarios)
app.get('/files', async (req, res) => {
  const files = await prisma.file.findMany();
  if (files.length > 0) {
    const fileNamesList = files.map((f: any) => `- ${f.originalName}`).join("\n");
    const responseToUser = `Estos son sus archivos guardados:\n${fileNamesList}\nPuedes previsualizar o eliminar cualquier archivo solicitándolo.`;
    res.status(200).json({ message: responseToUser });
  } else {
    res.status(200).json({ message: "No tienes archivos guardados por ahora." });
  }
});

// Mover express.json() aquí para que no interfiera con multer
app.use(express.json());

// =======================
// ENDPOINTS DE CONVERSACIONES
// =======================
// Guardar conversación cifrada
app.post('/conversations', async (req: Request, res: Response) => {
  const { wallet, mensajes } = req.body;
  if (!wallet || !mensajes || !Array.isArray(mensajes)) {
    res.status(400).json({ error: 'Faltan datos requeridos (wallet, mensajes).' });
    return;
  }
  const key = deriveKeyFromWallet(wallet);
  // Buscar o crear usuario
  let user = await prisma.user.findUnique({ where: { wallet: wallet.toLowerCase() } });
  if (!user) {
    user = await prisma.user.create({ data: { wallet: wallet.toLowerCase() } });
  }
  const encrypted = encryptMessages(mensajes, key);
  await prisma.conversation.create({
    data: {
      userId: user.id,
      messages: encrypted
    }
  });
  res.status(200).json({ message: 'Conversación guardada exitosamente.' });
});

// Obtener conversaciones descifradas
app.get('/conversations/:wallet', async (req: Request, res: Response) => {
  const { wallet } = req.params;
  if (!wallet) {
    res.status(400).json({ error: 'Wallet requerida.' });
    return;
  }
  const key = deriveKeyFromWallet(wallet);
  const user = await prisma.user.findUnique({
    where: { wallet: wallet.toLowerCase() },
    include: { conversations: true }
  });
  if (!user) {
    res.status(404).json({ error: 'No hay conversaciones para esta wallet.' });
    return;
  }
  // Descifrar cada conversación
  const conversacionesDescifradas = user.conversations.map((conv: any) => {
    try {
      const mensajes = decryptMessages(conv.messages, key);
      return { id: conv.id, mensajes };
    } catch (e) {
      return { id: conv.id, mensajes: [] };
    }
  });
  res.status(200).json({ conversaciones: conversacionesDescifradas });
});

// =======================
// ENDPOINTS DE AGENTE Y ACCIONES
// =======================
// Procesa acciones del agente Gemini
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
        // Listar archivos guardados del usuario
        const user = await prisma.user.findUnique({
          where: { wallet: wallet.toLowerCase() },
          include: { files: true }
        });
        if (user && user.files.length > 0) {
          const fileNamesList = user.files.map((f: any) => `- ${f.originalName}`).join("\n");
          result = `Estos son tus archivos guardados:\n${fileNamesList}\nPuedes previsualizar o eliminar cualquier archivo solicitándolo.`;
        } else {
          result = "No tienes archivos guardados por ahora.";
        }
        break;
      }
      case 'eliminar_archivo':
      case 'deletefile': {
        const { fileId } = params || {};
        if (!fileId) {
          result = 'No se proporcionó el ID del archivo.';
          break;
        }
        const file = await prisma.file.findUnique({ where: { id: fileId } });
        if (!file) {
          result = 'Archivo no encontrado.';
          break;
        }
        await prisma.file.delete({ where: { id: fileId } });
        result = `Archivo '${file.originalName}' eliminado exitosamente.`;
        break;
      }
      case 'ver_archivo':
      case 'viewsavedfile': {
        const { fileId, fileName } = params || {};
        if (!fileId && !fileName) {
          result = { success: false, error: 'No se proporcionó el ID o nombre del archivo.' };
          break;
        }
        
        // Si se proporciona fileId, buscar directamente en la base de datos
        if (fileId) {
          const file = await prisma.file.findUnique({ where: { id: fileId } });
          if (!file) {
            result = { success: false, error: 'Archivo no encontrado.' };
            break;
          }
          result = { 
            success: true, 
            file: {
              id: file.id,
              ipfsUrl: file.ipfsUrl,
              originalFileName: file.originalName,
              fileType: file.fileType
            }
          };
          break;
        }
        
        // Si se proporciona fileName, buscar en la blockchain y Pinata
        if (fileName) {
          // 1. Obtener los hashes de la blockchain para la wallet
          const hashes = await getFiles(wallet);
          // 2. Consultar a Pinata/IPFS para obtener metadatos y buscar el archivo por nombre
          let foundFile = null;
          let matches = [];
          const fileNameLower = fileName.toLowerCase();
          const hasExtension = fileName.includes('.') && fileName.split('.').pop().length <= 5;
          for (const hash of hashes) {
            try {
              const url = `https://gateway.pinata.cloud/ipfs/${hash.replace('ipfs://', '')}`;
              const head = await fetch(url, { method: 'HEAD' });
              const pinataName = head.headers.get('x-pinata-metadata') || '';
              const contentType = head.headers.get('content-type') || 'desconocido';
              if (hasExtension) {
                // Coincidencia exacta (nombre completo)
                if (pinataName.toLowerCase() === fileNameLower) {
                  foundFile = {
                    id: hash,
                    ipfsUrl: hash,
                    originalFileName: pinataName,
                    fileType: contentType
                  };
                  break;
                }
              } else {
                // Coincidencia parcial (sin extensión)
                if (pinataName.toLowerCase().startsWith(fileNameLower)) {
                  matches.push({
                    id: hash,
                    ipfsUrl: hash,
                    originalFileName: pinataName,
                    fileType: contentType
                  });
                }
              }
            } catch {}
          }
          if (!foundFile && matches.length === 1) {
            foundFile = matches[0];
          }
          if (!foundFile && matches.length > 1) {
            result = { success: false, error: `Se encontraron varios archivos que comienzan con '${fileName}'. Por favor, especifica el nombre completo con extensión: ${matches.map(f => f.originalFileName).join(', ')}` };
            break;
          }
          if (!foundFile) {
            result = { success: false, error: 'Archivo no encontrado en tu bóveda.' };
            break;
          }
          result = { success: true, file: foundFile };
          break;
        }
        
        result = { success: false, error: 'Parámetros inválidos para ver archivo.' };
        break;
      }
      case 'descargar_archivo':
      case 'downloadfile': {
        const { fileId } = params || {};
        if (!fileId) {
          result = 'No se proporcionó el ID del archivo.';
          break;
        }
        const file = await prisma.file.findUnique({ where: { id: fileId } });
        if (!file) {
          result = 'Archivo no encontrado.';
          break;
        }
        result = `Descarga tu archivo '${file.originalName}' aquí: ${file.ipfsUrl}`;
        break;
      }
      case 'subir_archivo':
      case 'uploadtopinata': {
        result = 'Para subir archivos, usa el endpoint /upload.';
        break;
      }
      case 'buscar_por_extension':
      case 'findfilesbyextension': {
        const { extension } = params || {};
        if (!extension) {
          result = 'No se proporcionó la extensión.';
          break;
        }
        const user = await prisma.user.findUnique({
          where: { wallet: wallet.toLowerCase() },
          include: { files: true }
        });
        if (user && user.files.length > 0) {
          const filtered = user.files.filter((f: any) => f.originalName.endsWith(extension));
          if (filtered.length > 0) {
            const fileNamesList = filtered.map((f: any) => `- ${f.originalName}`).join("\n");
            result = `Estos son tus archivos ${extension} guardados:\n${fileNamesList}`;
          } else {
            result = `No tienes archivos guardados con extensión ${extension}.`;
          }
        } else {
          result = "No tienes archivos guardados por ahora.";
        }
        break;
      }
      case 'confirmar_subida':
      case 'confirmfileupload': {
        const { fileName, ipfsUrl } = params || {};
        if (!fileName || !ipfsUrl) {
          result = 'Faltan datos para confirmar la subida.';
          break;
        }
        result = `Archivo '${fileName}' subido correctamente: ${ipfsUrl}`;
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

// =======================
// ENDPOINT GEMINI (NO MODIFICAR LÓGICA)
// =======================
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
    const promptPath = path.join(process.cwd(), 'src', 'agent', 'prompt', 'README.md');
    const instructionsPath = path.join(process.cwd(), 'src', 'agent', 'instructions', 'README.md');
    let promptBase = '';
    let instructions = '';
    try {
      promptBase = fsSync.readFileSync(promptPath, 'utf8');
    } catch (e) {
      promptBase = 'Eres un asistente para gestión de archivos en bóveda blockchain.';
    }
    try {
      instructions = fsSync.readFileSync(instructionsPath, 'utf8');
    } catch (e) {
      instructions = '';
    }
    // Obtener conversación previa de la base de datos (Prisma)
    let conversationHistory = '';
    if (wallet) {
      try {
        const user = await prisma.user.findUnique({
          where: { wallet: wallet.toLowerCase() },
          include: { conversations: true }
        });
        if (user && user.conversations.length > 0) {
          // Tomar la última conversación
          const lastConv = user.conversations[user.conversations.length - 1];
          // Descifrar mensajes
          const key = deriveKeyFromWallet(wallet);
          const mensajes = decryptMessages(lastConv.messages, key);
          // Formatear historial para el prompt
          conversationHistory = '\n\n---\n\nHistorial de conversación previa:\n' + mensajes.map((m: any) => `${m.rol === 'usuario' ? 'Usuario' : 'Gemini'}: ${m.mensaje}`).join('\n');
        }
      } catch (e) {
        conversationHistory = '';
      }
    }
    // Concatenar prompt base, instrucciones, historial (si existe) y el input del usuario
    const prompt = `${promptBase}\n\n${instructions}${conversationHistory}\n\nUsuario: ${input}`;
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

// =======================
// HEALTH CHECK Y SERVIDOR
// =======================
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Inicializar servidor
  app.listen(port, () => {
    console.log(`Servidor backend escuchando en http://localhost:${port}`);
  });