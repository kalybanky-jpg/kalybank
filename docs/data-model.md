# Modèle de données

> Le modèle constitue le registre bancaire interne déclaré de Monalyz. Il ne
> s’agit ni d’un reflet bancaire temps réel ni d’une synchronisation avec un
> système externe.

## Entités principales

| Entité | Finalité |
| --- | --- |
| `profiles` | Profil applicatif et état d’accès |
| `staff_members` | Habilitation staff explicite |
| `financial_positions` | Compte bancaire déclaré et solde agrégé courant |
| `financial_ledger_entries` | Grand livre append-only des mouvements de solde |
| `transfer_intents` | Intention de transfert et réservation |
| `transfer_review_checks` | Trace des contrôles confirmés par le chef d’agence |
| `external_transfer_executions` | Données historiques de confirmation hors Monalyz |
| `loan_applications` | Demande de prêt non contractuelle |
| `loan_review_checks` | Trace des contrôles confirmés par le chef d’agence |
| `external_loan_fundings` | Données historiques de décaissement hors Monalyz |
| `kyc_applications` | Déclarations et pièces d’identité |
| `kyc_drafts` | Brouillon KYC courant, repris entre appareils |
| `kyc_review_checklists` | Checklist humaine structurée du dossier KYC |
| `official_documents` | Registre versionné des PDF émis par l’établissement |
| `notifications`, `audit_events` | Information utilisateur et traçabilité |
| `transactional_email_outbox` | E-mails métier idempotents et réessayables |

## Invariants

- Les montants sont des `bigint` en unités mineures, avec devise ISO.
- `profiles.base_currency` est la devise choisie à l’inscription. Elle est
  obligatoire, limitée à `EUR`, `USD`, `CAD`, `CHF` ou `GBP`, initialise le
  compte courant créé après le KYC et reste la devise de référence des produits
  financiers de l’utilisateur.
- `profiles.preferred_currency` est uniquement une préférence d’affichage.
  Elle est initialisée avec `base_currency`, peut être modifiée par
  l’utilisateur et ne réécrit jamais les comptes, le grand livre, les prêts,
  les virements ou les documents déjà enregistrés.
- `profiles.preferred_language` vaut exclusivement `fr`, `en`, `de` ou `es`,
  est obligatoire et utilise `fr` par défaut.
- `reserved_minor` ne peut pas être négatif ni dépasser `amount_minor`.
- Une intention ne modifie pas `amount_minor`.
- Seul un staff actif ayant le rôle applicatif de chef d’agence (`admin`) peut
  déclarer un compte, ajuster un solde, émettre un document, valider, refuser
  ou finaliser un virement ou un prêt.
- Les contrôles et exécutions sont réalisés par le personnel de
  l’établissement dans ses procédures internes, hors Monalyz ; le chef
  d’agence en confirme le résultat dans l’application.
- Seule la confirmation du virement effectif débite la position interne.
- Seule la confirmation du décaissement crédite une position `current`
  appartenant au demandeur, dans la même devise que le prêt.
- Toute création ou variation effective de solde est atomique avec une écriture
  correspondante du grand livre.
- Aucun flux métier ne contacte une API bancaire ni ne déplace automatiquement
  des fonds.
- Un événement métier ne produit qu’une entrée d’outbox grâce à une clé unique.
- Une approbation KYC crée atomiquement un compte courant actif à solde nul,
  dans `profiles.base_currency`, identifié par son numéro interne et relié au
  dossier par `source_kyc_id`.

## Devise de référence et devise d’affichage

La devise d’une ligne métier reste attachée à cette ligne et constitue la
source de vérité. Le tableau de bord convertit chaque montant séparément vers
`preferred_currency` avant tout total ; il n’additionne jamais des montants
natifs de devises différentes. Les formulaires financiers, les écritures et
les documents officiels continuent d’utiliser la devise source.

À l’inscription, le navigateur transmet la devise dans les métadonnées Auth.
Le trigger `private.handle_new_user` normalise une allowlist fermée et initialise
les deux colonnes. Une inscription sans devise ou avec une valeur hors liste est
refusée côté base ; le défaut `EUR` sert uniquement au backfill des profils
historiques et aux opérations de maintenance directes sur `profiles`.

## Comptes déclarés dans `financial_positions`

Une position reste l’agrégat du solde courant, mais porte aussi le registre du
compte : `account_number`, `iban`, `bic`, `account_holder_name`,
`institution_name`, `branch_name`, `branch_code`, `account_status`,
`opened_at`, `declared_by`, `is_demo` et
`declaration_idempotency_key`.

- `account_type` vaut `current` ou `savings`.
- `account_status` vaut `pending`, `active`, `restricted` ou `closed`.
- Un compte `active` possède son numéro interne, son titulaire, sa date
  d’ouverture et son déclarant. L’IBAN, le BIC et l’agence sont facultatifs :
  ils restent gérés dans les outils internes de la banque.
