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
  const FormData = require('form-data');
  const formData = new FormData();
  formData.append('file', req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype
  });
  
  // Agregar metadata personalizada con información completa del archivo
  const metadata = {
    name: originalFileName,
    keyvalues: {
      type: fileType,
      size: req.file.size.toString(),
      uploadedBy: wallet.toLowerCase(),
      uploadedAt: new Date().toISOString()
    }
  };
  formData.append('pinataMetadata', JSON.stringify(metadata));
  
  try {
    const pinataResponse = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        maxBodyLength: Infinity,
        headers: {
          'Authorization': `Bearer ${pinataJWT}`,
          ...formData.getHeaders(), // Asegura el header correcto
        },
      }
    );
    console.log('Respuesta de Pinata al subir archivo:', pinataResponse.data);
    const ipfsHash = pinataResponse.data.IpfsHash;
    const ipfsUrl = `ipfs://${ipfsHash}`;
    
    // Guardar en base de datos con información completa
    const file = await prisma.file.create({
      data: {
        ipfsUrl,
        originalName: originalFileName,
        fileType,
        fileSize: req.file.size,
        userId: user.id,
        // Agregar campos adicionales para mejor tracking
        pinataHash: ipfsHash,
        uploadedAt: new Date()
      }
    });
    
    res.status(200).json({ 
      ipfsUrl, 
      file,
      metadata: {
        hash: ipfsHash,
        gatewayUrl: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
        fileName: originalFileName,
        fileType: fileType,
        fileSize: req.file.size
      }
    });
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

