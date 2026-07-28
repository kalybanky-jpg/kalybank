# Modèle de données

> Le modèle persiste des intentions et des preuves, jamais un reflet bancaire en temps réel.

## Entités principales

| Entité | Finalité |
| --- | --- |
| `profiles` | Profil applicatif et état d’accès |
| `staff_members` | Habilitation staff explicite |
| `financial_positions` | Position déclarée ou rapprochée, datée |
| `transfer_intents` | Intention de transfert et réservation |
| `transfer_review_checks` | Contrôles atomiques par reviewer |
| `external_transfer_executions` | Référence, preuve et exécutant externe |
| `loan_applications` | Demande de prêt non contractuelle |
| `loan_review_checks` | Contrôles du prêt |
| `external_loan_fundings` | Preuve de financement externe |
| `kyc_applications` | Déclarations et pièces d’identité |
| `notifications`, `audit_events` | Information utilisateur et traçabilité |

## Invariants

- Les montants sont des `bigint` en unités mineures, avec devise ISO.
- `reserved_minor` ne peut pas être négatif ni dépasser `amount_minor`.
- Une intention ne modifie pas `amount_minor`.
- Les quatre contrôles exigent au moins deux reviewers distincts.
- L’auteur de la preuve externe ne peut pas confirmer son propre règlement.
- Seule la confirmation finale ajuste la position d’un transfert.
- Le financement d’un prêt ne crédite aucun faux compte KALY.
- Une approbation KYC ne crée ni compte, ni IBAN, ni position.

## États des transferts

```text
submitted
  -> under_review
  -> approved_for_external_execution
  -> external_execution_recorded
  -> external_settlement_confirmed
```

États terminaux alternatifs : `rejected`, `cancelled`, `external_failed`.
Le prêt suit le même principe avec `approved_for_external_funding` et
`external_funding_recorded`.

## Migrations

La source de vérité est le dossier `supabase/migrations`, dont la migration
initiale est `20260728060744_kaly_secure_external_financial_workflows.sql`.
Toute évolution passe par une nouvelle migration, suivie d’un reset local,
du linter SQL, des advisors et des tests pgTAP.
