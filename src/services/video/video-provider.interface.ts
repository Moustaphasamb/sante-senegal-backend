export interface VideoRoom {
  providerRoomId: string;
  roomUrl: string;
}

export interface CreateAccessTokenOptions {
  roomUrl: string;
  providerRoomId: string;
  userName: string;
  role: 'medecin' | 'patient';
  isOwner: boolean; // médecin = true (gère l'enregistrement côté provider)
}

export interface VideoProvider {
  readonly name: string; // "daily" | "mock"

  createRoom(opts: { appointmentId: string }): Promise<VideoRoom>;
  createAccessToken(opts: CreateAccessTokenOptions): Promise<string>;
  startRecording(providerRoomId: string): Promise<{ providerRecordingId: string }>;
  stopRecording(
    providerRoomId: string,
    providerRecordingId: string
  ): Promise<{ recordingUrl?: string }>;
  deleteRoom(providerRoomId: string): Promise<void>;
}
