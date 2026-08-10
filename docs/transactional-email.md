# E-mails transactionnels

Monalyz propose deux configurations indépendantes :

- les e-mails d’identité de Supabase Auth, transportés par SMTP ;
- les notifications métier des virements, prêts et dossiers KYC, envoyées depuis l’outbox
  par l’API REST Resend ou Brevo.

Un seul fournisseur métier est actif à la fois. Aucun e-mail ne donne un ordre
bancaire et aucun fournisseur n’est relié à une banque.

## En un coup d’œil

| Élément | Valeur versionnée |
| --- | --- |
| Planification | Fonction Netlify chaque minute |
| Lot planifié | 5 jobs maximum |
| Concurrence | 2 envois |
| Timeout fournisseur | 3 secondes par appel |
| Lot de la route authentifiée | 10 jobs maximum |
| Activation automatique | Deploy Netlify publié uniquement |

Le worker et sa planification sont présents dans le dépôt. Leur activation
effective exige encore un site publié et les secrets de production ; ce
document ne constitue pas une preuve de déploiement.

## Architecture métier

```text
RPC virement/prêt/KYC
  -> transaction PostgreSQL
     -> nouvel état métier
     -> notification interne
     -> job unique dans transactional_email_outbox
  -> fonction Netlify transactional-email-worker (chaque minute)
     -> claim atomique
     -> lecture de profiles.preferred_language
     -> rendu d’un modèle versionné
     -> API Resend ou API Brevo
     -> sent, nouvelle tentative ou failed
```

L’enregistrement métier et le job d’e-mail sont atomiques. Une panne réseau ou
fournisseur ne revient jamais sur une validation, un refus ou une
finalisation. Le job reste disponible pour une nouvelle tentative.

La clé `event_key` empêche deux jobs pour le même statut. La clé
`Idempotency-Key: monalyz-<job-id>` est aussi transmise au fournisseur :
en-tête HTTP chez Resend, en-tête personnalisé du message chez Brevo.

## Événements couverts

| Virement | Prêt | KYC |
| --- | --- | --- |
| Demande soumise | Demande soumise | Dossier reçu |
| Validé par le chef d’agence | Validé par le chef d’agence | Complément demandé |
| Effectué et finalisé | Décaissé et position courante créditée | Dossier resoumis |
| Refusé | Refusé | Approuvé et compte interne créé |
| Exécution échouée | Décaissement échoué | Rejeté et corrigeable |

Les modèles décrivent uniquement ce que le client doit savoir : demande reçue,
en cours d’examen, validée, effectuée, refusée ou non aboutie. Le vocabulaire
interne de traitement n’apparaît pas dans les messages.

## Langue du destinataire

Les quinze modèles existent en français, anglais, allemand et espagnol. Les
sujets, corps, pieds de page, nombres et devises sont localisés avec
`fr-FR`, `en-US`, `de-DE` ou `es-ES`.

La langue n’est pas figée lors de la création du job. Après avoir réclamé un
job, le worker relit `profiles.preferred_language` à partir de
`recipient_id`, immédiatement avant l’appel fournisseur. Une nouvelle
tentative utilise donc la préférence la plus récente. Une erreur de lecture du
profil produit un échec réessayable sans envoyer de message ; seule une
préférence réellement absente utilise `fr`.

Le rendu continue d’échapper toute donnée dynamique en HTML. L’idempotence
reste fondée sur l’identifiant stable du job et ne dépend pas de la langue.
Chaque version HTML affiche le wordmark Monalyz à 180 px. Son URL absolue est
construite côté serveur afin qu’elle reste chargeable hors de l’application.

## Configuration des e-mails métier

Variables communes :

| Variable | Rôle |
| --- | --- |
| `TRANSACTIONAL_EMAIL_PROVIDER` | `resend` ou `brevo` |
| `TRANSACTIONAL_EMAIL_FROM_EMAIL` | Adresse expéditrice vérifiée |
| `TRANSACTIONAL_EMAIL_FROM_NAME` | Secours de configuration ; le nom publié dans le back-office est utilisé à l’envoi |
| `TRANSACTIONAL_EMAIL_REPLY_TO` | Adresse de réponse, sinon l’expéditeur |
| `TRANSACTIONAL_EMAIL_ASSET_BASE_URL` | Base publique du wordmark, facultative si une origine applicative est définie |
| `SUPABASE_SECRET_KEY` | Clé serveur privilégiée du worker d’outbox |
| `SEND_EMAIL_HOOK_SECRET` | Secret signé du Send Email Hook Supabase (`v1,whsec_…`) |

