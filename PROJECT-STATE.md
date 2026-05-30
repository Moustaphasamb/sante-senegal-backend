# 📊 PROJECT-STATE.md — État du projet

> Document maintenu à jour par Claude Code après chaque module.
> Date de dernière mise à jour : **30 mai 2026**

---

## 🎯 Phase actuelle

**Module 20 : Mode offline & sync (frontend)** — à démarrer.

Backend : modules 1 à 19 terminés. Reste le module 20 (mode offline & sync, côté frontend).

---

## ✅ Ce qui est terminé

### Phase 0 — Fondations

- [x] Spécification complète (`SANTE-SENEGAL-SPECIFICATION.md`)
- [x] Document maître (`CLAUDE.md`), rôles & permissions (`ROLES.md`), roadmap (`ROADMAP.md`)
- [x] Schéma Prisma complet (40+ modèles, 20+ enums) : `prisma/schema.prisma`
- [x] Seed de test : `prisma/seed.ts`
- [x] Setup Express + TypeScript + Prisma 5
- [x] Config env (Zod) `src/config/env.ts`, database, Redis (optionnel)
- [x] Logger Winston, helpers erreurs + réponses HTTP
- [x] Middlewares : errorHandler, validate (Zod, gère ZodEffects), rateLimiter (3 niveaux)
- [x] Health checks, app Express, serveur avec graceful shutdown

### Module 1 — Authentification

- [x] Utils JWT / password / OTP, service SMS (mode dev), service OTP, service Auth
- [x] Middleware `authenticate` + `authorize` + `authorizeAnyMedecin` / `authorizeAnyAdmin` + `requireKycApproved`
- [x] Validators + controller + routes (11 endpoints)

### Module 2 — Utilisateurs & Profils

- [x] Upload Cloudinary (mode dev auto), photos de profil
- [x] Contacts d'urgence (max 5, logique isPrimary), soft delete avec révocation tokens
- [x] Validators + service + controller + routes (10 endpoints)

### Module 3 — Établissements de santé

- [x] Recherche géolocalisée Haversine, RBAC (admin limité à son étab.), soft delete
- [x] `validateQuery` ajouté ; fix `ts-node` (`"ts-node": { "files": true }`)
- [x] 6 endpoints

### Module 4 — Médecins

- [x] Annuaire + filtres + nearby, KYC (upload diplôme/CNI), toggle mobile, GPS, planning
- [x] 11 endpoints

### Module 5 — DME (Dossier Médical Électronique)

- [x] Helper `src/utils/audit.ts` (`createAuditLog`, non bloquant)
- [x] Tokens de partage QR (1h/24h/7j/illimité), consentement, AuditLog systématique
- [x] 9 endpoints

### Module 6 — Rendez-vous

- [x] Disponibilités, frais d'annulation (R7), Payment EN_ATTENTE créé en transaction
- [x] Prix autoritatif depuis le profil médecin (jamais du body client)
- [x] 10 endpoints

### Module 7 — Médecin libéral mobile ⭐

- [x] Socket.io singleton `src/sockets/index.ts` (auth JWT, rooms `user:{id}` / `home-visit:{id}`)
- [x] Matching Haversine + scoring, timeout 60s, tracking GPS temps réel
- [x] 9 endpoints + WebSocket

### Module 8 — Consultations

- [x] Signes vitaux, codes CIM-10, règle de modification 24h, AuditLog
- [x] `validateBody` accepte les `ZodEffects` (schémas avec `.refine()`)
- [x] 4 endpoints

### Module 9 — Ordonnances numériques

- [x] Numéro `ORD-AAAA-XXXX`, signature électronique SHA256, token QR, PDF (pdfkit)
- [x] 🔒 Accès pharmacien restreint aux ordonnances liées à SA pharmacie (anti-IDOR)
- [x] `GET /prescriptions/verify/:token` — vérification par QR (preuve de possession)
- [x] 7 endpoints

### Module 10 — Médicaments & Pharmacies

