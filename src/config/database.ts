import { PrismaClient } from '@prisma/client';
import { config } from './env';

// Singleton pour éviter trop de connexions Prisma en dev (hot reload)
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: config.isDev
      ? ['query', 'info', 'warn', 'error']
      : ['warn', 'error'],
    errorFormat: 'pretty',
  });

if (config.isDev) {
  global.prisma = prisma;
}

// Test de connexion à la base de données
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('❌ Échec de la connexion à la base de données:', error);
    return false;
  }
};

// Fermeture propre de la connexion
export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
};
