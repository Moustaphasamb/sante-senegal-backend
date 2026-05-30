# 📊 PROJECT-STATE.md — État du projet

> Document maintenu à jour par Claude Code après chaque module.
> Date de dernière mise à jour : **29 mai 2026**

---

## 🎯 Phase actuelle

**Phase 3 : Module Statistiques & Dashboards** (à démarrer)

> Module 15 (Urgences SOS) ✅ terminé le 30 mai 2026.
> Module 16 (Avis & Notation) ✅ terminé le 30 mai 2026.
> Module 17 (Audit & Conformité) ✅ terminé le 30 mai 2026.

> Module 9 (Ordonnances numériques) ✅ terminé le 30 mai 2026.
> Module 10 (Médicaments & Pharmacies) ✅ terminé le 30 mai 2026.
> Module 11 (Commandes pharmacie) ✅ terminé le 30 mai 2026.
> Module 12 (Livraison) ✅ terminé le 30 mai 2026.
> Module 13 (Paiements & Wallet) ✅ terminé le 30 mai 2026.
> Module 14 (Notifications) ✅ terminé le 30 mai 2026.

---

## ✅ Ce qui est terminé

### Phase 0 — Fondations

- [x] Document de spécification complet (`SANTE-SENEGAL-SPECIFICATION.md`)
- [x] Schéma Prisma complet (40+ modèles, 20+ enums) : `prisma/schema.prisma`
- [x] Données de test (seed) : `prisma/seed.ts`
- [x] Setup Express + TypeScript + Prisma 5
- [x] Configuration env (Zod) : `src/config/env.ts`
- [x] Configuration database : `src/config/database.ts`
- [x] Configuration Redis : `src/config/redis.ts`
- [x] Logger Winston : `src/utils/logger.ts`
- [x] Helpers erreurs : `src/utils/errors.ts`
- [x] Helpers réponses HTTP : `src/utils/response.ts`
- [x] Middleware d'erreurs global : `src/middleware/errorHandler.ts`
- [x] Middleware validation Zod : `src/middleware/validate.ts`
- [x] Middleware rate limiting (3 niveaux) : `src/middleware/rateLimiter.ts`
- [x] Routes de health check : `src/routes/health.routes.ts`
- [x] Configuration Express : `src/app.ts`
- [x] Serveur avec graceful shutdown : `src/server.ts`

### Phase 1.1 — Module Authentification

- [x] Utilitaire JWT : `src/utils/jwt.ts`
- [x] Utilitaire mots de passe : `src/utils/password.ts`
- [x] Utilitaire OTP : `src/utils/otp.ts`
- [x] Service SMS (mode dev) : `src/services/sms.service.ts`
- [x] Service OTP : `src/services/otp.service.ts`
- [x] Service Auth : `src/services/auth.service.ts`
- [x] Validators Zod : `src/validators/auth.validators.ts`
- [x] Type Express étendu : `src/types/express.d.ts`
- [x] Middleware authenticate + authorize + RBAC : `src/middleware/authenticate.ts`
- [x] Controller auth : `src/controllers/auth.controller.ts`
- [x] Routes auth : `src/routes/auth.routes.ts`

### Phase 1.2 — Module Utilisateurs & Profils ✅ TERMINÉ

- [x] Dépendances : `cloudinary@2`, `multer@1.4.5-lts`
- [x] Validators Zod : `src/validators/user.validators.ts`
- [x] Middleware upload multer : `src/middleware/upload.middleware.ts`
- [x] Service upload Cloudinary : `src/services/upload.service.ts`
- [x] Service utilisateurs : `src/services/user.service.ts`
- [x] Controller : `src/controllers/user.controller.ts`
- [x] Routes : `src/routes/user.routes.ts`
- [x] Routes index mis à jour : `src/routes/index.ts`

### Phase 3.3 — Module Audit & Conformité ✅ TERMINÉ 🔒

- [x] Validators : `src/validators/audit.validators.ts`
- [x] Service lecture (filtres + historique ressource) : `src/services/audit.service.ts`
- [x] Controller : `src/controllers/audit.controller.ts`
- [x] Middleware audit opt-in réutilisable : `src/middleware/audit.middleware.ts` (`auditAction()`)
- [x] Routes (SUPER_ADMIN) : `src/routes/audit.routes.ts` → `/admin/audit-logs`
- Endpoints : GET `/admin/audit-logs` (filtres userId/action/resourceType/resourceId/from/to), GET `/admin/audit-logs/resource/:resourceType/:resourceId`
- L'écriture des logs se fait déjà via `createAuditLog` (DME, consultations, paiements, SOS). Ce module = lecture + outil middleware.

