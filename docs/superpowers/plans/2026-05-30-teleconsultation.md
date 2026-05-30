# Module 19 — Téléconsultation vidéo : Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la téléconsultation vidéo (session liée à un RDV, jetons par participant, consentement + enregistrement, chat persisté) au backend Santé Sénégal.

**Architecture:** Modèle Prisma `Teleconsultation` 1-pour-1 avec `Appointment` + `TeleconsultationMessage` pour le chat. Couche provider abstraite (`VideoProvider`) avec `DailyProvider` (réel) et `MockProvider` (fallback dev), choisie par une factory selon `DAILY_API_KEY`. Logique métier dans un service, exposée par 11 endpoints REST + une room Socket.io.

**Tech Stack:** TypeScript 5, Express 4, Prisma 5, PostgreSQL 16, Socket.io 4, Zod. `fetch` global (Node 25) pour Daily — aucune dépendance ajoutée.

---

## ⚠️ Méthode de vérification (spécifique à ce projet)

Le projet **n'a pas de framework de tests installé** (pas de Vitest/Jest) et le CLAUDE.md (section 13) impose le workflow manuel suivant, suivi sur les 18 modules précédents. **On le respecte ici au lieu du TDD :**

- **Gate de chaque tâche** : `npx tsc --noEmit` doit passer sans erreur (en CMD : `npx tsc --noEmit`).
- **Validation finale** : test manuel des endpoints en **mode mock** (Task 11).
- **Commits fréquents** : un commit par tâche.
- Branche active : `feature/module-19-teleconsultation` (déjà créée).

> Toutes les commandes sont à lancer en **CMD**, depuis `C:\Users\samb9\Desktop\sante-senegal\sante-senegal-backend`.

---

## Plan de fichiers

**Créés :**
- `src/services/video/video-provider.interface.ts` — contrat `VideoProvider` + types.
- `src/services/video/mock.provider.ts` — implémentation factice (dev).
- `src/services/video/daily.provider.ts` — implémentation Daily.co (REST via `fetch`).
- `src/services/video/index.ts` — factory `getVideoProvider()`.
- `src/validators/teleconsultation.validators.ts` — schémas Zod.
- `src/services/teleconsultation.service.ts` — logique métier.
- `src/controllers/teleconsultation.controller.ts` — couche HTTP.
- `src/routes/teleconsultation.routes.ts` — endpoints.

**Modifiés :**
- `prisma/schema.prisma` — 2 enums, 2 modèles, 2 relations inverses (+ migration).
- `src/config/env.ts` — variables Daily.
- `.env.example` — variables Daily.
- `src/routes/index.ts` — enregistrement de la route.
- `src/sockets/index.ts` — room `teleconsultation:{id}`.
- `PROJECT-STATE.md` — état du module.

---

## Task 1 : Schéma Prisma + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1 : Ajouter les 2 enums**

Ajouter à la suite des autres enums (après `enum VaccinationStatus { ... }`) :

```prisma
enum TeleconsultationStatus {
  EN_ATTENTE   // room provisionnée, appel pas démarré
  EN_COURS     // démarrée par le médecin
  TERMINEE
  ANNULEE
}

enum RecordingStatus {
  AUCUN
  CONSENTEMENT_REFUSE
  CONSENTEMENT_DONNE
  EN_COURS
  DISPONIBLE          // URL d'enregistrement disponible
  ECHEC
}
```

- [ ] **Step 2 : Ajouter les 2 modèles**

Ajouter à la fin de la zone des modèles (à côté de `model Consultation`/`model Appointment`) :

```prisma
model Teleconsultation {
  id                  String   @id @default(cuid())

  appointmentId       String   @unique
  appointment         Appointment @relation(fields: [appointmentId], references: [id])

  // Provider
  provider            String   // "daily" | "mock"
  providerRoomId      String
  roomUrl             String
  medecinToken        String?  // jeton d'accès médecin (rôle owner)
  patientToken        String?  // jeton d'accès patient

  // Cycle de vie
  status              TeleconsultationStatus @default(EN_ATTENTE)
  startedAt           DateTime?
  endedAt             DateTime?

  // Enregistrement + consentement (R6 / CDP)
  recordingStatus     RecordingStatus @default(AUCUN)
  recordingConsentAt  DateTime?
  recordingUrl        String?
  providerRecordingId String?

  messages            TeleconsultationMessage[]

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([status])
  @@map("teleconsultations")
}

model TeleconsultationMessage {
  id                  String   @id @default(cuid())

  teleconsultationId  String
  teleconsultation    Teleconsultation @relation(fields: [teleconsultationId], references: [id], onDelete: Cascade)

  senderId            String   // userId
  sender              User     @relation(fields: [senderId], references: [id])
  content             String   @db.Text

  createdAt           DateTime @default(now())

  @@index([teleconsultationId])
  @@map("teleconsultation_messages")
}
```

- [ ] **Step 3 : Ajouter les 2 relations inverses**

