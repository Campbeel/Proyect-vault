# 🚀 Backend - Blockchain Vault

## 📁 Estructura del Proyecto
```
backend/
├── src/              # Código fuente principal (rutas, lógica de negocio, controladores)
├── prisma/           # Esquemas y migraciones de base de datos
├── dist/             # Archivos compilados (build)
├── scripts/          # Scripts utilitarios y de migración
├── config/           # Archivos de configuración adicionales
├── docs/             # Documentación técnica interna
├── package.json      # Dependencias y scripts de npm
├── tsconfig.json     # Configuración de TypeScript
├── env.example       # Variables de entorno de ejemplo
├── README.md         # Documentación principal del backend
└── ...
```

- `src/`: Código fuente principal del backend.
- `prisma/`: Esquemas y migraciones de base de datos.
- `dist/`: Archivos generados tras compilar el proyecto.
- `scripts/`: Scripts utilitarios (por ejemplo, migraciones manuales).
- `config/`: Configuración adicional (si aplica).
- `docs/`: Documentación técnica interna.

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
