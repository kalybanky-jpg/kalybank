# Modèle de données

> Le modèle persiste des intentions et des preuves, jamais un reflet bancaire en temps réel.

## Entités principales

| Entité | Finalité |
| --- | --- |
| `profiles` | Profil applicatif et état d’accès |
| `staff_members` | Habilitation staff explicite |
| `financial_positions` | Position déclarée ou rapprochée, datée |
| `transfer_intents` | Intention de transfert et réservation |
| `transfer_review_checks` | Trace des contrôles confirmés par le chef d’agence |
| `external_transfer_executions` | Données historiques d’exécution externe |
| `loan_applications` | Demande de prêt non contractuelle |
| `loan_review_checks` | Trace des contrôles confirmés par le chef d’agence |
| `external_loan_fundings` | Données historiques de financement externe |
| `kyc_applications` | Déclarations et pièces d’identité |
| `notifications`, `audit_events` | Information utilisateur et traçabilité |
| `transactional_email_outbox` | E-mails métier idempotents et réessayables |

## Invariants

- Les montants sont des `bigint` en unités mineures, avec devise ISO.
- `reserved_minor` ne peut pas être négatif ni dépasser `amount_minor`.
- Une intention ne modifie pas `amount_minor`.
- Seul un staff actif ayant le rôle applicatif de chef d’agence (`admin`) peut
  valider, refuser ou finaliser un virement ou un prêt.
- Les contrôles bancaires sont réalisés hors de l’application ; le chef
  d’agence confirme leur résultat dans Monalyz.
- Seule la confirmation du virement effectif débite la position interne.
- Seule la confirmation du décaissement crédite une position `current`
  appartenant au demandeur, dans la même devise que le prêt.
- Un événement métier ne produit qu’une entrée d’outbox grâce à une clé unique.
- Une approbation KYC ne crée ni compte, ni IBAN, ni position.

## États des transferts

```text
submitted
  -> approved_for_external_execution
  -> external_settlement_confirmed
```

États terminaux alternatifs : `rejected`, `cancelled`, `external_failed`.
Les états `under_review` et `external_execution_recorded` restent reconnus pour
la compatibilité des dossiers existants.

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

## Outbox transactionnelle

`transactional_email_outbox` est privée : aucun accès direct n’est accordé aux
clients authentifiés. Sa clé `event_key` est unique par entité et statut. Un
job passe de `pending` à `sending`, puis `sent` ou de nouveau `pending`. Après
cinq tentatives il devient `failed`. Un claim abandonné redevient disponible
après dix minutes. Chaque claim reçoit un `claim_token` aléatoire qui doit être
présenté pour terminer le job ; les deux RPC de traitement sont réservées au
rôle Supabase `service_role`.

## Migrations

La source de vérité est le dossier `supabase/migrations`, dont la migration
initiale est `20260728060744_kaly_secure_external_financial_workflows.sql`.
Toute évolution passe par une nouvelle migration, suivie d’un reset local,
du linter SQL, des advisors et des tests pgTAP.
