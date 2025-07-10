# 🚀 Guía de Despliegue - Blockchain Vault

## 📋 Resumen
Este proyecto se despliega en:
- **Backend**: Render (Node.js + Express)
- **Frontend**: Vercel (Next.js)
- **Base de Datos**: Supabase (PostgreSQL)

---

## 🔧 Paso 1: Preparar Base de Datos (Supabase)

### 1.1 Crear proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com)
2. Crea una nueva cuenta o inicia sesión
3. Crea un nuevo proyecto
4. Anota la URL de conexión y la clave de API

### 1.2 Configurar base de datos
```bash
# En el directorio backend
cd backend
npx prisma db push
```

---

## 🌐 Paso 2: Desplegar Backend (Render)

### 2.1 Crear cuenta en Render
1. Ve a [render.com](https://render.com)
2. Crea una cuenta gratuita
3. Conecta tu repositorio de GitHub

### 2.2 Configurar servicio web
1. Crea un nuevo **Web Service**
2. Conecta tu repositorio
3. Configura:
   - **Name**: `blockchain-vault-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm start`

### 2.3 Variables de entorno en Render
Configura estas variables en el dashboard de Render:

| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `DATABASE_URL` | `tu_url_de_supabase` |
| `FRONTEND_URL` | `tu_url_de_vercel` |
| `PINATA_JWT` | `tu_token_de_pinata` |
| `GOOGLE_API_KEY` | `tu_api_key_de_google` |

### 2.4 Obtener credenciales

#### Pinata (IPFS)
1. Ve a [pinata.cloud](https://pinata.cloud)
2. Crea una cuenta
3. Ve a API Keys → Create New Key
4. Copia el JWT token

#### Google AI (Gemini)
1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Crea una nueva API key
3. Copia la clave

---

## 🎨 Paso 3: Desplegar Frontend (Vercel)

### 3.1 Crear cuenta en Vercel
1. Ve a [vercel.com](https://vercel.com)
2. Crea una cuenta gratuita
3. Conecta tu repositorio de GitHub

### 3.2 Configurar proyecto
1. Importa tu repositorio
2. Vercel detectará automáticamente que es Next.js
3. Configura las variables de entorno:

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_BACKEND_URL` | `https://tu-backend.onrender.com` |
| `NEXT_PUBLIC_CHAIN_ID` | `8453` |
| `NEXT_PUBLIC_RPC_URL` | `https://mainnet.base.org` |

### 3.3 Desplegar
1. Haz clic en "Deploy"
2. Espera a que se complete el build
3. Anota la URL generada

---

## 🔗 Paso 4: Conectar Todo

### 4.1 Actualizar URLs
1. Ve a Render → Tu backend → Environment
2. Actualiza `FRONTEND_URL` con tu URL de Vercel
3. Ve a Vercel → Tu frontend → Settings → Environment Variables
4. Actualiza `NEXT_PUBLIC_BACKEND_URL` con tu URL de Render

### 4.2 Probar conexión
1. Abre tu frontend en Vercel
2. Intenta conectar una wallet
3. Prueba subir un archivo
4. Verifica que el chat funcione

---

## 🛠️ Troubleshooting

### Error de CORS
- Verifica que `FRONTEND_URL` en Render coincida exactamente con tu URL de Vercel
- Incluye el protocolo `https://`

### Error de base de datos
- Verifica que `DATABASE_URL` en Render sea correcta
- Asegúrate de que Prisma esté configurado para producción

### Error de build
- Revisa los logs en Render/Vercel
- Verifica que todas las dependencias estén en `package.json`

### Error de API keys
- Verifica que `PINATA_JWT` y `GOOGLE_API_KEY` sean válidas
- Asegúrate de que no tengan espacios extra

---

## 📊 URLs Finales

Después del despliegue tendrás:
- **Frontend**: `https://tu-proyecto.vercel.app`
- **Backend**: `https://tu-proyecto.onrender.com`
- **Base de datos**: `https://tu-proyecto.supabase.co`

---

## 🔒 Seguridad

- ✅ Nunca subas archivos `.env` al repositorio
- ✅ Usa HTTPS en producción
- ✅ Configura rate limiting en Render
- ✅ Monitorea los logs regularmente
- ✅ Mantén las dependencias actualizadas

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs en Render/Vercel
2. Verifica las variables de entorno
3. Prueba localmente primero
4. Consulta la documentación de cada plataforma 