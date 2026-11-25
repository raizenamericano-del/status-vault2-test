import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl } from './config.js';

// Ensure DATABASE_URL is set for Prisma before client construction
process.env.DATABASE_URL = getDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
