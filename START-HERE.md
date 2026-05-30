# 🚀 START-HERE.md — Comment démarrer avec Claude Code

> **Salut Baye ! Voici comment tu transitionnes vers Claude Code pour la suite du projet.**

---

## 📦 Ce que tu as dans ce package

```
sante-senegal-backend/
├── 📘 START-HERE.md              ← TU ES ICI
├── 📕 CLAUDE.md                  ← Document maître pour Claude Code (50+ pages)
├── 📗 PROJECT-STATE.md           ← État actuel du projet
├── 📙 ROADMAP.md                 ← Liste des modules à construire
├── 📓 README.md                  ← Instructions techniques
├── 📔 AUTH-MODULE-GUIDE.md       ← Guide de test du module auth
├── 🗃️ SANTE-SENEGAL-SPECIFICATION.md  ← La bible du projet
├── prisma/
│   ├── schema.prisma             ← Schéma complet de la DB
│   └── seed.ts                   ← Données de test
├── src/                          ← Code source (Phase 0 + Module Auth)
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 🛣️ Étape 1 : Installation sur ton PC

### 1.1 Décompresse le ZIP

Décompresse dans : `C:\Users\samb9\Desktop\sante-senegal-backend\`

### 1.2 Ouvre VS Code dans le dossier

```cmd
cd C:\Users\samb9\Desktop\sante-senegal-backend
code .
```

### 1.3 Installe Claude Code (si pas déjà fait)

Suis les instructions sur https://docs.claude.com/en/docs/claude-code

Tu l'as déjà installé sur ton PC (voir tes anciens contextes : `C:\Users\samb9\.local\bin\claude.exe`).

### 1.4 Installe les dépendances

Dans le terminal CMD de VS Code :

```cmd
npm install
```

### 1.5 Configure ton .env

```cmd
copy .env.example .env
```

Puis ouvre `.env` dans VS Code et remplis au minimum :

**DATABASE_URL** : ton URL PostgreSQL locale
```
DATABASE_URL="postgresql://sante_user:tonMotDePasse@localhost:5432/sante_senegal?schema=public"
```

**JWT_SECRET** et **JWT_REFRESH_SECRET** : génère 2 secrets différents
```cmd
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 1.6 Crée la base PostgreSQL

Ouvre pgAdmin et exécute :

```sql
CREATE USER sante_user WITH PASSWORD 'tonMotDePasse';
CREATE DATABASE sante_senegal OWNER sante_user;
GRANT ALL PRIVILEGES ON DATABASE sante_senegal TO sante_user;
```

### 1.7 Génère Prisma + migration + seed

```cmd
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
```

### 1.8 Lance le serveur

```cmd
npm run dev
```

✅ Tu devrais voir :
```
✅ PostgreSQL connecté
✅ Serveur démarré sur http://localhost:3000
```

### 1.9 Teste

Ouvre dans ton navigateur : http://localhost:3000/api/v1/health

Tu dois voir une réponse JSON.

---

## 🤖 Étape 2 : Démarrer avec Claude Code

### 2.1 Lance Claude Code dans le dossier du projet

Dans un terminal CMD à part :

```cmd
cd C:\Users\samb9\Desktop\sante-senegal-backend
C:\Users\samb9\.local\bin\claude.exe
```

### 2.2 Premier message à Claude Code

Copie-colle EXACTEMENT ce message à Claude Code :

```
Salut ! Je travaille sur le projet "Santé Sénégal", une plateforme tout-en-un
pour la santé au Sénégal.

Lis IMPÉRATIVEMENT ces 5 fichiers dans cet ordre avant de répondre :
1. CLAUDE.md (document maître - lis-le ENTIÈREMENT)
2. PROJECT-STATE.md (où on en est)
3. ROADMAP.md (ce qui reste à faire)
4. ROLES.md (rôles et permissions - CRUCIAL pour RBAC)
5. prisma/schema.prisma (la structure DB)

Ensuite, donne-moi un résumé de :
- Ce que tu as compris du projet
- L'état actuel
- Le prochain module à construire
- Tes 3-5 questions pour clarifier avant de commencer
```

### 2.3 Réponse attendue de Claude Code