- [x] Util géo partagé `src/utils/geo.ts` (`haversineDistance` + `boundingBox`)
- [x] Catalogue + recherche, stock (upsert batch, `isLowStock` auto), géoloc, pharmacies de garde
- [x] 9 endpoints

### Module 11 — Commandes pharmacie

- [x] Machine à états, vérification stock + prix réel à la création (R9)
- [x] 8 endpoints
- [x] ⚠ Pas de décrément auto du stock (PharmacyOrderItem sans medicationId au schéma)

### Module 12 — Livraison ⭐

- [x] Machine à états + tracking temps réel (`join-delivery`, `delivery:tracking`)
- [x] Intégration auto module 11 : `ready()` d'une commande LIVRAISON crée la Delivery
- [x] Attribution atomique anti double-acceptation, commission livraison 20% (R10)
- [x] 6 endpoints + WebSocket

### Module 13 — Paiements & Wallet 💳

- [x] WALLET_INTERNE instantané, WAVE/OM via webhook idempotent
- [x] Helpers wallet transactionnels (`creditWallet`/`debitWallet`/`reversePendingCredit`)
- [x] 🔒 Débit/crédit via updates atomiques conditionnels (anti double-dépense)
- [x] 🔒 Webhooks fail-closed en production si secret absent
- [x] Crédit bénéficiaire en `pendingBalance` (R10, règlement différé — cron à faire)
- [x] 9 endpoints (6 paiements + 3 wallet)

### Module 14 — Notifications 🔔

- [x] Helper réutilisable `notificationService.notify()` (in-app + Socket.io + SMS optionnel)
- [x] Préférences par catégorie + heures silencieuses (Africa/Dakar)
- [x] CRON rappels RDV J-1 / H-2 via `setInterval` (sans Redis) : `src/jobs/reminder.job.ts`
- [x] 5 endpoints

### Module 15 — Urgences (SOS) 🚨

- [x] Alerte + SMS aux contacts d'urgence (lien Google Maps) + notif in-app + AuditLog
- [x] ⚠ Intégration SAMU réelle non branchée (`samuCalled` reste false)
- [x] 3 endpoints

### Module 16 — Avis & Notation ⭐

- [x] 4 types de cible (MEDECIN/LIVREUR par userId, PHARMACY/ESTABLISHMENT par entité)
- [x] Recalcul auto `averageRating`/`totalReviews` (création + modération)
- [x] 🔒 Vérification d'éligibilité : prestation TERMINÉE réelle requise (anti faux-avis)
- [x] 5 endpoints (dont modération admin)

### Module 17 — Audit & Conformité 🔒

- [x] Lecture filtrée des logs (SUPER_ADMIN) + historique d'une ressource
- [x] Middleware `auditAction()` opt-in réutilisable : `src/middleware/audit.middleware.ts`
- [x] 2 endpoints

### Module 18 — Statistiques & Dashboards 📈

- [x] `/stats/me` adapté au rôle (patient / médecin / pharmacien / livreur)
- [x] `/stats/establishment/:id` cloisonné (R4 — admin limité à son établissement)
- [x] `/stats/global` (SUPER_ADMIN) : utilisateurs par rôle, activité, volume paiements, revenu plateforme
- [x] 3 endpoints

### Module 19 — Téléconsultation vidéo 🎥

- [x] Modèles Prisma `Teleconsultation` (1-1 avec `Appointment`) + `TeleconsultationMessage` (chat) + enums `TeleconsultationStatus` / `RecordingStatus`
- [x] Couche provider abstraite `src/services/video/` : interface `VideoProvider`, `DailyProvider` (REST via `fetch`), `MockProvider` (fallback dev), factory `getVideoProvider()` (fail-closed en prod si `DAILY_API_KEY` absent)
- [x] Session liée au RDV : création idempotente, jetons d'accès **distincts** médecin/patient, cycle `EN_ATTENTE → EN_COURS → TERMINEE`
- [x] Consentement enregistrement (R6/CDP) **fail-closed** : pas d'enregistrement sans `CONSENTEMENT_DONNE`
- [x] Chat persisté + Socket.io (room `teleconsultation:{id}`, vérif DB à la connexion)
- [x] Audit log (join/start/end/recording), RBAC (médecin = start/end/recording, patient = consentement)
- [x] Lien module 8 : réutilise `POST /consultations` avec l'`appointmentId` (aucune route nouvelle)
- [x] 11 endpoints — testé de bout en bout en mode mock (login seed → RDV → flux complet → consultation DME)

