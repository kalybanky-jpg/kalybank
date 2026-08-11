# Monalyz

> Registre bancaire numérique pour déclarer et suivre les comptes, IBAN,
> soldes, virements, prêts et documents officiels de l’établissement.

> [!IMPORTANT]
> Monalyz n’utilise aucune API bancaire, n’est relié à aucun système bancaire
> tiers et ne déclenche aucun mouvement automatique. Pour ce MVP, le personnel
> de l’établissement réalise les contrôles et les exécutions dans ses processus
> internes, hors Monalyz. Le chef d’agence est l’unique autorité qui déclare,
> valide et finalise ensuite ces opérations dans l’application.

| Élément | Valeur |
| --- | --- |
| État | Application fonctionnelle, déploiement non configuré |
| Stack | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Données | Supabase Auth, PostgreSQL, Storage privé |
| Gestionnaire | Bun |
| Support | `support@monalyz.com` |

## Fonctions actuelles

- comptes bancaires déclarés dans `financial_positions`, avec titulaire,
  numéro de compte, IBAN, BIC, agence, statut et solde courant ;
- grand livre append-only des soldes d’ouverture, ajustements, débits de
  virements confirmés et crédits de prêts décaissés ;
- comptes applicatifs et dossiers KYC contrôlés humainement ;
- intentions de transfert avec réservation, validation et finalisation par le
  chef d’agence après exécution interne par le personnel de l’établissement ;
- demandes de prêt validées puis décaissées par le chef d’agence après
  traitement interne, avec crédit de la position courante ;
- documents officiels PDF versionnés — RIB, relevés, attestations, confirmations
  de virement et décisions ou confirmations de prêt — conservés dans un bucket
  Storage privé ;
- rôles staff, RLS, journal d’audit, justificatifs privés et e-mails
  transactionnels multilingues via Resend ou Brevo.

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
app/                  Routes Next.js, Auth et API de fichiers/documents
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
| [Modèle vierge avec admin démo](docs/clean-admin-baseline.md) | Base locale/CI minimale et identifiants publics |
| [Base Supabase](docs/database-operations.md) | Liaison, migrations et snapshot |
| [E-mails transactionnels](docs/transactional-email.md) | Profils SMTP Resend et Brevo |
| [Déploiement](docs/deployment.md) | Prévol, smoke tests et rollback |
| [ADR-0002](docs/adr/0002-internal-official-banking-register.md) | Registre bancaire officiel interne |

## État actuel

Les conversions d’affichage utilisent l’API gratuite sans clé
[Frankfurter v2](https://frankfurter.dev/), appelée côté serveur et mise en
cache pendant une heure. Ses taux de référence quotidiens sont indicatifs ;
un jeu de taux statiques daté et explicitement signalé prend le relais en cas
d’indisponibilité. Les soldes, opérations et documents restent enregistrés
dans leur devise d’origine : aucun taux d’affichage ne réécrit le registre.

Les soldes, IBAN et documents sont officiels au sens où ils sont déclarés ou
émis par le personnel habilité de l’établissement et audités dans Monalyz ;
ils ne proviennent d’aucune synchronisation bancaire.
