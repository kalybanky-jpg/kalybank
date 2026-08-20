# API et RPC

> Surface serveur volontairement étroite : routes de fichiers/PDF, health
> check minimal et RPC Supabase authentifiées. Aucune route n’appelle une API
> bancaire.

## Routes HTTP

### `GET|PUT /api/admin/credentials`

Permet à l’unique administrateur connecté de consulter son adresse de
connexion, puis de modifier son adresse e-mail ou son mot de passe depuis
**Administration > Paramètres**. La route vérifie la session avec Supabase,
recontrôle le rôle `admin`, refuse les mutations d’origine étrangère et exige
le mot de passe actuel avant tout appel privilégié.

Changement d’adresse :

```json
{
  "kind": "email",
  "email": "direction@example.com",
  "currentPassword": "<mot-de-passe-actuel>"
}
```

Changement de mot de passe :

```json
{
  "kind": "password",
  "currentPassword": "<mot-de-passe-actuel>",
  "newPassword": "<nouveau-mot-de-passe>",
  "confirmPassword": "<nouveau-mot-de-passe>"
}
```

Le nouveau mot de passe doit contenir 16 à 72 caractères, dont une
minuscule, une majuscule, un chiffre et un symbole, sans espace. Une mutation
réussie ferme toutes les sessions et impose une reconnexion. La réponse, les
journaux et l’audit ne contiennent jamais l’adresse ni les mots de passe ;
Supabase ne permet pas de relire un mot de passe existant en clair.

### `GET /api/exchange-rates`