> ⚠️ Twilio Video abandonné (fin de vie). Provider réel = **Daily.co**. En prod : définir `DAILY_API_KEY` (sinon refus de démarrage). Endpoints recording de `DailyProvider` à ajuster au branchement réel.

---

## 📡 Endpoints actifs (récapitulatif)

```
# Auth
POST   /api/v1/auth/otp/send | otp/verify | register/patient | register/medecin
POST   /api/v1/auth/login | refresh | logout | logout-all | change-password | reset-password
GET    /api/v1/auth/me

# Utilisateurs
GET/PATCH/DELETE /api/v1/users/me   |  POST/DELETE /api/v1/users/me/photo
GET    /api/v1/users/:id
GET/POST/PATCH/DELETE /api/v1/users/me/emergency-contacts(/:id)

# Établissements
GET    /api/v1/establishments | /nearby | /:id
POST/PATCH/DELETE /api/v1/establishments(/:id)

# Médecins
GET    /api/v1/medecins | /nearby | /:id | /:id/availability
PATCH  /api/v1/medecins/me   |  POST /api/v1/medecins/me/documents | /mobile/toggle | /location
GET/POST /api/v1/medecins/me/schedule
POST   /api/v1/admin/medecins/:id/approve-kyc | reject-kyc

# DME
GET    /api/v1/medical-records/me | /:patientId
PATCH  /api/v1/medical-records/me   |  POST /me/allergies | /chronic-conditions | /documents
POST   /api/v1/medical-records/me/share-token   |  GET /access/:token   |  DELETE /me/share-tokens/:id

# Rendez-vous
GET    /api/v1/appointments/me | /me/upcoming | /:id
POST   /api/v1/appointments
PATCH  /api/v1/appointments/:id/cancel | /reschedule
POST   /api/v1/appointments/:id/check-in | /start | /end

# Visites à domicile (médecin libéral mobile) + WebSocket
POST   /api/v1/home-visits   |  GET /me | /:id
POST   /api/v1/home-visits/:id/accept | reject | start-trip | arrived | complete
PATCH  /api/v1/home-visits/:id/cancel

# Consultations
POST   /api/v1/consultations   |  GET /:id   |  PATCH /:id
GET    /api/v1/patients/:patientId/consultations

# Ordonnances
POST   /api/v1/prescriptions   |  GET /me | /:id | /:id/pdf | /:id/qr | /verify/:token
POST   /api/v1/prescriptions/:id/cancel

# Médicaments
GET    /api/v1/medications | /search/availability | /:id

# Pharmacies
GET    /api/v1/pharmacies | /nearby | /on-duty | /:id | /:id/stock
POST   /api/v1/pharmacies/me/stock

# Commandes pharmacie
POST   /api/v1/pharmacy-orders   |  GET /me | /:id
POST   /api/v1/pharmacy-orders/:id/accept | refuse | ready | complete   |  PATCH /:id/cancel

# Livraisons + WebSocket
GET    /api/v1/deliveries/available
POST   /api/v1/deliveries/:id/accept | picked-up | delivered | failed
GET    /api/v1/deliveries/:id/tracking

# Paiements & Wallet
POST   /api/v1/payments/initiate | /wave/webhook | /orange-money/webhook
GET    /api/v1/payments/me | /:id   |  POST /payments/:id/refund
GET    /api/v1/wallet/me | /me/transactions   |  POST /wallet/me/withdraw

# Notifications
GET    /api/v1/notifications/me | /me/settings
PATCH  /api/v1/notifications/me/settings | /me/read-all | /me/:id/read

# Urgences
POST   /api/v1/sos/alert   |  GET /sos/me   |  POST /sos/:id/resolve

# Avis & Notation
POST   /api/v1/reviews   |  GET /reviews/me/received | /reviews/target/:userId
POST   /api/v1/reviews/:id/respond | /admin/reviews/:id/moderate

# Audit (super-admin)
GET    /api/v1/admin/audit-logs | /admin/audit-logs/resource/:resourceType/:resourceId

# Statistiques
GET    /api/v1/stats/me | /stats/establishment/:id | /stats/global

# Téléconsultation vidéo + WebSocket (room teleconsultation:{id})
POST   /api/v1/teleconsultations   |  GET /me | /:id
POST   /api/v1/teleconsultations/:id/join | /start | /end
PATCH  /api/v1/teleconsultations/:id/recording-consent
POST   /api/v1/teleconsultations/:id/recording/start | /recording/stop
GET/POST /api/v1/teleconsultations/:id/messages
```

