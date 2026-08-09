# Tests et portes qualité

> Les tests couvrent à la fois les utilitaires TypeScript et les invariants transactionnels PostgreSQL.

## Commandes

| Couche | Commande | Portée |
| --- | --- | --- |
| TypeScript | `bun run typecheck` | Typage strict |
| Lint | `bun run lint -- --max-warnings=0` | Next, hooks, accessibilité |
| Tests unitaires | `bun run test` | Tous les fichiers `tests/**/*.test.ts` et `tests/**/*.test.tsx` |
| E-mails métier | `bun x tsx --test tests/transactional-email.test.ts` | Config, modèles, payloads et idempotence |
| Worker e-mail | `bun x tsx --test tests/transactional-email-dispatch.test.ts` | Planification Netlify, lot, concurrence, timeout et finalisation |
| Upload direct | `bun x tsx --test tests/staged-upload.test.ts tests/upload-preparation.test.ts` | Intents, chemins propriétaires, signatures et compression locale |
| Health check | `bun x tsx --test tests/health-contract.test.ts` | Réponse indisponible sans fuite de configuration |
| Langues | `bun x tsx --test tests/language.test.ts` | BCP 47, priorité et repli |
| Registre bancaire | `bun x tsx --test tests/financial.test.ts tests/banking-i18n.test.ts` | Numéros de compte, soldes et traductions UI |
| PDF officiels | `bun x tsx --test tests/official-document-pdf.test.ts` | Rendu, empreinte et filigrane démo |
| Provisionnement démo | `bun x tsx --test tests/demo-provisioning.test.ts` | Cibles, secrets, refus de reprise et idempotence |
| Schéma | `bun x supabase db lint --local --level warning --fail-on error` | Erreurs SQL |
| Conseillers | `bun x supabase db advisors --local --type all --level warn --fail-on error` | Sécurité et performance |
| pgTAP | `bun run test:db` | Les 5 suites SQL du dossier, soit 301 assertions planifiées (203 + 14 + 9 + 47 + 28) |
| Snapshot | `bun run db:snapshot` puis `bun run test` | Copie SQL et manifeste |
| Types Supabase | `bun run db:types` | Régénération des contrats TypeScript depuis la base locale |
| Dépendances | `bun audit` | Vulnérabilités connues |
| Production | `bun run build:netlify` | Compilation, pré-rendu et présence des binaires natifs Linux dans l’artefact |

Bun 1.3.14 est le gestionnaire canonique déclaré dans `package.json`. Une
installation reproductible se vérifie avec `bun install --frozen-lockfile` ;
aucun lockfile npm ne doit être généré ou versionné.

La CI régénère les types Supabase après le reset local et les compare à
`lib/supabase/database.types.ts`. Une différence bloque la fusion afin que les
migrations et les contrats TypeScript restent synchronisés.

## Parcours sans Docker local

Le lint, le typecheck, les tests TypeScript/TSX, l’audit des dépendances et le
build n’exigent pas Docker. Les commandes Supabase `--local` en ont besoin pour
démarrer la pile locale ; elles doivent rester désactivées sur une machine qui
ne le supporte pas.

Dans ce cas, la branche ou la pull request doit obligatoirement laisser le job
base de données de [la CI](../.github/workflows/ci.yml) exécuter le reset, pgTAP,
le linter, les advisors, la comparaison des types et la régénération du
snapshot dans son runner isolé. Le SQL généré est conservé trois jours comme
artefact `database-schema-snapshot-<run_attempt>`, puis comparé au
`supabase/schema.sql` commité. Le dry-run distant
`bun run db:deploy:check` ne remplace pas pgTAP, mais peut compléter cette porte
après le succès de la CI. Ne jamais sauter le job base de données au motif que
Docker local est indisponible.