`SUPABASE_SERVICE_ROLE_KEY` reste accepté pour les projets utilisant les
anciennes clés JWT. Préférer `SUPABASE_SECRET_KEY`. Ces deux variables sont
strictement serveur et ne doivent jamais porter le préfixe `NEXT_PUBLIC_`.

La base des assets est résolue dans cet ordre :
`TRANSACTIONAL_EMAIL_ASSET_BASE_URL`, `APP_ORIGIN`, puis
`NEXT_PUBLIC_APP_ORIGIN`. Elle doit être une URL HTTP(S) absolue; en production,
HTTPS est obligatoire. Le logo e-mail courant est lu dans `brand_settings` et
servi depuis le bucket public versionné `brand-assets`; l’asset historique
local reste le secours.

### Hook Supabase Auth

Le profil de production utilise directement le SMTP Supabase et maintient le
Send Email Hook désactivé. Un hook HTTP remplace entièrement le SMTP et doit
répondre en moins de cinq secondes ; il ne constitue donc pas un mécanisme de
secours. La commande `auth:email:configure:*` désactive explicitement ce hook
avant de vérifier la configuration distante.

La route `https://<origine>/api/auth/send-email-hook` reste disponible pour une
future architecture à faible latence. Avant de la réactiver, valider les
démarrages à froid sous cinq secondes et copier son secret dans
`SEND_EMAIL_HOOK_SECRET`. L’endpoint vérifie les trois en-têtes Standard
Webhooks avant tout accès aux données.

### Resend métier

```dotenv
TRANSACTIONAL_EMAIL_PROVIDER=resend
TRANSACTIONAL_EMAIL_FROM_EMAIL=support@monalyz.com
TRANSACTIONAL_EMAIL_FROM_NAME=Monalyz
TRANSACTIONAL_EMAIL_REPLY_TO=support@monalyz.com
TRANSACTIONAL_EMAIL_ASSET_BASE_URL=https://app.monalyz.com
RESEND_API_KEY=re_replace_me
SUPABASE_SECRET_KEY=sb_secret_replace_me
```

`RESEND_API_KEY` autorise l’appel `POST https://api.resend.com/emails`. Resend
accepte également cette clé comme secret SMTP du profil Supabase Auth.

### Brevo métier

```dotenv
TRANSACTIONAL_EMAIL_PROVIDER=brevo
TRANSACTIONAL_EMAIL_FROM_EMAIL=support@monalyz.com
TRANSACTIONAL_EMAIL_FROM_NAME=Monalyz
TRANSACTIONAL_EMAIL_REPLY_TO=support@monalyz.com
TRANSACTIONAL_EMAIL_ASSET_BASE_URL=https://app.monalyz.com
BREVO_API_KEY=xkeysib-replace_me
SUPABASE_SECRET_KEY=sb_secret_replace_me
```

`BREVO_API_KEY` autorise l’appel
`POST https://api.brevo.com/v3/smtp/email`. Elle est distincte des
identifiants SMTP `BREVO_SMTP_LOGIN` et `BREVO_SMTP_KEY` utilisés par
Supabase Auth. Une clé API Brevo ne remplace pas une clé SMTP, et inversement.

Les variables fournisseur sont des secrets serveur : ne jamais utiliser de
préfixe `NEXT_PUBLIC_` et ne jamais les commiter.

## Configuration Supabase Auth

Supabase Auth envoie la confirmation d’inscription, la récupération du mot de
passe et la notification de changement du mot de passe. Le script
d’administration applique un profil SMTP à la fois.

| Profil Auth | Hôte | Port | Identifiant | Secret |
| --- | --- | --- | --- | --- |
| Resend | `smtp.resend.com` | `587` | `resend` | `RESEND_API_KEY` |
| Brevo | `smtp-relay.brevo.com` | `587` | `BREVO_SMTP_LOGIN` | `BREVO_SMTP_KEY` |

### Appliquer Resend à Supabase Auth

```powershell
# Ajoutez la clé et le jeton Management API dans .env, hors Git.
npx bun run auth:email:check:resend
npx bun run auth:email:configure:resend
```

### Appliquer Brevo à Supabase Auth

```powershell
Copy-Item .env.email.brevo.example .env.email.brevo.local
npx bun run auth:email:check:brevo
npx bun run auth:email:configure:brevo
```

Variables d’administration :

| Variable | Rôle |
| --- | --- |
| `SUPABASE_PROJECT_REF` | Projet hébergé à modifier |
| `SUPABASE_ACCESS_TOKEN` | Jeton Management API |
| `AUTH_SMTP_FROM_EMAIL` | Adresse expéditrice vérifiée |
| `AUTH_SMTP_SENDER_NAME` | Nom visible |
| `AUTH_EMAIL_RATE_LIMIT_PER_HOUR` | Limite Supabase par heure |
| `AUTH_SMTP_MAX_FREQUENCY_SECONDS` | Délai anti-abus |

