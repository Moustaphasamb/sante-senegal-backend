# 🏥 CLAUDE.md — Document maître pour Claude Code

> **Ce document est ta référence complète pour le projet "Santé Sénégal".**
> Lis-le ENTIÈREMENT avant toute action.
> Reviens-y systématiquement à chaque nouveau module.

---

## 📑 Table des matières

1. [Identité du projet](#1-identité-du-projet)
2. [Contexte du développeur](#2-contexte-du-développeur)
3. [Environnement technique](#3-environnement-technique)
4. [Vision et objectifs](#4-vision-et-objectifs)
5. [Architecture globale](#5-architecture-globale)
6. [Conventions de code](#6-conventions-de-code)
7. [Conventions Git](#7-conventions-git)
8. [État actuel du projet](#8-état-actuel-du-projet)
9. [Roadmap module par module](#9-roadmap-module-par-module)
10. [Règles métier critiques](#10-règles-métier-critiques)
11. [Sécurité et conformité](#11-sécurité-et-conformité)
12. [Tests et qualité](#12-tests-et-qualité)
13. [Instructions par module](#13-instructions-par-module)
14. [Workflow d'exécution](#14-workflow-dexécution)
15. [FAQ et cas particuliers](#15-faq-et-cas-particuliers)

---

## 1. Identité du projet

### Nom
**Santé Sénégal** — Plateforme nationale tout-en-un pour l'écosystème santé sénégalais

### Slogan
Une seule app pour toute la santé du Sénégal

### Ce qu'on construit

Une plateforme SaaS qui connecte sur un même outil :
- **Patients** (consultent, prennent RDV, accèdent à leur DME, commandent des médicaments)
- **Médecins** (salariés en hôpital/clinique, libéraux mobiles à domicile, spécialistes en cabinet)
- **Infirmiers à domicile**
- **Pharmacies** (avec stock temps réel et livraison)
- **Livreurs** (médicaments)
- **Établissements** (hôpitaux publics, cliniques privées, postes/centres de santé)
- **Administrateurs** (établissements + super-admin plateforme)

### Innovations clés (uniques sur le marché sénégalais)

1. **Médecin libéral mobile** : Uber-style — un patient ouvre l'app, géolocalise les médecins libéraux disponibles à proximité, en sélectionne un qui se déplace à son domicile, voit l'arrivée en temps réel.

2. **Pharmacie virtuelle 24/7** : Stock en temps réel de toutes les pharmacies partenaires, recherche par molécule, livraison à domicile, pharmacies de garde.

3. **DME unifié** : Dossier médical électronique unique partagé entre tous les praticiens (avec consentement du patient via QR code).

---

## 2. Contexte du développeur

### Profil

- **Nom** : Baye Tapha Samb
- **Niveau** : Beginner-to-intermediate en développement
- **Centres d'intérêt** : trading institutionnel (SMC/ICT), fitness, sports coaching
- **Lien fort avec le Sénégal** (markets locaux, instruments locaux, interfaces françaises)

### Préférences de travail

- **Step-by-step** : guidance étape par étape
- **Exact terminal commands** : toujours des commandes exactes, copy-paste-ready
- **Context for commands** : toujours préciser où exécuter (CMD vs PowerShell, quel dossier)
- **Direct output** : ne pas tourner autour du pot
- **Français** dans les contextes UI et certains commentaires

### Contraintes environnement

⚠️ **IMPORTANT** : Tenir compte de ces contraintes :

- **OS** : Windows 11 Pro
- **Editor** : VS Code
- **Terminal** : **CMD obligatoire**, pas PowerShell (module `Microsoft.PowerShell.Security` corrompu sur sa machine)
- **Node.js** : v25.9.0 (à vérifier)
- **npm** : v11.12.1
- **PostgreSQL** : v16
- **Pas de Redis local** au démarrage (l'app doit pouvoir tourner sans)

### Quand tu donnes des commandes

✅ **OUI** :
```cmd
cd C:\Users\samb9\Desktop\sante-senegal-backend
npm install
```

❌ **NON** :
```powershell
Set-Location C:\Users\samb9\Desktop\sante-senegal-backend
```

---

## 3. Environnement technique

### Stack Backend

```yaml
Language: TypeScript 5
Runtime: Node.js 20+ (l'utilisateur a v25)
Framework: Express 4
ORM: Prisma 5 (PAS 6, PAS 7)
Database: PostgreSQL 16
Cache: Redis 7 (optionnel au démarrage)
Real-time: Socket.io 4
Job Queue: Bull
Auth: JWT (access + refresh)
Validation: Zod
Logging: Winston
Security: Helmet, bcryptjs (PAS bcrypt à cause compilation native sur Windows)
```

### Services externes prévus

| Service | Usage | Status |
|---|---|---|
| Twilio SMS | SMS fallback international | À configurer |
| Orange SMS API | SMS Sénégal | À configurer |
| Wave Business | Paiements mobile | À configurer |
| Orange Money API | Paiements mobile | À configurer |
| Cloudinary | Stockage fichiers/images | À configurer |
| Mapbox | Géolocalisation, cartes | À configurer |
| Firebase FCM | Push notifications | À configurer |
| Sentry | Monitoring erreurs | Optionnel |

### Stack Frontend (prévu, phase 4)

```yaml
Type: PWA (Progressive Web App)
Framework: React 18
Bundler: Vite 5
Language: TypeScript 5
UI: TailwindCSS + shadcn/ui
State: Zustand
Data fetching: React Query (TanStack Query)
Routing: React Router v6
Maps: Mapbox GL JS
Forms: React Hook Form + Zod
i18n: i18next (français + wolof)
PWA: Workbox
```

### Structure des dossiers backend

```
sante-senegal-backend/
├── prisma/
│   ├── schema.prisma          # Schéma DB
│   ├── seed.ts                # Données de test
│   └── migrations/            # Migrations auto-générées
├── src/
│   ├── config/                # Configuration (env, DB, Redis)
│   ├── controllers/           # Logique HTTP (request/response)
│   ├── services/              # Logique métier
│   ├── middleware/            # Middleware Express
│   ├── routes/                # Définition des routes
│   ├── validators/            # Schémas Zod
│   ├── utils/                 # Helpers (JWT, password, errors...)
│   ├── jobs/                  # Tâches Bull asynchrones
│   ├── sockets/               # Socket.io handlers
│   ├── types/                 # Types TypeScript globaux
│   ├── app.ts                 # Configuration Express
│   └── server.ts              # Point d'entrée
├── logs/                      # Logs (gitignored)
├── .env                       # Secrets (gitignored)
├── .env.example               # Template
├── package.json
├── tsconfig.json
└── README.md
```

### Path aliases (déjà configurés dans tsconfig.json)

```typescript
@/*           → src/*
@config/*     → src/config/*
@controllers/* → src/controllers/*
@middleware/* → src/middleware/*
@routes/*     → src/routes/*
@services/*   → src/services/*
@utils/*      → src/utils/*
@types/*      → src/types/*
```

---

## 4. Vision et objectifs

### Objectif court terme (3-6 mois)

Backend complet et fonctionnel avec tous les modules métiers, testable via Postman/Insomnia.

### Objectif moyen terme (6-12 mois)

Frontend PWA complet, app utilisable de bout en bout, lancement pilote avec 2-3 cliniques à Dakar.

### Objectif long terme (12-24 mois)

Déploiement national, partenariat ordre des médecins, intégrations pharmacies, lancement officiel.

### Approche stratégique du projet

- **Construire TOUT le système complet** (l'utilisateur a choisi cette option)
- **6-12 mois de dev sérieux** prévu
- **Vision technique d'abord**, validation business ensuite
- Code de niveau production, pas POC

---

## 5. Architecture globale

### Pattern d'architecture

**Architecture en couches** classique :

```
┌─────────────────────────────────────┐
│         CLIENTS (PWA, Mobile)       │
└─────────────────┬───────────────────┘
                  │ HTTPS / WSS
                  ▼
┌─────────────────────────────────────┐
│         ROUTES (Express)            │
│   - validation Zod                  │
│   - rate limiting                   │
└─────────────────┬───────────────────┘
                  ▼
┌─────────────────────────────────────┐
│         MIDDLEWARE                  │
│   - auth (JWT)                      │
│   - authorize (RBAC)                │
│   - error handling                  │
└─────────────────┬───────────────────┘
                  ▼
┌─────────────────────────────────────┐
│         CONTROLLERS                 │
│   (request/response uniquement)     │
└─────────────────┬───────────────────┘
                  ▼
┌─────────────────────────────────────┐
│         SERVICES                    │
│   (logique métier)                  │
└─────────────────┬───────────────────┘
                  ▼
┌─────────────────────────────────────┐
│         PRISMA (DB layer)           │
└─────────────────────────────────────┘
```

### Règle d'or de séparation des responsabilités

| Layer | Responsabilité | Ne fait PAS |
|---|---|---|
| **Routes** | Définir les endpoints, valider, middleware | Logique métier |
| **Controllers** | Parse request, appelle service, format response | Logique métier complexe, accès DB |
| **Services** | Logique métier, orchestre les opérations | Manipuler req/res, gestion HTTP |
| **Validators** | Valider les inputs avec Zod | Logique métier |
| **Utils** | Helpers purs réutilisables | État, side effects |

### Roles & Permissions (RBAC)

```typescript
enum UserRole {
  PATIENT
  MEDECIN_SALARIE          // Rattaché à un établissement
  MEDECIN_LIBERAL_MOBILE   // Se déplace à domicile (l'innovation)
  SPECIALISTE_CABINET      // Spécialiste en cabinet privé
  INFIRMIER_DOMICILE       // Soins infirmiers à domicile
  PHARMACIEN
  LIVREUR
  ADMIN_ETABLISSEMENT
  SUPER_ADMIN
}
```

---

## 6. Conventions de code

### TypeScript

- **Toujours typer explicitement** les paramètres et retours de fonctions exportées
- **Pas de `any`** sauf cas absolument exceptionnel (et avec commentaire)
- **Préférer `interface`** pour les objets, **`type`** pour les unions/aliases
- **Strict mode activé** dans tsconfig

### Nommage

| Type | Convention | Exemple |
|---|---|---|
| Variables, fonctions | camelCase | `getUserById` |
| Classes, types, interfaces | PascalCase | `UserService`, `AppointmentInput` |
| Constantes | SCREAMING_SNAKE_CASE | `MAX_LOGIN_ATTEMPTS` |
| Fichiers TS | kebab-case | `auth.service.ts`, `home-visit.routes.ts` |
| Tables DB (Prisma) | snake_case via `@@map` | `@@map("home_visits")` |
| Routes API | kebab-case | `/home-visits`, `/medical-records` |

### Imports

**Ordre strict** :

```typescript
// 1. Node natifs
import crypto from 'crypto';
import path from 'path';

// 2. Packages externes
import express, { Request, Response } from 'express';
import { z } from 'zod';

// 3. Prisma
import { PrismaClient, UserRole } from '@prisma/client';

// 4. Config & utils internes
import { config } from '../config/env';
import { logger } from '../utils/logger';

// 5. Services & controllers
import { authService } from '../services/auth.service';

// 6. Types
import type { AppointmentInput } from '../types/appointment.types';
```

### Structure d'un service

```typescript
// src/services/example.service.ts

import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';

// ─── Types (exportés si réutilisés) ─────────────────
export interface CreateExampleInput {
  name: string;
}

// ─── Classe service ─────────────────────────────────
class ExampleService {
  async create(input: CreateExampleInput): Promise<Example> {
    // 1. Validation métier (au-delà de Zod)
    if (input.name.length < 2) {
      throw new BadRequestError('Nom trop court');
    }

    // 2. Vérifications DB (existe déjà ?)
    const existing = await prisma.example.findFirst({
      where: { name: input.name },
    });
    if (existing) {
      throw new ConflictError('Existe déjà');
    }

    // 3. Création
    const example = await prisma.example.create({
      data: input,
    });

    // 4. Side effects (notifications, logs)
    logger.info('Example créé', { id: example.id });

    return example;
  }
}

// ─── Export singleton ───────────────────────────────
export const exampleService = new ExampleService();
```

### Structure d'un controller

```typescript
// src/controllers/example.controller.ts

import { Request, Response, NextFunction } from 'express';
import { exampleService } from '../services/example.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

class ExampleController {
  create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();

      const result = await exampleService.create(req.body);

      sendCreated(res, result, 'Exemple créé avec succès');
    } catch (error) {
      next(error);
    }
  };
}

export const exampleController = new ExampleController();
```

### Structure d'une route

```typescript
// src/routes/example.routes.ts

import { Router } from 'express';
import { exampleController } from '../controllers/example.controller';
import { authenticate, authorize } from '../middleware/authenticate';
import { validateBody } from '../middleware/validate';
import { createExampleSchema } from '../validators/example.validators';
import { UserRole } from '@prisma/client';

const router = Router();

router.post(
  '/',
  authenticate,
  authorize(UserRole.PATIENT, UserRole.SUPER_ADMIN),
  validateBody(createExampleSchema),
  exampleController.create
);

export { router as exampleRoutes };
```

### Gestion d'erreurs

**Toujours** utiliser les classes d'erreurs custom :

```typescript
import {
  BadRequestError,        // 400
  UnauthorizedError,      // 401
  ForbiddenError,         // 403
  NotFoundError,          // 404
  ConflictError,          // 409
  ValidationError,        // 422
  TooManyRequestsError,   // 429
  InternalServerError,    // 500
} from '../utils/errors';

// ❌ NON
throw new Error('User not found');

// ✅ OUI
throw new NotFoundError('Utilisateur');
```

### Messages

- **TOUJOURS en français** pour les utilisateurs
- **TOUJOURS en français** pour les logs (cohérence projet sénégalais)
- **Anglais accepté** pour les commentaires techniques internes

### Commentaires

```typescript
// ─── Section visuelle ─────────────────────────────────
// Utilise ce format pour découper le code en sections

/**
 * Documentation JSDoc pour les fonctions complexes
 * @param phoneNumber - Numéro normalisé +221...
 * @returns L'utilisateur ou null
 */
```

### Validation Zod

**TOUS les inputs HTTP doivent être validés par Zod.** Pas d'exception.

```typescript
// src/validators/example.validators.ts

import { z } from 'zod';

export const createExampleSchema = z.object({
  name: z.string().min(2).max(100),
  age: z.number().int().min(0).max(150),
});

export type CreateExampleInput = z.infer<typeof createExampleSchema>;
```

### Réponses HTTP

**TOUJOURS** utiliser les helpers de `utils/response.ts` :

```typescript
sendSuccess(res, data, { message: '...' });   // 200
sendCreated(res, data, 'Créé');               // 201
sendNoContent(res);                           // 204
sendError(res, 400, 'BAD_REQUEST', '...');    // erreurs
```

---

## 7. Conventions Git

### Branches

```
main                    # Branche stable
develop                 # Branche de développement
feature/module-auth     # Nouvelle fonctionnalité
fix/login-bug           # Correction de bug
refactor/services-layer # Refactoring
```

### Commits (format Conventional Commits)

```
feat(auth): ajouter endpoint de réinitialisation de mot de passe
fix(rdv): corriger le calcul des créneaux disponibles
refactor(prisma): séparer les modèles patient et user
docs(readme): mettre à jour les instructions d'installation
test(auth): ajouter tests pour le service OTP
chore(deps): mettre à jour Prisma 5.22.0
```

**Types** : `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`

### Workflow

1. Créer une branche feature depuis `develop`
2. Développer + tester localement
3. Commiter avec messages clairs
4. Merger vers `develop` quand prêt
5. `develop` → `main` pour releases

---

## 8. État actuel du projet

### ✅ Phase 0 — Fondations (TERMINÉ)

- [x] Document de spécification complet (`SANTE-SENEGAL-SPECIFICATION.md`)
- [x] Schéma de base de données Prisma (40+ modèles, 20+ enums)
- [x] Setup backend (Express + TypeScript + Prisma)
- [x] Configuration env validée avec Zod
- [x] Configuration database (Prisma singleton)
- [x] Configuration Redis (optionnelle)
- [x] Logger Winston
- [x] Middleware d'erreurs global
- [x] Rate limiting (global + auth + OTP)
- [x] Helpers HTTP normalisés
- [x] Routes de health check
- [x] Seed avec données de test (admin, patients, médecins, pharmacie)
- [x] README complet

### ✅ Phase 1.1 — Module Authentification (TERMINÉ)

- [x] Utilitaires : JWT, password, OTP
- [x] Service SMS (mode dev qui log console)
- [x] Service OTP (envoi, vérification, cleanup)
- [x] Service Auth (register, login, refresh, logout, change/reset password)
- [x] Validators Zod pour tous les endpoints auth
- [x] Middleware authenticate + authorize (RBAC)
- [x] Controllers auth
- [x] Routes auth (10 endpoints)

### ⏭️ Phase 1.2 — Module Utilisateurs (À FAIRE)

CRUD profils patients, médecins, etc. Voir section 13.

### ⏭️ Phases suivantes

Voir [Roadmap](#9-roadmap-module-par-module).

---

## 9. Roadmap module par module

L'utilisateur veut progresser **module par module**, dans cet ordre :

### Module 1 : Authentification ✅ FAIT

### Module 2 : Utilisateurs & Profils
**Objectif** : gérer les profils complets des utilisateurs après inscription.

Endpoints :
- `GET /users/me` (étend `/auth/me`)
- `PATCH /users/me` — Mettre à jour son profil
- `POST /users/me/photo` — Upload photo de profil (Cloudinary)
- `GET /users/:id` — Voir profil public d'un utilisateur (sécurisé selon rôle)
- `DELETE /users/me` — Soft delete son compte
- `POST /users/me/emergency-contacts` — Ajouter contact d'urgence
- `GET /users/me/emergency-contacts` — Lister
- `DELETE /users/me/emergency-contacts/:id` — Supprimer

### Module 3 : Établissements de santé
**Objectif** : gérer les hôpitaux, cliniques, postes de santé.

Endpoints :
- `GET /establishments` — Liste paginée + filtres (type, ville, spécialité)
- `GET /establishments/nearby?lat=X&lng=Y&radius=10` — Géolocalisation
- `GET /establishments/:id` — Détail
- `POST /establishments` (admin) — Créer
- `PATCH /establishments/:id` (admin) — Modifier
- `DELETE /establishments/:id` (super-admin) — Supprimer

### Module 4 : Médecins
**Objectif** : annuaire des médecins + KYC + disponibilité libérale mobile.

Endpoints :
- `GET /medecins` — Liste paginée + filtres (spécialité, ville, langue, prix)
- `GET /medecins/nearby?lat=X&lng=Y&specialty=X` — Géoloc (libéraux mobiles)
- `GET /medecins/:id` — Profil public
- `PATCH /medecins/me` — Modifier son profil médecin
- `POST /medecins/me/documents` — Upload diplôme/CNI (KYC)
- `POST /medecins/me/mobile/toggle` — Activer/désactiver dispo mobile
- `POST /medecins/me/location` — Mettre à jour sa position GPS
- `GET /medecins/me/schedule` — Voir son planning
- `POST /medecins/me/schedule` — Définir ses horaires
- `POST /admin/medecins/:id/approve-kyc` (super-admin)
- `POST /admin/medecins/:id/reject-kyc` (super-admin)

### Module 5 : DME (Dossier Médical Électronique)
**Objectif** : accès et gestion du dossier médical.

Endpoints :
- `GET /medical-records/me` — Voir son DME (patient)
- `GET /medical-records/:patientId` — Voir DME d'un patient (médecin avec consentement)
- `PATCH /medical-records/me` — Modifier infos générales (allergies, etc.)
- `POST /medical-records/me/allergies` — Ajouter allergie
- `POST /medical-records/me/chronic-conditions` — Ajouter maladie chronique
- `POST /medical-records/me/documents` — Upload document médical
- `POST /medical-records/me/share-token` — Créer un token de partage (QR code)
- `GET /medical-records/access/:token` — Accéder via token (médecin)
- `DELETE /medical-records/me/share-tokens/:id` — Révoquer un token

### Module 6 : Rendez-vous classiques
**Objectif** : prise/gestion de RDV présentiels et téléconsultations.

Endpoints :
- `GET /appointments/me` — Mes RDV (patient ou médecin)
- `GET /appointments/me/upcoming` — RDV à venir
- `POST /appointments` — Créer RDV
- `GET /appointments/:id` — Détail
- `PATCH /appointments/:id/cancel` — Annuler
- `PATCH /appointments/:id/reschedule` — Reprogrammer
- `POST /appointments/:id/check-in` — Check-in à l'arrivée
- `POST /appointments/:id/start` — Démarrer la consultation
- `POST /appointments/:id/end` — Terminer
- `GET /medecins/:id/availability` — Créneaux dispo

### Module 7 : Médecin libéral mobile ⭐
**Objectif** : le module phare innovant.

Endpoints :
- `POST /home-visits` — Demander un médecin à domicile
- `GET /home-visits/me` — Mes demandes (patient/médecin)
- `GET /home-visits/:id` — Détail
- `POST /home-visits/:id/accept` (médecin) — Accepter la mission
- `POST /home-visits/:id/reject` (médecin) — Refuser
- `POST /home-visits/:id/start-trip` (médecin) — En route
- `POST /home-visits/:id/arrived` (médecin) — Arrivé
- `POST /home-visits/:id/complete` (médecin) — Terminer
- `PATCH /home-visits/:id/cancel` — Annuler
- **WebSocket** : `home-visit:matching`, `home-visit:tracking`, `home-visit:status`

### Module 8 : Consultations
**Objectif** : enregistrer les consultations dans le DME.

Endpoints :
- `POST /consultations` — Saisir une consultation (médecin)
- `GET /consultations/:id` — Détail
- `PATCH /consultations/:id` — Modifier (médecin, dans les 24h)
- `GET /patients/:id/consultations` — Historique consultations d'un patient

### Module 9 : Ordonnances numériques
**Objectif** : générer, signer, envoyer des ordonnances.

Endpoints :
- `POST /prescriptions` — Créer une ordonnance
- `GET /prescriptions/me` — Mes ordonnances
- `GET /prescriptions/:id` — Détail
- `GET /prescriptions/:id/pdf` — Télécharger PDF
- `GET /prescriptions/:id/qr` — QR code
- `POST /prescriptions/:id/cancel` — Annuler

### Module 10 : Médicaments & Pharmacies
**Objectif** : catalogue, stocks, recherche.

Endpoints :
- `GET /medications` — Catalogue (recherche par nom/DCI)
- `GET /medications/:id` — Détail
- `GET /pharmacies` — Liste paginée
- `GET /pharmacies/nearby?lat=X&lng=Y` — Géoloc
- `GET /pharmacies/on-duty` — Pharmacies de garde
- `GET /pharmacies/:id` — Détail
- `GET /pharmacies/:id/stock` — Stock complet
- `POST /pharmacies/me/stock` (pharmacien) — Mettre à jour stock
- `GET /medications/search/availability?medicationId=X` — Trouver pharmacies avec ce médoc

### Module 11 : Commandes pharmacie
**Objectif** : commander médicaments depuis ordonnance.

Endpoints :
- `POST /pharmacy-orders` — Créer commande
- `GET /pharmacy-orders/me` — Mes commandes
- `GET /pharmacy-orders/:id` — Détail
- `POST /pharmacy-orders/:id/accept` (pharmacien)
- `POST /pharmacy-orders/:id/refuse` (pharmacien)
- `POST /pharmacy-orders/:id/ready` (pharmacien)
- `POST /pharmacy-orders/:id/complete` (pharmacien)
- `PATCH /pharmacy-orders/:id/cancel`

### Module 12 : Livraison
**Objectif** : matching livreurs + tracking.

Endpoints :
- `GET /deliveries/available` (livreur)
- `POST /deliveries/:id/accept` (livreur)
- `POST /deliveries/:id/picked-up` (livreur)
- `POST /deliveries/:id/delivered` (livreur)
- `POST /deliveries/:id/failed` (livreur)
- `GET /deliveries/:id/tracking` (patient) — Tracking temps réel
- **WebSocket** : `delivery:tracking`

### Module 13 : Paiements
**Objectif** : Wave + Orange Money + wallet interne.

Endpoints :
- `POST /payments/initiate` — Initier un paiement
- `POST /payments/wave/webhook` — Webhook Wave
- `POST /payments/orange-money/webhook` — Webhook OM
- `GET /payments/me` — Mes paiements
- `GET /payments/:id` — Détail
- `POST /payments/:id/refund` (admin) — Rembourser
- `GET /wallet/me` — Solde
- `GET /wallet/me/transactions` — Historique
- `POST /wallet/me/withdraw` (médecin/pharmacien) — Retrait

### Module 14 : Notifications
**Objectif** : SMS, push, in-app.

Endpoints :
- `GET /notifications/me` — Mes notifs
- `PATCH /notifications/me/:id/read` — Marquer lu
- `PATCH /notifications/me/read-all` — Tout marquer lu
- `GET /notifications/me/settings` — Préférences
- `PATCH /notifications/me/settings` — Modifier préférences
- **Jobs Bull** : `send-sms`, `send-push`, `send-email`
- **CRON** : rappels RDV J-1 et H-2

### Module 15 : Urgences (SOS)
**Objectif** : bouton SOS + notification SAMU.

Endpoints :
- `POST /sos/alert` — Déclencher alerte
- `GET /sos/me` — Mes alertes
- `POST /sos/:id/resolve` — Marquer résolu

### Module 16 : Avis & Notation
**Objectif** : notation des médecins, pharmacies, livreurs.

Endpoints :
- `POST /reviews` — Créer avis
- `GET /reviews/target/:userId` — Avis sur un utilisateur
- `GET /reviews/me/received` — Mes avis reçus
- `POST /reviews/:id/respond` — Répondre à un avis
- `POST /admin/reviews/:id/moderate` (admin) — Modérer

### Module 17 : Audit & Conformité
**Objectif** : log immuable de toutes actions sur DME.

- Middleware d'audit automatique
- `GET /admin/audit-logs` (super-admin) — Consulter logs

### Module 18 : Statistiques & Dashboards
**Objectif** : KPIs pour patients, médecins, admins.

Endpoints :
- `GET /stats/me` — Stats personnelles
- `GET /stats/establishment/:id` (admin) — Stats d'un établissement
- `GET /stats/global` (super-admin) — Stats plateforme

### Module 19 : Téléconsultation (vidéo)
**Objectif** : intégrer WebRTC pour téléconsultations.

À étudier avec service externe (Twilio Video, Daily.co, ou Jitsi).

### Module 20 : Mode offline & sync
**Objectif** : DME consultable offline, sync intelligente.

---

## 10. Règles métier critiques

### R1 — Phone numbers

- **Format unique** stocké en DB : `+221XXXXXXXXX`
- **Normalisation** systématique avant tout traitement
- **Validation** : doit commencer par `+221[7]` puis 8 chiffres

### R2 — Mots de passe

- Minimum 8 caractères
- Au moins 1 majuscule, 1 minuscule, 1 chiffre
- Bcryptjs avec 12 rounds (config)
- Jamais retournés dans les réponses API

### R3 — OTP

- 6 chiffres
- Valide 5 minutes
- Max 5 tentatives par code
- Max 3 OTP actifs par numéro simultanément
- Rate limit : 3 OTP / 5min par numéro
- En DEV : log dans console, pas d'envoi SMS

### R4 — JWT

- Access token : 1 heure
- Refresh token : 30 jours
- Rotation à chaque refresh (l'ancien devient invalide)
- Refresh tokens stockés en DB pour révocation

### R5 — KYC

- Patients : KYC `APPROVED` direct à l'inscription
- Médecins/professionnels : KYC `PENDING` jusqu'à validation admin
- Compte `PENDING` peut se connecter mais accès limité

### R6 — DME (Dossier Médical)

- **Le DME appartient au patient**
- Médecin = accès UNIQUEMENT avec consentement (token QR)
- Tokens valides : 1h, 24h, 7j, ou illimité
- **Toutes les actions** sur DME doivent être loggées dans `AuditLog`
- **Aucune donnée médicale n'est supprimée** (anonymisation possible)

### R7 — Rendez-vous

- Annulation > 24h avant : pas de frais
- Annulation 2h-24h : 50% retenu
- Annulation < 2h ou no-show : 100% retenu
- 3 no-show consécutifs = blocage 30 jours

### R8 — Médecin libéral mobile

- Médecin a **60 secondes** pour accepter sinon passe au suivant
- Annulation patient après acceptation : 50% du tarif retenu
- Annulation médecin : pénalité note + indispo 1h
- Matching : disponibilité + distance + note + temps de réponse moyen

### R9 — Pharmacies

- Stock doit être à jour à ±15 minutes
- Annoncer un médicament inexistant = suspension
- Substitution générique = consentement patient obligatoire
- Médicaments sur ordonnance = vérification ordonnance numérique

### R10 — Paiements

- Commission plateforme : 5% sur consultations, 3% sur pharmacie
- Paiement médecin J+1 (libéral) ou J+15 (établissement)
- Litige paiement = blocage 48h pour médiation
- Remboursement automatique si médecin annule

### R11 — Sécurité

- **Tout endpoint avec données sensibles** = authenticate + RBAC
- **Audit log** sur toutes actions DME
- **Soft delete** sur users (jamais hard delete)
- **HTTPS obligatoire** en production
- **CORS strict** en production

### R12 — Internationalisation

- Messages utilisateur : **français** par défaut, **wolof** prochainement
- Format date : ISO 8601 partout
- Devise : **XOF** (Franc CFA)
- Timezone : **Africa/Dakar**

---

## 11. Sécurité et conformité

### Hashing

- **Mots de passe** : bcryptjs 12 rounds
- **OTP codes** : bcryptjs 10 rounds (stockage temporaire)
- **Refresh tokens** : stockés en clair en DB (rotation à chaque usage)

### JWT

- HS256 (HMAC SHA-256)
- Secret minimum 64 caractères aléatoires
- Secret différent pour access vs refresh
- Issuer claim : "Santé Sénégal"

### Headers HTTP

Via Helmet (déjà configuré) :
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

### Rate limiting

3 niveaux configurés :
- **Global** : 100 req / 15 min par IP
- **Auth** : 5 tentatives / 15 min
- **OTP** : 3 envois / 5 min par numéro

### Audit Log

Pour toute action sur le DME, créer une entrée `AuditLog` avec :
- userId (qui)
- action (quoi)
- resourceType + resourceId (sur quoi)
- oldValue / newValue
- ipAddress, userAgent
- timestamp

### Conformité CDP Sénégal

- Consentement explicite à l'inscription
- Droit d'accès, rectification, suppression
- Politique de confidentialité claire
- Déclaration à la Commission de Protection des Données

---

## 12. Tests et qualité

### Stratégie de tests (à mettre en place progressivement)

- **Unitaires** (Vitest ou Jest) : services et utils purs
- **Intégration** : endpoints API avec Supertest
- **E2E** : critiques (auth flow, RDV, paiements)

### Convention de fichiers de test

```
src/services/auth.service.ts
src/services/auth.service.test.ts  (ou .spec.ts)
```

### Linting

ESLint + Prettier déjà configurés. Lancer :

```cmd
npm run lint
npm run format
```

---

## 13. Instructions par module

### Comment construire un nouveau module

À chaque fois que l'utilisateur dit **"construis le module X"**, suis CETTE checklist :

#### Étape 1 — Comprendre le module

1. **Relire la section concernée** de ce document (section 9)
2. **Vérifier le schéma Prisma** pour les modèles concernés
3. **Identifier les règles métier** (section 10)
4. **Identifier les permissions/rôles** requis
5. **Si doute** : demander à l'utilisateur

#### Étape 2 — Créer les fichiers (dans CET ordre)

```
1. src/validators/{module}.validators.ts   (schémas Zod)
2. src/services/{module}.service.ts         (logique métier)
3. src/controllers/{module}.controller.ts   (HTTP)
4. src/routes/{module}.routes.ts            (endpoints)
5. src/routes/index.ts                      (ajouter la route)
```

#### Étape 3 — Tester

1. Compiler : `npx tsc --noEmit`
2. Lancer : `npm run dev`
3. Tester les endpoints au Postman ou avec curl
4. Si erreurs : debug et corriger
5. Documenter les endpoints dans un guide de test

#### Étape 4 — Documenter

Mettre à jour le `PROJECT-STATE.md` avec :
- Module marqué comme terminé
- Liste des endpoints créés
- Notes importantes

#### Étape 5 — Commiter

```cmd
git add .
git commit -m "feat(module-X): description"
```

### Quand utiliser quoi

| Besoin | Outil |
|---|---|
| Valider input HTTP | Zod schema dans validators/ |
| Logique métier complexe | Service |
| Accès DB | Prisma via le service |
| Vérifier rôle utilisateur | Middleware `authorize` |
| Vérifier JWT | Middleware `authenticate` |
| Rate limiting spécifique | Créer un rate limiter custom |
| Réponse HTTP | Helpers `sendSuccess`, `sendCreated`... |
| Erreur métier | Classes custom (`NotFoundError` etc.) |
| Log technique | `logger.info/warn/error` |
| Audit DME | Créer entrée `auditLog` dans Prisma |
| Job asynchrone (SMS, email) | Bull queue dans `jobs/` |
| Notification temps réel | Socket.io dans `sockets/` |
| Tâche périodique | CRON via Bull ou node-cron |

---

## 14. Workflow d'exécution

### Quand l'utilisateur lance une nouvelle session

1. **Lire CE document** en entier
2. **Lire `PROJECT-STATE.md`** pour savoir où on en est
3. **Lire `ROADMAP.md`** pour le prochain module
4. Demander : **"Quel module veux-tu construire aujourd'hui ?"**

### Quand l'utilisateur dit "fais X"

1. **Confirmer la compréhension** en reformulant
2. **Lister les fichiers** que tu vas créer/modifier
3. **Vérifier les dépendances** (autres modules requis)
4. **Exécuter étape par étape**
5. **Tester** avant de passer à la suite
6. **Documenter** les changements

### Quand une erreur survient

1. **Lire le message complet** d'erreur
2. **Identifier le fichier et la ligne**
3. **Vérifier** :
   - Imports corrects ?
   - Types corrects ?
   - Validation Zod en amont ?
   - Variable d'environnement présente ?
4. **Corriger** et relancer
5. **Expliquer** la cause à l'utilisateur

### Quand l'utilisateur demande une nouvelle fonctionnalité hors roadmap

1. **Vérifier** que c'est cohérent avec la vision projet
2. **Évaluer l'impact** (changements DB ? Nouveaux modules ?)
3. **Proposer une intégration** dans la roadmap
4. **Si simple** : ajouter immédiatement
5. **Si complexe** : créer un sous-module et l'inscrire dans la roadmap

### Communication

- **Tutoyer** Baye
- **Français** par défaut
- **Direct et concis** mais complet
- **Step-by-step** avec commandes exactes
- **Si CMD** : précise toujours `cmd` pas `powershell`
- **Si erreur** : explique la cause, pas seulement la solution

---

## 15. FAQ et cas particuliers

### Q : Comment gérer les fichiers (photos, documents) ?

Utiliser **Cloudinary** avec :
- Upload via API depuis le backend
- URLs stockées en DB
- Transformations automatiques (resize, optimisation)
- Folders structurés : `users/{id}/photo`, `medecins/{id}/diploma`, etc.

### Q : Comment gérer la géolocalisation ?

- Latitude/longitude stockées en `Float` Prisma
- Index géospatial via `@@index([latitude, longitude])`
- Calcul de distance via formule **Haversine** côté service
- Pour requêtes complexes : PostGIS (extension PostgreSQL, à activer si besoin)

### Q : Comment envoyer des SMS en production ?

Le service `sms.service.ts` a déjà la structure. Pour activer :
1. Obtenir credentials Orange SMS Sénégal et/ou Twilio
2. Ajouter dans `.env`
3. Implémenter les méthodes `sendViaOrange()` et `sendViaTwilio()`

### Q : Comment gérer les paiements Wave/OM ?

Workflow :
1. Backend crée un `Payment` avec status `EN_ATTENTE`
2. Appel API Wave/OM pour initier
3. URL de paiement retournée au client
4. Webhook reçu → vérifier signature → mettre à jour `Payment.status`
5. Si succès → créditer wallet bénéficiaire + créer `WalletTransaction`

### Q : Comment faire le matching médecin libéral mobile ?

Algorithme dans `home-visit.service.ts` :
1. Récupérer médecins avec `isMobileAvailable: true`
2. Filtrer par spécialité demandée
3. Calculer distance Haversine pour chacun
4. Filtrer par `mobileRadiusKm`
5. Trier par score (distance × note × temps réponse moyen)
6. Notifier le premier via Socket.io + push
7. 60s timeout → passer au suivant
8. Stocker `rejectedByMedecinIds` pour ne pas reproposer

### Q : Comment gérer les rappels RDV (J-1 et H-2) ?

CRON Bull :
- Toutes les heures, scanner les RDV à venir
- Pour ceux dans 23-25h : envoyer SMS J-1 (si pas déjà envoyé)
- Pour ceux dans 1.5-2.5h : envoyer SMS H-2 (si pas déjà envoyé)
- Marquer `reminderJ1Sent` / `reminderH2Sent` en DB

### Q : Et le frontend ?

Pour l'instant on focus le backend. Quand le backend sera bien avancé (modules 1-10 ou 1-15), on attaquera le frontend PWA dans un projet séparé.

### Q : Les tests

À mettre en place progressivement. Priorité :
1. Tests unitaires sur les utils (jwt, password, otp) → faciles, gros impact
2. Tests d'intégration sur l'auth → critique
3. Tests sur les paiements → critique pour la prod

### Q : La documentation API

Quand le backend sera stable, générer une doc Swagger/OpenAPI à partir des routes + Zod schemas.

---

## 🎯 Engagement de Claude Code

À chaque interaction avec Baye, Claude Code s'engage à :

1. ✅ **Respecter les conventions** de ce document
2. ✅ **Suivre l'ordre** de la roadmap (module par module)
3. ✅ **Tester** avant de déclarer terminé
4. ✅ **Documenter** chaque module construit
5. ✅ **Préciser les commandes** en CMD (pas PowerShell)
6. ✅ **Être pédagogue** mais sans noyer dans les détails inutiles
7. ✅ **Demander** si quelque chose n'est pas clair
8. ✅ **Sauvegarder** régulièrement (git commit après chaque module)
9. ✅ **Respecter le français** dans tous les messages utilisateur
10. ✅ **Penser sécurité** et conformité données médicales en premier

---

## 📞 Quand Baye lance Claude Code pour la première fois

Claude Code doit dire :

> "Salut Baye ! J'ai lu le document maître CLAUDE.md. Voici où on en est :
>
> ✅ Phase 0 - Fondations : terminée
> ✅ Module 1 - Authentification : terminé
> ⏭️ Prochain : Module 2 - Utilisateurs & Profils
>
> Veux-tu :
> 1. Vérifier que tout fonctionne avant d'aller plus loin ?
> 2. Démarrer le module 2 ?
> 3. Autre chose ?"

---

**Fin du document maître. Bon dev Baye ! 🚀**
