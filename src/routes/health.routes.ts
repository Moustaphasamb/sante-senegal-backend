import { Router, Request, Response } from 'express';
import { prisma, testDatabaseConnection } from '../config/database';
import { redis } from '../config/redis';
import { sendSuccess, sendError } from '../utils/response';
import { config } from '../config/env';

const router = Router();

/**
 * GET /api/v1/health
 * Vérification basique que le serveur tourne
 */
router.get('/', (req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'OK',
    service: config.appName,
    environment: config.env,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /api/v1/health/deep
 * Vérification profonde : DB + Redis
 */
router.get('/deep', async (req: Request, res: Response) => {
  const checks = {
    server: 'OK',
    database: 'UNKNOWN' as 'OK' | 'KO' | 'UNKNOWN',
    redis: 'UNKNOWN' as 'OK' | 'KO' | 'UNKNOWN',
  };

  // Test PostgreSQL
  try {
    const dbConnected = await testDatabaseConnection();
    checks.database = dbConnected ? 'OK' : 'KO';
  } catch {
    checks.database = 'KO';
  }

  // Test Redis
  try {
    await redis.ping();
    checks.redis = 'OK';
  } catch {
    checks.redis = 'KO';
  }

  const allOk = Object.values(checks).every((v) => v === 'OK');

  if (!allOk) {
    return sendError(
      res,
      503,
      'SERVICE_DEGRADED',
      'Un ou plusieurs services sont indisponibles',
      checks
    );
  }

  return sendSuccess(res, {
    status: 'OK',
    checks,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/health/version
 * Version de l'API
 */
router.get('/version', (req: Request, res: Response) => {
  sendSuccess(res, {
    name: config.appName,
    version: '1.0.0',
    apiVersion: config.apiVersion,
    environment: config.env,
  });
});

export { router as healthRoutes };
