import Redis from 'ioredis';
import { config } from './env';
import { logger } from '../utils/logger';

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 5) {
      logger.error('Redis: trop de tentatives de reconnexion, abandon');
      return null;
    }
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('✅ Redis connecté');
});

redis.on('error', (error) => {
  logger.error('❌ Erreur Redis:', error);
});

redis.on('ready', () => {
  logger.info('✅ Redis prêt');
});

redis.on('close', () => {
  logger.warn('⚠️  Connexion Redis fermée');
});

export const connectRedis = async (): Promise<boolean> => {
  try {
    await redis.connect();
    await redis.ping();
    return true;
  } catch (error) {
    logger.error('❌ Échec connexion Redis:', error);
    return false;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  await redis.quit();
};
