import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env';

// Créer le dossier logs s'il n'existe pas
const logDir = config.logging.directory;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Couleurs personnalisées
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Format des logs en console (dev)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Format des logs en fichier (prod)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Définir les transports
const transports: winston.transport[] = [
  // Console
  new winston.transports.Console({
    format: consoleFormat,
  }),

  // Fichier pour toutes les erreurs
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),

  // Fichier pour tous les logs
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: fileFormat,
    maxsize: 5242880,
    maxFiles: 5,
  }),
];

// Créer le logger
export const logger = winston.createLogger({
  level: config.logging.level,
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  transports,
  exitOnError: false,
});

// Stream pour Morgan (logs HTTP)
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};
