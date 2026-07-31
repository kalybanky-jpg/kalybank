# API et RPC

> Surface serveur volontairement étroite : routes de fichiers/PDF et RPC
> Supabase authentifiées. Aucune route n’appelle une API bancaire.

## Route HTTP

### `POST /api/evidence`

Reçoit un `multipart/form-data` contenant :

- `bucket` : `kyc-evidence`, `loan-evidence` ou `external-execution-evidence` ;
- `kind` : identifiant ASCII `[a-z0-9_-]`, 64 caractères maximum ;
- `file` : PDF, PNG ou JPEG de 1 octet à 10 Mo.

La route exige une session, une origine canonique identique et une concordance
entre MIME déclaré et signature binaire. Réponse réussie :

```json
{ "path": "<user-id>/<kind>/<uuid>.<extension>" }
```

### `DELETE /api/evidence`

Supprime jusqu’à dix chemins préfixés par l’UUID du téléverseur, après contrôle
de session, d’origine et de RLS. Cette route sert au nettoyage compensatoire
lorsqu’une RPC métier échoue.

`external-execution-evidence` est un nom historique qui signifie « preuve
d’une exécution effectuée hors Monalyz ». Dans le MVP actuel, cette exécution
est réalisée dans les procédures internes de l’établissement, sans API ni
banque tierce connectée.

### `POST /api/official-documents`

Émet un document à la demande du chef d’agence. Le JSON contient :

```json
{
  "ownerId": "<uuid>",
  "accountId": "<uuid|null>",
  "transferId": "<uuid|null>",
  "loanId": "<uuid|null>",
  "documentType": "account_statement",
  "title": "Relevé de compte",
  "periodStart": "2026-07-01",
  "periodEnd": "2026-07-31"
}
```

`documentType` accepte `bank_details`, `account_statement`,
`balance_certificate`, `transfer_confirmation`,
`loan_disbursement_confirmation` ou `loan_decision`. La route exige une
session, une origine canonique et le rôle actif `admin`. Elle relit la langue
du propriétaire, fige le snapshot par RPC, rend le PDF côté serveur, calcule
son SHA-256, l’enregistre dans le bucket privé `official-documents` et termine
le job avec un client `service_role`. Réponse réussie :

```json
{
  "id": "<uuid>",
  "documentNumber": "<numéro-unique>",
  "status": "issued"
}
```

### `GET /api/official-documents/:documentId`

Télécharge un PDF `issued` après authentification et application de la RLS sur
`official_documents` et Storage. La réponse est privée, non mise en cache,
forcée en téléchargement et protégée par `nosniff`. Un document non finalisé
retourne `409`; une ligne ou un objet inaccessible retourne `404`.

### `GET /auth/callback`

Échange un code PKCE Supabase contre une session, puis accepte uniquement un
chemin interne normalisé. `APP_ORIGIN` est obligatoire en production.

### `GET /auth/confirm`

Échange un `token_hash` e-mail contre une session SSR pour l’inscription ou la
récupération. Les types OTP sont limités à une liste fermée, les réponses ne
sont pas mises en cache et les redirections externes sont refusées.

### `POST /api/transactional-email/dispatch`

Déclenche l’envoi d’un lot de dix e-mails métier au maximum. La route exige :

- une session Supabase valide ;
- une origine identique à `APP_ORIGIN` ou `NEXT_PUBLIC_APP_ORIGIN` ;
- une configuration serveur complète pour Resend ou Brevo ;
- `SUPABASE_SECRET_KEY`, ou `SUPABASE_SERVICE_ROLE_KEY` pour compatibilité,
  exclusivement côté serveur.

Elle ne reçoit aucun destinataire ni contenu depuis le navigateur. Les jobs
sont réclamés dans l’outbox par RPC, rendus depuis une liste fermée de modèles,
puis marqués comme envoyés ou remis en attente. Réponse réussie :

```json
{ "claimed": 2, "sent": 2, "failed": 0 }
```

Les réponses portent `Cache-Control: no-store, private`. La session autorise
le déclenchement HTTP, mais seule la route serveur peut réclamer la file
globale : les RPC `claim` et `complete` refusent les JWT autres que
`service_role`. Chaque complétion doit en plus présenter le `claim_token`
opaque renvoyé lors de la réclamation.

## RPC publiques authentifiées

