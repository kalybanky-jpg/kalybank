# Tests et portes qualité

> Les tests couvrent à la fois les utilitaires TypeScript et les invariants transactionnels PostgreSQL.

## Commandes

| Couche | Commande | Portée |
| --- | --- | --- |
| TypeScript | `npx bun run typecheck` | Typage strict |
| Lint | `npx bun run lint -- --max-warnings=0` | Next, hooks, accessibilité |
| Tests unitaires | `npx bun run test` | Domaine, redirections et e-mails |
| E-mails métier | `npx bun x tsx --test tests/transactional-email.test.ts` | Config, modèles, payloads et idempotence |
| Langues | `npx bun x tsx --test tests/language.test.ts` | BCP 47, priorité et repli |
| Registre bancaire | `npx bun x tsx --test tests/financial.test.ts tests/banking-i18n.test.ts` | Comptes, IBAN, soldes et traductions UI |
| PDF officiels | `npx bun x tsx --test tests/official-document-pdf.test.ts` | Rendu, empreinte et filigrane démo |
| Provisionnement démo | `npx bun x tsx --test tests/demo-provisioning.test.ts` | Cibles, secrets, refus de reprise et idempotence |
| Schéma | `npx bun x supabase db lint --local --level warning --fail-on error` | Erreurs SQL |
| Conseillers | `npx bun x supabase db advisors --local --type all --level warn --fail-on error` | Sécurité et performance |
| pgTAP | `npx bun run test:db` | 137 invariants financiers, documentaires, linguistiques et démo |
| Snapshot | `npx bun run db:snapshot` puis `npx bun run test` | Copie SQL et manifeste |
| Dépendances | `npx bun audit` | Vulnérabilités connues |
| Production | `npx bun run build` | Compilation et pré-rendu |

## Arborescence

```text
tests/
  database-snapshot.test.ts
  email-config.test.ts
  financial.test.ts
  banking-i18n.test.ts
  navigation.test.ts
  official-document-pdf.test.ts
  transactional-email.test.ts
supabase/tests/
  monalyz_workflow_invariants_test.sql
```

## Avant fusion

1. Appliquer les migrations avec `npx bun x supabase migration up --local`.
2. Régénérer le snapshot avec `npx bun run db:snapshot`.
3. Exécuter toutes les commandes du tableau.
4. Vérifier `/login`, la redirection de `/myaccount` et celle de `/admin`.
5. Vérifier que chaque script de la réponse HTML porte le nonce du CSP.
6. Confirmer que `/api/evidence` retourne `401` sans session et `403` pour une origine étrangère.
7. Vérifier avec un compte de test que l’outbox passe de `pending` à `sent` et
   que le fournisseur ne reçoit qu’un message par `event_key`.
8. Ouvrir directement les routes publiques avec `fr-CA`, `en-GB`, `de-DE`,
   `es-MX` et une langue non prise en charge ; contrôler le contenu et
   `<html lang>`.
9. Vérifier les 40 couples modèle/langue ainsi que le scénario où la langue du
   profil change entre la création du job et son dispatch.
10. Prévalider le provisionnement avec
    `npm run demo:provision -- --target=local --dry-run` ; cette commande ne
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

Le patch `patches/minimatch@3.1.5.patch` adapte l’ancien consommateur CommonJS
à `brace-expansion` 5.0.8 corrigé. Ne le supprimer qu’après disparition de
`minimatch` 3 dans la chaîne ESLint.