Récupère côté serveur les taux quotidiens de l’API gratuite sans clé
[Frankfurter v2](https://frankfurter.dev/) avec `EUR` comme base. La réponse
est validée contre la liste complète des devises utilisées par Monalyz et mise
en cache pendant une heure. Elle expose la source, la date de chaque taux et le
booléen `fallback`.

Si Frankfurter est indisponible ou renvoie une réponse incomplète, la route
répond avec le jeu statique daté embarqué, `fallback: true` et une raison
explicite ; ce repli n’est pas mis en cache. Ces taux servent uniquement à
l’affichage indicatif. Ils ne sont jamais utilisés comme preuve d’un cours
exécutable ni pour réécrire les montants du registre.

### `POST /api/upload-intents`

Crée une capacité d’upload signée vers le bucket privé `upload-staging`. La
requête est un petit JSON ; aucun octet du fichier ne traverse la route.

Pour une preuve :

```json
{
  "purpose": "evidence",
  "mimeType": "application/pdf",
  "size": 7340032,
  "metadata": {
    "bucket": "loan-evidence",
    "kind": "income_statement"
  }
}
```

Pour un asset de marque, `purpose` vaut `branding` et `metadata.kind` vaut
`primaryLogo`, `reversedLogo` ou `favicon`. La route exige une session et une
origine canonique identique. Elle contrôle le rôle pour la marque et les preuves
d’exécution interne, puis lie le chemin temporaire à l’UUID de l’utilisateur,
au but et aux métadonnées attendues.

Réponse `201` :

```json
{
  "path": "<user-id>/evidence/loan-evidence/income_statement/<uuid>.pdf",
  "token": "<signed-upload-token>"
}
```

Le navigateur transmet ensuite le fichier directement à Supabase avec
`uploadToSignedUrl`. `DELETE /api/upload-intents` supprime en best effort de un
à dix chemins temporaires appartenant à la session lorsque la finalisation
échoue ou est abandonnée.

### `POST /api/evidence`

Finalise une preuve déjà envoyée directement dans `upload-staging`. Le corps
reste un petit JSON :

```json
{
  "bucket": "loan-evidence",
  "kind": "income_statement",
  "stagingPath": "<user-id>/evidence/loan-evidence/income_statement/<uuid>.pdf"
}
```

La route exige une session, une origine canonique identique et un chemin signé
appartenant à l’utilisateur. Elle déplace l’objet de Storage vers le bucket
final, relit sa taille, puis ne récupère qu’au plus ses 4 premiers Kio avec une requête
`Range` pour vérifier le PDF, PNG ou JPEG par signature binaire. Une erreur de
taille, de MIME ou de signature supprime la destination invalide. Réponse
réussie :

```json
{ "path": "<user-id>/<kind>/<uuid>.<extension>" }
```

La préparation client commune accepte une source raster jusqu’à 25 Mio et
compresse progressivement les JPEG, PNG et WebP supérieurs à 3,5 Mo, avec un
plus grand côté de 3 200 px maximum. La taille préparée est ensuite contrôlée
impérativement. Ce parcours
de preuve accepte uniquement PDF, PNG ou JPEG de 1 octet à 10 Mio ; un éventuel
selfie KYC facultatif doit être JPEG. Les PDF restent byte-identiques. Aucun gros payload ne
traverse Netlify.

### `DELETE /api/evidence`

Supprime jusqu’à dix chemins préfixés par l’UUID du téléverseur, après contrôle
de session, d’origine et de RLS. Un objet déjà référencé par un dossier KYC,
un brouillon, une demande de prêt ou une exécution enregistrée ne peut pas être
supprimé. Les nouveaux téléversements KYC utilisent un chemin versionné : une
correction ne remplace jamais le fichier d’une soumission antérieure.

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
le job avec un client `service_role`. Le client transmet une clé UUID dans
`Idempotency-Key`; une reprise avec la même clé retrouve le même document et ne
supprime jamais l’artefact produit par une requête concurrente. Réponse réussie :

```json
{
  "id": "<uuid>",
  "documentNumber": "<numéro-unique>",
  "status": "issued"
}
```

### `GET /api/official-documents/:documentId`

Autorise un PDF `issued` après authentification et application de la RLS sur
`official_documents` et Storage, puis répond `307` vers une URL Storage signée
pendant 60 secondes. La réponse est privée, non mise en cache, forcée en
téléchargement et protégée par `nosniff` et `no-referrer`. Le PDF ne traverse
pas la fonction Netlify. Un document non finalisé retourne `409`; une ligne ou
un objet inaccessible retourne `404`.

### `PUT /api/admin/branding`

Publie le nom et les assets de marque depuis des chemins `upload-staging`. Les
PNG ou WebP concernés ont déjà été compressés dans le navigateur ; le SVG
reste inchangé. Chaque source est limitée à 5 Mio et son chemin doit lier
l’administrateur, le but `branding` et le type d’asset. La route relit les
sources privées, valide leurs signatures, génère les logos, favicons, icônes et
cartes sociales puis publie atomiquement une nouvelle révision. Le corps JSON
ne contient aucun fichier :

```json
{
  "bankName": "Monalyz",
  "expectedRevision": 4,
  "primaryLogoPath": "<staging-path|null>",
  "reversedLogoPath": "<staging-path|null>",
  "faviconPath": "<staging-path|null>"
}
```

La route exige une session administrateur et une origine identique. Un conflit
de révision retourne `409` ; les objets temporaires et les assets partiellement
générés sont nettoyés en best effort.

### `GET /api/health`

Vérifie que la configuration serveur permet une lecture minimale de
`brand_settings`, avec un délai de trois secondes. Réponse saine :

```json
{ "status": "ok" }
```

Une configuration ou une base indisponible retourne `503` et
`{ "status": "unavailable" }`, sans détail interne. Toutes les réponses sont
`no-store`.

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
- une origine identique à `APP_ORIGIN`, `NEXT_PUBLIC_APP_ORIGIN` ou à une
  origine explicitement listée dans `APP_ALLOWED_ORIGINS` pendant une migration ;
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
le déclenchement HTTP, mais seule la route serveur peut réclamer la file : un
utilisateur standard est limité à ses propres e-mails, tandis qu’un chef
d’agence actif peut traiter le lot global. Les échecs suivent un backoff
exponentiel borné à 30 minutes. Les RPC `claim` et `complete` refusent les JWT
autres que `service_role`; chaque complétion doit en plus présenter le
`claim_token` opaque renvoyé lors de la réclamation.

La cadence de production ne dépend pas de cette route interactive : la
fonction Netlify privée `transactional-email-worker` réclame cinq jobs au
maximum chaque minute, avec une concurrence de deux et un timeout fournisseur
de trois secondes. Netlify ne l’exécute automatiquement que sur un deploy
publié.

## RPC publiques authentifiées

| RPC | Responsabilité |
| --- | --- |
| `current_app_role` | Retourner le rôle courant |
| `submit_transfer_intent` | Créer et réserver une intention |
| `branch_manager_review_transfer_check` | Valider un contrôle séquentiel avec une note facultative ; chaque étape notifie le client et la quatrième débite puis clôture atomiquement |
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
| `claim_transactional_emails_for_recipient` | Réclamer atomiquement les jobs d’un seul destinataire (`service_role`) |
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
  p_note text default null
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
| `409` | Suppression d’une preuve déjà référencée |
| `413` | Fichier vide ou supérieur à 10 Mio |
| `415` | Signature ou MIME refusé |
| `503` | Client serveur privilégié indisponible |

Voir [Architecture](architecture.md),
[Déploiement Netlify](deployment.md) et
[E-mails transactionnels](transactional-email.md).
