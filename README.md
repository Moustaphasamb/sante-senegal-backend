# 🏥 Santé Sénégal — Backend API

Backend Node.js + Express + TypeScript + PostgreSQL pour la plateforme **Santé Sénégal**.

## 📋 Prérequis

- **Node.js** v20+ (tu as v25.9.0 ✅)
- **npm** v10+ (tu as v11.12.1 ✅)
- **PostgreSQL** 16+ (déjà installé ✅)
- **Redis** 7+ (à installer pour les fonctionnalités temps réel)

## 🚀 Installation (étape par étape)

### 1. Aller dans le dossier du projet

```cmd
cd C:\Users\samb9\Desktop\sante-senegal-backend
```

### 2. Installer les dépendances

```cmd
npm install
```

### 3. Créer la base de données PostgreSQL

Ouvre **pgAdmin** (ou psql en CMD) et exécute :

```sql
CREATE USER sante_user WITH PASSWORD 'tonMotDePasseSecurise';
CREATE DATABASE sante_senegal OWNER sante_user;
GRANT ALL PRIVILEGES ON DATABASE sante_senegal TO sante_user;
```

### 4. Configurer les variables d'environnement

```cmd
copy .env.example .env
```

Puis ouvre `.env` dans VS Code et remplis au minimum :

```env
DATABASE_URL="postgresql://sante_user:tonMotDePasseSecurise@localhost:5432/sante_senegal?schema=public"
JWT_SECRET=remplace_ceci_par_une_chaine_aleatoire_de_64_caracteres_minimum
JWT_REFRESH_SECRET=une_autre_chaine_aleatoire_differente_de_64_caracteres_minimum
```

💡 **Astuce** : pour générer un secret aléatoire, exécute dans CMD :
```cmd
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 5. Générer le client Prisma

```cmd
npx prisma generate
```

⚠️ **IMPORTANT** : Si TypeScript affiche des erreurs comme `Module '@prisma/client' has no exported member 'UserRole'`, c'est que cette étape n'a pas été faite ou a échoué. Lance `npx prisma generate` pour résoudre.

### 6. Créer les tables dans la base de données

```cmd
npx prisma migrate dev --name init
```

### 7. Peupler la base avec des données de test

```cmd
npm run prisma:seed
```

### 8. Lancer le serveur en développement

```cmd
npm run dev
```

✅ Le serveur démarre sur **http://localhost:3000**

### 9. Tester le serveur

Ouvre dans ton navigateur :

- **Page d'accueil** : http://localhost:3000
- **Health check** : http://localhost:3000/api/v1/health
- **Health check profond** (DB + Redis) : http://localhost:3000/api/v1/health/deep
- **Prisma Studio** (interface DB) : `npx prisma studio` → http://localhost:5555

## 📁 Structure du projet

```
sante-senegal-backend/
├── prisma/
│   ├── schema.prisma          → Schéma complet de la DB (40+ modèles)
│   └── seed.ts                → Données de test
├── src/
│   ├── config/
│   │   ├── env.ts             → Variables d'environnement validées (Zod)
│   │   ├── database.ts        → Prisma Client singleton
│   │   └── redis.ts           → Configuration Redis
│   ├── controllers/           → Logique des routes (à venir)
│   ├── middleware/
│   │   ├── errorHandler.ts    → Gestion globale des erreurs
│   │   ├── validate.ts        → Validation Zod
│   │   └── rateLimiter.ts     → Anti-spam / brute force
│   ├── routes/
│   │   ├── index.ts           → Routes principales
│   │   └── health.routes.ts   → Health checks
│   ├── services/              → Logique métier (à venir)
│   ├── jobs/                  → Tâches asynchrones Bull (à venir)
│   ├── sockets/               → Socket.io handlers (à venir)
│   ├── utils/
│   │   ├── logger.ts          → Logger Winston
│   │   ├── errors.ts          → Classes d'erreurs custom
│   │   └── response.ts        → Helpers réponses HTTP
│   ├── types/                 → Types TypeScript globaux
│   ├── app.ts                 → Configuration Express
│   └── server.ts              → Point d'entrée
├── logs/                      → Logs (créé automatiquement)
├── .env                       → Variables d'environnement (NE PAS COMMIT)
├── .env.example               → Template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 🛠️ Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Démarre le serveur en mode développement (hot reload) |
| `npm run build` | Compile TypeScript en JavaScript |
| `npm start` | Démarre le serveur en production |
| `npm run prisma:generate` | Génère le client Prisma |
| `npm run prisma:migrate` | Crée une nouvelle migration |
| `npm run prisma:studio` | Ouvre Prisma Studio (interface DB) |
| `npm run prisma:seed` | Peuple la DB avec les données de test |
| `npm run prisma:reset` | ⚠️ Reset complet de la DB |

## 🔑 Comptes de test

Après avoir lancé `npm run prisma:seed`, ces comptes sont disponibles :

| Rôle | Téléphone | Mot de passe |
|---|---|---|
| Super Admin | +221770000001 | Admin2026! |
| Patient (Fatou Diop) | +221771111111 | Patient2026! |
| Patient (Mamadou Sarr) | +221772222222 | Patient2026! |
| Médecin Salarié (Dr Diallo) | +221780000001 | Medecin2026! |
| Médecin Libéral Mobile (Dr Sow) | +221780000002 | Medecin2026! |
| Spécialiste (Dr Fall) | +221780000003 | Medecin2026! |
| Pharmacien (Awa Ba) | +221790000001 | Pharma2026! |

## 📚 Endpoints actuels

### Health Check
- `GET /` → Bienvenue
- `GET /api/v1/health` → Status basique
- `GET /api/v1/health/deep` → Status approfondi (DB + Redis)
- `GET /api/v1/health/version` → Version

### À venir
- `POST /api/v1/auth/register` → Inscription
- `POST /api/v1/auth/login` → Connexion
- `POST /api/v1/auth/otp/send` → Envoi OTP
- `POST /api/v1/auth/otp/verify` → Vérification OTP
- ... et plein d'autres

## 🐛 Dépannage

### Le serveur ne démarre pas

```
❌ Variables d'environnement invalides
```
→ Vérifie ton fichier `.env`. `DATABASE_URL`, `JWT_SECRET` et `JWT_REFRESH_SECRET` sont obligatoires (32+ caractères).

### Erreur de connexion PostgreSQL

```
❌ Impossible de se connecter à PostgreSQL
```
→ Vérifie que PostgreSQL tourne : ouvre `services.msc` → "postgresql-x64-16" doit être en cours d'exécution.

### Redis non disponible

```
⚠️ Redis non disponible
```
→ Redis n'est pas obligatoire au démarrage pour tester l'API. Tu peux l'installer plus tard via [Memurai](https://www.memurai.com/) (équivalent Redis pour Windows).

### Erreur Prisma

```
Error: Query engine library for current platform not found
```
→ Exécute : `npx prisma generate`

## 🔒 Sécurité

⚠️ **NE JAMAIS committer le fichier `.env`** — il contient des secrets.

Avant de mettre en production :
- [ ] Changer tous les `CHANGE_ME` dans `.env`
- [ ] Générer des `JWT_SECRET` longs et aléatoires
- [ ] Activer HTTPS
- [ ] Configurer Sentry pour le monitoring d'erreurs
- [ ] Activer la 2FA pour les comptes admin

## 📞 Support

Projet développé par **Baye Tapha Samb**.

---

**Version :** 1.0.0
**Date :** 28 mai 2026
**Status :** Phase 0 — Fondations ✅
