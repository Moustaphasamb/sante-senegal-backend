# Module 2 — Utilisateurs & Profils : Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer 10 endpoints permettant à un utilisateur connecté de gérer son profil, sa photo, et ses contacts d'urgence ; et à n'importe qui de voir le profil public d'un autre utilisateur.

**Architecture:** Service layer (user.service + upload.service) → Controller → Routes. Upload photo via multer (memoryStorage) → Cloudinary (avec mode dégradé dev si credentials manquants). PATCH profil met à jour User + profil rôle-spécifique dans une transaction Prisma.

**Tech Stack:** Express, Prisma 5, Zod, cloudinary@2, multer@1.4.5-lts.1, bcryptjs, Winston

---

## Fichiers

| Action | Fichier |
|---|---|
| Créer | `src/validators/user.validators.ts` |
| Créer | `src/middleware/upload.middleware.ts` |
| Créer | `src/services/upload.service.ts` |
| Créer | `src/services/user.service.ts` |
| Créer | `src/controllers/user.controller.ts` |
| Créer | `src/routes/user.routes.ts` |
| Modifier | `src/routes/index.ts` |

---

## Task 1 : Installer les dépendances

- [ ] Installer cloudinary + multer + types

```cmd
cd C:\Users\samb9\Desktop\sante-senegal\sante-senegal-backend
npm install cloudinary@^2.5.1 multer@^1.4.5-lts.1
npm install --save-dev @types/multer@^1.4.12
```

---

## Task 2 : Validators Zod

- [ ] Créer `src/validators/user.validators.ts`

---

## Task 3 : Middleware upload (multer)

- [ ] Créer `src/middleware/upload.middleware.ts`

---

## Task 4 : Service upload (Cloudinary)

- [ ] Créer `src/services/upload.service.ts`

---

## Task 5 : Service utilisateurs

- [ ] Créer `src/services/user.service.ts`

---

## Task 6 : Controller

- [ ] Créer `src/controllers/user.controller.ts`

---

## Task 7 : Routes

- [ ] Créer `src/routes/user.routes.ts`
- [ ] Modifier `src/routes/index.ts`

---

## Task 8 : Compiler et tester

- [ ] `npx tsc --noEmit`
- [ ] `npm run dev`
- [ ] Tester les 10 endpoints

---

## Task 9 : Mettre à jour PROJECT-STATE.md

- [ ] Marquer Module 2 comme terminé
