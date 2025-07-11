// =======================
// IMPORTS Y DEPENDENCIAS
// =======================
import { express, cors, multer, dotenv, axios, CryptoJS, prisma } from "./imports";

interface MensajeConversacion {
  rol: 'usuario' | 'gemini';
  mensaje: string;
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

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
}));
app.use(express.json());

const upload = multer();

// --- Endpoints de conversaciones con Prisma ---
app.post('/conversations', async (req, res) => {
  try {
    const { wallet, mensajes } = req.body;
    if (!wallet || !mensajes || !Array.isArray(mensajes)) {
      res.status(400).json({ error: 'Faltan datos requeridos (wallet, mensajes).' });
      return;
    }

    // Buscar o crear usuario
    let user = await prisma.user.findUnique({
      where: { wallet: wallet.toLowerCase() }
    });

    if (!user) {
      user = await prisma.user.create({
        data: { wallet: wallet.toLowerCase() }
      });
    }

    // Cifrar mensajes
    const key = deriveKeyFromWallet(wallet);
    const encryptedMessages = encryptMessages(mensajes, key);

    // Guardar conversación
    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        messages: encryptedMessages
      }
    });

    res.status(200).json({ 
      message: 'Conversación guardada exitosamente.',
      conversationId: conversation.id
    });
  } catch (error) {
    console.error('Error al guardar conversación:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.get('/conversations/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    if (!wallet) {
      res.status(400).json({ error: 'Wallet requerida.' });
      return;
    }

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { wallet: wallet.toLowerCase() },
      include: { conversations: true }
    });

    if (!user) {
      res.status(404).json({ error: 'No hay conversaciones para esta wallet.' });
      return;
    }

    // Descifrar conversaciones
    const key = deriveKeyFromWallet(wallet);
    const conversacionesDescifradas = user.conversations.map((conv: any) => {
      try {
        const mensajes = decryptMessages(conv.messages, key);
        return { 
          id: conv.id, 
          mensajes,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt
        };
      } catch (e) {
        return { 
          id: conv.id, 
          mensajes: [],
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt
        };
      }
    });

    res.status(200).json({ conversaciones: conversacionesDescifradas });
  } catch (error) {
    console.error('Error al obtener conversaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// --- Endpoints de archivos con Prisma ---
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No se proporcionó ningún archivo.' });
      return;
    }

    const pinataJWT = process.env.PINATA_JWT;
    if (!pinataJWT) {
      res.status(500).json({ error: 'La clave de API de Pinata no está configurada.' });
      return;
    }

    const { originalFileName, fileType, wallet } = req.body;
    if (!originalFileName || !fileType || !wallet) {
      res.status(400).json({ error: 'Faltan metadatos esenciales.' });
      return;
    }

    // Buscar o crear usuario
    let user = await prisma.user.findUnique({
      where: { wallet: wallet.toLowerCase() }
    });

    if (!user) {
      user = await prisma.user.create({
        data: { wallet: wallet.toLowerCase() }
      });
    }

    // Subir a Pinata
    const formData = new FormData();
    formData.append('file', new Blob([req.file.buffer]), originalFileName);

    const pinataResponse = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
      headers: {
        'Authorization': `Bearer ${pinataJWT}`,
        'Content-Type': 'multipart/form-data'
      }
    });

    const ipfsHash = pinataResponse.data.IpfsHash;
    const ipfsUrl = `ipfs://${ipfsHash}`;

    // Guardar en base de datos
    const file = await prisma.file.create({
      data: {
        ipfsUrl,
        originalName: originalFileName,
        fileType,
        fileSize: req.file.size,
        userId: user.id
      }
    });

    res.status(200).json({
      message: 'Archivo subido exitosamente.',
      file: {
        id: file.id,
        ipfsUrl: file.ipfsUrl,
        originalName: file.originalName,
        fileType: file.fileType,
        fileSize: file.fileSize
      }
    });
  } catch (error) {
    console.error('Error al subir archivo:', error);
    res.status(500).json({ error: 'Error al subir archivo.' });
  }
});

app.get('/files/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    if (!wallet) {
      res.status(400).json({ error: 'Wallet requerida.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { wallet: wallet.toLowerCase() },
      include: { files: true }
    });

    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    res.status(200).json({ files: user.files });
  } catch (error) {
    console.error('Error al obtener archivos:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.get('/files/:wallet/:fileId', async (req, res) => {
  try {
    const { wallet, fileId } = req.params;
    if (!wallet || !fileId) {
      res.status(400).json({ error: 'Wallet y fileId requeridos.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { wallet: wallet.toLowerCase() },
      include: { files: true }
    });

    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    const file = user.files.find((f: any) => f.id === fileId);
    if (!file) {
      res.status(404).json({ error: 'Archivo no encontrado.' });
      return;
    }

    res.status(200).json({ file });
  } catch (error) {
    console.error('Error al obtener archivo:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.delete('/files/:wallet/:fileId', async (req, res) => {
  try {
    const { wallet, fileId } = req.params;
    if (!wallet || !fileId) {
      res.status(400).json({ error: 'Wallet y fileId requeridos.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { wallet: wallet.toLowerCase() }
    });

    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    // Verificar que el archivo pertenece al usuario
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId: user.id
      }
    });

    if (!file) {
      res.status(404).json({ error: 'Archivo no encontrado.' });
      return;
    }

    // Eliminar archivo
    await prisma.file.delete({
      where: { id: fileId }
    });

    res.status(200).json({ message: 'Archivo eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar archivo:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Inicializar servidor
async function startServer() {
  try {
    // Verificar conexión a la base de datos
    await prisma.$connect();
    console.log('✅ Conectado a la base de datos SQLite');

    app.listen(port, () => {
      console.log(`🚀 Servidor corriendo en puerto ${port}`);
      console.log(`📁 Base de datos: SQLite con Prisma`);
      console.log(`🌐 CORS origin: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();

// Manejo graceful de cierre
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await prisma.$disconnect();
  process.exit(0);
}); 