Après une nouvelle migration, un premier run peut échouer uniquement sur la
comparaison du snapshot tout en publiant l’artefact. Télécharger ce SQL, vérifier
qu’il ne contient aucune donnée, remplacer `supabase/schema.sql`, committer la
copie revue puis relancer la CI. Cette boucle est l’alternative documentée à la
régénération locale.

## Arborescence

```text
tests/
  database-snapshot.test.ts
  email-config.test.ts
  health-contract.test.ts
  financial.test.ts
  banking-i18n.test.ts
  brand-logo.test.tsx
  navigation.test.ts
  official-document-pdf.test.ts
  staged-upload.test.ts
  transactional-email-dispatch.test.ts
  transactional-email.test.ts
  upload-preparation.test.ts
supabase/tests/
  kyc_workflow_test.sql
  monalyz_workflow_invariants_test.sql
  security_hardening_test.sql
  transactional_email_claims_test.sql
```

## Avant fusion

1. Exécuter lint, typecheck, tests TypeScript/TSX, audit et build.
2. Après toute migration, régénérer le snapshot localement si autorisé ou
   récupérer l’artefact CI, puis vérifier son manifeste avant de le committer.
3. Si Docker local est explicitement disponible, appliquer les migrations et
   exécuter les portes Supabase locales ; sinon attendre le job base de données
   de la CI avant toute fusion ou migration distante.
4. Vérifier `/login`, la redirection de `/myaccount` et celle de `/admin`.
5. Vérifier que chaque script de la réponse HTML porte le nonce du CSP.
6. Confirmer que `/api/evidence` retourne `401` sans session et `403` pour une origine étrangère.
7. Vérifier avec un compte de test que l’outbox passe de `pending` à `sent` et
   que le fournisseur ne reçoit qu’un message par `event_key`.
8. Ouvrir directement les routes publiques avec `fr-CA`, `en-GB`, `de-DE`,
   `es-MX` et une langue non prise en charge ; contrôler le contenu et
   `<html lang>`.
9. Vérifier les 60 couples modèle/langue ainsi que le scénario où la langue du
   profil change entre la création du job et son dispatch.
10. Prévalider le provisionnement avec
    `bun run demo:provision -- --target=local --dry-run` ; cette commande ne
    contacte pas Supabase.
11. Vérifier qu’une déclaration de compte crée une seule écriture d’ouverture,
    normalise l’IBAN et refuse les doublons.
12. Vérifier qu’approbations de virement et de prêt ne modifient aucun solde ;
    les mouvements de grand livre apparaissent uniquement lors des
    confirmations internes et dans la même transaction que le nouveau solde.
13. Tenter `UPDATE` et `DELETE` sur `financial_ledger_entries` et confirmer
    leur refus, puis vérifier la RLS propriétaire sur comptes et écritures.
14. Émettre chaque type de document autorisé, comparer les empreintes du
    snapshot et du PDF, puis vérifier téléchargement propriétaire, refus tiers,
    révocation et immutabilité.
15. Provisionner les fixtures démo dans un environnement jetable et contrôler
    l’IBAN synthétique, `is_demo`, l’écriture d’ouverture et le filigrane des
    PDF.
16. Inspecter les requêtes réseau des flux financiers : aucun appel vers une
    API bancaire, un agrégateur ou un moteur de paiement n’est autorisé.
17. Vérifier qu’un gros fichier utilise `/api/upload-intents`, que le corps de
    `/api/evidence` reste JSON et que le PDF officiel est servi par redirection
    `307` vers Storage.
18. Sur Deploy Preview, tester manuellement le worker e-mail avec **Run now** ;
    après publication, confirmer sa cadence et les alertes selon le
    [runbook Netlify](runbooks/netlify-production-release.md).

Le patch `patches/minimatch@3.1.5.patch` adapte l’ancien consommateur CommonJS
à `brace-expansion` 5.0.8 corrigé. Ne le supprimer qu’après disparition de
`minimatch` 3 dans la chaîne ESLint.
