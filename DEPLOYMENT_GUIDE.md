# 🚀 Guía de Despliegue - Blockchain Vault

## 📋 Prerrequisitos

1. **Cuenta en Render** (gratis): https://render.com
2. **Cuenta en Vercel** (gratis): https://vercel.com
3. **Cuenta en Pinata** (gratis): https://pinata.cloud
4. **Dominio** (opcional): Puedes usar subdominios gratuitos

## 🗄️ Base de Datos (SQLite + Prisma)

### Configuración Local
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
```

### Variables de Entorno (.env)
```env
DATABASE_URL="file:./dev.db"
PINATA_JWT=tu_jwt_de_pinata
GOOGLE_AI_API_KEY=tu_api_key_de_google
PORT=5000
```

## 🌐 Despliegue del Backend (Render)

### 1. Conectar Repositorio
1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Click en "New +" → "Web Service"
3. Conecta tu repositorio de GitHub
4. Selecciona el repositorio `blockchain`

### 2. Configurar Servicio
- **Name**: `blockchain-vault-backend`
- **Environment**: `Node`
- **Build Command**: `npm install && npx prisma generate && npm run build`
- **Start Command**: `npm start`
- **Plan**: `Free`

### 3. Variables de Entorno en Render
```
NODE_ENV=production
PORT=10000
DATABASE_URL=file:./prod.db
FRONTEND_URL=https://tu-frontend.vercel.app
PINATA_JWT=tu_jwt_de_pinata
GOOGLE_AI_API_KEY=tu_api_key_de_google
```

### 4. Desplegar
- Click en "Create Web Service"
- Espera a que termine el build (5-10 minutos)
- Tu backend estará en: `https://blockchain-vault-backend.onrender.com`

## 🎨 Despliegue del Frontend (Vercel)

### 1. Conectar Repositorio
1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Click en "New Project"
3. Importa tu repositorio de GitHub
4. Selecciona el directorio `frontend`

### 2. Configurar Proyecto
- **Framework Preset**: `Next.js`
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

### 3. Variables de Entorno en Vercel
```
NEXT_PUBLIC_BACKEND_URL=https://blockchain-vault-backend.onrender.com
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
```

### 4. Desplegar
- Click en "Deploy"
- Espera a que termine el build (2-3 minutos)
- Tu frontend estará en: `https://tu-proyecto.vercel.app`

## 🔧 Configuración de Dominio Personalizado

### Opción 1: Subdominio Gratuito
- **Frontend**: `blockchain-vault.vercel.app`
- **Backend**: `api.blockchain-vault.onrender.com`

### Opción 2: Dominio Personalizado
1. Compra un dominio (ej: `blockvault.app`)
2. Configura DNS:
   - `A` record → `76.76.19.19` (Vercel)
   - `CNAME` record → `tu-proyecto.vercel.app`
3. En Vercel: Settings → Domains → Add Domain

## 📱 URLs de Producción

### Desarrollo Local
- **Frontend**: `http://localhost:3000`
- **Backend**: `http://localhost:5000`

### Producción
- **Frontend**: `https://tu-proyecto.vercel.app`
- **Backend**: `https://blockchain-vault-backend.onrender.com`

## 🔍 Verificación del Despliegue

### Backend
```bash
curl https://blockchain-vault-backend.onrender.com/health
# Debe responder: {"status":"OK","timestamp":"..."}
```

### Frontend
- Visita tu URL de Vercel
- Verifica que se conecte al backend
- Prueba subir un archivo

## 🛠️ Comandos Útiles

### Desarrollo Local
```bash
# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm run dev
```

### Base de Datos
```bash
# Generar cliente Prisma
npx prisma generate

# Aplicar cambios a la BD
npx prisma db push

# Ver datos en Prisma Studio
npx prisma studio
```

### Despliegue
```bash
# Backend
npm run build
npm start

# Frontend
npm run build
npm start
```

## 🔒 Seguridad

### Variables Sensibles
- ✅ **PINATA_JWT**: Solo en backend
- ✅ **GOOGLE_AI_API_KEY**: Solo en backend
- ✅ **DATABASE_URL**: Solo en backend
- ✅ **NEXT_PUBLIC_***: Solo para frontend

### CORS
- Backend configurado para aceptar solo tu dominio de frontend
- Variables de entorno controlan los orígenes permitidos

## 📊 Monitoreo

### Render Dashboard
- Logs en tiempo real
- Métricas de rendimiento
- Estado del servicio

### Vercel Dashboard
- Analytics de visitas
- Logs de build
- Métricas de rendimiento

## 🚨 Troubleshooting

### Error: "Cannot connect to database"
- Verifica que `DATABASE_URL` esté configurada
- Asegúrate de que Prisma esté generado: `npx prisma generate`

### Error: "CORS policy"
- Verifica `FRONTEND_URL` en el backend
- Asegúrate de que coincida con tu dominio de Vercel

### Error: "Pinata JWT not configured"
- Verifica que `PINATA_JWT` esté en las variables de entorno
- Obtén un nuevo JWT en [Pinata Dashboard](https://app.pinata.cloud)

## 💰 Costos Estimados

### Gratis (MVP)
- **Render**: $0/mes (Free tier)
- **Vercel**: $0/mes (Free tier)
- **Pinata**: $0/mes (1GB gratis)
- **Dominio**: $0/mes (subdominios gratuitos)

### Escalado (Opcional)
- **Render**: $7/mes (Pro plan)
- **Vercel**: $20/mes (Pro plan)
- **Dominio**: $10-15/año
- **Total**: ~$40/mes

## 🎯 Próximos Pasos

1. **Desplegar MVP** con configuración gratuita
2. **Probar funcionalidad** completa
3. **Optimizar rendimiento** si es necesario
4. **Agregar dominio personalizado** si hay demanda
5. **Escalar** según necesidades

---

**¡Tu proyecto blockchain estará vivo en la web! 🚀** 