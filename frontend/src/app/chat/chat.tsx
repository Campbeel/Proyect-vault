"use client";

// =======================
// IMPORTS Y DEPENDENCIAS
// =======================
import {
  useAccount,
  useRouter,
  useEffect,
  useRef,
  useState,
  useCallback,
  axios,
  useDisconnect
} from "../../imports";
import React from "react";

// =======================
// TIPOS Y MODELOS
// =======================
interface Message {
  sender: "user" | "agente";
  text?: string;
  fileUrl?: string;
  fileType?: string;
  savedFileId?: string;
  downloadInfo?: {
    gatewayUrl: string;
    originalName: string;
    isAvailable: boolean;
    warning?: string;
  };
}

interface SavedFile {
  id: string;
  ipfsUrl: string;
  originalFileName: string;
  fileType: string;
}

// =======================
// COMPONENTE SNACKBAR (notificaciones)
// =======================
function Snackbar({ message, onClose }: { message: string, onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "2rem",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#16a34a",
        color: "white",
        padding: "12px 24px",
        borderRadius: "1rem",
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        zIndex: 50,
        fontWeight: 600,
        fontSize: "1rem"
      }}
    >
      {message}
      <button
        style={{
          marginLeft: "16px",
          color: "white",
          fontWeight: "bold",
          background: "none",
          border: "none",
          cursor: "pointer"
        }}
        onClick={onClose}
      >X</button>
    </div>
  );
}

