import http from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';

let io: Server | null = null;

export function initSocket(server: http.Server): Server {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') ?? '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    logger.debug('Client WebSocket connecté', { socketId: socket.id });

    // Rejoindre une room personnelle avec son userId
    socket.on('join', (userId: string) => {
      if (typeof userId === 'string' && userId.length > 0) {
        socket.join(`user:${userId}`);
        logger.debug('Socket rejoint room utilisateur', { userId, socketId: socket.id });
      }
    });

    // Rejoindre la room d'une visite à domicile (patient + médecin)
    socket.on('join-home-visit', (homeVisitId: string) => {
      if (typeof homeVisitId === 'string' && homeVisitId.length > 0) {
        socket.join(`home-visit:${homeVisitId}`);
        logger.debug('Socket rejoint room visite', { homeVisitId, socketId: socket.id });
      }
    });

    // Médecin libéral mobile → envoie sa position GPS en temps réel
    socket.on(
      'home-visit:tracking',
      (data: { homeVisitId: string; lat: number; lng: number }) => {
        if (!data?.homeVisitId) return;
        io?.to(`home-visit:${data.homeVisitId}`).emit('home-visit:tracking', {
          lat: data.lat,
          lng: data.lng,
          timestamp: new Date().toISOString(),
        });
      }
    );

    socket.on('disconnect', () => {
      logger.debug('Client WebSocket déconnecté', { socketId: socket.id });
    });
  });

  logger.info('✅ Socket.io initialisé');
  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io non initialisé — appelez initSocket() au démarrage');
  return io;
}
