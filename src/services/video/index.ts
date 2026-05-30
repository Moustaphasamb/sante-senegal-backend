import { config } from '../../config/env';
import { logger } from '../../utils/logger';
import type { VideoProvider } from './video-provider.interface';
import { DailyProvider } from './daily.provider';
import { MockProvider } from './mock.provider';

let cached: VideoProvider | null = null;

/**
 * Renvoie le provider vidéo actif.
 * Daily si DAILY_API_KEY est défini, sinon MockProvider (dev) — comme Redis/SMS,
 * l'app doit fonctionner sans service externe.
 */
export function getVideoProvider(): VideoProvider {
  if (cached) return cached;

  if (config.video.dailyApiKey) {
    cached = new DailyProvider();
  } else if (config.isProd) {
    // Fail-closed : interdit le provider mock en production (app médicale).
    throw new Error(
      'DAILY_API_KEY requis en production — refus de démarrer avec le provider vidéo MOCK'
    );
  } else {
    logger.warn('⚠️ DAILY_API_KEY absent → provider vidéo MOCK (dev uniquement)');
    cached = new MockProvider();
  }
  return cached;
}

export type { VideoProvider } from './video-provider.interface';
