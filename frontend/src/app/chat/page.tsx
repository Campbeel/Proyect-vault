"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { useDisconnect } from "wagmi";

interface Message {
  sender: "user" | "agente";
  text?: string;
  fileUrl?: string; // Mantener para compatibilidad de visualización si es necesario
  fileType?: string; // Mantener para compatibilidad de visualización si es necesario
  savedFileId?: string; // ID para vincular con un archivo guardado en el estado `savedFiles`
}

interface SavedFile {
  id: string; // Un ID único para el archivo guardado
  ipfsUrl: string;
  originalFileName: string;
  fileType: string;
}

// Snackbar para confirmaciones
function Snackbar({ message, onClose }: { message: string, onClose: () => void }) {
  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg z-50 animate-fade-in">
      {message}
      <button className="ml-4 text-white font-bold" onClick={onClose}>X</button>
    </div>
  );
}

export default function ChatPage() {
  const { isConnected, address } = useAccount();
  const router = useRouter();
  const { disconnect } = useDisconnect();
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
  const [isViewingFile, setIsViewingFile] = useState<boolean>(false);
  const [viewingFileUrl, setViewingFileUrl] = useState<string | null>(null);
  const [viewingFileName, setViewingFileName] = useState<string | null>(null);
  const [viewingFileType, setViewingFileType] = useState<string | null>(null);
  // Generar el nonce solo en el cliente para evitar hydration error
  const [nonce, setNonce] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // id del archivo en acción
  const [snackbar, setSnackbar] = useState<string | null>(null);

  useEffect(() => {
    // Solo se ejecuta en el cliente
    const n = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setNonce(n);
  }, []);

  useEffect(() => { setIsMounted(true); }, []);

  const establishSessionKey = useCallback(async (): Promise<string | null> => {
    // Solo retorna una clave ficticia, sin mensajes para el usuario
    if (!address) {
      return null;
    }
    return "dummy-session-key"; // Clave ficticia
  }, [address]);

  useEffect(() => {
    if (isConnected) {
      establishSessionKey();
    }
  }, [isConnected, address, establishSessionKey]);

  useEffect(() => {
    if (isConnected && address) {
      axios.get(`http://localhost:5000/files?owner=${address}`)
        .then(res => {
          if (res.data && res.data.files) {
            setSavedFiles(res.data.files);
          }
        })
        .catch(() => {
          setSavedFiles([]);
        });
    }
  }, [isConnected, address]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.sender === 'agente' && lastMsg.text) {
      let fileName = null;
      // Detectar frases comunes para ver o descargar archivos
      if (lastMsg.text.includes('Preparando previsualización de')) {
        const match = lastMsg.text.match(/Preparando previsualización de\s*"([^"]+)"/);
        if (match) fileName = match[1];
      } else if (lastMsg.text.includes('Puedes descargar')) {
        const match = lastMsg.text.match(/Puedes descargar\s*"([^"]+)"/);
        if (match) fileName = match[1];
      } else if (/mu[ée]strame|muestrame|necesito ver|quiero ver el contenido|quiero descargar/i.test(lastMsg.text)) {
        // Buscar el nombre del archivo entre comillas o después de la frase
        const match = lastMsg.text.match(/(?:mu[ée]strame|muestrame|necesito ver|quiero ver el contenido|quiero descargar)[^\w\d]*"([^"]+)"|(?:mu[ée]strame|muestrame|necesito ver|quiero ver el contenido|quiero descargar)[^\w\d]*([\w\d\.\-\s]+\.[a-zA-Z0-9]+)/i);
        if (match) fileName = match[1] || match[2];
        if (fileName) fileName = fileName.trim();
      }
      if (fileName) {
        const file = savedFiles.find(f => f.originalFileName === fileName);
        if (file) {
          // Elimina mensajes innecesarios del agente si el archivo existe
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
  }, [messages, savedFiles]);

  if (!isMounted) return null;

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    // Actualizada la condición para el envío
    if (!input.trim() && selectedFiles.length === 0) return;

    // --- SUBIDA DE ARCHIVOS ---
    if (selectedFiles.length > 0) {
      setUploadingFile(true);
      try {
        for (const file of selectedFiles) {
          const formData = new FormData();
          formData.append('file', file, file.name);
          formData.append('originalFileName', file.name);
          formData.append('fileType', file.type);
          // Puedes agregar más metadatos si lo necesitas

          const response = await axios.post('http://localhost:5000/upload', formData);
          if (response.data && response.data.ipfsUrl) {
            // Notificar a Gemini (el backend/chatbot) que el archivo fue subido
            await axios.post('http://localhost:5000/chat/agent', {
              message: `He subido el archivo ${file.name}`,
              fileUrl: response.data.ipfsUrl,
              fileType: file.type,
              owner: address || "",
              savedFilesContext: savedFiles
            });
            setSnackbar(`Archivo "${file.name}" subido correctamente.`);
          }
        }
        setSelectedFiles([]);
        setFilePreviews([]);
        setComment("");
      } catch (error) {
        setSnackbar('Error al subir el archivo.');
      } finally {
        setUploadingFile(false);
      }
      return;
    }

    // --- INTERCEPTAR PETICIONES DE ARCHIVO ANTES DE ENVIAR AL AGENTE ---
    const peticionArchivo = /(mu[ée]strame|muestrame|necesito ver|quiero ver el contenido|quiero descargar|descargar|ver)\s*"?([\w\d\.\-\s]+\.[a-zA-Z0-9]+)"?/i;
    const match = input.match(peticionArchivo);
    if (match) {
      const fileName = match[2]?.trim();
      if (fileName) {
        const file = savedFiles.find(f => f.originalFileName === fileName);
        if (file) {
          handleViewFile(file);
          setMessages((msgs) => [...msgs, { sender: "user", text: input }]);
          setInput("");
          return; // No enviar al agente
        }
      }
    }

    // Si no es petición de archivo, enviar mensaje al agente normalmente
    if (input.trim()) {
      setMessages((msgs) => [...msgs, { sender: "user", text: input }]);
      setInput("");
      try {
        const response = await axios.post('http://localhost:5000/chat/agent', { 
          message: input,
          savedFilesContext: savedFiles 
        });
        if (response.data.type === 'tool_calls') {
          // Manejar las llamadas a herramientas
          const toolResults = response.data.content;
          for (const result of toolResults) {
            if (result.toolOutput.result) {
              const agentMessage: Message = {
                sender: "agente",
                text: result.toolOutput.result.message,
              };
              if (result.toolOutput.result.fileId) {
                agentMessage.savedFileId = result.toolOutput.result.fileId;
              }
              if (result.toolOutput.result.fileId && result.toolOutput.result.ipfsUrl && result.toolOutput.result.originalFileName && result.toolOutput.result.fileType) {
                const newSavedFile: SavedFile = {
                  id: result.toolOutput.result.fileId,
                  ipfsUrl: result.toolOutput.result.ipfsUrl,
                  originalFileName: result.toolOutput.result.originalFileName,
                  fileType: result.toolOutput.result.fileType,
                };
                setSavedFiles(prev => {
                  if (!prev.some(f => f.id === newSavedFile.id)) {
                    return [...prev, newSavedFile];
                  }
                  return prev;
                });
              }
              setMessages((msgs) => [...msgs, agentMessage]);
            }
          }
        } else if (response.data.type === 'text') {
          const agentMessage: Message = {
            sender: "agente",
            text: response.data.content
          };
          if (response.data.savedFileId) {
            agentMessage.savedFileId = response.data.savedFileId;
            if (response.data.fileType) {
              agentMessage.fileType = response.data.fileType;
            }
            if (response.data.fileUrl) {
              agentMessage.fileUrl = response.data.fileUrl;
            }
          }
          setMessages((msgs) => [...msgs, agentMessage]);
        }
      } catch (error) {
        setMessages((msgs) => [...msgs, { 
          sender: "agente", 
          text: "Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo." 
        }]);
      }
    }
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newSelectedFiles = Array.from(files);
      setSelectedFiles((prevFiles) => [...prevFiles, ...newSelectedFiles]); // Añadir nuevos archivos

      newSelectedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreviews((prevPreviews) => [...prevPreviews, reader.result as string]); // Añadir nuevas previsualizaciones
        };
        reader.readAsDataURL(file);
      });
      // Limpiar el input para que el mismo archivo pueda ser seleccionado de nuevo
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setInput(""); // Limpiar el input de texto principal al seleccionar un archivo
    }
  };

  const handleViewFile = async (fileToView: SavedFile) => {
    // Solo logs para depuración
    console.log(`Preparando para ver ${fileToView.originalFileName}...`);
    setIsViewingFile(true);
    setViewingFileUrl(fileToView.ipfsUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/'));
    setViewingFileName(fileToView.originalFileName);
    setViewingFileType(fileToView.fileType);
    console.log(`"${fileToView.originalFileName}" está listo para previsualizar.`);
  };

  const handleCloseFileView = () => {
    setIsViewingFile(false);
    setViewingFileUrl(null);
    setViewingFileName(null);
    setViewingFileType(null);
  };

  // Handler para desconectar y volver a la landing
  const handleDisconnect = () => {
    disconnect();
    router.push("/");
  };

  // Eliminar archivo
  const handleDeleteFile = async (file: SavedFile) => {
    setActionLoading(file.id);
    try {
      await axios.post('http://localhost:5000/chat/agent', {
        message: `Elimina el archivo ${file.originalFileName}`,
        owner: address || ""
      });
      setSavedFiles(prev => prev.filter(f => f.id !== file.id));
      setSnackbar(`Archivo "${file.originalFileName}" eliminado correctamente.`);
    } catch (error) {
      setSnackbar('Error al eliminar el archivo.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <main className="w-screen h-screen flex flex-col bg-gradient-to-b from-gray-900 to-black relative">
      {/* Botón de desconexión arriba a la derecha */}
      <div className="absolute top-6 right-8 z-50">
        <button
          onClick={handleDisconnect}
          className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl font-medium shadow-lg hover:from-red-600 hover:to-pink-700 transition-all duration-300 hover:scale-105"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
          </svg>
          Desconectar
        </button>
      </div>
      {isViewingFile && viewingFileUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-w-4xl w-full h-full border border-gray-700">
            <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900">
              <h3 className="text-lg font-semibold text-white truncate flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {viewingFileName}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!viewingFileUrl || !viewingFileName) return;
                    try {
                      const response = await fetch(viewingFileUrl);
                      if (!response.ok) throw new Error('No se pudo descargar el archivo');
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = viewingFileName;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      window.URL.revokeObjectURL(url);
                    } catch (error) {
                      alert('Error al descargar el archivo');
                    }
                  }}
                  className="text-white bg-blue-600 hover:bg-blue-700 transition-colors px-3 py-1 rounded-lg flex items-center gap-1"
                  title="Descargar archivo"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descargar
                </button>
                {/* Botón Eliminar */}
                {viewingFileName && (
                  <button
                    onClick={async () => {
                      const file = savedFiles.find(f => f.originalFileName === viewingFileName);
                      if (file) {
                        await handleDeleteFile(file);
                        handleCloseFileView();
                      }
                    }}
                    className="text-white bg-red-600 hover:bg-red-700 transition-colors px-3 py-1 rounded-lg flex items-center gap-1"
                    title="Eliminar archivo"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Eliminar
                  </button>
                )}
                <button
                  onClick={handleCloseFileView}
                  className="text-gray-400 hover:text-white transition-colors duration-200 p-2 hover:bg-gray-700 rounded-full"
                  title="Cerrar previsualización"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 bg-gray-900">
              {viewingFileType?.startsWith('image/') && (
                <img src={viewingFileUrl} alt={viewingFileName || "Previsualización de imagen"} className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
              )}
              {viewingFileType === 'application/pdf' && (
                <iframe src={viewingFileUrl} className="w-full h-full border-0 rounded-lg shadow-lg" title="Previsualización de PDF"></iframe>
              )}
              {viewingFileType?.startsWith('text/') && (
                <iframe src={viewingFileUrl} className="w-full h-full border-0 rounded-lg shadow-lg" title="Previsualización de texto"></iframe>
              )}
              {viewingFileType && !viewingFileType.startsWith('image/') && viewingFileType !== 'application/pdf' && !viewingFileType.startsWith('text/') && (
                <div className="text-white text-center p-6 bg-gray-800 rounded-xl shadow-lg">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="mb-4 text-lg">No se puede previsualizar este tipo de archivo ({viewingFileType})</p>
                  <span className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg cursor-not-allowed opacity-60">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Descargar desde la barra superior
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`w-full flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`px-4 py-3 rounded-2xl max-w-[80%] ${
                msg.sender === "user" 
                  ? "bg-green-600 text-white ml-4" 
                  : "bg-gray-800 text-white mr-4"
              } ${msg.fileUrl || msg.savedFileId ? 'max-w-xs' : ''}`}
            >
              {msg.sender === 'agente' && msg.text && msg.text.includes('/download-file?fileId=') ? (
                (() => {
                  // Extraer el fileId del enlace
                  const match = msg.text.match(/\/download-file\?fileId=([^\s]+)/);
                  const fileId = match ? decodeURIComponent(match[1]) : null;
                  // Buscar el archivo en savedFiles
                  const file = fileId ? savedFiles.find(f => f.ipfsUrl === fileId) : null;
                  return (
                    <div>
                      {/* Solo mostrar el botón, no el link */}
                      {file && (
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch(file.ipfsUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/'));
                              if (!response.ok) throw new Error('No se pudo descargar el archivo');
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = file.originalFileName;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              window.URL.revokeObjectURL(url);
                            } catch (error) {
                              alert('Error al descargar el archivo');
                            }
                          }}
                          className="ml-4 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs"
                        >
                          Descargar archivo
                        </button>
                      )}
                    </div>
                  );
                })()
              ) : (
                msg.text && <span style={{ whiteSpace: 'pre-line' }}>{msg.text}</span>
              )}
              {/* Visualización elegante de archivos adjuntos */}
              {(msg.fileUrl || msg.savedFileId) && (
                <div className="flex flex-col gap-2 mt-3 p-3 bg-gray-900 rounded-xl border border-gray-700 w-full max-w-xs">
                  {/* Icono según tipo de archivo */}
                  {(() => {
                    let file: SavedFile | undefined = undefined;
                    if (msg.savedFileId) file = savedFiles.find(f => f.id === msg.savedFileId);
                    const fileType = file?.fileType || msg.fileType || '';
                    const fileName = file?.originalFileName || msg.fileUrl?.split('/').pop() || 'Archivo';
                    let icon = null;
                    if (fileType.startsWith('image/')) icon = <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10a2 2 0 110-4 2 2 0 010 4zm0 0l4 4m0 0l4-4" /></svg>;
                    else if (fileType.startsWith('video/')) icon = <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A2 2 0 0122 9.618v4.764a2 2 0 01-2.447 1.894L15 14M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" /></svg>;
                    else if (fileType === 'application/pdf') icon = <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>;
                    else icon = <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
                    return (
                      <div className="flex items-center gap-3">
                        {icon}
                        <span className="font-semibold text-white truncate max-w-[180px]" title={fileName}>{fileName}</span>
                        <span className="text-xs text-gray-400 ml-2">{fileType.split('/')[1] || fileType}</span>
                      </div>
                    );
                  })()}
                  {/* Acciones rápidas */}
                  <div className="flex gap-2 mt-2 flex-wrap justify-start">
                    {/* Ver */}
                    {msg.savedFileId && (
                      <button
                        onClick={() => {
                          const file = savedFiles.find(f => f.id === msg.savedFileId);
                          if (file) {
                            setActionLoading(msg.savedFileId || "");
                            handleViewFile(file);
                            setTimeout(() => setActionLoading(null), 1000);
                          }
                        }}
                        className="px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1"
                        disabled={actionLoading === msg.savedFileId}
                        title="Ver archivo"
                      >
                        {actionLoading === msg.savedFileId ? (
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                        Ver
                      </button>
                    )}
                    {/* Descargar */}
                    {msg.savedFileId && (
                      <button
                        onClick={async () => {
                          const file = savedFiles.find(f => f.id === msg.savedFileId);
                          if (file) {
                            setActionLoading(msg.savedFileId || "");
                            try {
                              const response = await fetch(file.ipfsUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/'));
                              if (!response.ok) throw new Error('No se pudo descargar el archivo');
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = file.originalFileName;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              window.URL.revokeObjectURL(url);
                            } catch (error) {
                              alert('Error al descargar el archivo');
                            } finally {
                              setActionLoading(null);
                            }
                          }
                        }}
                        className="px-3 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1"
                        disabled={actionLoading === msg.savedFileId}
                        title="Descargar archivo"
                      >
                        {actionLoading === msg.savedFileId ? (
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        )}
                        Descargar
                      </button>
                    )}
                    {/* Eliminar */}
                    {msg.savedFileId && (
                      <button
                        onClick={() => {
                          const file = savedFiles.find(f => f.id === msg.savedFileId);
                          if (file) handleDeleteFile(file);
                        }}
                        className="px-3 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1"
                        disabled={actionLoading === msg.savedFileId}
                        title="Eliminar archivo"
                      >
                        {actionLoading === msg.savedFileId ? (
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        )}
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <input
        type="file"
        id="hiddenFileInput"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        multiple
        accept="*/*"
      />

      {selectedFiles.length > 0 && (
        <div className="p-4 border-t border-gray-800 bg-gray-900 flex flex-col items-center">
          <p className="text-white mb-4 text-lg font-medium">Vista previa de archivos:</p>
          <div className="flex flex-wrap gap-4 justify-center mb-6">
            {selectedFiles.map((file, index) => (
              <div key={file.name + index} className="relative flex flex-col items-center p-3 border border-gray-700 rounded-xl bg-gray-800 shadow-lg hover:shadow-xl transition-shadow">
                {file.type.startsWith('image') && (
                  <img src={filePreviews[index]} alt={file.name} className="max-w-xs max-h-40 object-contain rounded-lg" />
                )}
                {file.type.startsWith('video') && (
                  <video controls src={filePreviews[index]} className="max-w-xs max-h-40 object-contain rounded-lg" />
                )}
                {!file.type.startsWith('image') && !file.type.startsWith('video') && (
                  <div className="flex items-center justify-center w-32 h-32 bg-gray-700 rounded-lg">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )}
                <p className="text-gray-300 text-sm mt-2 truncate max-w-[200px]">{file.name}</p>
                <p className="text-gray-400 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                    setFilePreviews(prev => prev.filter((_, i) => i !== index));
                  }}
                  className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleSend} className="w-full flex flex-col items-center">
            <label
              htmlFor="hiddenFileInput"
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors mb-4 cursor-pointer flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Adjuntar otro archivo
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Añadir un comentario (opcional)"
              className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4 shadow-lg"
            />
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={() => { setSelectedFiles([]); setFilePreviews([]); setComment(""); }}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors flex items-center gap-2 shadow-lg hover:shadow-xl"
                disabled={uploadingFile}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center gap-2 shadow-lg hover:shadow-xl"
                disabled={uploadingFile}
              >
                {uploadingFile ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Subiendo...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {!selectedFiles.length && (
        <form
          onSubmit={handleSend}
          className="flex gap-2 p-4 border-t border-gray-800 bg-gray-900 relative"
        >
          <div className="relative w-full flex items-center gap-2">
            <label
              htmlFor="hiddenFileInput"
              className="flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-800 cursor-pointer transition-colors"
              tabIndex={-1}
            >
              <svg className="w-6 h-6 text-gray-400 hover:text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l7.07-7.07a4 4 0 00-5.656-5.657l-7.071 7.07a6 6 0 108.485 8.486L19 13" />
              </svg>
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-green-400 shadow-lg"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Enviar
            </button>
          </div>
        </form>
      )}

      {/* Snackbar de confirmación visual */}
      {snackbar && <Snackbar message={snackbar} onClose={() => setSnackbar(null)} />}
    </main>
  );
} 