// Nuevo endpoint para obtener archivo por hash
app.get('/api/files/hash/:hash', async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    const { wallet } = req.query;
    
    if (!hash) {
      return res.status(400).json({ error: 'Hash requerido.' });
    }
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet requerida para verificar propiedad.' });
    }
    
    // Verificar que el archivo pertenece al usuario
    const user = await prisma.user.findUnique({
      where: { wallet: wallet.toString().toLowerCase() },
      include: { files: true }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    
    // Buscar el archivo en la base de datos del usuario
    const file = user.files.find(f => f.pinataHash === hash || f.ipfsUrl.includes(hash));
    
    if (!file) {
      return res.status(404).json({ error: 'Archivo no encontrado o no tienes permisos.' });
    }
    
    // Obtener metadata actualizada desde Pinata
    const pinataJWT = process.env.PINATA_JWT;
    try {
      const metaRes = await axios.get(`https://api.pinata.cloud/data/pinList?hashContains=${hash}`,
        { headers: { 'Authorization': `Bearer ${pinataJWT}` } });
      
      const pinataItem = metaRes.data.rows && metaRes.data.rows[0];
      
      if (!pinataItem) {
        return res.status(404).json({ error: 'Archivo no encontrado en Pinata.' });
      }
      
      // Verificar que el archivo está disponible
      const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${hash}`;
      const availabilityCheck = await axios.head(gatewayUrl, { timeout: 5000 });
      
      res.json({
        success: true,
        file: {
          id: file.id,
          ipfsUrl: `ipfs://${hash}`,
          originalFileName: pinataItem.metadata?.name || file.originalName,
          fileType: pinataItem.metadata?.keyvalues?.type || file.fileType,
          fileSize: file.fileSize,
          gatewayUrl: gatewayUrl,
          uploadedAt: file.uploadedAt,
          isAvailable: availabilityCheck.status === 200
        }
      });
      
    } catch (pinataError) {
      console.error('Error al verificar archivo en Pinata:', pinataError);
      // Si no se puede verificar en Pinata, devolver datos locales
      res.json({
        success: true,
        file: {
          id: file.id,
          ipfsUrl: file.ipfsUrl,
          originalFileName: file.originalName,
          fileType: file.fileType,
          fileSize: file.fileSize,
          gatewayUrl: `https://gateway.pinata.cloud/ipfs/${hash}`,
          uploadedAt: file.uploadedAt,
          isAvailable: false,
          warning: 'No se pudo verificar disponibilidad en Pinata'
        }
      });
    }
    
  } catch (error) {
    console.error('Error al obtener archivo por hash:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
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
        const { fileId, fileName } = params || {};
        if (!fileId && !fileName) {
          result = { success: false, error: 'No se proporcionó el ID o nombre del archivo.' };
          break;
        }
        
        try {
          let fileToDelete = null;
          
          // Si se proporciona fileId (hash), buscar directamente
          if (fileId) {
            const hash = fileId.replace('ipfs://', '');
            const user = await prisma.user.findUnique({
              where: { wallet: wallet.toLowerCase() },
              include: { files: true }
            });
            
            if (!user) {
              result = { success: false, error: 'Usuario no encontrado.' };
              break;
            }
            
            fileToDelete = user.files.find(f => f.pinataHash === hash || f.ipfsUrl.includes(hash));
            
            if (!fileToDelete) {
              result = { success: false, error: 'Archivo no encontrado o no tienes permisos.' };
              break;
            }
          }
          
          // Si se proporciona fileName, buscar por nombre
          if (fileName && !fileToDelete) {
            const user = await prisma.user.findUnique({
              where: { wallet: wallet.toLowerCase() },
              include: { files: true }
            });
            
            if (!user || user.files.length === 0) {
              result = { success: false, error: 'No tienes archivos guardados.' };
              break;
            }
            
            const fileNameLower = fileName.toLowerCase();
            const hasExtension = fileName.includes('.') && fileName.split('.').pop().length <= 5;
            
            // Buscar archivo por nombre exacto o parcial
            let matches = [];
            
            for (const file of user.files) {
              const fileLower = file.originalName.toLowerCase();
              
              if (hasExtension) {
                if (fileLower === fileNameLower) {
                  fileToDelete = file;
                  break;
                }
              } else {
                if (fileLower.startsWith(fileNameLower)) {
                  matches.push(file);
                }
              }
            }
            
            // Si no se encontró exacto pero hay una coincidencia parcial única
            if (!fileToDelete && matches.length === 1) {
              fileToDelete = matches[0];
            }
            
            // Si hay múltiples coincidencias, pedir especificación
            if (!fileToDelete && matches.length > 1) {
              const fileNames = matches.map(f => f.originalName).join(', ');
              result = { 
                success: false, 
                error: `Se encontraron varios archivos que comienzan con '${fileName}'. Por favor, especifica el nombre completo: ${fileNames}` 
              };
              break;
            }
            
            if (!fileToDelete) {
              result = { success: false, error: 'Archivo no encontrado en tu bóveda.' };
              break;
            }
          }
          
          if (!fileToDelete) {
            result = { success: false, error: 'No se pudo identificar el archivo a eliminar.' };
            break;
          }
          
          // Intentar eliminar de Pinata (opcional, ya que IPFS es inmutable)
          const hash = fileToDelete.pinataHash || fileToDelete.ipfsUrl.replace('ipfs://', '');
          const pinataJWT = process.env.PINATA_JWT;
          
          let pinataUnpinned = false;
          let pinataUnpinWarning = '';
          try {
            // Intentar unpin de Pinata (esto no elimina el archivo de IPFS, solo de Pinata)
            await axios.delete(`https://api.pinata.cloud/pinning/unpin/${hash}`,
              { headers: { 'Authorization': `Bearer ${pinataJWT}` } });
            console.log(`Archivo ${fileToDelete.originalName} unpinned de Pinata`);
            pinataUnpinned = true;
          } catch (pinataError) {
            pinataUnpinWarning = `No se pudo eliminar de Pinata (puede que ya no esté pinned): ${pinataError.message}`;
            console.log(pinataUnpinWarning);
          }
          
          // Eliminar de la base de datos local
          await prisma.file.delete({ where: { id: fileToDelete.id } });
          
          result = { 
            success: true, 
            message: `Archivo '${fileToDelete.originalName}' eliminado exitosamente.` + (pinataUnpinned ? '' : ' (Advertencia: no se pudo eliminar de Pinata)'),
            deletedFile: {
              id: fileToDelete.id,
              originalName: fileToDelete.originalName,
              ipfsUrl: fileToDelete.ipfsUrl
            },
            pinataUnpinned,
            pinataUnpinWarning: pinataUnpinWarning || undefined
          };
          
        } catch (error) {
          console.error('Error al eliminar archivo:', error);
          result = { success: false, error: 'Error al eliminar el archivo.' };
        }
        break;
      }
      case 'ver_archivo':
      case 'viewsavedfile': {
        const { fileId, fileName } = params || {};
        if (!fileId && !fileName) {
          result = { success: false, error: 'No se proporcionó el ID o nombre del archivo.' };
          break;
        }
        
        // Si se proporciona fileId (hash), usar el nuevo endpoint
        if (fileId) {
          try {
            const hash = fileId.replace('ipfs://', '');
            const fileResponse = await axios.get(`http://localhost:5000/api/files/hash/${hash}?wallet=${wallet}`);
            
            if (fileResponse.data && fileResponse.data.success) {
              result = {
                success: true,
                file: fileResponse.data.file
              };
            } else {
              result = { success: false, error: 'Archivo no encontrado o no tienes permisos.' };
            }
          } catch (error) {
            console.error('Error al obtener archivo por hash:', error);
            result = { success: false, error: 'Error al obtener el archivo.' };
          }
          break;
        }
        
        // Si se proporciona fileName, buscar en la base de datos local primero
        if (fileName) {
          try {
            const user = await prisma.user.findUnique({
              where: { wallet: wallet.toLowerCase() },
              include: { files: true }
            });
            
            if (!user || user.files.length === 0) {
              result = { success: false, error: 'No tienes archivos guardados.' };
              break;
            }
            
            const fileNameLower = fileName.toLowerCase();
            const hasExtension = fileName.includes('.') && fileName.split('.').pop().length <= 5;
            
            // Buscar archivo por nombre exacto o parcial
            let foundFile = null;
            let matches = [];
            
            for (const file of user.files) {
              const fileLower = file.originalName.toLowerCase();
              
              if (hasExtension) {
                if (fileLower === fileNameLower) {
                  foundFile = file;
                  break;
                }
              } else {
                if (fileLower.startsWith(fileNameLower)) {
                  matches.push(file);
                }
              }
            }
            
            // Si no se encontró exacto pero hay una coincidencia parcial única
            if (!foundFile && matches.length === 1) {
              foundFile = matches[0];
            }
            
            // Si hay múltiples coincidencias, pedir especificación
            if (!foundFile && matches.length > 1) {
              const fileNames = matches.map(f => f.originalName).join(', ');
              result = { 
                success: false, 
                error: `Se encontraron varios archivos que comienzan con '${fileName}'. Por favor, especifica el nombre completo: ${fileNames}` 
              };
              break;
            }
            
            if (!foundFile) {
              result = { success: false, error: 'Archivo no encontrado en tu bóveda.' };
              break;
            }
            
            // Usar el hash del archivo encontrado para obtener metadata actualizada
            const hash = foundFile.pinataHash || foundFile.ipfsUrl.replace('ipfs://', '');
            const fileResponse = await axios.get(`http://localhost:5000/api/files/hash/${hash}?wallet=${wallet}`);
            
            if (fileResponse.data && fileResponse.data.success) {
              result = {
                success: true,
                file: fileResponse.data.file
              };
            } else {
              // Si falla la verificación en Pinata, usar datos locales
              result = {
                success: true,
                file: {
                  id: foundFile.id,
                  ipfsUrl: foundFile.ipfsUrl,
                  originalFileName: foundFile.originalName,
                  fileType: foundFile.fileType,
                  fileSize: foundFile.fileSize,
                  gatewayUrl: `https://gateway.pinata.cloud/ipfs/${hash}`,
                  uploadedAt: foundFile.uploadedAt,
                  isAvailable: false,
                  warning: 'No se pudo verificar disponibilidad en Pinata'
                }
              };
            }
            
          } catch (error) {
            console.error('Error al buscar archivo por nombre:', error);
            result = { success: false, error: 'Error al buscar el archivo.' };
          }
          break;
        }
        
        result = { success: false, error: 'Parámetros inválidos para ver archivo.' };
        break;
      }
      case 'descargar_archivo':
      case 'downloadfile': {
        const { fileId, fileName } = params || {};
        if (!fileId && !fileName) {
          result = { success: false, error: 'No se proporcionó el ID o nombre del archivo.' };
          break;
        }
        
        try {
          let fileToDownload = null;
          
          // Si se proporciona fileId (hash), buscar directamente
          if (fileId) {
            const hash = fileId.replace('ipfs://', '');
            const user = await prisma.user.findUnique({
              where: { wallet: wallet.toLowerCase() },
              include: { files: true }
            });
            
            if (!user) {
              result = { success: false, error: 'Usuario no encontrado.' };
              break;
            }
            
            fileToDownload = user.files.find(f => f.pinataHash === hash || f.ipfsUrl.includes(hash));
            
            if (!fileToDownload) {
              result = { success: false, error: 'Archivo no encontrado o no tienes permisos.' };
              break;
            }
          }
          
          // Si se proporciona fileName, buscar por nombre
          if (fileName && !fileToDownload) {
            const user = await prisma.user.findUnique({
              where: { wallet: wallet.toLowerCase() },
              include: { files: true }
            });
            
            if (!user || user.files.length === 0) {
              result = { success: false, error: 'No tienes archivos guardados.' };
              break;
            }
            
            const fileNameLower = fileName.toLowerCase();
            const hasExtension = fileName.includes('.') && fileName.split('.').pop().length <= 5;
            
            // Buscar archivo por nombre exacto o parcial
            let matches = [];
            
            for (const file of user.files) {
              const fileLower = file.originalName.toLowerCase();
              
              if (hasExtension) {
                if (fileLower === fileNameLower) {
                  fileToDownload = file;
                  break;
                }
              } else {
                if (fileLower.startsWith(fileNameLower)) {
                  matches.push(file);
                }
              }
            }
            
            // Si no se encontró exacto pero hay una coincidencia parcial única
            if (!fileToDownload && matches.length === 1) {
              fileToDownload = matches[0];
            }
            
            // Si hay múltiples coincidencias, pedir especificación
            if (!fileToDownload && matches.length > 1) {
              const fileNames = matches.map(f => f.originalName).join(', ');
              result = { 
                success: false, 
                error: `Se encontraron varios archivos que comienzan con '${fileName}'. Por favor, especifica el nombre completo: ${fileNames}` 
              };
              break;
            }
            
            if (!fileToDownload) {
              result = { success: false, error: 'Archivo no encontrado en tu bóveda.' };
              break;
            }
          }
          
          if (!fileToDownload) {
            result = { success: false, error: 'No se pudo identificar el archivo a descargar.' };
            break;
          }
          
          // Verificar disponibilidad en Pinata
          const hash = fileToDownload.pinataHash || fileToDownload.ipfsUrl.replace('ipfs://', '');
          const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${hash}`;
          
          try {
            // Verificar que el archivo está disponible
            const availabilityCheck = await axios.head(gatewayUrl, { timeout: 5000 });
            
            if (availabilityCheck.status === 200) {
              result = { 
                success: true, 
                message: `Archivo '${fileToDownload.originalName}' disponible para descarga.`,
                downloadInfo: {
                  id: fileToDownload.id,
                  originalName: fileToDownload.originalName,
                  fileType: fileToDownload.fileType,
                  fileSize: fileToDownload.fileSize,
                  gatewayUrl: gatewayUrl,
                  ipfsUrl: fileToDownload.ipfsUrl,
                  isAvailable: true
                }
              };
            } else {
              result = { 
                success: false, 
                error: 'El archivo no está disponible para descarga en este momento.' 
              };
            }
          } catch (availabilityError) {
            console.error('Error al verificar disponibilidad:', availabilityError);
            // Si no se puede verificar, devolver información básica
            result = { 
              success: true, 
              message: `Archivo '${fileToDownload.originalName}' - puede que no esté disponible.`,
              downloadInfo: {
                id: fileToDownload.id,
                originalName: fileToDownload.originalName,
                fileType: fileToDownload.fileType,
                fileSize: fileToDownload.fileSize,
                gatewayUrl: gatewayUrl,
                ipfsUrl: fileToDownload.ipfsUrl,
                isAvailable: false,
                warning: 'No se pudo verificar disponibilidad'
              }
            };
          }
          
        } catch (error) {
          console.error('Error al procesar descarga:', error);
          result = { success: false, error: 'Error al procesar la descarga.' };
        }
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