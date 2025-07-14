# Vault Web3: Caja Fuerte Digital Descentralizada

Este proyecto es una plataforma web que permite a los usuarios **guardar, consultar y gestionar archivos (fotos, videos, documentos, etc.) de forma privada y descentralizada** usando tecnología blockchain, IPFS y billetera Web3.

##  ¿Qué hace este sitio?

- Permite a cualquier usuario conectarse con su billetera Web3 (por ejemplo, MetaMask).
- Ofrece un chat inteligente donde puedes interactuar y realizar operaciones sobre tus archivos.
- Todos los archivos se almacenan en IPFS a través de Pinata, asegurando privacidad y descentralización.
- Solo el dueño de la billetera puede acceder, ver o eliminar sus archivos.

## Funciones principales del chat

Desde el chat puedes realizar 4 acciones principales sobre tus archivos:

1. **Subir archivos**  
   Adjunta y sube cualquier archivo (imagen, video, PDF, etc.) a IPFS. El sistema lo asocia a tu billetera y lo cifra para tu privacidad.

2. **Vista/Previsualización de archivos**  
   Solicita ver cualquier archivo que hayas subido. El sistema te muestra una previsualización (imagen, video, PDF, etc.) directamente en la web.

3. **Descargar archivos**  
   Descarga cualquier archivo guardado en tu caja fuerte digital, directamente desde IPFS.

4. **Eliminar archivos**  
   Elimina archivos que ya no quieras guardar. Solo tú puedes borrar tus propios archivos.

##  Idea general del proyecto

Vault Web3 es una **caja fuerte digital descentralizada**:  
- Tus archivos no dependen de servidores centralizados ni de empresas.
- Solo tú, usando tu billetera, puedes acceder y gestionar tus datos.
- El chat inteligente te guía y asiste en todas las operaciones, haciendo la experiencia simple y segura.

---

## Estructura del Proyecto

- **Frontend:**  
  Lógica de conexión Web3, chat, subida y gestión de archivos.

- **Backend:**  
  Integración con:
  - IPFS (almacenamiento descentralizado)
  - Pinata (gateway IPFS)
  - Gemini (asistente conversacional)
  - Uso de contrato para guardado de hash de archivoss.

---

## 👥 Autores

- Benjamin Muñoz
