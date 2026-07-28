# Installation locale

> Procédure reproductible pour lancer Monalyz avec sa pile Supabase locale.

## Prérequis

| Outil | Attendu |
| --- | --- |
| Node.js | 20.9 ou supérieur |
| Bun | Installable via `npx bun` |
| Docker Desktop | Démarré |
| Supabase CLI | `2.110.0`, épinglé dans les dépendances de développement |

## Installation

```powershell
npx bun install
Copy-Item .env.example .env.local
npx bun x supabase start -x realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
npx bun x supabase status -o env
```

Dans `.env.local`, reportez :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY>
NEXT_PUBLIC_APP_ORIGIN=http://127.0.0.1:3000
APP_ORIGIN=http://127.0.0.1:3000
```

Puis lancez :

```powershell
npx bun run dev
```

Pour travailler directement contre le projet distant Monalyz, utilisez plutôt :

```powershell
npx bun run supabase:link
Copy-Item .env.remote.example .env.local
```

Le schéma reste développé et testé localement avant tout déploiement distant.
Consultez [Exploitation Supabase](database-operations.md).

## Premier compte staff

1. Créez un compte applicatif depuis `/register`.
2. Confirmez l’adresse via Mailpit à `http://127.0.0.1:54324`.
3. Récupérez l’UUID dans `auth.users`.
4. Depuis une console SQL d’administration, accordez explicitement un rôle :

```sql
insert into public.staff_members (user_id, role, active)
values ('00000000-0000-0000-0000-000000000000', 'admin', true)
on conflict (user_id) do update
set role = excluded.role, active = true;
```

Les rôles autorisés sont `reviewer`, `operator`, `supervisor` et `admin`.
Aucun compte staff ou jeu de transactions n’est préchargé.

Pour créer les deux accès synthétiques réutilisables sans les inscrire dans le
seed ou le snapshot, suivez [Comptes de démonstration](demo-accounts.md).

Les modèles d’inscription et de récupération locaux sont versionnés dans
`supabase/templates`. Ils dirigent les liens vers `/auth/confirm`, où le
`token_hash` est échangé côté serveur contre des cookies de session.
Mailpit reste le seul transport local : aucun profil Resend ou Brevo n’est
nécessaire pour développer. Leur configuration hébergée est décrite dans
[E-mails transactionnels](transactional-email.md).

## Dépannage local

- Si le port PostgreSQL standard d’un autre projet est occupé, Monalyz utilise
  `54332` dans `supabase/config.toml`.
- Sous Windows, la pile minimale ci-dessus exclut les services non nécessaires
  susceptibles d’échouer sur le contrôle de santé Analytics.
- Après une modification de migration, exécutez
  `npx bun x supabase migration up --local`, les tests de base, puis
  `npx bun run db:snapshot`.
