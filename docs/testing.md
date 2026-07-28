# Tests et portes qualité

> Les tests couvrent à la fois les utilitaires TypeScript et les invariants transactionnels PostgreSQL.

## Commandes

| Couche | Commande | Portée |
| --- | --- | --- |
| TypeScript | `npx bun run typecheck` | Typage strict |
| Lint | `npx bun run lint -- --max-warnings=0` | Next, hooks, accessibilité |
| Tests unitaires | `npx bun run test` | Montants, états, masquage, redirections |
| Schéma | `npx bun x supabase db lint --local --level warning --fail-on error` | Erreurs SQL |
| Conseillers | `npx bun x supabase db advisors --local --type all --level warn --fail-on error` | Sécurité et performance |
| pgTAP | `npx bun run test:db` | 19 invariants financiers |
| Snapshot | `npx bun run db:snapshot` puis `npx bun run test` | Copie SQL et manifeste |
| Dépendances | `npx bun audit` | Vulnérabilités connues |
| Production | `npx bun run build` | Compilation et pré-rendu |

## Arborescence

```text
tests/
  database-snapshot.test.ts
  email-config.test.ts
  financial.test.ts
  navigation.test.ts
supabase/tests/
  kaly_workflow_invariants_test.sql
```

## Avant fusion

1. Appliquer les migrations avec `npx bun x supabase migration up --local`.
2. Régénérer le snapshot avec `npx bun run db:snapshot`.
3. Exécuter toutes les commandes du tableau.
4. Vérifier `/login`, la redirection de `/myaccount` et celle de `/admin`.
5. Vérifier que chaque script de la réponse HTML porte le nonce du CSP.
6. Confirmer que `/api/evidence` retourne `401` sans session et `403` pour une origine étrangère.

Le patch `patches/minimatch@3.1.5.patch` adapte l’ancien consommateur CommonJS
à `brace-expansion` 5.0.8 corrigé. Ne le supprimer qu’après disparition de
`minimatch` 3 dans la chaîne ESLint.