Dans `model Appointment`, ajouter une ligne (à côté de `consultation Consultation?`) :

```prisma
  teleconsultation Teleconsultation?
```

Dans `model User`, ajouter la ligne (parmi les autres relations) :

```prisma
  teleconsultationMessages TeleconsultationMessage[]
```

- [ ] **Step 4 : Créer la migration et régénérer le client**

Run (CMD) :
```cmd
npx prisma migrate dev --name add_teleconsultation
```
Expected : migration créée, `Your database is now in sync`, puis le client Prisma se régénère automatiquement. Si le client ne se régénère pas, lancer `npx prisma generate`.

- [ ] **Step 5 : Vérifier la compilation**

Run : `npx tsc --noEmit`
Expected : 0 erreur (les types `Teleconsultation`, `TeleconsultationStatus`, `RecordingStatus` sont désormais connus de `@prisma/client`).

- [ ] **Step 6 : Commit**

```cmd
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(teleconsultation): schéma Prisma — modèles Teleconsultation + messages"
```

---

## Task 2 : Variables d'environnement Daily

**Files:**
- Modify: `src/config/env.ts`
- Modify: `.env.example`

- [ ] **Step 1 : Ajouter les variables au schéma Zod**

Dans `src/config/env.ts`, dans l'objet `envSchema`, ajouter après le bloc Mapbox (`MAPBOX_ACCESS_TOKEN`) :

```ts
  // Téléconsultation vidéo (Daily.co)
  DAILY_API_KEY: z.string().optional(),
  DAILY_DOMAIN: z.string().optional(),
```

- [ ] **Step 2 : Exposer dans l'objet config**

Dans `src/config/env.ts`, dans l'objet `config`, ajouter après le bloc `mapbox: { ... },` :

```ts
  video: {
    dailyApiKey: env.DAILY_API_KEY,
    dailyDomain: env.DAILY_DOMAIN,
  },
```

- [ ] **Step 3 : Documenter dans `.env.example`**

Ajouter à la fin de `.env.example` :

```
# Téléconsultation vidéo (Daily.co) — laisser vide en dev pour utiliser le provider MOCK
DAILY_API_KEY=
DAILY_DOMAIN=
```

- [ ] **Step 4 : Vérifier la compilation**

Run : `npx tsc --noEmit`
Expected : 0 erreur.

- [ ] **Step 5 : Commit**

```cmd
git add src/config/env.ts .env.example
git commit -m "feat(teleconsultation): config env Daily (DAILY_API_KEY, DAILY_DOMAIN)"
```

---

## Task 3 : Interface provider + MockProvider

**Files:**
- Create: `src/services/video/video-provider.interface.ts`
- Create: `src/services/video/mock.provider.ts`

- [ ] **Step 1 : Créer l'interface**

`src/services/video/video-provider.interface.ts` :

```ts
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
```

- [ ] **Step 2 : Créer le MockProvider**

`src/services/video/mock.provider.ts` :

```ts
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
```

- [ ] **Step 3 : Vérifier la compilation**

Run : `npx tsc --noEmit`
Expected : 0 erreur.

- [ ] **Step 4 : Commit**

```cmd
git add src/services/video/video-provider.interface.ts src/services/video/mock.provider.ts
git commit -m "feat(teleconsultation): interface VideoProvider + MockProvider"
```

---

## Task 4 : DailyProvider

**Files:**
- Create: `src/services/video/daily.provider.ts`

- [ ] **Step 1 : Créer le DailyProvider**

`src/services/video/daily.provider.ts` :

```ts
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
    const data = await this.request<{ recordingId: string }>(
      `/recordings/start`,
      {
        method: 'POST',
        body: JSON.stringify({ room_name: providerRoomId }),
      }
    );
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
```

> Note : les chemins exacts de l'API recording de Daily peuvent évoluer ; en mode dev on utilise le MockProvider, donc DailyProvider n'est sollicité qu'en présence d'une vraie clé. Ajuster les endpoints recording lors du branchement réel en prod.

- [ ] **Step 2 : Vérifier la compilation**

Run : `npx tsc --noEmit`
Expected : 0 erreur. Si `fetch`/`RequestInit` sont inconnus du compilateur, vérifier que `@types/node` est bien en v22+ (c'est le cas dans `package.json`) — ils sont alors fournis globalement.

- [ ] **Step 3 : Commit**

```cmd
git add src/services/video/daily.provider.ts
git commit -m "feat(teleconsultation): DailyProvider (REST via fetch)"
```

---

## Task 5 : Factory de provider

**Files:**
- Create: `src/services/video/index.ts`

- [ ] **Step 1 : Créer la factory**

`src/services/video/index.ts` :

```ts
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
  } else {
    logger.warn('⚠️ DAILY_API_KEY absent → provider vidéo MOCK (dev uniquement)');
    cached = new MockProvider();
  }
  return cached;
}

export type { VideoProvider } from './video-provider.interface';
```

- [ ] **Step 2 : Vérifier la compilation**

Run : `npx tsc --noEmit`
Expected : 0 erreur.

- [ ] **Step 3 : Commit**

```cmd
git add src/services/video/index.ts
git commit -m "feat(teleconsultation): factory getVideoProvider (Daily/Mock selon env)"
```

---

## Task 6 : Validators Zod

**Files:**
- Create: `src/validators/teleconsultation.validators.ts`

- [ ] **Step 1 : Créer les schémas**

`src/validators/teleconsultation.validators.ts` :

```ts
import { z } from 'zod';

export const createTeleconsultationSchema = z.object({
  appointmentId: z.string().min(1, 'appointmentId requis'),
});

export const recordingConsentSchema = z.object({
  consent: z.boolean(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message vide').max(2000),
});

export const listTeleconsultationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTeleconsultationInput = z.infer<typeof createTeleconsultationSchema>;
export type RecordingConsentInput = z.infer<typeof recordingConsentSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ListTeleconsultationsQuery = z.infer<typeof listTeleconsultationsSchema>;
```

- [ ] **Step 2 : Vérifier la compilation**

Run : `npx tsc --noEmit`
Expected : 0 erreur.

- [ ] **Step 3 : Commit**

```cmd
git add src/validators/teleconsultation.validators.ts
git commit -m "feat(teleconsultation): validators Zod"
```

---

## Task 7 : Service métier

**Files:**
- Create: `src/services/teleconsultation.service.ts`

- [ ] **Step 1 : Créer le service complet**

`src/services/teleconsultation.service.ts` :

```ts
import {
  UserRole,
  AppointmentMode,
  AppointmentStatus,
  TeleconsultationStatus,
  RecordingStatus,
  NotificationType,
} from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../utils/errors';
import { createAuditLog } from '../utils/audit';
import { getIO } from '../sockets';
import { getVideoProvider } from './video/index';
import { notificationService } from './notification.service';
import type { ListTeleconsultationsQuery } from '../validators/teleconsultation.validators';

// ═══════════════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════════════

const CREATABLE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.EN_ATTENTE,
  AppointmentStatus.CONFIRME,
  AppointmentStatus.EN_COURS,
];

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

/** Émet un événement Socket.io vers la room d'une téléconsultation (best-effort). */
function emitToRoom(teleconsultationId: string, event: string, payload: unknown): void {
  try {
    getIO().to(`teleconsultation:${teleconsultationId}`).emit(event, payload);
  } catch (err) {
    logger.warn('Émission Socket.io téléconsultation échouée', { teleconsultationId, event, err });
  }
}

type AccessResult = {
  tele: Awaited<ReturnType<typeof loadWithAppointment>>;
  isPatient: boolean;
  isMedecin: boolean;
};

function loadWithAppointment(id: string) {
  return prisma.teleconsultation.findUnique({
    where: { id },
    include: {
      appointment: {
        select: {
          id: true,
          mode: true,
          status: true,
          patient: { select: { userId: true } },
          medecin: { select: { userId: true } },
        },
      },
    },
  });
}

/** Retire les jetons d'accès avant exposition HTTP. */
function publicView<T extends { medecinToken: string | null; patientToken: string | null }>(t: T) {
  const { medecinToken: _m, patientToken: _p, ...rest } = t;
  return rest;
}

class TeleconsultationService {
  /** Charge + vérifie que l'utilisateur est patient ou médecin du RDV lié. */
  private async resolveAccess(teleconsultationId: string, userId: string): Promise<AccessResult> {
    const tele = await loadWithAppointment(teleconsultationId);
    if (!tele) throw new NotFoundError('Téléconsultation');

    const isPatient = tele.appointment.patient.userId === userId;
    const isMedecin = tele.appointment.medecin.userId === userId;
    if (!isPatient && !isMedecin) {
      throw new ForbiddenError("Cette téléconsultation ne vous concerne pas");
    }
    return { tele, isPatient, isMedecin };
  }

  // ─── CRÉER / RÉCUPÉRER (idempotent) ──────────────────────────────
  async create(userId: string, appointmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        mode: true,
        status: true,
        patient: { select: { userId: true } },
        medecin: { select: { userId: true } },
      },
    });
    if (!appointment) throw new NotFoundError('Rendez-vous');

    const isPatient = appointment.patient.userId === userId;
    const isMedecin = appointment.medecin.userId === userId;
    if (!isPatient && !isMedecin) {
      throw new ForbiddenError("Ce rendez-vous ne vous concerne pas");
    }

    if (appointment.mode !== AppointmentMode.TELECONSULTATION) {
      throw new BadRequestError("Ce rendez-vous n'est pas une téléconsultation");
    }
    if (!CREATABLE_APPOINTMENT_STATUSES.includes(appointment.status)) {
      throw new BadRequestError("Le statut du rendez-vous ne permet pas de démarrer une téléconsultation");
    }

    // Idempotence : renvoyer l'existante
    const existing = await prisma.teleconsultation.findUnique({ where: { appointmentId } });
    if (existing) return publicView(existing);

    // Provisionner la room + 2 jetons
    const provider = getVideoProvider();
    const room = await provider.createRoom({ appointmentId });
    const [medecinToken, patientToken] = await Promise.all([
      provider.createAccessToken({
        roomUrl: room.roomUrl,
        providerRoomId: room.providerRoomId,
        userName: 'Médecin',
        role: 'medecin',
        isOwner: true,
      }),
      provider.createAccessToken({
        roomUrl: room.roomUrl,
        providerRoomId: room.providerRoomId,
        userName: 'Patient',
        role: 'patient',
        isOwner: false,
      }),
    ]);

    const tele = await prisma.teleconsultation.create({
      data: {
        appointmentId,
        provider: provider.name,
        providerRoomId: room.providerRoomId,
        roomUrl: room.roomUrl,
        medecinToken,
        patientToken,
        status: TeleconsultationStatus.EN_ATTENTE,
      },
    });

    logger.info('Téléconsultation créée', { id: tele.id, appointmentId, provider: provider.name });
    return publicView(tele);
  }

  // ─── LISTE (mes téléconsultations) ───────────────────────────────
  async listMine(userId: string, query: ListTeleconsultationsQuery) {
    const where = {
      appointment: {
        OR: [
          { patient: { userId } },
          { medecin: { userId } },
        ],
      },
    };
    const [items, total] = await Promise.all([
      prisma.teleconsultation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.teleconsultation.count({ where }),
    ]);
    return {
      items: items.map(publicView),
      pagination: { page: query.page, limit: query.limit, total },
    };
  }

  // ─── DÉTAIL ──────────────────────────────────────────────────────
  async getById(teleconsultationId: string, userId: string, role: UserRole) {
    if (role === UserRole.SUPER_ADMIN) {
      const tele = await prisma.teleconsultation.findUnique({ where: { id: teleconsultationId } });
      if (!tele) throw new NotFoundError('Téléconsultation');
      return publicView(tele);
    }
    const { tele } = await this.resolveAccess(teleconsultationId, userId);
    return publicView(tele);
  }

  // ─── REJOINDRE (renvoie MON jeton) ───────────────────────────────
  async join(teleconsultationId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const { tele, isMedecin } = await this.resolveAccess(teleconsultationId, userId);

    if (
      tele.status === TeleconsultationStatus.TERMINEE ||
      tele.status === TeleconsultationStatus.ANNULEE
    ) {
      throw new BadRequestError('Cette téléconsultation est terminée');
    }

    // Recharger les jetons (loadWithAppointment ne les sélectionne pas)
    const full = await prisma.teleconsultation.findUnique({
      where: { id: teleconsultationId },
      select: { roomUrl: true, medecinToken: true, patientToken: true, status: true, provider: true },
    });
    if (!full) throw new NotFoundError('Téléconsultation');

    await createAuditLog({
      userId,
      action: 'TELECONSULTATION_JOIN',
      resourceType: 'Teleconsultation',
      resourceId: teleconsultationId,
      ipAddress,
      userAgent,
    });

    return {
      roomUrl: full.roomUrl,
      token: isMedecin ? full.medecinToken : full.patientToken,
      status: full.status,
      provider: full.provider,
    };
  }

  // ─── DÉMARRER (médecin) ──────────────────────────────────────────
  async start(teleconsultationId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const { tele, isMedecin } = await this.resolveAccess(teleconsultationId, userId);
    if (!isMedecin) throw new ForbiddenError('Seul le médecin peut démarrer la téléconsultation');
    if (tele.status !== TeleconsultationStatus.EN_ATTENTE) {
      throw new BadRequestError('La téléconsultation a déjà démarré ou est terminée');
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.teleconsultation.update({
        where: { id: teleconsultationId },
        data: { status: TeleconsultationStatus.EN_COURS, startedAt: now },
      });
      await tx.appointment.update({
        where: { id: tele.appointment.id },
        data: { status: AppointmentStatus.EN_COURS, startedAt: now },
      });
      return t;
    });

    // Notifier le patient (best-effort)
    void notificationService.notify(
      tele.appointment.patient.userId,
      NotificationType.SYSTEM,
      'Téléconsultation démarrée',
      'Votre médecin a démarré la téléconsultation. Rejoignez l\'appel.',
      { actionUrl: `/teleconsultations/${teleconsultationId}` }
    );

    emitToRoom(teleconsultationId, 'teleconsultation:status', {
      status: TeleconsultationStatus.EN_COURS,
    });

    await createAuditLog({
      userId,
      action: 'TELECONSULTATION_START',
      resourceType: 'Teleconsultation',
      resourceId: teleconsultationId,
      ipAddress,
      userAgent,
    });

    return publicView(updated);
  }

  // ─── TERMINER (médecin) ──────────────────────────────────────────
  async end(teleconsultationId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const { tele, isMedecin } = await this.resolveAccess(teleconsultationId, userId);
    if (!isMedecin) throw new ForbiddenError('Seul le médecin peut terminer la téléconsultation');
    if (tele.status !== TeleconsultationStatus.EN_COURS) {
      throw new BadRequestError("La téléconsultation n'est pas en cours");
    }

    const full = await prisma.teleconsultation.findUnique({ where: { id: teleconsultationId } });
    if (!full) throw new NotFoundError('Téléconsultation');

    const provider = getVideoProvider();

    // Arrêter l'enregistrement s'il est en cours (best-effort)
    if (full.recordingStatus === RecordingStatus.EN_COURS && full.providerRecordingId) {
      try {
        const { recordingUrl } = await provider.stopRecording(full.providerRoomId, full.providerRecordingId);
        await prisma.teleconsultation.update({
          where: { id: teleconsultationId },
          data: { recordingStatus: RecordingStatus.DISPONIBLE, recordingUrl },
        });
      } catch (err) {
        logger.warn('Arrêt enregistrement à la clôture échoué', { teleconsultationId, err });
      }
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.teleconsultation.update({
        where: { id: teleconsultationId },
        data: { status: TeleconsultationStatus.TERMINEE, endedAt: now },
      });
      await tx.appointment.update({
        where: { id: tele.appointment.id },
        data: { status: AppointmentStatus.TERMINE, endedAt: now },
      });
      return t;
    });

    // Supprimer la room côté provider (best-effort)
    try {
      await provider.deleteRoom(full.providerRoomId);
    } catch (err) {
      logger.warn('Suppression room provider échouée', { teleconsultationId, err });
    }

    emitToRoom(teleconsultationId, 'teleconsultation:status', {
      status: TeleconsultationStatus.TERMINEE,
    });

    await createAuditLog({
      userId,
      action: 'TELECONSULTATION_END',
      resourceType: 'Teleconsultation',
      resourceId: teleconsultationId,
      ipAddress,
      userAgent,
    });

    return publicView(updated);
  }

  // ─── CONSENTEMENT ENREGISTREMENT (patient) ───────────────────────
  async setRecordingConsent(teleconsultationId: string, userId: string, consent: boolean) {
    const { isPatient } = await this.resolveAccess(teleconsultationId, userId);
    if (!isPatient) throw new ForbiddenError('Seul le patient peut donner son consentement');

    const updated = await prisma.teleconsultation.update({
      where: { id: teleconsultationId },
      data: {
        recordingStatus: consent
          ? RecordingStatus.CONSENTEMENT_DONNE
          : RecordingStatus.CONSENTEMENT_REFUSE,
        recordingConsentAt: new Date(),
      },
    });

    emitToRoom(teleconsultationId, 'teleconsultation:recording', {
      recordingStatus: updated.recordingStatus,
    });

    return publicView(updated);
  }

  // ─── DÉMARRER ENREGISTREMENT (médecin, fail-closed) ──────────────
  async startRecording(teleconsultationId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const { tele, isMedecin } = await this.resolveAccess(teleconsultationId, userId);
    if (!isMedecin) throw new ForbiddenError('Seul le médecin peut enregistrer');
    if (tele.status !== TeleconsultationStatus.EN_COURS) {
      throw new BadRequestError("La téléconsultation n'est pas en cours");
    }

    const full = await prisma.teleconsultation.findUnique({ where: { id: teleconsultationId } });
    if (!full) throw new NotFoundError('Téléconsultation');
    if (full.recordingStatus !== RecordingStatus.CONSENTEMENT_DONNE) {
      throw new ForbiddenError('Consentement du patient requis avant tout enregistrement');
    }

    const provider = getVideoProvider();
    const { providerRecordingId } = await provider.startRecording(full.providerRoomId);

    const updated = await prisma.teleconsultation.update({
      where: { id: teleconsultationId },
      data: { recordingStatus: RecordingStatus.EN_COURS, providerRecordingId },
    });

    emitToRoom(teleconsultationId, 'teleconsultation:recording', {
      recordingStatus: RecordingStatus.EN_COURS,
    });

    await createAuditLog({
      userId,
      action: 'TELECONSULTATION_RECORDING_START',
      resourceType: 'Teleconsultation',
      resourceId: teleconsultationId,
      ipAddress,
      userAgent,
    });

    return publicView(updated);
  }

  // ─── ARRÊTER ENREGISTREMENT (médecin) ────────────────────────────
  async stopRecording(teleconsultationId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const { isMedecin } = await this.resolveAccess(teleconsultationId, userId);
    if (!isMedecin) throw new ForbiddenError('Seul le médecin peut arrêter l\'enregistrement');

    const full = await prisma.teleconsultation.findUnique({ where: { id: teleconsultationId } });
    if (!full) throw new NotFoundError('Téléconsultation');
    if (full.recordingStatus !== RecordingStatus.EN_COURS || !full.providerRecordingId) {
      throw new BadRequestError('Aucun enregistrement en cours');
    }

    const provider = getVideoProvider();
    const { recordingUrl } = await provider.stopRecording(full.providerRoomId, full.providerRecordingId);

    const updated = await prisma.teleconsultation.update({
      where: { id: teleconsultationId },
      data: { recordingStatus: RecordingStatus.DISPONIBLE, recordingUrl },
    });

    emitToRoom(teleconsultationId, 'teleconsultation:recording', {
      recordingStatus: RecordingStatus.DISPONIBLE,
    });

    await createAuditLog({
      userId,
      action: 'TELECONSULTATION_RECORDING_STOP',
      resourceType: 'Teleconsultation',
      resourceId: teleconsultationId,
      ipAddress,
      userAgent,
    });

    return publicView(updated);
  }

  // ─── CHAT : liste ────────────────────────────────────────────────
  async listMessages(teleconsultationId: string, userId: string) {
    await this.resolveAccess(teleconsultationId, userId);
    return prisma.teleconsultationMessage.findMany({
      where: { teleconsultationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── CHAT : envoyer ──────────────────────────────────────────────
  async sendMessage(teleconsultationId: string, userId: string, content: string) {
    await this.resolveAccess(teleconsultationId, userId);
    const message = await prisma.teleconsultationMessage.create({
      data: { teleconsultationId, senderId: userId, content },
    });

    emitToRoom(teleconsultationId, 'teleconsultation:message', {
      id: message.id,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt,
    });

    return message;
  }
}

export const teleconsultationService = new TeleconsultationService();
```

- [ ] **Step 2 : Vérifier la compilation**

Run : `npx tsc --noEmit`
Expected : 0 erreur. Points de vigilance : `notificationService` est bien exporté par `notification.service.ts` ; `getIO` par `../sockets` ; les valeurs d'enum (`AppointmentStatus.TERMINE`, etc.) existent dans le schéma.

- [ ] **Step 3 : Commit**

```cmd
git add src/services/teleconsultation.service.ts
git commit -m "feat(teleconsultation): service métier (cycle de vie, enregistrement, chat)"
```

---

## Task 8 : Controller

**Files:**
- Create: `src/controllers/teleconsultation.controller.ts`

- [ ] **Step 1 : Créer le controller**

`src/controllers/teleconsultation.controller.ts` :

```ts
import { Request, Response, NextFunction } from 'express';
import { teleconsultationService } from '../services/teleconsultation.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import type {
  CreateTeleconsultationInput,
  RecordingConsentInput,
  SendMessageInput,
  ListTeleconsultationsQuery,
} from '../validators/teleconsultation.validators';

function getCtx(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

class TeleconsultationController {
  create = async (req: Request<{}, {}, CreateTeleconsultationInput>, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await teleconsultationService.create(req.user.userId, req.body.appointmentId);
      sendCreated(res, result, 'Téléconsultation prête');
    } catch (error) {
      next(error);
    }
  };

  listMine = async (req: Request<{}, {}, {}, ListTeleconsultationsQuery>, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await teleconsultationService.listMine(req.user.userId, req.query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await teleconsultationService.getById(req.params.id, req.user.userId, req.user.role);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  join = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const result = await teleconsultationService.join(req.params.id, req.user.userId, ipAddress, userAgent);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  start = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const result = await teleconsultationService.start(req.params.id, req.user.userId, ipAddress, userAgent);
      sendSuccess(res, result, 'Téléconsultation démarrée');
    } catch (error) {
      next(error);
    }
  };

  end = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const result = await teleconsultationService.end(req.params.id, req.user.userId, ipAddress, userAgent);
      sendSuccess(res, result, 'Téléconsultation terminée');
    } catch (error) {
      next(error);
    }
  };

  recordingConsent = async (req: Request<{ id: string }, {}, RecordingConsentInput>, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await teleconsultationService.setRecordingConsent(req.params.id, req.user.userId, req.body.consent);
      sendSuccess(res, result, 'Consentement enregistré');
    } catch (error) {
      next(error);
    }
  };

  startRecording = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const result = await teleconsultationService.startRecording(req.params.id, req.user.userId, ipAddress, userAgent);
      sendSuccess(res, result, 'Enregistrement démarré');
    } catch (error) {
      next(error);
    }
  };

  stopRecording = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const result = await teleconsultationService.stopRecording(req.params.id, req.user.userId, ipAddress, userAgent);
      sendSuccess(res, result, 'Enregistrement arrêté');
    } catch (error) {
      next(error);
    }
  };

  listMessages = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await teleconsultationService.listMessages(req.params.id, req.user.userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (req: Request<{ id: string }, {}, SendMessageInput>, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await teleconsultationService.sendMessage(req.params.id, req.user.userId, req.body.content);
      sendCreated(res, result, 'Message envoyé');
    } catch (error) {
      next(error);
    }
  };
}

export const teleconsultationController = new TeleconsultationController();
```

- [ ] **Step 2 : Vérifier la compilation**

Run : `npx tsc --noEmit`
Expected : 0 erreur. Vérifier que `req.user.role` existe sur le type Express étendu (utilisé aussi dans `consultation.controller.ts`).

- [ ] **Step 3 : Commit**

```cmd
git add src/controllers/teleconsultation.controller.ts
git commit -m "feat(teleconsultation): controller HTTP"
```

---

## Task 9 : Routes + enregistrement

**Files:**
- Create: `src/routes/teleconsultation.routes.ts`
- Modify: `src/routes/index.ts`

- [ ] **Step 1 : Créer le fichier de routes**

`src/routes/teleconsultation.routes.ts` :

```ts
import { Router } from 'express';
import { teleconsultationController } from '../controllers/teleconsultation.controller';
import { authenticate, authorize } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createTeleconsultationSchema,
  recordingConsentSchema,
  sendMessageSchema,
  listTeleconsultationsSchema,
} from '../validators/teleconsultation.validators';
import { UserRole } from '@prisma/client';

const router = Router();

const MEDECIN_ROLES = [
  UserRole.MEDECIN_SALARIE,
  UserRole.MEDECIN_LIBERAL_MOBILE,
  UserRole.SPECIALISTE_CABINET,
] as const;

// Création / liste / détail
router.post('/', authenticate, validateBody(createTeleconsultationSchema), teleconsultationController.create);
router.get('/me', authenticate, validateQuery(listTeleconsultationsSchema), teleconsultationController.listMine);
router.get('/:id', authenticate, teleconsultationController.getById);

// Session
router.post('/:id/join', authenticate, teleconsultationController.join);
router.post('/:id/start', authenticate, authorize(...MEDECIN_ROLES), teleconsultationController.start);
router.post('/:id/end', authenticate, authorize(...MEDECIN_ROLES), teleconsultationController.end);

// Enregistrement
router.patch('/:id/recording-consent', authenticate, authorize(UserRole.PATIENT), validateBody(recordingConsentSchema), teleconsultationController.recordingConsent);
router.post('/:id/recording/start', authenticate, authorize(...MEDECIN_ROLES), teleconsultationController.startRecording);
router.post('/:id/recording/stop', authenticate, authorize(...MEDECIN_ROLES), teleconsultationController.stopRecording);

// Chat
router.get('/:id/messages', authenticate, teleconsultationController.listMessages);
router.post('/:id/messages', authenticate, validateBody(sendMessageSchema), teleconsultationController.sendMessage);

export { router as teleconsultationRoutes };
```

> Note : vérifier les noms exacts des rôles médecins dans `ROLES.md` / le schéma Prisma avant compilation. S'il existe d'autres rôles habilités (ex. `INFIRMIER_DOMICILE` pour téléconsult.), les ajouter à `MEDECIN_ROLES`. Par défaut on s'en tient aux 3 rôles médecins.

- [ ] **Step 2 : Enregistrer la route dans `src/routes/index.ts`**

Ajouter l'import avec les autres imports de routes :
```ts
import { teleconsultationRoutes } from './teleconsultation.routes';
```

Ajouter le montage après le bloc `router.use('/stats', statsRoutes);` :
```ts
// ─── Téléconsultation vidéo ─────────────────────────────────
router.use('/teleconsultations', teleconsultationRoutes);
```

- [ ] **Step 3 : Vérifier la compilation**

Run : `npx tsc --noEmit`
Expected : 0 erreur.

- [ ] **Step 4 : Commit**

```cmd
git add src/routes/teleconsultation.routes.ts src/routes/index.ts
git commit -m "feat(teleconsultation): 11 endpoints REST + enregistrement route"
```

---

## Task 10 : Room Socket.io

**Files:**
- Modify: `src/sockets/index.ts`

- [ ] **Step 1 : Ajouter le handler de room téléconsultation**

Dans `src/sockets/index.ts`, à l'intérieur du `io.on('connection', ...)`, après le handler `socket.on('join-delivery', ...)`, ajouter :

```ts
    // ─── Téléconsultation : rejoindre la room après vérification DB ──
    socket.on('join-teleconsultation', async (teleconsultationId: string) => {
      if (typeof teleconsultationId !== 'string' || teleconsultationId.length === 0) return;
      try {
        const tele = await prisma.teleconsultation.findUnique({
          where: { id: teleconsultationId },
          select: {
            appointment: {
              select: {
                patient: { select: { userId: true } },
                medecin: { select: { userId: true } },
              },
            },
          },
        });
        const isInvolved =
          tele?.appointment.patient.userId === userId ||
          tele?.appointment.medecin.userId === userId;

        if (isInvolved) {
          socket.join(`teleconsultation:${teleconsultationId}`);
          logger.debug('Socket rejoint room téléconsultation', { teleconsultationId, userId });
        } else {
          socket.emit('error', { message: 'Accès refusé à cette téléconsultation' });
        }
      } catch (err) {
        logger.error('Erreur join-teleconsultation', { teleconsultationId, userId, err });
      }
    });
```

- [ ] **Step 2 : Vérifier la compilation**

Run : `npx tsc --noEmit`
Expected : 0 erreur.

- [ ] **Step 3 : Commit**

```cmd
git add src/sockets/index.ts
git commit -m "feat(teleconsultation): room Socket.io join-teleconsultation (vérif DB)"
```

---

## Task 11 : Test manuel (mode mock) + documentation

**Files:**
- Modify: `PROJECT-STATE.md`

- [ ] **Step 1 : Lancer le serveur en mode mock**

S'assurer que `DAILY_API_KEY` est vide dans `.env`. Run (CMD) :
```cmd
npm run dev
```
Expected : démarrage OK + log `⚠️ DAILY_API_KEY absent → provider vidéo MOCK` (au premier appel au provider, ou au démarrage selon l'usage).

- [ ] **Step 2 : Parcours manuel (Postman / curl)**

Avec un token patient et un token médecin (issus de `/auth/login`, comptes du seed), et un RDV `mode=TELECONSULTATION` (créé via module 6) :

1. `POST /api/v1/teleconsultations` body `{ "appointmentId": "<id>" }` (médecin ou patient) → 201, renvoie la téléconsult. **sans tokens**.
2. `POST /api/v1/teleconsultations/:id/join` (patient) puis (médecin) → chacun reçoit un `roomUrl` + son propre `token` (mock-token-patient / mock-token-medecin).
3. `POST /api/v1/teleconsultations/:id/start` (médecin) → statut `EN_COURS`, le RDV passe `EN_COURS`.
4. `PATCH /api/v1/teleconsultations/:id/recording-consent` body `{ "consent": true }` (patient) → `CONSENTEMENT_DONNE`.
5. `POST /api/v1/teleconsultations/:id/recording/start` (médecin) → `recordingStatus=EN_COURS`.
6. `POST /api/v1/teleconsultations/:id/recording/stop` (médecin) → `DISPONIBLE` + `recordingUrl` mock.
7. `POST /api/v1/teleconsultations/:id/messages` body `{ "content": "Bonjour" }` puis `GET .../messages` → message persisté.
8. `POST /api/v1/teleconsultations/:id/end` (médecin) → `TERMINEE`, RDV `TERMINE`.
9. `POST /api/v1/consultations` body `{ "appointmentId": "<id>", ... }` (médecin, module 8) → consultation créée dans le DME.

**Cas d'erreur à vérifier :**
- Un 3ᵉ utilisateur (ni patient ni médecin du RDV) sur `GET /:id` ou `/join` → **403**.
- `POST /:id/recording/start` **sans** consentement préalable → **403** (fail-closed, R-T2).
- `POST /:id/start` par le patient → **403** (réservé médecin).
- `POST /` sur un RDV `mode != TELECONSULTATION` → **400**.

> Adapter le préfixe d'URL (`/api/v1`) à la config réelle (`API_VERSION`).

- [ ] **Step 3 : Mettre à jour PROJECT-STATE.md**

Marquer le Module 19 comme terminé : lister les 11 endpoints, noter l'abstraction provider (Daily/Mock), le modèle `Teleconsultation`/`TeleconsultationMessage`, et la réutilisation de `POST /consultations` (module 8) pour le lien DME. Indiquer le prochain module : **Module 20 — Mode offline & sync (frontend)**.

- [ ] **Step 4 : Commit**

```cmd
git add PROJECT-STATE.md
git commit -m "docs(teleconsultation): Module 19 terminé — état projet + guide de test"
```

---

## Self-review (couverture du spec)

- ✅ Modèle dédié + provider abstrait Daily/Mock (spec §2, §3, §4) → Tasks 1, 3, 4, 5.
- ✅ Config env + fallback mock (spec §4.4) → Tasks 2, 5.
- ✅ 11 endpoints + RBAC + audit + idempotence (spec §5, §6, §8) → Tasks 6, 7, 8, 9.
- ✅ Chat Socket.io avec vérif DB (spec §7) → Tasks 7 (emit/persist), 10 (join room).
- ✅ Consentement fail-closed (spec §8 R-T2) → Task 7 `startRecording`.
- ✅ Lien module 8 sans nouvelle route (spec §5) → Task 11 step 2.9.
- ✅ Tests manuels en mode mock (spec §11) → Task 11.
- ✅ Hors périmètre respecté (LiveKit/Jitsi, frontend, webhooks) (spec §12).

**Cohérence des types :** `publicView()` retire `medecinToken`/`patientToken` ; `join()` recharge les tokens séparément. Enums utilisés : `TeleconsultationStatus` (EN_ATTENTE/EN_COURS/TERMINEE), `RecordingStatus` (AUCUN→CONSENTEMENT_DONNE→EN_COURS→DISPONIBLE), `AppointmentStatus.EN_COURS`/`.TERMINE`, `NotificationType.SYSTEM`. Signatures service ↔ controller alignées.
