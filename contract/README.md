# Contrato Simple

Este proyecto contiene un contrato inteligente simple desplegado en la red Base.

## Requisitos Previos

- Node.js (versión 16 o superior)
- npm o yarn
- Cuenta en Base con ETH para gas

## Instalación

1. Instalar dependencias:

```bash
npm install
```

2. Configurar variables de entorno:
   Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```
PRIVATE_KEY=tu_clave_privada
BASE_API_KEY=tu_api_key_de_basescan
```

## Comandos Principales

### Compilación

```bash
npx hardhat compile
```

### Despliegue

```bash
npx hardhat ignition deploy ./ignition/modules/SimpleStorage.ts --network base
```

### Verificación del Contrato

Después de desplegar el contrato, es importante verificarlo en el explorador de bloques de Base. Para esto:

1. Copia la dirección del contrato desplegado
2. Ejecuta el siguiente comando reemplazando [dirección_del_contrato] con la dirección real:

```bash
npx hardhat verify --network base [dirección_del_contrato]
```

La verificación es necesaria para:

- Hacer público el código fuente del contrato
- Permitir la interacción con el contrato a través del explorador de bloques
- Aumentar la transparencia y confianza en el contrato

## Despliegue en Otras Redes

Para desplegar el contrato en otras redes, necesitas:

1. Modificar el archivo `hardhat.config.ts` para agregar la configuración de la red deseada:

```typescript
networks: {
  // ... otras configuraciones ...
  nuevaRed: {
    url: "URL_RPC_DE_LA_RED",
    accounts: [process.env.PRIVATE_KEY],
    chainId: ID_DE_LA_RED
  }
}
```

2. Asegurarte de tener fondos suficientes en la wallet para gas en la red destino

3. Modificar el comando de despliegue especificando la nueva red:

```bash
npx hardhat ignition deploy ./ignition/modules/SimpleStorage.ts --network nuevaRed
```

4. Verificar el contrato en el explorador de bloques correspondiente:

```bash
npx hardhat verify --network nuevaRed [dirección_del_contrato]
```

## Estructura del Proyecto

- `contracts/`: Contiene los contratos inteligentes
- `ignition/`: Módulos de despliegue
- `scripts/`: Scripts de utilidad
- `test/`: Tests del contrato

## Redes Soportadas

- Base Mainnet
