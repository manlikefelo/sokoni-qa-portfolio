import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Next.js hot-reloads modules in development, which would otherwise open a new
// connection pool on every edit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