| RPC | Responsabilité |
| --- | --- |
| `current_app_role` | Retourner le rôle courant |
| `submit_transfer_intent` | Créer et réserver une intention |
| `branch_manager_review_transfer_check` | Valider un contrôle séquentiel ; le quatrième débite et clôture atomiquement |
| `branch_manager_reject_transfer` | Refuser et libérer la réservation |
| `submit_loan_application` | Créer une demande de prêt |
| `branch_manager_approve_loan` | Confirmer les contrôles hors application et valider |
| `branch_manager_disburse_loan` | Confirmer le décaissement et créditer une position courante |
| `branch_manager_reject_loan` | Refuser la demande |
| `submit_kyc_application` | Soumettre le dossier KYC |
| `save_kyc_draft` | Enregistrer le brouillon KYC courant |
| `begin_kyc_review` | Passer explicitement le dossier en vérification |
| `update_kyc_review_checklist` | Enregistrer la checklist administrative |
| `request_kyc_information` | Demander un complément ciblé |
| `resubmit_kyc_application` | Corriger et resoumettre le même dossier |
| `decide_kyc_application` | Approuver avec création atomique du compte interne, ou rejeter |
| `mark_notification_read` | Marquer une notification |
| `set_user_access_status` | Geler ou rétablir un accès |
| `get_account_number_configuration` | Lire le préfixe global et sa capacité (admin) |
| `set_account_number_prefix` | Configurer le préfixe global de 5 à 9 chiffres (admin) |
| `branch_manager_declare_account` | Déclarer un compte avec numéro automatique et écriture d’ouverture |
| `branch_manager_adjust_balance` | Porter un compte vers un solde cible avec une écriture motivée |
| `branch_manager_issue_official_document` | Figer le snapshot d’un document à rendre |
| `branch_manager_revoke_official_document` | Révoquer un document émis sans supprimer son historique |
| `complete_official_document` | Finaliser ou échouer le PDF (`service_role`) |
| `claim_transactional_emails` | Réclamer atomiquement des jobs (`service_role`) |
| `complete_transactional_email` | Terminer un claim avec son jeton (`service_role`) |

Les privilèges `anon` et les écritures directes métier sont révoqués. Les RPC
revalident toujours l’identité, le rôle, l’état courant et les préconditions.
Les anciennes RPC `record_financial_position` et `adjust_financial_position`
restent présentes pour compatibilité de migration, mais les nouveaux parcours
de compte utilisent les RPC `branch_manager_*` et le grand livre.

## Signatures du registre bancaire

```sql
branch_manager_declare_account(
  p_owner_id uuid,
  p_label text,
  p_account_type text,
  p_currency text,
  p_iban text,
  p_bic text,
  p_account_holder_name text,
  p_institution_name text,
  p_branch_name text,
  p_branch_code text,
  p_opening_balance_minor bigint,
  p_opened_at timestamptz,
  p_is_demo boolean,
  p_reason text,
  p_idempotency_key uuid
) returns financial_positions

branch_manager_adjust_balance(
  p_account_id uuid,
  p_target_amount_minor bigint,
  p_value_date timestamptz,
  p_reason text,
  p_idempotency_key uuid
) returns financial_positions
```

La déclaration et l’ajustement sont idempotents. Seul le chef d’agence actif
peut les appeler. L’ajustement reçoit un solde cible, calcule le delta sous
verrou et ajoute l’écriture de grand livre dans la même transaction.

```sql
branch_manager_issue_official_document(
  p_owner_id uuid,
  p_account_id uuid,
  p_transfer_id uuid,
  p_loan_id uuid,
  p_document_type text,
  p_title text,
  p_language text,
  p_period_start date,
  p_period_end date,
  p_idempotency_key uuid
) returns official_documents

complete_official_document(
  p_document_id uuid,
  p_storage_path text,
  p_content_hash text,
  p_succeeded boolean,
  p_error text
) returns official_documents

branch_manager_revoke_official_document(
  p_document_id uuid,
  p_reason text
) returns official_documents
```

L’émission et la révocation exigent le chef d’agence. La complétion est
réservée au `service_role` de la route serveur ; aucune clé privilégiée
n’atteint le navigateur.

Les RPC financières existantes conservent leurs signatures exactes :

```sql
branch_manager_finalize_transfer(
  p_transfer_id uuid,
  p_note text
) returns transfer_intents

branch_manager_disburse_loan(
  p_loan_id uuid,
  p_destination_position_id uuid,
  p_note text
) returns loan_applications
```

Ces deux fonctions n’enregistrent un mouvement de grand livre qu’après la
confirmation par le chef d’agence de l’exécution déjà réalisée par le personnel
de l’établissement. Une approbation seule ne modifie jamais le solde.

## Codes HTTP de `/api/evidence`

| Code | Cause |
| --- | --- |
| `201` | Preuve stockée |
| `400` | Paramètres ou opération Storage invalides |
| `401` | Session absente |
| `403` | Origine absente ou étrangère |
| `413` | Fichier vide ou supérieur à 10 Mo |
| `415` | Signature ou MIME refusé |
