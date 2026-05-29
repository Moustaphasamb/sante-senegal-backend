# 📊 PROJECT-STATE.md — État du projet

> Document maintenu à jour par Claude Code après chaque module.
> Date de dernière mise à jour : **29 mai 2026**

---

## 🎯 Phase actuelle

**Phase 1.5 : Module DME** (à démarrer)

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
Phase 1  : ████████████████████  40% (4/10 modules)
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