### Phase 3.2 — Module Avis & Notation ✅ TERMINÉ ⭐

- [x] Validators : `src/validators/review.validators.ts`
- [x] Service (résolution cible + recalcul note + anti-doublon) : `src/services/review.service.ts`
- [x] Controller : `src/controllers/review.controller.ts`
- [x] Routes : `src/routes/review.routes.ts` + route admin modération dans `index.ts`
- Endpoints : POST `/reviews`, GET `/reviews/me/received`, GET `/reviews/target/:userId`, POST `/reviews/:id/respond`, POST `/admin/reviews/:id/moderate`
- 4 types de cible : MEDECIN/LIVREUR (par userId), PHARMACY/ESTABLISHMENT (par targetEntityId, targetId résolu via gérant/admin).
- Recalcul auto `averageRating`/`totalReviews` (LivreurProfile = averageRating seul, pas de totalReviews) sur avis approuvés, à la création ET à la modération.
- Anti-doublon par contexte (appointmentId/homeVisitId/orderId/deliveryId). Pas d'auto-évaluation.
- 🔒 Sécurité : vérification d'éligibilité — l'avis exige une prestation TERMINÉE réelle entre auteur et cible (RDV/visite/commande/livraison vérifiés : propriété + statut terminal). Anti faux-avis.

### Phase 3.1 — Module Urgences (SOS) ✅ TERMINÉ 🚨

- [x] Validators : `src/validators/sos.validators.ts`
- [x] Service (trigger + SMS contacts + audit + notify) : `src/services/sos.service.ts`
- [x] Controller : `src/controllers/sos.controller.ts`
- [x] Routes : `src/routes/sos.routes.ts`
- [x] Routes index mis à jour
- Endpoints : POST `/sos/alert`, GET `/sos/me`, POST `/sos/:id/resolve`
- Déclenchement : crée l'alerte + SMS aux contacts d'urgence (notifyOnEmergency) avec lien Google Maps + notif in-app + AuditLog. `contactsNotified` maj selon SMS réussis.
- Résolution : propriétaire ou SUPER_ADMIN.
- ⚠ Intégration SAMU réelle non implémentée (samuCalled reste false) — à brancher en prod.

### Phase 2.9 — Module Notifications ✅ TERMINÉ 🔔

- [x] Validators : `src/validators/notification.validators.ts`
- [x] Service (notify() réutilisable + in-app + SMS + préférences + heures silencieuses) : `src/services/notification.service.ts`
- [x] Controller : `src/controllers/notification.controller.ts`
- [x] Routes : `src/routes/notification.routes.ts`
- [x] Job rappels RDV J-1/H-2 (CRON via setInterval, SANS Redis) : `src/jobs/reminder.job.ts`
- [x] Planificateur câblé dans `src/server.ts` (start + stop propre)
- Endpoints : GET `/notifications/me`, GET `/notifications/me/settings`, PATCH `/notifications/me/settings`, PATCH `/notifications/me/read-all`, PATCH `/notifications/me/:id/read`
- `notificationService.notify(userId, type, title, message, opts)` = helper best-effort réutilisable (in-app + Socket.io `notification:new` + SMS optionnel) à brancher dans les autres modules.
- Préférences par catégorie (rdvReminders/prescriptionAlerts/paymentAlerts) + heures silencieuses (timezone Africa/Dakar = UTC).
- ⚠ Choix : pas de Bull/Redis (contrainte « app tourne sans Redis »). CRON = setInterval horaire. Migration vers Bull possible plus tard si Redis garanti.

### Phase 2.8 — Module Paiements & Wallet ✅ TERMINÉ 💳

- [x] Validators : `src/validators/payment.validators.ts`, `src/validators/wallet.validators.ts`
- [x] Service wallet (helpers transactionnels credit/debit/reversePending) : `src/services/wallet.service.ts`
- [x] Service paiements (initiate, webhook idempotent, refund) : `src/services/payment.service.ts`
- [x] Controllers : `src/controllers/payment.controller.ts`, `src/controllers/wallet.controller.ts`
- [x] Routes : `src/routes/payment.routes.ts`, `src/routes/wallet.routes.ts`
- [x] Routes index mis à jour
- Endpoints paiements : POST `/payments/initiate`, POST `/payments/wave/webhook`, POST `/payments/orange-money/webhook`, GET `/payments/me`, GET `/payments/:id`, POST `/payments/:id/refund` (admin)
- Endpoints wallet : GET `/wallet/me`, GET `/wallet/me/transactions`, POST `/wallet/me/withdraw`
- WALLET_INTERNE = paiement instantané (débit payeur + crédit bénéficiaire en `pendingBalance` R10) ; WAVE/OM = `externalReference` + URL checkout (dev mock), confirmé par webhook.
- Webhooks PUBLICS (pas de JWT), vérifiés par signature HMAC-SHA256 (**fail-closed en prod** : refusés si secret absent), **idempotents** (rejouent sans double-traitement).
- 🔒 Sécurité : débit/crédit wallet via updates atomiques conditionnels (`updateMany balance >= amount` + `decrement`/`increment`) → pas de double-dépense concurrente.
- ⚠ Format exact de signature Wave/OM à brancher en prod (HMAC du corps en placeholder). Règlement différé (pending→balance) = cron à faire.

