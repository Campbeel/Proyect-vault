# 🚀 Backend - Blockchain Vault

## 📋 Descripción
Backend para la aplicación de almacenamiento seguro de archivos en blockchain, con integración de Prisma, Supabase y Gemini AI.

## 🏗️ Arquitectura
- **Express.js**: Servidor web
- **Prisma**: ORM para base de datos
- **Supabase**: Base de datos PostgreSQL
- **Pinata**: Almacenamiento IPFS
- **Gemini AI**: Agente conversacional

## 📁 Estructura del Proyecto
```
src/
├── index.ts              # Servidor principal con Prisma
├── index-prisma.ts       # Versión alternativa con Prisma
├── lib/
│   └── prisma.ts         # Cliente de Prisma
├── agent/
│   ├── prompt/           # Prompts para Gemini
│   └── instructions/     # Instrucciones del agente
└── cmd/                  # Comandos adicionales
```

## 🔧 Configuración
1. Configurar variables de entorno en `.env`
2. Ejecutar `npx prisma generate`
3. Ejecutar `npx prisma db push`
4. Iniciar con `npm run dev`

## 🌐 Endpoints Principales
- `POST /api/gemini` - Agente conversacional
- `POST /upload` - Subida de archivos
- `GET /files` - Listar archivos
- `POST /conversations` - Guardar conversaciones 