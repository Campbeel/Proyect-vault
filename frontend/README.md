# Frontend

## Recursos y Documentación

- [Tutorial en Video](https://youtu.be/lxTGqXh7LiA?si=AO12ENhMm3HTC7Qp) - Guía para configurar Reown en un proyecto (nota: este proyecto ya viene con Reown configurado)
- [Reown Platform](https://reown.com/) - Plataforma principal
- [Documentación de Reown](https://docs.reown.com/overview) - Documentación oficial
- [Wagmi Core API](https://wagmi.sh/core/api/actions/readContract) - Documentación de Wagmi para interacción con contratos

## Despliegue

Recomeniendo desplegar el frontend en [Vercel](https://vercel.com) por las siguientes razones:

- Integración nativa con Next.js
- Despliegue automático desde GitHub
- Excelente rendimiento y CDN global
- Configuración de variables de entorno sencilla
- Monitoreo y analytics incluidos

### Pasos para el despliegue en Vercel:

1. Conecta tu repositorio de GitHub con Vercel
2. Configura las variables de entorno necesarias
3. Selecciona el directorio `frontend` como directorio raíz
4. ¡Listo! Tu aplicación se desplegará automáticamente

## Desarrollo Local

Para iniciar el desarrollo local:

```bash
cd frontend
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`
