// Barrel file para centralizar imports/exports del backend

// Dependencias externas
export { default as express, Request, Response } from "express";
export { default as cors } from "cors";
export { default as multer } from "multer";
export { default as dotenv } from "dotenv";
export { default as axios } from "axios";
export { default as path } from "path";
export { default as fs } from "fs/promises";
export { default as fsSync } from "fs";
export { default as CryptoJS } from "crypto-js";

// Módulos internos
export { prisma } from "./lib/prisma";
export * from "./internal/config";
export * from "./internal/http";
export * from "./internal/http/example/get-health-handler";
export * from "./internal/http/example/routes";
export * from "./cmd/example-api/server";
export * from "./cmd/example-api/index";

// Libs y utilidades
export * from "./lib/prisma";

// Configuración
export * from "./internal/config";

// Handlers y rutas HTTP
export * from "./internal/http";
export * from "./internal/http/example/get-health-handler";
export * from "./internal/http/example/routes";

// Comandos y servidores de ejemplo
export * from "./cmd/example-api/server";
export * from "./cmd/example-api/index";
// (Agrega aquí más exports según crezca el proyecto) 