// =======================
// COMPONENTE PRINCIPAL DE CHAT
// =======================
export default function ChatPage() {
  // Hooks de conexión y navegación
  const { isConnected, address } = useAccount();
  const router = useRouter();
  const { disconnect } = useDisconnect();

  // Estado de mensajes y archivos
  const [messages, setMessages] = useState<Message[]>([
    { sender: "agente", text: "¡Hola! ¿En qué puedo ayudarte hoy?" },
  ]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [comment, setComment] = useState<string>("");
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const [isViewingFile, setIsViewingFile] = useState(false);
  const [viewingFileUrl, setViewingFileUrl] = useState<string | null>(null);
  const [viewingFileName, setViewingFileName] = useState<string | null>(null);
  const [viewingFileType, setViewingFileType] = useState<string | null>(null);
  const [fileAvailability, setFileAvailability] = useState<{
    isAvailable: boolean;
    warning?: string;
  } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  // =======================
  // FUNCIONES DE CONVERSACIÓN Y CIFRADO
  // =======================
  const saveConversation = useCallback(async () => {
    if (!address || messages.length === 0) return;
    try {
      await axios.post("http://localhost:5000/conversations", {
        wallet: address,
        mensajes: messages
      });
    } catch {
      console.error("Error guardando conversación:");
    }
  }, [address, messages]);

  useEffect(() => {}, []);
  useEffect(() => { setIsMounted(true); }, []);

  const establishSessionKey = useCallback(async (): Promise<string | null> => {
    if (!address) return null;
    return "dummy-session-key";
  }, [address]);

  useEffect(() => {
    if (isConnected) {
      establishSessionKey();
    }
  }, [isConnected, address, establishSessionKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  const handleViewFile = useCallback(async (fileToView: SavedFile) => {
    setIsViewingFile(true);
    setFileAvailability(null);
    try {
      const hash = fileToView.ipfsUrl.replace('ipfs://', '');
      const response = await axios.get(`http://localhost:5000/api/files/hash/${hash}?wallet=${address}`);
      if (response.data && response.data.success) {
        const fileData = response.data.file;
        setViewingFileUrl(fileData.gatewayUrl);
        setViewingFileName(fileData.originalFileName);
        setViewingFileType(fileData.fileType);
        setFileAvailability({
          isAvailable: fileData.isAvailable,
          warning: fileData.warning
        });
        if (!fileData.isAvailable) {
          setSnackbar(`Advertencia: El archivo "${fileData.originalFileName}" puede no estar disponible en este momento.`);
        }
      } else {
        setViewingFileUrl(fileToView.ipfsUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/'));
        setViewingFileName(fileToView.originalFileName);
        setViewingFileType(fileToView.fileType);
        setFileAvailability({
          isAvailable: false,
          warning: 'No se pudo verificar la disponibilidad del archivo.'
        });
        setSnackbar('Advertencia: No se pudo verificar la disponibilidad del archivo.');
      }
    } catch (error) {
      console.error('Error al verificar archivo:', error);
      setViewingFileUrl(fileToView.ipfsUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/'));
      setViewingFileName(fileToView.originalFileName);
      setViewingFileType(fileToView.fileType);
      setFileAvailability({
        isAvailable: false,
        warning: 'Error al verificar el archivo. Intentando mostrar con datos locales.'
      });
      setSnackbar('Error al verificar el archivo. Intentando mostrar con datos locales.');
    }
  }, [address]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.sender === 'agente' && lastMsg.text) {
      let fileName: string | null = null;
      if (typeof lastMsg.text === 'string' && lastMsg.text.includes('Preparando previsualización de')) {
        const match = lastMsg.text.match(/Preparando previsualización de\s*"([^"]+)"/);
        if (match) fileName = match[1] || null;
      } else if (typeof lastMsg.text === 'string' && lastMsg.text.includes('Puedes descargar')) {
        const match = lastMsg.text.match(/Puedes descargar\s*"([^"]+)"/);
        if (match) fileName = match[1] || null;
      } else if (typeof lastMsg.text === 'string' && /mu[ée]strame|muestrame|necesito ver|quiero ver el contenido|quiero descargar/i.test(lastMsg.text)) {
        const match = lastMsg.text.match(/(?:mu[ée]strame|muestrame|necesito ver|quiero ver el contenido|quiero descargar)[^\w\d]*"([^"]+)"|(?:mu[ée]strame|muestrame|necesito ver|quiero ver el contenido|quiero descargar)[^\w\d]*([\w\d\.\-\s]+\.[a-zA-Z0-9]+)/i);
        if (match) fileName = (match[1] || match[2]) || null;
        if (typeof fileName === "string") fileName = fileName.trim();
      }
      if (fileName) {
        const file = savedFiles.find(f => f.originalFileName === fileName);
        if (file) {
          const mensajesInnecesarios = [
            'necesito su',
            'nombre exacto',
            'necesito saber si ya está subido a pinata',
            '¿podrías confirmarme si el archivo',
            'deberás subirlo usando la función uploadtopinata',
            'primero debes hacerlo a través de la función uploadtopinata',
            'puedo usar la función viewsavedfile',
            'necesito el id o el nombre con el que fue guardado',
            'necesito el id o el nombre',
            '¿podrías proporcionarme alguno de estos datos?',
            'puedo usar la función viewsavedfile para mostrarte una vista previa',
            'puedo usar la función viewsavedfile para mostrarte el archivo',
            'subido a pinata',
            'subirlo usando la función uploadtopinata',
            'usando la función uploadtopinata',
            'viewsavedfile'
          ];
          const texto = lastMsg.text ?? '';
          if (
            texto &&
            mensajesInnecesarios.some(frag => texto.toLowerCase().includes(frag.toLowerCase()))
          ) {
            setMessages(msgs => msgs.slice(0, -1));
          }
          handleViewFile(file);
        }
      }
    }
  }, [messages, savedFiles, handleViewFile]);

  if (!isMounted) return null;

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() && selectedFiles.length === 0) return;

    // --- SUBIDA DE ARCHIVOS ---
    if (selectedFiles.length > 0) {
      setUploadingFile(true);
      try {
        for (const file of selectedFiles) {
          if (!address) {
            setSnackbar('Conecta tu wallet antes de subir archivos.');
            return;
          }
          const formData = new FormData();
          formData.append('file', file, file.name);
          formData.append('wallet', address);
          const response = await axios.post('http://localhost:5000/upload', formData);
          if (response.data && response.data.ipfsUrl) {
            const ipfsHash = response.data.ipfsUrl;
            const message = `Guardar archivo: ${ipfsHash}`;
            let signature = null;
            if (window.ethereum && address) {
              signature = await (window.ethereum as any).request({
                method: 'personal_sign',
                params: [message, address],
              });
            }
            await axios.post('http://localhost:5000/api/files', {
              ipfsHash,
              message,
              signature,
              wallet: address,
            });
            setSnackbar(`Archivo "${file.name}" subido correctamente.`);
          }
        }
        setSelectedFiles([]);
        setFilePreviews([]);
        setComment("");
      } catch {
        setSnackbar('Error al subir el archivo.');
      } finally {
        setUploadingFile(false);
      }
      return;
    }

    // --- FLUJO CON GEMINI ---
    setMessages((msgs) => [...msgs, { sender: "user", text: input }]);
    setInput("");
    try {
      const geminiResponse = await geminiApi(input, address);

      function extractJsonFromGeminiResponse(response: string) {
        const match = response.match(/```json\s*([\s\S]+?)```/i);
        if (match) {
          try {
            return JSON.parse(match[1]);
          } catch {
            return null;
          }
        }
        try {
          return JSON.parse(response);
        } catch {
          return null;
        }
      }

      const parsed = extractJsonFromGeminiResponse(geminiResponse);

      if (parsed && typeof parsed === 'object' && 'action' in parsed) {
        setMessages((msgs) => [...msgs, { sender: "agente", text: parsed.respuesta || "" }]);
        if (parsed.action) {
          if (parsed.action === 'listar_archivos') {
            try {
              const res = await axios.get(`http://localhost:5000/files/${address}`);
              if (res.data && res.data.files) {
                setSavedFiles(res.data.files);
              } else {
                setSavedFiles([]);
              }
            } catch {
              setSavedFiles([]);
            }
          }
          const backendResponse = await axios.post('http://localhost:5000/chat/agent', {
            action: parsed.action,
            params: parsed.metadata,
            wallet: address || ""
          });

          if (
            parsed.action === 'ver_archivo' &&
            backendResponse.data &&
            typeof backendResponse.data === 'object' &&
            backendResponse.data.success &&
            backendResponse.data.file
          ) {
            const fileData = backendResponse.data.file;
            if (fileData && fileData.ipfsUrl && (fileData.originalFileName || fileData.originalName) && fileData.fileType) {
              const fileToView: SavedFile = {
                id: fileData.id || fileData.ipfsUrl,
                ipfsUrl: fileData.ipfsUrl,
                originalFileName: fileData.originalFileName || fileData.originalName,
                fileType: fileData.fileType
              };
              handleViewFile(fileToView);
            } else {
              setMessages((msgs) => [...msgs, { sender: "agente", text: "No se pudo obtener la información del archivo para previsualizar." }]);
            }
          } else {
            if (backendResponse.data && typeof backendResponse.data === 'object' && backendResponse.data.error) {
              setMessages((msgs) => [...msgs, { sender: "agente", text: backendResponse.data.error }]);
            } else if (backendResponse.data && typeof backendResponse.data === 'object' && backendResponse.data.message) {
              setMessages((msgs) => [...msgs, { sender: "agente", text: backendResponse.data.message, downloadInfo: backendResponse.data.downloadInfo }]);
            } else {
              setMessages((msgs) => [...msgs, { sender: "agente", text: String(backendResponse.data) }]);
            }
          }
        }
      } else {
        const textOnly = geminiResponse.split("```json")[0].trim();
        setMessages((msgs) => [...msgs, { sender: "agente", text: textOnly }]);
      }
    } catch {
      setMessages((msgs) => [...msgs, {
        sender: "agente",
        text: "Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo."
      }]);
    }
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newSelectedFiles = Array.from(files);
      setSelectedFiles((prevFiles) => [...prevFiles, ...newSelectedFiles]);
      newSelectedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreviews((prevPreviews) => [...prevPreviews, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setInput("");
    }
  };

  const handleCloseFileView = () => {
    setIsViewingFile(false);
    setViewingFileUrl(null);
    setViewingFileName(null);
    setViewingFileType(null);
    setFileAvailability(null);
  };

  const handleDisconnect = async () => {
    await saveConversation();
    disconnect();
    router.push("/");
  };

  const handleDeleteFile = async (file: SavedFile) => {
    setActionLoading(file.id);
    try {
      const hash = file.ipfsUrl;
      const message = `Eliminar archivo: ${hash}`;
      if (window.ethereum && address) {
        await (window.ethereum as any).request({
          method: 'personal_sign',
          params: [message, address],
        });
      }
      const response = await axios.post('http://localhost:5000/chat/agent', {
        action: 'eliminar_archivo',
        params: { fileName: file.originalFileName },
        wallet: address
      });
      if (response.data && response.data.success) {
        setSavedFiles(prev => prev.filter(f => f.id !== file.id));
        setSnackbar(response.data.message || `Archivo "${file.originalFileName}" eliminado correctamente.`);
      } else {
        const errorMsg = response.data?.error || 'Error al eliminar el archivo.';
        setSnackbar(errorMsg);
      }
    } catch (error) {
      console.error('Error al eliminar archivo:', error);
      setSnackbar('Error al eliminar el archivo.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadFile = async (file: SavedFile) => {
    setActionLoading(file.id);
    try {
      const response = await axios.post('http://localhost:5000/chat/agent', {
        action: 'descargar_archivo',
        params: { fileName: file.originalFileName },
        wallet: address
      });
      if (response.data && response.data.success) {
        const downloadInfo = response.data.downloadInfo;
        if (downloadInfo.isAvailable) {
          const fileResponse = await fetch(downloadInfo.gatewayUrl);
          if (!fileResponse.ok) throw new Error('No se pudo descargar el archivo');
          const blob = await fileResponse.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = downloadInfo.originalName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          setSnackbar(`Archivo "${downloadInfo.originalName}" descargado correctamente.`);
        } else {
          setSnackbar(`Advertencia: ${downloadInfo.warning || 'El archivo puede no estar disponible.'}`);
        }
      } else {
        const errorMsg = response.data?.error || 'Error al procesar la descarga.';
        setSnackbar(errorMsg);
      }
    } catch (error) {
      console.error('Error al descargar archivo:', error);
      setSnackbar('Error al descargar el archivo.');
    } finally {
      setActionLoading(null);
    }
  };

  if (!address) {
    return (
      <main
        style={{
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(to bottom, #111827 0%, #000 100%)"
        }}
      >
        <div
          style={{
            background: "#1f2937",
            padding: "32px",
            borderRadius: "18px",
            color: "white",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            border: "1px solid #374151"
          }}
        >
          <svg width="40" height="40" fill="none" stroke="#facc15" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a5 5 0 00-10 0v2a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2z" />
          </svg>
          <span style={{ fontFamily: "monospace", fontSize: "1.125rem" }}>Wallet no conectada</span>
          <button
            onClick={() => window.location.href = "/"}
            style={{
              padding: "12px 32px",
              background: "linear-gradient(to right, #22d3ee, #6366f1)",
              color: "white",
              borderRadius: "12px",
              fontWeight: 500,
              fontSize: "1rem",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
            }}
          >
            Conectar Wallet
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(to bottom, #111827 0%, #000 100%)",
        position: "relative"
      }}
    >
      {/* Botón de desconexión */}
      <div style={{ position: "absolute", top: 24, right: 32, zIndex: 50 }}>
        <button
          onClick={handleDisconnect}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 20px",
            background: "linear-gradient(to right, #ef4444, #ec4899)",
            color: "white",
            borderRadius: "12px",
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
          }}
        >
          <svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
          </svg>
          Desconectar
        </button>
      </div>

      {/* Mensajes */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              width: "100%",
              display: "flex",
              justifyContent: msg.sender === "user" ? "flex-end" : "flex-start"
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "18px",
                maxWidth: msg.fileUrl || msg.savedFileId ? "320px" : "80%",
                background: msg.sender === "user" ? "#16a34a" : "#27272a",
                color: "white",
                marginLeft: msg.sender === "user" ? "16px" : "0",
                marginRight: msg.sender === "user" ? "0" : "16px",
                marginTop: "4px",
                marginBottom: "4px",
                wordBreak: "break-word"
              }}
            >
              {typeof msg.text === 'string' ? (
                <>
                  <span style={{ whiteSpace: 'pre-line' }}>{msg.text}</span>
                  {msg.downloadInfo && (
                    <button
                      onClick={async () => {
                        if (msg.downloadInfo?.isAvailable) {
                          const fileResponse = await fetch(msg.downloadInfo?.gatewayUrl);
                          const blob = await fileResponse.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = msg.downloadInfo?.originalName;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          window.URL.revokeObjectURL(url);
                        } else {
                          alert(msg.downloadInfo?.warning || 'El archivo no está disponible.');
                        }
                      }}
                      style={{
                        marginLeft: "8px",
                        padding: "4px 12px",
                        background: "#2563eb",
                        color: "white",
                        borderRadius: "8px",
                        border: "none",
                        fontSize: "0.85rem",
                        cursor: "pointer"
                      }}
                    >
                      Descargar archivo
                    </button>
                  )}
                </>
              ) : (
                <span style={{ color: 'red' }}>[Respuesta no textual]</span>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input de archivos oculto */}
      <input
        type="file"
        id="hiddenFileInput"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        multiple
        accept="*/*"
      />

      {/* Vista previa de archivos seleccionados */}
      {selectedFiles.length > 0 && (
        <div style={{
          padding: "16px",
          borderTop: "1px solid #27272a",
          background: "#18181b",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }}>
          <p style={{ color: "white", marginBottom: "16px", fontSize: "1.125rem", fontWeight: 500 }}>Vista previa de archivos:</p>
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "center",
            marginBottom: "24px"
          }}>
            {selectedFiles.map((file, index) => (
              <div key={file.name + index} style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "12px",
                border: "1px solid #374151",
                borderRadius: "18px",
                background: "#1f2937",
                boxShadow: "0 2px 12px rgba(0,0,0,0.15)"
              }}>
                {file.type.startsWith('image') && (
                  <img src={filePreviews[index]} alt={file.name} style={{
                    maxWidth: "256px",
                    maxHeight: "160px",
                    objectFit: "contain",
                    borderRadius: "12px"
                  }} />
                )}
                {file.type.startsWith('video') && (
                  <video controls src={filePreviews[index]} style={{
                    maxWidth: "256px",
                    maxHeight: "160px",
                    objectFit: "contain",
                    borderRadius: "12px"
                  }} />
                )}
                {!file.type.startsWith('image') && !file.type.startsWith('video') && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "128px",
                    height: "128px",
                    background: "#374151",
                    borderRadius: "12px"
                  }}>
                    <svg width="48" height="48" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )}
                <p style={{
                  color: "#d1d5db",
                  fontSize: "0.875rem",
                  marginTop: "8px",
                  maxWidth: "200px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}>{file.name}</p>
                <p style={{ color: "#9ca3af", fontSize: "0.75rem" }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                    setFilePreviews(prev => prev.filter((_, i) => i !== index));
                  }}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    padding: "4px",
                    color: "#f87171",
                    background: "#18181b",
                    borderRadius: "50%",
                    border: "none",
                    cursor: "pointer"
                  }}
                  title="Eliminar archivo"
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleSend} style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}>
            <label
              htmlFor="hiddenFileInput"
              style={{
                padding: "12px 24px",
                background: "#2563eb",
                color: "white",
                borderRadius: "12px",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                marginBottom: "16px"
              }}
            >
              <svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Adjuntar otro archivo
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Añadir un comentario (opcional)"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "12px",
                border: "1px solid #374151",
                background: "#1f2937",
                color: "white",
                marginBottom: "16px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                outline: "none"
              }}
            />
            <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => { setSelectedFiles([]); setFilePreviews([]); setComment(""); }}
                style={{
                  padding: "12px 24px",
                  background: "#dc2626",
                  color: "white",
                  borderRadius: "12px",
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                }}
                disabled={uploadingFile}
              >
                <svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancelar
              </button>
              <button
                type="submit"
                style={{
                  padding: "12px 24px",
                  background: "#16a34a",
                  color: "white",
                  borderRadius: "12px",
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                }}
                disabled={uploadingFile}
              >
                {uploadingFile ? (
                  <>
                    <svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"></circle>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"></path>
                    </svg>
                    Subiendo...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Enviar Archivos
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Formulario de mensaje */}
      {!selectedFiles.length && (
        <form
          onSubmit={handleSend}
          style={{
            display: "flex",
            gap: "8px",
            padding: "16px",
            borderTop: "1px solid #27272a",
            background: "#18181b",
            position: "relative"
          }}
        >
          <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center", gap: "8px" }}>
            <label
              htmlFor="hiddenFileInput"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                cursor: "pointer",
                background: "#23272f"
              }}
              tabIndex={-1}
            >
              <svg width="24" height="24" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l7.07-7.07a4 4 0 00-5.656-5.657l-7.071 7.07a6 6 0 108.485 8.486L19 13" />
              </svg>
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe un mensaje..."
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: "12px",
                border: "1px solid #374151",
                background: "#18181b",
                color: "white",
                outline: "none"
              }}
            />
            <button
              type="submit"
              style={{
                padding: "12px 24px",
                background: "#16a34a",
                color: "white",
                borderRadius: "12px",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
              }}
            >
              <svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Enviar
            </button>
          </div>
        </form>
      )}

      {/* Snackbar de confirmación visual */}
      {snackbar && <Snackbar message={snackbar} onClose={() => setSnackbar(null)} />}

      {/* Vista de archivo */}
      {isViewingFile && viewingFileUrl && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.8)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          onClick={handleCloseFileView}
        >
          <div
            style={{
              background: "#18181b",
              borderRadius: "18px",
              padding: "32px",
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "auto",
              position: "relative"
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={handleCloseFileView}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
              title="Cerrar"
            >
              ×
            </button>
            <h2 style={{ color: "white", marginBottom: "16px" }}>{viewingFileName}</h2>
            {viewingFileType?.startsWith("image") ? (
              <img
                src={viewingFileUrl}
                alt={viewingFileName || ""}
                style={{ maxWidth: "80vw", maxHeight: "70vh", borderRadius: "12px" }}
              />
            ) : viewingFileType?.startsWith("video") ? (
              <video
                src={viewingFileUrl}
                controls
                style={{ maxWidth: "80vw", maxHeight: "70vh", borderRadius: "12px" }}
              />
            ) : viewingFileType?.includes("pdf") ? (
              <iframe
                src={viewingFileUrl}
                title={viewingFileName || ""}
                style={{ width: "80vw", height: "70vh", border: "none", borderRadius: "12px", background: "white" }}
              />
            ) : (
              <a
                href={viewingFileUrl}
                download={viewingFileName || undefined}
                style={{
                  color: "#22d3ee",
                  fontWeight: 500,
                  fontSize: "1.1rem",
                  textDecoration: "underline"
                }}
              >
                Descargar archivo
              </a>
            )}
            {fileAvailability?.warning && (
              <div style={{ color: "#facc15", marginTop: "16px" }}>
                {fileAvailability.warning}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// Conexión real a Gemini (proxy backend)
async function geminiApi(input: string, wallet?: string) {
  const response = await fetch("http://localhost:5000/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, wallet })
  });
  const data = await response.json();
  return data?.text || "No se pudo obtener respuesta de Gemini.";
}