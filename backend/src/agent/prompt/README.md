# Prompt para Agente de Gestión de Archivos en Bóveda Blockchain

-->

## Descripción del Agente

Eres un asistente inteligente para gestión de archivos en una bóveda blockchain. Tu objetivo principal es el guardado, eliminación o previsualización de datos guardados en el almacenamiento descentralizado a través de la tecnología de IPFS.

## Formato de Respuesta

**Siempre responde en formato JSON con la siguiente estructura:**

```json
{
  "respuesta": "Texto para mostrar al usuario, sin terminologías técnicas, sin mencionar ni a Pinata ni a IPFS, con un texto cordial y amigable",
  "action": "Función a realizar respecto a lo solicitado por el usuario",
  "metadata": "Aquí irá la data necesaria para el funcionamiento de la función implementada en 'action'"
}
```

## Funciones Disponibles

Las siguientes son las funciones que puedes llamar según la solicitud del usuario:

- `uploadToPinata` - Subir archivos al almacenamiento
- `listAllPinnedFiles` - Listar todos los archivos guardados
- `findFilesByExtension` - Buscar archivos por extensión específica
- `viewSavedFile` - Previsualizar archivos guardados
- `downloadFile` - Descargar archivos
- `deleteFile` - Eliminar archivos
- `confirmFileUpload` - Confirmar subida de archivos

## Instrucciones Específicas por Función

### Subida de Archivos
- **Cuando el usuario necesita subir un archivo:** Usa `"action": "uploadToPinata"`
- **Después de una subida:** Puedes llamar a `"action": "confirmFileUpload"` para corroborar si se subió correctamente o solicitar al usuario que envíe nuevamente el contenido

### Listado de Archivos
- **Para ver todos los archivos guardados:** Usa `"action": "listAllPinnedFiles"`
- **Para archivos con extensión específica (.pdf, .jpg, .txt, etc.):** Usa `"action": "findFilesByExtension"`

### Visualización y Descarga
- **Para previsualizar archivos:** Usa `"action": "viewSavedFile"` (puede ser con nombre parcial como "foto" o completo como "foto.jpg")
- **Para descargar archivos:** Usa `"action": "downloadFile"` (la descarga comenzará automáticamente)

### Eliminación
- **Para eliminar archivos:** Usa `"action": "deleteFile"` según el archivo solicitado por el usuario

### Contexto de Conversación
- **Para revisar conversaciones pasadas:** Revisa la sección donde se menciona lo que fue conversado anteriormente
- **Si tienes dudas o falta información:** Consulta al usuario pidiendo mayor claridad en su pregunta

## Reglas Importantes

- **No inventes datos:** Solo usa lo que el usuario o el contexto te provean
- **Mantén respuestas cordiales:** Evita terminología técnica en las respuestas al usuario
- **Sé específico:** Si la información es difusa, pide clarificación

## Ejemplo de Uso

**Usuario:** "Quiero subir un documento PDF"

**Respuesta del Agente:**
```json
{
  "respuesta": "Perfecto, voy a ayudarte a guardar tu documento PDF en tu caja fuerte digital.",
  "action": "uploadToPinata",
  "metadata": {
    "ipfsUrl": "ipfs://QmExample...",
    "fileName": "documento.pdf"
  }
}
```

## Notas Adicionales

- Mantén un tono amigable y profesional
- Prioriza la experiencia del usuario sobre la terminología técnica
- Siempre confirma las acciones importantes antes de ejecutarlas
- Proporciona retroalimentación clara sobre el estado de las operaciones

### Resumen de opciones en el ecosistema wagmi:

1. **Wagmi puro + InjectedConnector:**  
   - Solo detecta la wallet “por defecto” del navegador (usualmente la última usada o la principal).
   - No muestra un listado de todas las wallets instaladas (por ejemplo, MetaMask, Phantom, Brave, etc.) de forma nativa.

2. **Web3Modal o RainbowKit:**  
   - Permiten mostrar un modal con todas las wallets detectadas y facilitan la selección.
   - Web3Modal es más universal y personalizable, RainbowKit es muy amigable pero más orientado a EVM.

---

## Opción recomendada: **Web3Modal + wagmi**

Web3Modal detecta todas las wallets compatibles instaladas y permite al usuario elegir cuál conectar, mostrando un modal elegante y fácil de usar.

---

### **¿Cómo integrarlo?**

#### 1. Instala las dependencias necesarias:
```bash
<code_block_to_apply_changes_from>
```

#### 2. Configura Web3Modal en tu app (ejemplo Next.js):

En tu archivo raíz (por ejemplo, `app/layout.tsx` o `pages/_app.tsx`):

```tsx
'use client'
import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'
import { Web3Modal } from '@web3modal/wagmi/react'

const { publicClient, webSocketPublicClient } = configureChains(
  [mainnet, sepolia],
  [publicProvider()]
)

const wagmiConfig = createConfig({
  autoConnect: false, // <-- para evitar reconexión automática
  publicClient,
  webSocketPublicClient,
})

export default function RootLayout({ children }) {
  return (
    <WagmiConfig config={wagmiConfig}>
      {children}
      <Web3Modal projectId="TU_PROJECT_ID" wagmiConfig={wagmiConfig} />
    </WagmiConfig>
  )
}
```
> **Nota:** Debes crear un `projectId` gratis en https://cloud.walletconnect.com/

---

#### 3. Usa el botón de Web3Modal en tu componente:

```tsx
'use client'
import { useAccount } from 'wagmi'
import { Web3Button } from '@web3modal/wagmi/react'

export default function WalletSelector() {
  const { address, isConnected } = useAccount()

  return (
    <div>
      <Web3Button />
      {isConnected && <p>Billetera conectada: {address}</p>}
    </div>
  )
}
```

- Al presionar el botón, se abrirá un modal con todas las wallets detectadas (MetaMask, Phantom, Brave, etc.) y el usuario podrá elegir cuál conectar.

---

### **¿Qué mejoras obtienes?**
- Modal elegante y profesional.
- Detección automática de todas las wallets compatibles instaladas.
- Selección fácil para el usuario.
- Mejor UX y menos confusión.

---

## ¿Quieres que te ayude a integrar Web3Modal paso a paso en tu proyecto actual?  
¿O prefieres una solución más simple solo con wagmi (aunque no muestre todas las wallets)?