- L’IBAN reste normalisé, validé modulo 97 et unique dans le registre administratif.
- Pour chaque nouveau compte, le numéro est généré automatiquement sur 10 chiffres
  à partir du préfixe global de 5 à 9 chiffres configuré par l’administrateur.
  L’index unique empêche toute attribution en double.
- Une clé d’idempotence ne peut déclarer qu’un seul compte.
- Le propriétaire et le chef d’agence actif peuvent lire le compte ; les
  écritures directes restent révoquées.

Le champ historique `external_identifier_masked` demeure une projection
masquée de compatibilité. Lorsqu’un IBAN est déclaré manuellement, sa source
canonique est `iban`.
Un IBAN de fixture n’est autorisé que sur un compte marqué `is_demo = true`.
Les nouveaux snapshots documentaires destinés au client contiennent le numéro de
compte, mais pas l’IBAN. Les documents déjà émis restent immuables.

## Grand livre `financial_ledger_entries`

Chaque écriture possède un `sequence_no` unique par compte, une clé métier
unique, un montant signé, les soldes avant/après, une date de valeur, une
référence interne, son auteur et, selon le cas, le virement ou prêt source.
`balance_after_minor` doit toujours être égal à
`balance_before_minor + amount_minor`.

Les types autorisés sont :

- `migration_opening_balance` et `account_opening` pour l’origine du solde ;
- `manual_adjustment` pour une correction motivée ;
- `transfer_debit` seulement après confirmation interne du règlement ;
- `loan_credit` seulement après confirmation interne du décaissement.

Le grand livre est append-only : `UPDATE` et `DELETE` sont interdits hors
maintenance de migration contrôlée. Les index uniques empêchent qu’un même
virement ou prêt produise deux mouvements. Le client et le chef d’agence
peuvent lire les écritures autorisées par RLS, jamais les créer directement.

## États des transferts

Pour les nouveaux dossiers, les quatre lignes de `transfer_review_checks` sont
validées séquentiellement par le chef d’agence. Les trois premières laissent le
virement en `under_review`; la quatrième déclenche directement le règlement
atomique et fait passer le virement à `external_settlement_confirmed`.

```text
submitted
  -> under_review (1 à 3 contrôles terminés)
  -> external_settlement_confirmed (autorisation finale)
```

États terminaux alternatifs : `rejected`, `cancelled`, `external_failed`.
Les états `under_review` et `external_execution_recorded` restent reconnus pour
la compatibilité des dossiers existants. Le vocabulaire `external_*` signifie
dans ce schéma historique « hors Monalyz » ; l’exécution MVP reste interne à
l’établissement et n’utilise aucune API bancaire.

## États des prêts

```text
submitted
  -> approved_for_external_funding
  -> external_settlement_confirmed
```

À la dernière transition, `credited_position_id`, `disbursed_by` et
`disbursed_at` sont enregistrés et la position courante est créditée
atomiquement. Les états intermédiaires historiques restent acceptés pour les
dossiers déjà engagés.

## Documents officiels

`official_documents` référence exactement une source métier cohérente selon
son type : un compte pour `bank_details`, `account_statement` et
`balance_certificate`, un virement et son compte pour
`transfer_confirmation`, ou un prêt pour `loan_decision` et
`loan_disbursement_confirmation`.

La ligne conserve le numéro unique, la langue `fr|en|de|es`, la version, le
snapshot JSON et son SHA-256, le chemin Storage, l’empreinte du PDF, l’émetteur,
les dates et la révocation éventuelle. Les statuts sont `pending`, `issued`,
`failed` et `revoked`. Un document émis est immuable ; sa révocation est
motivée et auditée.

Le bucket `official-documents` est privé, limité aux PDF de 10 Mo. Sa politique
autorise la lecture au propriétaire du dossier et au chef d’agence actif.
Le téléchargement passe par la route serveur et ne transforme jamais le
bucket en ressource publique. Un document de démonstration porte
`is_demo = true` et un filigrane non ambigu dans le PDF.

## Outbox transactionnelle

`transactional_email_outbox` est privée : aucun accès direct n’est accordé aux
clients authentifiés. Sa clé `event_key` est unique par entité et statut. Un
job passe de `pending` à `sending`, puis `sent` ou de nouveau `pending`. Après
cinq tentatives il devient `failed`. Un claim abandonné redevient disponible
après dix minutes. Chaque claim reçoit un `claim_token` aléatoire qui doit être
présenté pour terminer le job ; les deux RPC de traitement sont réservées au
rôle Supabase `service_role`. Le job référence le profil par `recipient_id` :
le worker relit `preferred_language` après le claim et juste avant l’envoi.

## Migrations

La source de vérité est le dossier `supabase/migrations`, dont la migration
initiale est `20260728060744_kaly_secure_external_financial_workflows.sql`.
Toute évolution passe par une nouvelle migration, suivie d’un reset local,
du linter SQL, des advisors, des tests pgTAP et de la régénération de
`supabase/schema.sql`.
