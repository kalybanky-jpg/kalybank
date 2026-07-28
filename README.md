# Monalyz

> Application d’instruction, de contrôle et de traçabilité d’opérations financières réalisées hors application.

> [!IMPORTANT]
> Monalyz n’utilise aucune API bancaire, n’est relié à aucune banque et ne déplace
> jamais d’argent. Les contrôles et mouvements réels ont lieu hors application ;
> le chef d’agence en confirme ensuite le résultat dans Monalyz.

| Élément | Valeur |
| --- | --- |
| État | Application fonctionnelle, déploiement non configuré |
| Stack | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Données | Supabase Auth, PostgreSQL, Storage privé |
| Gestionnaire | Bun |
| Support | `support@monalyz.com` |

## Fonctions actuelles

- comptes applicatifs et dossiers KYC contrôlés humainement ;
- intentions de transfert avec réservation, validation et finalisation par le
  chef d’agence après traitement bancaire hors application ;
- demandes de prêt validées puis décaissées par le chef d’agence après
  traitement interne, avec crédit de la position courante ;
- positions financières déclarées ou rapprochées, datées et non connectées ;
- rôles staff, RLS, journal d’audit, justificatifs privés et outbox e-mail.

## Démarrage rapide

```powershell
npx bun install
Copy-Item .env.example .env.local
npx bun x supabase start -x realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
npx bun run dev
```

Renseignez `.env.local` avec les valeurs locales affichées par
`npx bun x supabase status -o env`. Consultez [le guide d’installation](docs/setup.md)
avant de créer le premier rôle staff.

## Carte du dépôt

```text
app/                  Routes Next.js, Auth et API de justificatifs
components/           Interfaces utilisateur et back-office
lib/                  Store Supabase, domaine financier et sécurité
supabase/migrations/  Schéma, RLS, RPC et machines d’état
supabase/tests/       Tests pgTAP des invariants financiers
tests/                Tests TypeScript du domaine et des redirections
docs/                 Architecture et procédures d’exploitation
```

## Documentation

| Document | Usage |
| --- | --- |
| [Index](docs/index.md) | Parcours de lecture |
| [Installation](docs/setup.md) | Environnement local et bootstrap |
| [Architecture](docs/architecture.md) | Frontières et flux |
| [Modèle de données](docs/data-model.md) | Entités, états et invariants |
| [API](docs/api.md) | Route serveur et RPC |
| [Tests](docs/testing.md) | Portes qualité |
| [Base Supabase](docs/database-operations.md) | Liaison, migrations et snapshot |
| [E-mails transactionnels](docs/transactional-email.md) | Profils SMTP Resend et Brevo |
| [Déploiement](docs/deployment.md) | Prévol, smoke tests et rollback |

## État actuel

Le dépôt ne contient ni configuration de plateforme de déploiement ni CI.
Les taux de conversion sont des références statiques datées, jamais des cours
de marché en direct. Les preuves de transaction proviennent exclusivement de
l’exécution externe documentée par des opérateurs habilités.