---

## Comptes de test (après seed)

| Rôle | Téléphone | Mot de passe |
|---|---|---|
| Super Admin | +221770000001 | Admin2026! |
| Patient (Fatou Diop) | +221771111111 | Patient2026! |
| Patient (Mamadou Sarr) | +221772222222 | Patient2026! |
| Patient (Aïcha Ndiaye) | +221773333333 | Patient2026! |
| Médecin Salarié (Dr Diallo) | +221780000001 | Medecin2026! |
| Médecin Libéral Mobile (Dr Sow) | +221780000002 | Medecin2026! |
| Spécialiste (Dr Fall) | +221780000003 | Medecin2026! |
| Pharmacien (Awa Ba) | +221790000001 | Pharma2026! |

---

## ⏭️ Prochaine étape

### Module 20 : Mode offline & sync (frontend)

DME consultable hors-ligne, files d'actions en attente, synchronisation au retour de connexion.
⚠️ Ce module est **côté frontend** — dépend du démarrage du frontend PWA (phase 4).
Le backend est désormais complet (modules 1 à 19).

### Module 20 : Mode offline & sync

DME consultable offline, synchronisation intelligente (côté frontend principalement).

---

## 📈 Progression globale

```
Phase 0 (fondations)        : ████████████████████ 100% ✅
Backend modules (1→20)      : ██████████████████░░  90% (18/20)
Phase 4 (frontend PWA)      : ░░░░░░░░░░░░░░░░░░░░   0%
Phase 5 (tests, polish)     : ░░░░░░░░░░░░░░░░░░░░   0%

GLOBAL                      : █████████░░░░░░░░░░░  ~45%
```

---

## 🔒 Correctifs de sécurité appliqués (revue automatique)

- Socket.io : 3 failles corrigées (auth JWT, vérif DB avant join room, émetteur GPS autorisé seul)
- Rendez-vous : prix autoritatif serveur (jamais du body client)
- Wallet : débit/crédit via updates atomiques conditionnels (anti double-dépense)
- Webhooks paiement : fail-closed en production si secret absent
- Avis : vérification d'éligibilité (prestation réelle terminée requise)
- Ordonnances : accès pharmacien restreint (anti-IDOR) + vérification par token QR

---

## 📝 Notes de session

### 28-29 mai 2026
- Création du projet, spécification, schéma Prisma, modules 1 à 8

### 30 mai 2026
- Modules 9 à 18 livrés (parcours pharmacie complet, paiements, notifications, conformité, stats)
- 6 correctifs de sécurité issus de la revue automatique
- Commits poussés sur `origin/master` (`6a2b5ce`, `2b47471`)
- Ajout des docs `ROLES.md` et `START-HERE.md` (par Baye)

---

**Ce document est mis à jour par Claude Code à chaque module terminé.**
