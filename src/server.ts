import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { config } from './config/env';
import { logger } from './utils/logger';
import { testDatabaseConnection, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { initSocket } from './sockets';

const startServer = async (): Promise<void> => {
  try {
    // ─── Bannière de démarrage ─────────────────────────────
    logger.info('═══════════════════════════════════════════════════════');
    logger.info(`   🏥  ${config.appName} - Backend API`);
    logger.info('═══════════════════════════════════════════════════════');
    logger.info(`   Environnement : ${config.env}`);
    logger.info(`   Port          : ${config.port}`);
    logger.info(`   API Version   : ${config.apiVersion}`);
    logger.info('═══════════════════════════════════════════════════════');

    // ─── Test de la base de données ────────────────────────
    logger.info('🔄 Connexion à la base de données...');
    const dbOk = await testDatabaseConnection();
    if (!dbOk) {
      logger.error('❌ Impossible de se connecter à PostgreSQL');
      process.exit(1);
    }
    logger.info('✅ PostgreSQL connecté');

    // ─── Connexion Redis (optionnelle au démarrage) ────────
    try {
      logger.info('🔄 Connexion à Redis...');
      const redisOk = await connectRedis();
      if (redisOk) {
        logger.info('✅ Redis connecté');
      } else {
        logger.warn('⚠️  Redis non disponible — fonctionnalités temps réel limitées');
      }
    } catch (error) {
      logger.warn('⚠️  Redis non disponible — fonctionnalités temps réel limitées');
    }

    // ─── Création de l'app Express ─────────────────────────
    const app = createApp();
    const server = http.createServer(app);

    // ─── Socket.io ────────────────────────────────────────
    initSocket(server);

    // ─── Démarrage du serveur ──────────────────────────────
    server.listen(config.port, () => {
      logger.info('═══════════════════════════════════════════════════════');
      logger.info(`✅ Serveur démarré sur ${config.appUrl}`);
      logger.info(`📚 Health check : ${config.appUrl}/api/${config.apiVersion}/health`);
      logger.info('═══════════════════════════════════════════════════════');
    });

    // ─── Gestion arrêt propre ──────────────────────────────
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`\n${signal} reçu, arrêt en cours...`);

      server.close(async () => {
        logger.info('🛑 Serveur HTTP fermé');

        try {
          await disconnectDatabase();
          logger.info('🛑 Connexion PostgreSQL fermée');
        } catch (error) {
          logger.error('Erreur fermeture DB:', error);
        }

        try {
          await disconnectRedis();
          logger.info('🛑 Connexion Redis fermée');
        } catch (error) {
          logger.error('Erreur fermeture Redis:', error);
        }

        process.exit(0);
      });

      // Force l'arrêt après 10s
      setTimeout(() => {
        logger.error('⚠️  Arrêt forcé après 10s');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // ─── Erreurs non gérées ────────────────────────────────
    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('❌ Unhandled Promise Rejection:', reason);
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error('❌ Uncaught Exception:', error);
      shutdown('uncaughtException');
    });
  } catch (error) {
    logger.error('❌ Erreur fatale au démarrage:', error);
    process.exit(1);
  }
};

// 🚀 Démarrage
startServer();