Claude Code doit :
1. Confirmer avoir lu les 4 fichiers
2. Te résumer le projet
3. Te dire qu'on en est au **Module 2 : Utilisateurs & Profils**
4. Te poser ses questions

---

## 🎯 Étape 3 : Travailler avec Claude Code

### Comment lui donner des instructions

**Format recommandé :**

```
Construis le Module X comme décrit dans ROADMAP.md.

Respecte CLAUDE.md (conventions, sécurité, RBAC).
Mets à jour PROJECT-STATE.md à la fin.

Procède étape par étape et arrête-toi à chaque fichier créé
pour me montrer le diff.
```

### Exemples de commandes utiles

**Pour construire un module :**
```
Construis le module 2 (Utilisateurs & Profils) en suivant la roadmap.
```

**Pour debugger :**
```
Quand je lance `npm run dev`, j'ai cette erreur : [paste error]
Diagnostique et corrige.
```

**Pour ajouter une fonctionnalité :**
```
Ajoute un endpoint pour [description].
Respecte les conventions du CLAUDE.md.
```

**Pour tester :**
```
Aide-moi à tester le module Auth.
Génère les requêtes curl pour chaque endpoint.
```

**Pour commiter :**
```
Fais un git commit avec un message clair pour les changements actuels.
```

---

## ⚡ Tips pour bien collaborer avec Claude Code

### ✅ À faire

- **Lui donner accès aux fichiers** dont il a besoin (Claude Code a accès au filesystem)
- **Le laisser lancer les commandes** (npm install, prisma generate, etc.)
- **Lui demander de tester** ce qu'il vient de coder
- **Lui dire quand quelque chose ne fonctionne pas** avec le message d'erreur exact
- **Le faire commiter régulièrement** (1 commit par sous-tâche)

### ❌ À éviter

- Lui demander de faire 5 modules d'un coup (un à la fois)
- Lui donner des instructions vagues ("améliore le code")
- Sauter des modules de la roadmap (chaque dépend du précédent)
- Modifier des fichiers à la main sans lui dire

---

## 🔧 Commandes utiles pendant le développement

### Voir les logs en direct

```cmd
npm run dev
```

### Voir la DB dans Prisma Studio

```cmd
npx prisma studio
```

→ Ouvre http://localhost:5555

### Reset complet de la DB

```cmd
npm run prisma:reset
```

⚠️ Supprime toutes les données.

### Compiler TypeScript sans run

```cmd
npx tsc --noEmit
```

### Tester un endpoint avec curl

```cmd
curl -X POST http://localhost:3000/api/v1/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"phoneNumber\":\"+221771111111\",\"password\":\"Patient2026!\"}"
```

---

## 🆘 Si tu bloques

### Si Claude Code semble perdu

Redonne-lui le contexte :

```
Relis CLAUDE.md et PROJECT-STATE.md.
Sur quoi on travaillait ? Où on en est ?
```

### Si une erreur que tu ne comprends pas

```
J'ai cette erreur : [paste complète]
À quel fichier elle se réfère ? Explique-moi la cause.
```

### Si tu veux changer d'approche

```
Avant de continuer, je voudrais discuter [sujet].
Qu'est-ce que tu en penses ?
```

### Si tu veux revenir en arrière

```
Annule les changements depuis [moment/commit].
Reprenons à partir de [état].
```

---

## 📚 Documentation de référence

Garde toujours ces fichiers ouverts dans VS Code :

- `CLAUDE.md` — Onglet 1 (référence)
- `PROJECT-STATE.md` — Onglet 2 (où on en est)
- `ROADMAP.md` — Onglet 3 (ce qui reste)
- `prisma/schema.prisma` — Onglet 4 (structure DB)

---

## 🎯 Premier objectif concret

Une fois Claude Code lancé et le module 1 vérifié, ton **premier vrai objectif** est de :

**Construire le Module 2 : Utilisateurs & Profils**

C'est court (1-2 jours), ça te familiarise avec le workflow, et ça débloque les modules suivants.

Demande à Claude Code : `Construis le Module 2 selon la roadmap.`

---

**Bon courage Baye ! 🚀**

> N'oublie pas : Claude Code est ton assistant, pas ton remplaçant.
> Toi tu prends les décisions stratégiques, lui exécute.
> Reste critique, vérifie son code, teste tout.
