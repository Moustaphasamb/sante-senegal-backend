import http from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { verifyAccessToken } from '../utils/jwt';
import { prisma } from '../config/database';

// Extension du type SocketData de socket.io
declare module 'socket.io' {
  interface SocketData {
    userId: string;
    userRole: string;
  }
}

let io: Server | null = null;

export function initSocket(server: http.Server): Server {
  // Fix #3 : CORS fail-closed — pas de wildcard avec credentials
  const rawOrigins = process.env.CORS_ORIGINS?.split(',').filter(Boolean);
  const corsOrigins: string[] | string =
    rawOrigins && rawOrigins.length > 0
      ? rawOrigins
      : process.env.NODE_ENV === 'production'
        ? (() => { throw new Error('CORS_ORIGINS requis en production'); })()
        : ['http://localhost:5173', 'http://localhost:3001'];

  io = new Server(server, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Fix #1 : Authentification JWT sur chaque connexion Socket.io
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ??
      socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentification requise — fournissez un Bearer token'));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      socket.data.userRole = payload.role;
      next();
    } catch {
      next(new Error('Token invalide ou expiré'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    logger.debug('Client WebSocket connecté', { socketId: socket.id, userId });

    // Auto-rejoindre la room personnelle — serveur-side uniquement (jamais client)
    socket.join(`user:${userId}`);

    // Fix #2 : Rejoindre une room home-visit après vérification DB
    socket.on('join-home-visit', async (homeVisitId: string) => {
      if (typeof homeVisitId !== 'string' || homeVisitId.length === 0) return;
      try {
        const visit = await prisma.homeVisit.findUnique({
          where: { id: homeVisitId },
          select: {
            patient: { select: { userId: true } },
            medecin: { select: { userId: true } },
          },
        });
        const isInvolved =
          visit?.patient.userId === userId || visit?.medecin?.userId === userId;

        if (isInvolved) {
          socket.join(`home-visit:${homeVisitId}`);
          logger.debug('Socket rejoint room visite', { homeVisitId, userId });
        } else {
          socket.emit('error', { message: 'Accès refusé à cette visite' });
        }
      } catch (err) {
        logger.error('Erreur join-home-visit', { homeVisitId, userId, err });
      }
    });

    // Fix #2 : Tracking GPS — seul le médecin assigné peut broadcaster
    socket.on(
      'home-visit:tracking',
      async (data: { homeVisitId: string; lat: number; lng: number }) => {
        if (!data?.homeVisitId) return;
        try {
          const visit = await prisma.homeVisit.findUnique({
            where: { id: data.homeVisitId },
            select: { medecin: { select: { userId: true } } },
          });
          if (visit?.medecin?.userId !== userId) return; // seul le médecin peut envoyer
          io?.to(`home-visit:${data.homeVisitId}`).emit('home-visit:tracking', {
            lat: data.lat,
            lng: data.lng,
            timestamp: new Date().toISOString(),
          });
        } catch {}
      }
    );

    socket.on('disconnect', () => {
      logger.debug('Client WebSocket déconnecté', { socketId: socket.id, userId });
    });
  });

  logger.info('✅ Socket.io initialisé');
  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io non initialisé — appelez initSocket() au démarrage');
  return io;
}
