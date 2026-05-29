import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════

class UploadService {
  private readonly isConfigured: boolean;

  constructor() {
    const { cloudName, apiKey, apiSecret } = config.cloudinary;
    this.isConfigured = !!(cloudName && apiKey && apiSecret);

    if (this.isConfigured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      logger.info('Cloudinary configuré');
    } else {
      logger.warn('Cloudinary non configuré — uploads désactivés en mode dev');
    }
  }

  // ─── PHOTO DE PROFIL ──────────────────────────────────────────────

  async uploadProfilePhoto(
    fileBuffer: Buffer,
    _mimeType: string,
    userId: string
  ): Promise<string> {
    if (!this.isConfigured) {
      // Mode dev : retourner une URL avatar généré automatiquement
      logger.debug('Upload photo (mode dev — Cloudinary non configuré)', { userId });
      return `https://ui-avatars.com/api/?name=${userId}&size=400&background=0D8ABC&color=fff&format=png`;
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `sante-senegal/users/${userId}`,
          public_id: 'photo',
          overwrite: true,
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' },
          ],
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        },
        (error, result) => {
          if (error || !result) {
            logger.error('Erreur upload Cloudinary', { error, userId });
            reject(error ?? new Error('Upload photo échoué'));
            return;
          }
          logger.info('Photo uploadée sur Cloudinary', { userId, url: result.secure_url });
          resolve(result.secure_url);
        }
      );
      stream.end(fileBuffer);
    });
  }

  // ─── DOCUMENT KYC ────────────────────────────────────────────────

  async uploadDocument(
    fileBuffer: Buffer,
    _mimeType: string,
    userId: string,
    documentType: string
  ): Promise<string> {
    if (!this.isConfigured) {
      logger.debug('Upload document KYC (mode dev — Cloudinary non configuré)', { userId, documentType });
      return `https://via.placeholder.com/800x600?text=${documentType}`;
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `sante-senegal/users/${userId}/documents`,
          public_id: documentType,
          overwrite: true,
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        },
        (error, result) => {
          if (error || !result) {
            logger.error('Erreur upload document Cloudinary', { error, userId, documentType });
            reject(error ?? new Error('Upload document échoué'));
            return;
          }
          logger.info('Document uploadé sur Cloudinary', { userId, documentType, url: result.secure_url });
          resolve(result.secure_url);
        }
      );
      stream.end(fileBuffer);
    });
  }

  async deleteProfilePhoto(userId: string): Promise<void> {
    if (!this.isConfigured) return;

    try {
      await cloudinary.uploader.destroy(`sante-senegal/users/${userId}/photo`);
      logger.info('Photo supprimée de Cloudinary', { userId });
    } catch (error) {
      // Ne pas bloquer si la suppression Cloudinary échoue
      logger.warn('Erreur suppression photo Cloudinary (non bloquante)', { userId, error });
    }
  }
}

export const uploadService = new UploadService();
