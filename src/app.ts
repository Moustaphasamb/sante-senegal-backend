import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config/env';
import { apiRoutes } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { globalRateLimiter } from './middleware/rateLimiter';
import { morganStream } from './utils/logger';
import { sendSuccess } from './utils/response';

export const createApp = (): Application => {
  const app: Application = express();

  // ─── Sécurité ──────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: config.isProd ? undefined : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // ─── CORS ──────────────────────────────────────────────────
  app.use(
    cors({
      origin: (origin, callback) => {
        // Autoriser les requêtes sans origin (Postman, mobile apps)
        if (!origin) return callback(null, true);

        if (config.cors.origins.includes(origin) || config.isDev) {
          callback(null, true);
        } else {
          callback(new Error('Origine non autorisée par CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // ─── Parsing ───────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ─── Compression ───────────────────────────────────────────
  app.use(compression());

  // ─── Logging HTTP ──────────────────────────────────────────
  app.use(
    morgan(config.isDev ? 'dev' : 'combined', {
      stream: morganStream,
    })
  );

  // ─── Trust proxy (utile derrière nginx/cloudflare) ─────────
  app.set('trust proxy', 1);

  // ─── Rate Limiting global ──────────────────────────────────
  app.use('/api', globalRateLimiter);

  // ─── Route racine ──────────────────────────────────────────
  app.get('/', (req: Request, res: Response) => {
    sendSuccess(res, {
      message: `Bienvenue sur l'API ${config.appName} 🏥`,
      version: '1.0.0',
      apiVersion: config.apiVersion,
      documentation: `${config.appUrl}/api/${config.apiVersion}/health`,
      environment: config.env,
    });
  });

  // ─── Routes API ────────────────────────────────────────────
  app.use(`/api/${config.apiVersion}`, apiRoutes);

  // ─── 404 ───────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ─── Error handler global (DOIT être dernier) ──────────────
  app.use(errorHandler);

  return app;
};
