"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";

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

export default function ChatPage() {
  const { isConnected, address } = useAccount();
  const router = useRouter();
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

  const generateNonce = (): string => {
    // Generar un nonce aleatorio. Para mayor seguridad en producción, considera un UUID.
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const establishSessionKey = useCallback(async (): Promise<string | null> => {
    // Simplemente retorna una clave ficticia o indica que la sesión está establecida.
    // Esto elimina la necesidad de firmar un mensaje y la lógica de cifrado por ahora.
    if (!address) {
      setMessages((msgs) => [...msgs, { sender: "agente", text: "No hay billetera conectada." }]);
      return null;
    }
    setMessages((msgs) => [...msgs, { sender: "agente", text: "Conexión de billetera establecida." }]);
    return "dummy-session-key"; // Clave ficticia
  }, [address, setMessages]);

  useEffect(() => {
    if (!isConnected) {
      router.replace("/login");
    } else {
      // Intentar establecer la clave de sesión simulada al conectar la billetera
      establishSessionKey();
    }
  }, [isConnected, router, address, establishSessionKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  if (!isConnected) return null;

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    // Actualizada la condición para el envío
    if (!input.trim() && selectedFiles.length === 0) return;

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

              // Asegurar que savedFileId se establece para el mensaje del agente si fileId está presente
              if (result.toolOutput.result.fileId) {
                agentMessage.savedFileId = result.toolOutput.result.fileId;
              }

              // Si la salida de la herramienta incluye información completa del archivo para guardar
              if (result.toolOutput.result.fileId && result.toolOutput.result.ipfsUrl && result.toolOutput.result.originalFileName && result.toolOutput.result.fileType) {
                const newSavedFile: SavedFile = {
                  id: result.toolOutput.result.fileId, // Usando fileId del resultado de la herramienta como ID
                  ipfsUrl: result.toolOutput.result.ipfsUrl,
                  originalFileName: result.toolOutput.result.originalFileName,
                  fileType: result.toolOutput.result.fileType,
                };
                
                // Añadir el archivo a savedFiles si no existe ya para que handleViewFile pueda encontrarlo
                setSavedFiles(prev => {
                  if (!prev.some(f => f.id === newSavedFile.id)) {
                    return [...prev, newSavedFile];
                  }
                  return prev;
                });
              }
              console.log("Agent Message (tool_calls):", agentMessage);
              setMessages((msgs) => [...msgs, agentMessage]);
            }
          }
        } else if (response.data.type === 'text') {
          const agentMessage: Message = {
            sender: "agente",
            text: response.data.content
          };

          // Si la respuesta de texto también incluye información del archivo para previsualizar
          if (response.data.savedFileId) {
            agentMessage.savedFileId = response.data.savedFileId;
            // Opcionalmente, si fileType y fileUrl se proporcionan directamente para esta previsualización
            if (response.data.fileType) {
              agentMessage.fileType = response.data.fileType;
            }
            if (response.data.fileUrl) {
              agentMessage.fileUrl = response.data.fileUrl;
            }
          }
          console.log("Agent Message (text):", agentMessage);
          setMessages((msgs) => [...msgs, agentMessage]);
        }
      } catch (error) {
        console.error("Error al comunicarse con el agente:", error);
        setMessages((msgs) => [...msgs, { 
          sender: "agente", 
          text: "Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo." 
        }]);
      }
    }

    // Nuevo bloque para manejar la subida de múltiples archivos
    if (selectedFiles.length > 0) {
      setUploadingFile(true);
      const uploadPromises = selectedFiles.map(async (file) => {
        setMessages((msgs) => [...msgs, { 
          sender: "user", 
          text: comment || `Subiendo archivo: ${file.name}`, 
          fileType: file.type 
        }]);
        
        try {
          // Simplemente subimos el archivo sin cifrarlo
          const formData = new FormData();
          formData.append('file', file);
          formData.append('originalFileName', file.name);
          formData.append('fileType', file.type);
          // Estos campos pueden ser necesarios en el backend, pero los valores son ficticios si no hay cifrado real
          formData.append('encryptedFileKey', "dummy-key");
          formData.append('nonce', "dummy-nonce");

          const response = await axios.post('http://localhost:5000/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          if (response.data.ipfsUrl) {
            const newSavedFile: SavedFile = {
              id: response.data.ipfsUrl, // Usar ipfsUrl como ID consistente con el backend
              ipfsUrl: response.data.ipfsUrl,
              originalFileName: file.name,
              fileType: file.type,
            };
            setSavedFiles(prev => [...prev, newSavedFile]);

            setMessages((msgs) => [...msgs, { 
              sender: "agente", 
              text: `Archivo "${file.name}" guardado exitosamente en IPFS.`, 
              savedFileId: newSavedFile.id // Asegurar que savedFileId también sea el ipfsUrl
            }]);
          } else {
            throw new Error("No se recibió un hash IPFS válido.");
          }
        } catch (error) {
          console.error(`Error al subir archivo cifrado "${file.name}":`, error);
          setMessages((msgs) => [...msgs, { 
            sender: "agente", 
            text: `Error al subir el archivo "${file.name}": ${error instanceof Error ? error.message : 'Error desconocido'}` 
          }]);
        }
      });

      try {
        await Promise.all(uploadPromises);
        setMessages((msgs) => [...msgs, { 
          sender: "agente", 
          text: "Todos los archivos han sido procesados." 
        }]);
      } catch (error) {
        console.error("Error al procesar los archivos:", error);
        setMessages((msgs) => [...msgs, { 
          sender: "agente", 
          text: "Hubo errores al procesar algunos archivos. Por favor, revisa los mensajes anteriores." 
        }]);
      } finally {
        setSelectedFiles([]);
        setFilePreviews([]);
        setComment("");
        setUploadingFile(false);
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
    setMessages((msgs) => [...msgs, { sender: "agente", text: `Preparando para ver ${fileToView.originalFileName}...` }]);
    setIsViewingFile(true);
    setViewingFileUrl(fileToView.ipfsUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/'));
    setViewingFileName(fileToView.originalFileName);
    setViewingFileType(fileToView.fileType);

    setMessages((msgs) => [...msgs, { sender: "agente", text: `"${fileToView.originalFileName}" está listo para previsualizar.` }]);
  };

  const handleCloseFileView = () => {
    setIsViewingFile(false);
    setViewingFileUrl(null);
    setViewingFileName(null);
    setViewingFileType(null);
  };

  return (
    <main className="w-screen h-screen flex flex-col bg-black">
      {isViewingFile && viewingFileUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden flex flex-col max-w-4xl w-full h-full">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white truncate">Previsualizando: {viewingFileName}</h3>
              <button
                onClick={handleCloseFileView}
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 bg-gray-900">
              {viewingFileType?.startsWith('image/') && (
                <img src={viewingFileUrl} alt={viewingFileName || "Previsualización de imagen"} className="max-w-full max-h-full object-contain" />
              )}
              {viewingFileType === 'application/pdf' && (
                <iframe src={viewingFileUrl} className="w-full h-full border-0" title="Previsualización de PDF"></iframe>
              )}
              {viewingFileType?.startsWith('text/') && (
                <iframe src={viewingFileUrl} className="w-full h-full border-0" title="Previsualización de texto"></iframe>
              )}
              {viewingFileType && !viewingFileType.startsWith('image/') && viewingFileType !== 'application/pdf' && !viewingFileType.startsWith('text/') && (
                <div className="text-white text-center">
                  <p className="mb-2">No se puede previsualizar este tipo de archivo ({viewingFileType}).</p>
                  <a
                    href={viewingFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                    download
                  >
                    Descargar {viewingFileName}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`w-full flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`px-3 py-2 text-base ${msg.sender === "user" ? "text-green-400" : "text-white"} ${msg.fileUrl || msg.savedFileId ? 'max-w-xs' : ''}`}
            >
              {msg.text && <p>{msg.text}</p>}
              {msg.fileUrl && (
                <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline break-all">
                  {msg.fileType?.startsWith('image') && (
                    <img src={msg.fileUrl} alt="Archivo" className="max-w-full h-auto rounded-lg" />
                  )}
                  {msg.fileType?.startsWith('video') && (
                    <video controls src={msg.fileUrl} className="max-w-full h-auto rounded-lg" />
                  )}
                  {!msg.fileType?.startsWith('image') && !msg.fileType?.startsWith('video') && (
                    <span>Archivo: {msg.fileUrl}</span>
                  )}
                </a>
              )}
              {msg.savedFileId && (
                <button 
                  onClick={() => {
                    const file = savedFiles.find(f => f.id === msg.savedFileId);
                    if (file) handleViewFile(file);
                  }}
                  className="text-blue-400 underline break-all block mt-1"
                >
                  Ver archivo
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* El input de archivo oculto que ambos botones de adjuntar usarán */}
      <input
        type="file"
        id="hiddenFileInput"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }} // Simplificado para asegurar la funcionalidad con label
        multiple // Permitir selección múltiple
        accept="*/*" // Aceptar cualquier tipo de archivo
      />

      {selectedFiles.length > 0 && (
        <div className="p-4 border-t border-gray-800 bg-black flex flex-col items-center">
          <p className="text-white mb-2">Vista previa de archivos:</p>
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {selectedFiles.map((file, index) => (
              <div key={file.name + index} className="relative flex flex-col items-center p-2 border border-gray-700 rounded-lg bg-gray-900">
                {file.type.startsWith('image') && (
                  <img src={filePreviews[index]} alt={file.name} className="max-w-xs max-h-40 object-contain rounded-lg" />
                )}
                {file.type.startsWith('video') && (
                  <video controls src={filePreviews[index]} className="max-w-xs max-h-40 object-contain rounded-lg" />
                )}
                {!file.type.startsWith('image') && !file.type.startsWith('video') && (
                  <div className="flex items-center justify-center w-32 h-32 bg-gray-800 rounded-lg">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )}
                <p className="text-gray-300 text-sm mt-1 truncate max-w-[200px]">{file.name}</p>
                <p className="text-gray-400 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                    setFilePreviews(prev => prev.filter((_, i) => i !== index));
                  }}
                  className="absolute top-0 right-0 p-1 text-red-400 hover:text-red-600 bg-gray-900 rounded-full"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleSend} className="w-full flex flex-col items-center">
            <label
              htmlFor="hiddenFileInput"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors mb-4 cursor-pointer"
            >
              Adjuntar otro archivo
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Añadir un comentario (opcional)"
              className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-black text-white focus:outline-none focus:ring-2 focus:ring-green-400 mb-4"
            />
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => { setSelectedFiles([]); setFilePreviews([]); setComment(""); }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                disabled={uploadingFile}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
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
                  'Enviar Archivos'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {!selectedFiles.length && (
        <form
          onSubmit={handleSend}
          className="flex gap-2 p-4 border-t border-gray-800 bg-black relative"
        >
          <div className="relative w-full flex items-center gap-2">
            <label
              htmlFor="hiddenFileInput"
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-800 cursor-pointer"
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
              className="flex-1 px-4 py-2 rounded-lg border border-gray-700 bg-black text-white focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Enviar
            </button>
          </div>
        </form>
      )}
    </main>
  );
} 