# Backend

Este es un proyecto base para comenzar con el desarrollo de aplicaciones Web3.

## Requisitos Previos

- Node.js (versión recomendada: 18.x o superior)
- Docker
- Cuenta de Google Cloud Platform
- Google Cloud CLI (gcloud) instalado y configurado

## Instalación

1. Clona el repositorio:

```bash
git clone [URL_DEL_REPOSITORIO]
cd web3-hackathon-starter
```

2. Instala las dependencias:

```bash
make setup
```

## Estructura del Proyecto

El proyecto sigue una arquitectura modular donde cada servicio es independiente y puede ser desarrollado y desplegado por separado.

### Organización de Directorios

```
src/
├── cmd/                   # Contiene los puntos de entrada de cada servicio
│   ├── service-a/         # Servicio A con su configuración específica
│   │   ├── server.ts      # Punto de entrada del servicio
│   │   └── .env           # Variables de entorno específicas
│   └── service-b/
│       ├── server.ts
│       └── .env
│
└── internal/              # Código compartido entre servicios
│   └── example/           # Lógica de cade implementacion
│
│
└── scripts/               # Scripts en caso de ser necesario
```

### Componentes Principales

- **cmd/**: Cada directorio dentro de `cmd/` representa un servicio independiente que puede ser desplegado por separado. Cada servicio tiene:

  - Su propio `server.ts` como punto de entrada
  - Configuración específica
  - Variables de entorno propias

- **internal/**: Contiene el código compartido entre servicios.

### Flujo de Desarrollo

1. Cada servicio en `cmd/` puede ser desarrollado y probado de forma independiente
2. La lógica compartida se implementa en `internal/`
3. Los servicios pueden comunicarse entre sí a través de APIs o eventos
4. Cada servicio puede tener sus propias configuraciones

## Desarrollo Local

Para ejecutar un servicio en modo desarrollo, utiliza el siguiente comando:

```bash
make dev APP_NAME=nombre-del-servicio
```

Por ejemplo:

```bash
make dev APP_NAME=example-api
```

## Despliegue

Para desplegar un servicio en Google Cloud Run, asegúrate de:

1. Tener Docker corriendo en tu máquina
2. Estar autenticado con Google Cloud:

```bash
gcloud auth login
```

3. En algunos casos es mejor logearse con este comando

```bash
gcloud auth application-default login
```

4. Verificar que estás en el proyecto correcto de Google Cloud:

```bash
gcloud projects list
```

Si necesitas cambiar de proyecto, puedes usar:

```bash
gcloud config set project [ID_DEL_PROYECTO]
```

5. Ejecutar el comando de despliegue:

```bash
make deploy APP_NAME=nombre-del-servicio
```

Por ejemplo:

```bash
make deploy APP_NAME=example-api
```

## Otros Comandos Útiles

- `make build`: Compila el proyecto
- `make test`: Ejecuta las pruebas
- `make clean`: Limpia los archivos generados
- `make check`: Ejecuta el linter y otras verificaciones

## Variables de Entorno

Cada servicio debe tener su archivo `.env` en su directorio correspondiente dentro de `src/cmd/`. Este archivo contiene las variables de entorno necesarias para el funcionamiento del servicio.