### Phase 2.7 — Module Livraison ✅ TERMINÉ ⭐

- [x] Validators : `src/validators/delivery.validators.ts`
- [x] Service (machine à états + notif Socket.io patient) : `src/services/delivery.service.ts`
- [x] Controller : `src/controllers/delivery.controller.ts`
- [x] Routes : `src/routes/delivery.routes.ts`
- [x] Socket.io : handlers `join-delivery` + `delivery:tracking` (persiste position) dans `src/sockets/index.ts`
- [x] Intégration module 11 : `pharmacyOrderService.ready()` crée la `Delivery` si LIVRAISON ; `complete()` bloqué pour LIVRAISON (clôture par le livreur)
- Endpoints : GET `/deliveries/available`, POST `/:id/accept`, POST `/:id/picked-up`, POST `/:id/delivered`, POST `/:id/failed`, GET `/:id/tracking`
- Workflow : RECHERCHE_LIVREUR → ACCEPTEE → RECUPEREE → LIVREE (clôt la commande). Échec → ECHEC.
- Attribution atomique via `updateMany` (anti double-acceptation). Commission livraison 20 % (R10).

### Phase 2.6 — Module Commandes pharmacie ✅ TERMINÉ

- [x] Validators (refine LIVRAISON, statuts) : `src/validators/pharmacy-order.validators.ts`
- [x] Service (machine à états, vérif stock R9, calcul prix) : `src/services/pharmacy-order.service.ts`
- [x] Controller : `src/controllers/pharmacy-order.controller.ts`
- [x] Routes : `src/routes/pharmacy-order.routes.ts`
- [x] Routes index mis à jour : `src/routes/index.ts`
- Endpoints : POST `/pharmacy-orders`, GET `/pharmacy-orders/me`, GET `/pharmacy-orders/:id`, POST `/:id/accept`, POST `/:id/refuse`, POST `/:id/ready`, POST `/:id/complete`, PATCH `/:id/cancel`
- Workflow : EN_ATTENTE → ACCEPTEE → PRETE → (RETIREE si retrait | LIVREE si livraison). Refus/annulation gérés.
- ⚠ Note : pas de décrément auto du stock (PharmacyOrderItem n'a pas de medicationId en schéma — dispo + prix vérifiés à la création seulement).

### Phase 2.5 — Module Médicaments & Pharmacies ✅ TERMINÉ

- [x] Util géo partagé (Haversine + bounding box) : `src/utils/geo.ts`
- [x] Validators : `src/validators/medication.validators.ts`, `src/validators/pharmacy.validators.ts`
- [x] Services : `src/services/medication.service.ts`, `src/services/pharmacy.service.ts`
- [x] Controllers : `src/controllers/medication.controller.ts`, `src/controllers/pharmacy.controller.ts`
- [x] Routes : `src/routes/medication.routes.ts`, `src/routes/pharmacy.routes.ts`
- [x] Routes index mis à jour : `src/routes/index.ts`
- Endpoints médicaments : GET `/medications`, GET `/medications/search/availability`, GET `/medications/:id`
- Endpoints pharmacies : GET `/pharmacies`, GET `/pharmacies/nearby`, GET `/pharmacies/on-duty`, GET `/pharmacies/:id`, GET `/pharmacies/:id/stock`, POST `/pharmacies/me/stock`
- Stock : upsert batch sur `(pharmacyId, medicationId)`, calcul auto `isLowStock`
- Garde : `isOnDuty` OU `isOpen24_7` OU `PharmacyDutySchedule` couvrant maintenant

### Phase 2.4 — Module Ordonnances numériques ✅ TERMINÉ

- [x] Validators Zod (items + validité + renouvellement) : `src/validators/prescription.validators.ts`
- [x] Service (numéro ORD-AAAA-XXXX, signature SHA256, QR token, PDF pdfkit, AuditLog) : `src/services/prescription.service.ts`
- [x] Controller (PDF/QR en buffer binaire) : `src/controllers/prescription.controller.ts`
- [x] Routes : `src/routes/prescription.routes.ts`
- [x] Routes index mis à jour : `src/routes/index.ts`
- Endpoints : POST `/prescriptions`, GET `/prescriptions/me`, GET `/prescriptions/:id`, GET `/prescriptions/:id/pdf`, GET `/prescriptions/:id/qr`, POST `/prescriptions/:id/cancel`

### Phase 2.3 — Module Consultations ✅ TERMINÉ

- [x] Validators : `src/validators/consultation.validators.ts`
- [x] Service (résolution DME, règle 24h, AuditLog) : `src/services/consultation.service.ts`
- [x] Controller : `src/controllers/consultation.controller.ts`
- [x] Routes : `src/routes/consultation.routes.ts`
- [x] Fix : `validateBody` accepte `ZodEffects` (schemas avec `.refine()`)

### Phase 2.2 — Module Médecin libéral mobile ✅ TERMINÉ ⭐

- [x] `src/sockets/index.ts` — Socket.io singleton + events tracking/request/status
- [x] `src/server.ts` — initSocket() câblé
- [x] Validators : `src/validators/home-visit.validators.ts`
- [x] Service (matching Haversine + scoring + timeout 60s) : `src/services/home-visit.service.ts`
- [x] Controller : `src/controllers/home-visit.controller.ts`
- [x] Routes : `src/routes/home-visit.routes.ts`

### Phase 2.1 — Module Rendez-vous ✅ TERMINÉ

- [x] Validators Zod : `src/validators/appointment.validators.ts`
- [x] Service (disponibilités, R7, Payment, audit) : `src/services/appointment.service.ts`
- [x] Controller : `src/controllers/appointment.controller.ts`
- [x] Routes : `src/routes/appointment.routes.ts`
- [x] `GET /medecins/:id/availability` ajouté dans `src/routes/medecin.routes.ts`
- [x] Routes index mis à jour : `src/routes/index.ts`

### Phase 1.5 — Module DME ✅ TERMINÉ

- [x] `src/utils/audit.ts` — helper createAuditLog (réutilisable tous modules)
- [x] Validators Zod : `src/validators/medical-record.validators.ts`
- [x] Service : `src/services/medical-record.service.ts`
- [x] Controller : `src/controllers/medical-record.controller.ts`
- [x] Routes : `src/routes/medical-record.routes.ts`
- [x] Routes index mis à jour : `src/routes/index.ts`

### Phase 1.4 — Module Médecins ✅ TERMINÉ

- [x] Validators Zod : `src/validators/medecin.validators.ts`
- [x] `uploadDocument` dans `src/services/upload.service.ts`
- [x] `uploadDocumentMiddleware` (PDF) dans `src/middleware/upload.middleware.ts`
- [x] Service (Haversine, KYC, planning upsert) : `src/services/medecin.service.ts`
- [x] Controller : `src/controllers/medecin.controller.ts`
- [x] Routes : `src/routes/medecin.routes.ts`
- [x] Routes index mis à jour : `src/routes/index.ts`

### Phase 1.3 — Module Établissements de santé ✅ TERMINÉ

- [x] `validateQuery` ajouté dans `src/middleware/validate.ts`
- [x] Fix `ts-node` : `"ts-node": { "files": true }` dans `tsconfig.json`
- [x] Variables d'env complètes dans `.env` (JWT, Redis, etc.)
- [x] Validators Zod : `src/validators/establishment.validators.ts`
- [x] Service (Haversine, RBAC, soft delete) : `src/services/establishment.service.ts`
- [x] Controller : `src/controllers/establishment.controller.ts`
- [x] Routes : `src/routes/establishment.routes.ts`
- [x] Routes index mis à jour : `src/routes/index.ts`

---

## 📡 Endpoints actifs

```
GET  /                                           → Accueil API
GET  /api/v1/health                              → Health basique
GET  /api/v1/health/deep                         → Health DB + Redis
GET  /api/v1/health/version                      → Version

POST /api/v1/auth/otp/send                       → Envoi OTP
POST /api/v1/auth/otp/verify                     → Vérification OTP
POST /api/v1/auth/register/patient               → Inscription patient
POST /api/v1/auth/register/medecin               → Inscription médecin
POST /api/v1/auth/login                          → Connexion
POST /api/v1/auth/refresh                        → Refresh token
POST /api/v1/auth/logout                         → Déconnexion
POST /api/v1/auth/logout-all                     → Déconnexion tous appareils
GET  /api/v1/auth/me                             → Profil utilisateur connecté
POST /api/v1/auth/change-password                → Changer mot de passe
POST /api/v1/auth/reset-password                 → Réinitialiser via OTP

GET  /api/v1/users/me                            → Profil complet (auth)
PATCH /api/v1/users/me                           → Modifier profil (auth)
POST /api/v1/users/me/photo                      → Upload photo profil (auth, multipart)
DELETE /api/v1/users/me/photo                    → Supprimer photo (auth)
DELETE /api/v1/users/me                          → Désactiver compte (auth, soft delete)
GET  /api/v1/users/:id                           → Profil public (public)
GET  /api/v1/users/me/emergency-contacts         → Lister contacts urgence (auth)
POST /api/v1/users/me/emergency-contacts         → Ajouter contact urgence (auth)
PATCH /api/v1/users/me/emergency-contacts/:id    → Modifier contact urgence (auth)
DELETE /api/v1/users/me/emergency-contacts/:id   → Supprimer contact urgence (auth)

GET  /api/v1/establishments                      → Liste paginée + filtres (public)
GET  /api/v1/establishments/nearby               → Recherche géolocalisée Haversine (public)
GET  /api/v1/establishments/:id                  → Détail complet (public)
POST /api/v1/establishments                      → Créer (ADMIN_ETABLISSEMENT, SUPER_ADMIN)
PATCH /api/v1/establishments/:id                 → Modifier (ADMIN = son étab., SUPER_ADMIN = tous)
DELETE /api/v1/establishments/:id                → Désactiver soft delete (SUPER_ADMIN)
```

### Comptes de test (après seed)

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

### Module 4 : Médecins

**Objectifs :**
1. Annuaire des médecins (liste + filtres + géoloc)
2. KYC — upload diplômes/CNI
3. Toggle disponibilité libérale mobile
4. Planning hebdomadaire

**Fichiers à créer :**
- `src/validators/medecin.validators.ts`
- `src/services/medecin.service.ts`
- `src/controllers/medecin.controller.ts`
- `src/routes/medecin.routes.ts`

**Endpoints :**
- `GET /api/v1/medecins`
- `GET /api/v1/medecins/nearby`
- `GET /api/v1/medecins/:id`
- `PATCH /api/v1/medecins/me`
- `POST /api/v1/medecins/me/documents`
- `POST /api/v1/medecins/me/mobile/toggle`
- `POST /api/v1/medecins/me/location`
- `GET /api/v1/medecins/me/schedule`
- `POST /api/v1/medecins/me/schedule`
- `POST /api/v1/admin/medecins/:id/approve-kyc`
- `POST /api/v1/admin/medecins/:id/reject-kyc`

---

## 📈 Progression globale

```
Phase 0  : ████████████████████ 100% ✅
Phase 1  : ████████████████████ 100% (5/5 modules)
Phase 2  : ████████░░░░░░░░░░░░  43% (3/7 modules)
Phase 2  : ░░░░░░░░░░░░░░░░░░░░   0%
Phase 3  : ░░░░░░░░░░░░░░░░░░░░   0%
Phase 4  : ░░░░░░░░░░░░░░░░░░░░   0% (frontend)
Phase 5  : ░░░░░░░░░░░░░░░░░░░░   0% (tests, polish)

GLOBAL   : ████░░░░░░░░░░░░░░░░  15%
```

---

## 📝 Notes de session

### 28 mai 2026
- Création du projet
- Spécification complète
- Schéma Prisma posé
- Backend de base + module auth livrés

### 29 mai 2026
- Module 2 — Utilisateurs & Profils livré
- 10 nouveaux endpoints actifs
- Photo de profil via Cloudinary (mode dev auto-configuré sans credentials)
- Contacts d'urgence avec limite max 5 et logique isPrimary
- Soft delete avec révocation des tokens
- Module 3 — Établissements de santé livré
- 6 nouveaux endpoints actifs
- Recherche géolocalisée Haversine (bounding box + distance exacte)
- RBAC : ADMIN_ÉTABLISSEMENT limité à son propre établissement
- isVerified : réservé SUPER_ADMIN
- Soft delete via isActive=false
- Fix ts-node : `"ts-node": { "files": true }` dans tsconfig.json
- Variables d'environnement JWT complètes dans .env

---

**Ce document est mis à jour automatiquement par Claude Code à chaque module terminé.**
