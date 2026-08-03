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

Les commandes `--local` démarrent la pile Supabase locale et exigent Docker.
Lorsque Docker local est désactivé ou instable, ne pas le lancer : exécuter les
portes applicatives sans Docker, pousser la branche et attendre le job base de
données de [la CI](../.github/workflows/ci.yml). Ce job doit valider migrations,
pgTAP, linter, advisors, snapshot et types avant tout `db:deploy`. Le dry-run
lié `npx bun run db:deploy:check` complète cette validation sans la remplacer.
Le runner GitHub régénère `supabase/schema.sql`, le publie comme artefact
éphémère pendant trois jours puis exige l’absence de différence avec la copie
commitée. Si cette comparaison est la seule porte rouge, télécharger
l’artefact, vérifier qu’il reste structurel et sans donnée, remplacer le
snapshot commité puis relancer toute la CI.

Le snapshot contient uniquement les schémas applicatifs `public` et `private`.
Les buckets et politiques Storage restent définis dans les migrations, car le
schéma `storage` est géré par Supabase.

## Durcissement et staging d’upload

La migration versionnée
`20260803112108_harden_function_privileges_and_upload_staging.sql` :

- crée le bucket privé `upload-staging` avec une limite de 10 Mio et une liste
  fermée de MIME PDF/JPEG/PNG/WebP/SVG ;
- supprime les anciennes policies `INSERT`/`UPDATE` navigateur sur les buckets
  de preuves finaux afin que toute écriture passe par la finalisation validée ;
- révoque `EXECUTE` sur toutes les fonctions applicatives `public` et `private`
  pour `PUBLIC`, `anon` et `authenticated` ;
- conserve l’accès complet de `service_role` ;
- réaccorde à `authenticated` uniquement le helper RLS privé et les RPC
  applicatives explicitement listées ;
- ferme aussi les privilèges par défaut des futures fonctions créées par
  `postgres`.

Cette migration appartient à la source de vérité Git. Sa présence ne prouve
pas son application au projet distant : comparer la liste distante, exécuter
le dry-run, obtenir une CI verte puis faire appliquer la migration par un seul
opérateur.

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

Les deux comptes de démonstration réutilisables font exception au seed : ils
sont matérialisés explicitement dans l’environnement ciblé par la procédure
[Comptes de démonstration](demo-accounts.md). Seuls le script, la RPC et leurs
UUID déterministes sont versionnés ; les identités Auth et les lignes produites
ne sont jamais exportées dans `supabase/schema.sql`.

## Déploiement et vérification

Après chaque déploiement :

1. comparer `supabase migration list` au dossier local ;
2. confirmer que `upload-staging` est privé, limité à 10 Mio et restreint
   aux cinq MIME attendus ;
3. compter les tables, politiques RLS et autres buckets attendus ;
4. exécuter les advisors sécurité et performance ;
5. confirmer que `anon` ne peut exécuter aucune fonction applicative et que
   `authenticated` ne conserve que les RPC prévues ;
6. vérifier que `service_role` peut toujours appeler les RPC de worker, PDF et
   provisionnement ;
7. archiver le résultat de la porte qualité avec la version applicative.

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

Les sauvegardes, quotas et conditions de restauration de production sont des
contrôles humains du
[runbook Netlify](runbooks/netlify-production-release.md).
