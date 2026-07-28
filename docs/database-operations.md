# Exploitation de la base Supabase

> Le projet distant canonique est `qljqldhvbakornnpalua`. Le dépôt conserve
> toujours le schéma reproductible, jamais les données réelles.

| Élément | Valeur |
| --- | --- |
| Project ref | `qljqldhvbakornnpalua` |
| API URL | `https://qljqldhvbakornnpalua.supabase.co` |
| Source de vérité | `supabase/migrations/*.sql` |
| Snapshot structurel | `supabase/schema.sql` |
| Données de production dans Git | Interdites |

## Liaison d’un poste

```powershell
npx bun install
npx bun run supabase:link
Copy-Item .env.remote.example .env.local
```

La commande de liaison demande une session Supabase CLI autorisée et peut
demander le mot de passe PostgreSQL du projet. Le `project-ref` est fixé dans
`package.json` afin d’éviter toute sélection accidentelle d’un autre projet.

## Règle de modification

1. créer chaque évolution dans une migration horodatée ;
2. ne jamais modifier le schéma distant avec Table Editor ou SQL Editor ;
3. rejouer les migrations sur Supabase local ;
4. exécuter le linter, les advisors et les tests pgTAP ;
5. régénérer `supabase/schema.sql` ;
6. vérifier que les tests TypeScript acceptent le manifeste du snapshot ;
7. prévisualiser le déploiement distant ;
8. faire appliquer les migrations par un seul opérateur.

```powershell
npx bun x supabase migration new description_atomique
npx bun x supabase migration up --local
npx bun run test:db
npx bun run db:snapshot
npx bun run test
npx bun run db:deploy:check
npx bun run db:deploy
```

Le snapshot contient uniquement les schémas applicatifs `public` et `private`.
Les buckets et politiques Storage restent définis dans les migrations, car le
schéma `storage` est géré par Supabase.

## Protection contre la dérive

`db:snapshot` calcule un manifeste SHA-256 de toutes les migrations et
l’inscrit dans le snapshot. Le test `database-snapshot.test.ts` recalcule ce
manifeste : toute migration ajoutée ou modifiée sans régénération du snapshot
fait échouer la suite de tests.

Le snapshot n’est pas une sauvegarde de continuité d’activité. Les sauvegardes
opérationnelles restent celles de Supabase. Il sert à reconstruire et auditer
la structure depuis Git.

## Données interdites dans le dépôt

Ne jamais exporter ou committer :

- `auth.users`, sessions, identités ou mots de passe ;
- profils, KYC, justificatifs ou pièces d’identité ;
- intentions, preuves ou références financières ;
- secrets, clés privées, tokens ou mots de passe de base ;
- dump `--data-only` d’un environnement distant.

Les jeux de test éventuels doivent être synthétiques, minimaux et écrits
manuellement dans `supabase/seed.sql`.

## Déploiement et vérification

Après chaque déploiement :

1. comparer `supabase migration list` au dossier local ;
2. compter les tables, politiques RLS et buckets attendus ;
3. exécuter les advisors sécurité et performance ;
4. vérifier que les RPC publiques ne sont accordées qu’aux rôles prévus ;
5. archiver le résultat de la porte qualité avec la version applicative.

Les RPC du schéma `public` signalées par l’advisor
`authenticated_security_definer_function_executable` constituent une
exception intentionnelle : elles sont l’API transactionnelle des utilisateurs
authentifiés, fixent un `search_path` vide et contrôlent explicitement
`auth.uid()` ainsi que le rôle applicatif avant toute opération privilégiée.
Le rôle `anon` ne doit jamais recevoir `EXECUTE`. Toute nouvelle RPC doit être
revue individuellement avant d’être ajoutée à cette exception.

Les alertes `unused_index` sont normales tant que la base distante reste vide.
Elles ne justifient pas la suppression des index de clés étrangères avant
l’observation d’une charge représentative.

Une migration déjà déployée est immuable. Tout retour arrière se fait par une
nouvelle migration compensatoire revue, jamais en réécrivant l’historique.
