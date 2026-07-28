# API et RPC

> Surface serveur volontairement étroite : une route de fichiers et des RPC Supabase authentifiées.

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
| `branch_manager_approve_transfer` | Confirmer les contrôles hors application et valider |
| `branch_manager_finalize_transfer` | Confirmer le virement effectif et débiter la position |
| `branch_manager_reject_transfer` | Refuser et libérer la réservation |
| `submit_loan_application` | Créer une demande de prêt |
| `branch_manager_approve_loan` | Confirmer les contrôles hors application et valider |
| `branch_manager_disburse_loan` | Confirmer le décaissement et créditer une position courante |
| `branch_manager_reject_loan` | Refuser la demande |
| `submit_kyc_application` | Soumettre le dossier KYC |
| `review_kyc_application` | Décider le dossier KYC |
| `mark_notification_read` | Marquer une notification |
| `set_user_access_status` | Geler ou rétablir un accès |
| `record_financial_position` | Créer une position interne |
| `adjust_financial_position` | Rapprocher une position avec motif |
| `claim_transactional_emails` | Réclamer atomiquement des jobs (`service_role`) |
| `complete_transactional_email` | Terminer un claim avec son jeton (`service_role`) |

Les privilèges `anon` et les écritures directes métier sont révoqués. Les RPC
revalident toujours l’identité, le rôle, l’état courant et les préconditions.

## Codes HTTP de `/api/evidence`

| Code | Cause |
| --- | --- |
| `201` | Preuve stockée |
| `400` | Paramètres ou opération Storage invalides |
| `401` | Session absente |
| `403` | Origine absente ou étrangère |
| `413` | Fichier vide ou supérieur à 10 Mo |
| `415` | Signature ou MIME refusé |
