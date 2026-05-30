import crypto from 'crypto';
import { logger } from '../../utils/logger';
import type {
  VideoProvider,
  VideoRoom,
  CreateAccessTokenOptions,
} from './video-provider.interface';

/**
 * Provider vidéo factice pour le développement et les tests.
 * Ne fait aucun appel réseau — simule rooms, tokens et enregistrements.
 */
export class MockProvider implements VideoProvider {
  readonly name = 'mock';

  async createRoom(opts: { appointmentId: string }): Promise<VideoRoom> {
    const providerRoomId = `mock-room-${opts.appointmentId}`;
    logger.debug('MockProvider.createRoom', { providerRoomId });
    return {
      providerRoomId,
      roomUrl: `https://mock.video/${providerRoomId}`,
    };
  }

  async createAccessToken(opts: CreateAccessTokenOptions): Promise<string> {
    const rand = crypto.randomBytes(6).toString('hex');
    return `mock-token-${opts.role}-${rand}`;
  }

  async startRecording(providerRoomId: string): Promise<{ providerRecordingId: string }> {
    logger.debug('MockProvider.startRecording', { providerRoomId });
    return { providerRecordingId: `mock-rec-${crypto.randomBytes(4).toString('hex')}` };
  }

  async stopRecording(
    providerRoomId: string,
    providerRecordingId: string
  ): Promise<{ recordingUrl?: string }> {
    logger.debug('MockProvider.stopRecording', { providerRoomId, providerRecordingId });
    return { recordingUrl: `https://mock.video/rec/${providerRecordingId}.mp4` };
  }

  async deleteRoom(providerRoomId: string): Promise<void> {
    logger.debug('MockProvider.deleteRoom', { providerRoomId });
  }
}