Le script exige une confirmation d’adresse, sécurise le changement d’adresse
et de mot de passe, applique les modèles versionnés de `supabase/templates`,
puis relit la configuration distante. Son résumé masque toujours les secrets.
Les trois modèles incluent le wordmark à partir de
`{{ .SiteURL }}/brand/monalyz/monalyz-wordmark-email-360.png` et conservent les
liens sécurisés des parcours de récupération. La confirmation d’inscription
utilise uniquement le code `{{ .Token }}` à six chiffres, sans lien, et peut
saluer l’utilisateur avec `user_metadata.display_name`. Le sujet et le corps utilisent les conditions Go
Template de Supabase pour sélectionner le français, l’anglais, l’allemand ou
l’espagnol depuis `user_metadata.preferred_language`; une valeur absente ou
inconnue utilise le français. Pour les nouveaux projets Free créés depuis le
3 juin 2026, Supabase exige un SMTP personnalisé pour modifier les modèles
Auth; les profils Resend et Brevo décrits ici satisfont cette condition.

## Exploitation de l’outbox

- un lot contient de 1 à 20 jobs au niveau RPC, 10 au niveau de la route
  authentifiée et 5 dans la fonction planifiée ;
- `transactional-email-worker` exporte en code une configuration Netlify typée
  avec la cadence `* * * * *` ; `netlify.toml` ne duplique pas ce cron ;
- le worker traite deux jobs en parallèle et interrompt chaque appel Resend ou
  Brevo après trois secondes ;
- le worker lit uniquement la liste fermée de variables autorisées via
  `Netlify.env` et ne renvoie aucun corps HTTP ;
- seules les RPC appelées avec le rôle `service_role` peuvent réclamer ou
  terminer des jobs ;
- `FOR UPDATE SKIP LOCKED` évite que deux workers réclament le même job ;
- un `claim_token` aléatoire lie la complétion au claim en cours ;
- un claim bloqué depuis plus de dix minutes peut être repris ;
- chaque tentative incrémente `attempts` ;
- après cinq échecs, le job devient `failed` ;
- l’erreur fournisseur est conservée avec une taille limitée ;
- seuls les jobs `sent` possèdent `sent_at` ;
- chaque invocation journalise un résumé JSON : jobs réclamés, envoyés,
  échoués, finalisations échouées et durée.

La route de dispatch exige une origine canonique et une session, puis crée un
client serveur isolé avec `SUPABASE_SECRET_KEY` — ou l’ancienne
`SUPABASE_SERVICE_ROLE_KEY`. Le navigateur ne reçoit jamais cette clé et ne
fournit jamais l’adresse du destinataire, le modèle ou le contenu : ils
proviennent exclusivement de l’outbox.

La fonction planifiée n’appelle pas cette route et ne possède aucun chemin HTTP
public : elle utilise directement le même service de dispatch avec le client
privilégié. Netlify ne lance automatiquement une fonction planifiée que pour
un deploy publié. Sur un Deploy Preview, utiliser **Run now** dans l’interface
Netlify pour un essai explicite ; aucune cadence automatique ne doit être
attendue.

## Préparation et recette

1. vérifier le domaine expéditeur chez le ou les fournisseurs ;
2. publier les enregistrements SPF, DKIM et DMARC ;
3. renseigner un seul profil métier dans les secrets du serveur ;
4. lancer
   `npx bun x tsx --test tests/transactional-email.test.ts tests/transactional-email-dispatch.test.ts` ;
5. soumettre un virement et un prêt avec un compte de test ;
6. valider, refuser et finaliser depuis le compte chef d’agence ;
7. vérifier le statut `sent`, l’identifiant fournisseur et les journaux ;
8. provoquer un échec contrôlé et vérifier la remise en attente ;
9. contrôler l’affichage texte et HTML sur mobile et ordinateur.

La mise en place des secrets, le test **Run now**, les alertes et le go/no-go
sont détaillés dans le
[runbook de mise en production Netlify](runbooks/netlify-production-release.md).

Références officielles :
[SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp),
[modèles Supabase](https://supabase.com/docs/guides/auth/auth-email-templates),
[API Resend](https://resend.com/docs/api-reference/emails/send-email),
[SMTP Resend](https://resend.com/docs/send-with-smtp),
[API Brevo](https://developers.brevo.com/reference/sendtransacemail) et
[SMTP Brevo](https://developers.brevo.com/docs/smtp-integration).
