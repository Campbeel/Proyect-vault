// =======================
// IMPORTS Y DEPENDENCIAS
// =======================
import { PrismaClient } from '@prisma/client'

// =======================
// CONFIGURACIÓN DEL CLIENTE PRISMA
// =======================
// Instancia global de Prisma para evitar múltiples conexiones
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Crear o reutilizar la instancia de Prisma
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

// En desarrollo, mantener la instancia global para hot reload
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma 