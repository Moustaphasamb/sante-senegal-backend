# Spec — Module 19 : Téléconsultation vidéo

> Projet **Santé Sénégal** — backend Node/Express/Prisma/PostgreSQL.
> Date : 2026-05-30. Auteur : Baye Tapha Samb (avec Claude Code).
> Dépend du Module 6 (Rendez-vous) et réutilise le Module 8 (Consultations).

---

## 1. Objectif

Permettre une **consultation médicale à distance par vidéo**, rattachée à un rendez-vous
existant de mode `TELECONSULTATION`. Le backend gère le cycle de vie de la session,
la génération de jetons d'accès vidéo par participant, le consentement et l'enregistrement
(conformité CDP), et un chat texte persisté pendant l'appel.

Le frontend n'existe pas encore : ce module est **100 % backend** et doit être **testable
sans aucun service externe** grâce à un provider vidéo « mock ».

## 2. Décisions d'architecture

### 2.1 Modèle de données dédié (approche A retenue)

Création d'un modèle `Teleconsultation` 1-pour-1 avec `Appointment`, plutôt que d'étendre
`Appointment` (qui deviendrait un fourre-tout) ou de tout déléguer au provider (impossible
de tracer le consentement → non conforme).

Les champs `videoRoomUrl` / `videoRoomToken` déjà présents sur `Appointment` sont **laissés
en place mais non utilisés** : on évite une migration destructive ; le nouveau modèle les
remplace fonctionnellement.

### 2.2 Couche provider abstraite

Une interface `VideoProvider` masque le fournisseur réel. Deux implémentations :
- `DailyProvider` — vrais appels REST à `api.daily.co` (provider de référence).
- `MockProvider` — simule room/token/enregistrement.

Une factory `getVideoProvider()` choisit Daily si `DAILY_API_KEY` est défini, sinon Mock
(avec `logger.warn`). C'est exactement le pattern Redis/SMS du projet : **l'app tourne sans
service externe en dev**. Changer de provider plus tard (LiveKit, Jitsi) = nouvelle classe,
aucun impact sur la logique métier.

## 3. Schéma Prisma

### 3.1 Enums (nouveaux)

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

### 3.2 Modèles (nouveaux)

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

### 3.3 Relations inverses à ajouter

- `Appointment` : `teleconsultation Teleconsultation?`
- `User` : `teleconsultationMessages TeleconsultationMessage[]`

### 3.4 Migration

`npx prisma migrate dev --name add_teleconsultation` puis `npx prisma generate`.

## 4. Couche provider (`src/services/video/`)

### 4.1 Interface (`video-provider.interface.ts`)

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
  isOwner: boolean;        // médecin = true (peut gérer l'enregistrement côté provider)
}

export interface VideoProvider {
  readonly name: string;   // "daily" | "mock"
  createRoom(opts: { appointmentId: string }): Promise<VideoRoom>;
  createAccessToken(opts: CreateAccessTokenOptions): Promise<string>;
  startRecording(providerRoomId: string): Promise<{ providerRecordingId: string }>;
  stopRecording(providerRoomId: string, providerRecordingId: string): Promise<{ recordingUrl?: string }>;
  deleteRoom(providerRoomId: string): Promise<void>;
}
```

### 4.2 `DailyProvider`

- Base URL `https://api.daily.co/v1`, header `Authorization: Bearer ${DAILY_API_KEY}`.
- `createRoom` → `POST /rooms` (room privée, propriétés `enable_recording`).
- `createAccessToken` → `POST /meeting-tokens` (`is_owner` selon le rôle, `user_name`).
- `startRecording` / `stopRecording` → endpoints recording de Daily.
- `deleteRoom` → `DELETE /rooms/{name}` (best-effort, erreurs catchées + loggées).

### 4.3 `MockProvider`

Renvoie des valeurs factices déterministes : `roomUrl = https://mock.video/{appointmentId}`,
tokens `mock-token-{role}-{random}`, `recordingUrl = https://mock.video/rec/{id}`. Aucun
appel réseau. Permet de tester tout le parcours sans compte Daily.

### 4.4 Factory (`index.ts`)

```ts
export function getVideoProvider(): VideoProvider {
  if (config.DAILY_API_KEY) return new DailyProvider();
  logger.warn('DAILY_API_KEY absent → provider vidéo MOCK (dev uniquement)');
  return new MockProvider();
}
```

`.env.example` : ajouter `DAILY_API_KEY=` et `DAILY_DOMAIN=`.

## 5. Endpoints (`/teleconsultations`)

Toutes les routes : `authenticate`. Validation Zod systématique.

| # | Méthode & route | Accès | Comportement |
|---|---|---|---|
| 1 | `POST /teleconsultations` | Patient **ou** médecin du RDV | Body `{ appointmentId }`. Vérifie `mode=TELECONSULTATION` + R-T1. **Idempotent** : si déjà créée, renvoie l'existante. Sinon provisionne room + 2 tokens via le provider. |
| 2 | `GET /teleconsultations/me` | Patient / médecin | Liste paginée des miennes. |
| 3 | `GET /teleconsultations/:id` | Patient / médecin du RDV, SUPER_ADMIN (lecture) | Détail **sans** les tokens. |
| 4 | `POST /teleconsultations/:id/join` | Patient / médecin du RDV | Renvoie `{ roomUrl, token }` (token selon mon rôle). Refusé si `TERMINEE`/`ANNULEE`. Audit log. |
| 5 | `POST /teleconsultations/:id/start` | Médecin | `status→EN_COURS`, RDV `status→EN_COURS` + `startedAt`. `notify()` patient. Audit log. |
| 6 | `POST /teleconsultations/:id/end` | Médecin | `status→TERMINEE`, RDV `endedAt`. Stoppe l'enregistrement si actif. Supprime la room provider (best-effort). Audit log. |
| 7 | `PATCH /teleconsultations/:id/recording-consent` | **Patient** | Body `{ consent: boolean }` → `CONSENTEMENT_DONNE`/`CONSENTEMENT_REFUSE` + `recordingConsentAt`. |
| 8 | `POST /teleconsultations/:id/recording/start` | Médecin | Exige `recordingStatus=CONSENTEMENT_DONNE` **et** `status=EN_COURS` (R-T2). → `EN_COURS`. Audit log. |
| 9 | `POST /teleconsultations/:id/recording/stop` | Médecin | → `DISPONIBLE` + `recordingUrl`. Audit log. |
| 10 | `GET /teleconsultations/:id/messages` | Patient / médecin du RDV | Historique du chat (ordre chronologique). |
| 11 | `POST /teleconsultations/:id/messages` | Patient / médecin du RDV | Body `{ content }`. Persiste + broadcast Socket.io. |

**Lien module 8 (aucune route nouvelle)** : après l'appel, le médecin appelle l'endpoint
existant `POST /consultations` avec l'`appointmentId` de la téléconsultation → la
`Consultation` est créée dans le DME (logique module 8 déjà en place). Documenté dans le
guide de test.

## 6. RBAC & sécurité

- **Garde d'accès** (dans le service) : le `userId` courant doit être le patient
  (`appointment.patient.userId`) ou le médecin (`appointment.medecin.userId`) du RDV lié.
  Sinon `ForbiddenError`. Résolution systématique en DB.
- **Réservé médecin** (`authorize(MEDECIN_SALARIE, MEDECIN_LIBERAL_MOBILE, SPECIALISTE_CABINET)`) :
  start, end, recording/start, recording/stop. Consulter `ROLES.md` pour la liste exacte des rôles médecins.
- **Réservé patient** : recording-consent.
- **Audit log** (`createAuditLog()`, R6/R11) sur : join, start, end, recording/start, recording/stop.
- **Fail-closed** : aucun enregistrement sans `CONSENTEMENT_DONNE` stocké en DB.
- Tokens jamais exposés dans `GET /:id` (uniquement via `join`, et seulement le mien).

## 7. Chat temps réel (Socket.io)

- Singleton existant `src/sockets/`. Room : `teleconsultation:{id}`.
- **À la connexion à la room** : vérification DB que l'utilisateur est patient/médecin du RDV
  avant de l'autoriser à rejoindre (pattern sécurité modules 7/12 : vérif DB systématique).
- Événements émis :
  - `teleconsultation:message` — nouveau message de chat.
  - `teleconsultation:status` — changement de statut (start/end).
  - `teleconsultation:recording` — état de l'enregistrement.
- Source de vérité = la DB. `POST /messages` persiste **puis** broadcast (pas de message
  uniquement en mémoire).

## 8. Règles métier

- **R-T1** : création possible seulement si `appointment.mode=TELECONSULTATION` et
  `appointment.status` ∈ {EN_ATTENTE, CONFIRME, EN_COURS}.
- **R-T2** : enregistrement interdit sans `recordingStatus=CONSENTEMENT_DONNE` (conformité CDP / R6).
- **R-T3** : médecin démarre/termine/enregistre ; patient donne le consentement. Séparation stricte.
- **R-T4** : à `TERMINEE`, room provider supprimée (best-effort) et tokens invalidés (status).
- **Idempotence** : `POST /teleconsultations` renvoie l'existante au lieu de dupliquer.

## 9. Gestion d'erreurs

- Classes custom (`NotFoundError`, `ForbiddenError`, `BadRequestError`, `ConflictError`).
- Erreurs provider (Daily) catchées et loggées ; `deleteRoom`/`stopRecording` en best-effort
  (ne doivent jamais faire échouer la fin de la téléconsultation côté métier).
- Messages utilisateur en français.

## 10. Fichiers

**Créés**
- `src/services/video/video-provider.interface.ts`
- `src/services/video/daily.provider.ts`
- `src/services/video/mock.provider.ts`
- `src/services/video/index.ts`
- `src/validators/teleconsultation.validators.ts`
- `src/services/teleconsultation.service.ts`
- `src/controllers/teleconsultation.controller.ts`
- `src/routes/teleconsultation.routes.ts`

**Modifiés**
- `prisma/schema.prisma` (2 modèles + 2 enums + relations inverses) + migration
- `src/routes/index.ts` (enregistrer la route)
- `src/sockets/` (handler room `teleconsultation:{id}`)
- `.env.example` (`DAILY_API_KEY`, `DAILY_DOMAIN`)
- `src/config/env` (ajouter `DAILY_API_KEY`, `DAILY_DOMAIN` au schéma Zod, optionnels)

## 11. Tests & validation

1. `npx tsc --noEmit` (zéro erreur de type).
2. `npm run dev` → l'app démarre en **mode mock** (sans `DAILY_API_KEY`), log d'avertissement attendu.
3. Parcours manuel (curl / Postman), en mode mock :
   1. Créer un RDV `mode=TELECONSULTATION` (module 6).
   2. `POST /teleconsultations { appointmentId }` → room + tokens.
   3. `POST /:id/join` côté patient puis côté médecin → 2 tokens distincts.
   4. `POST /:id/start` (médecin) → RDV passe `EN_COURS`.
   5. `PATCH /:id/recording-consent { consent: true }` (patient).
   6. `POST /:id/recording/start` puis `/recording/stop` (médecin) → `recordingUrl` mock.
   7. `POST /:id/messages` + `GET /:id/messages` → chat persisté.
   8. `POST /:id/end` (médecin) → `TERMINEE`.
   9. `POST /consultations { appointmentId }` (module 8) → consultation créée dans le DME.
4. Vérifier qu'un utilisateur tiers (ni patient ni médecin du RDV) reçoit `403`.
5. Vérifier que `recording/start` sans consentement renvoie `403` (fail-closed).
6. Mettre à jour `PROJECT-STATE.md` (module 19 terminé + endpoints + notes) puis commit.

## 12. Hors périmètre (YAGNI)

- Intégration réelle LiveKit / Jitsi (branchables plus tard via l'interface).
- UI / frontend (phase 4).
- Webhooks Daily (enregistrement asynchrone) — l'URL d'enregistrement est récupérée à
  l'arrêt ; les webhooks pourront être ajoutés en prod si nécessaire.
- Salle d'attente virtuelle, partage d'écran, sous-titres.
