import { config } from '../../config/env';
import { logger } from '../../utils/logger';
import { InternalServerError } from '../../utils/errors';
import type {
  VideoProvider,
  VideoRoom,
  CreateAccessTokenOptions,
} from './video-provider.interface';

const DAILY_BASE_URL = 'https://api.daily.co/v1';

/**
 * Provider vidéo Daily.co (https://docs.daily.co/reference).
 * Utilise le fetch global de Node. Nécessite config.video.dailyApiKey.
 */
export class DailyProvider implements VideoProvider {
  readonly name = 'daily';

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const apiKey = config.video.dailyApiKey;
    if (!apiKey) throw new InternalServerError('DAILY_API_KEY manquant');

    const res = await fetch(`${DAILY_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error('Erreur API Daily', { path, status: res.status, body });
      throw new InternalServerError(`Daily API a répondu ${res.status}`);
    }

    return (await res.json()) as T;
  }

  async createRoom(opts: { appointmentId: string }): Promise<VideoRoom> {
    const data = await this.request<{ name: string; url: string }>('/rooms', {
      method: 'POST',
      body: JSON.stringify({
        privacy: 'private',
        properties: {
          enable_recording: 'cloud',
          // Expiration de la room : 4h après création (epoch en secondes)
          exp: Math.floor(Date.now() / 1000) + 4 * 3600,
        },
      }),
    });
    return { providerRoomId: data.name, roomUrl: data.url };
  }

  async createAccessToken(opts: CreateAccessTokenOptions): Promise<string> {
    const data = await this.request<{ token: string }>('/meeting-tokens', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          room_name: opts.providerRoomId,
          user_name: opts.userName,
          is_owner: opts.isOwner,
        },
      }),
    });
    return data.token;
  }

  async startRecording(providerRoomId: string): Promise<{ providerRecordingId: string }> {
    const data = await this.request<{ recordingId: string }>(`/recordings/start`, {
      method: 'POST',
      body: JSON.stringify({ room_name: providerRoomId }),
    });
    return { providerRecordingId: data.recordingId };
  }

  async stopRecording(
    providerRoomId: string,
    providerRecordingId: string
  ): Promise<{ recordingUrl?: string }> {
    await this.request(`/recordings/stop`, {
      method: 'POST',
      body: JSON.stringify({ room_name: providerRoomId }),
    });
    // L'URL d'enregistrement Daily est récupérée via l'API recordings (asynchrone côté Daily).
    const rec = await this.request<{ download_link?: string }>(
      `/recordings/${providerRecordingId}`,
      { method: 'GET' }
    );
    return { recordingUrl: rec.download_link };
  }

  async deleteRoom(providerRoomId: string): Promise<void> {
    await this.request(`/rooms/${providerRoomId}`, { method: 'DELETE' });
  }
}
