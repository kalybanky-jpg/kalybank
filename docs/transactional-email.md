# E-mails transactionnels

Monalyz propose deux configurations indépendantes :

- les e-mails d’identité de Supabase Auth, transportés par SMTP ;
- les notifications métier des virements et prêts, envoyées depuis l’outbox
  par l’API REST Resend ou Brevo.

Un seul fournisseur métier est actif à la fois. Aucun e-mail ne donne un ordre
bancaire et aucun fournisseur n’est relié à une banque.

## Architecture métier

```text
RPC virement/prêt
  -> transaction PostgreSQL
     -> nouvel état métier
     -> notification interne
     -> job unique dans transactional_email_outbox
  -> POST /api/transactional-email/dispatch
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

| Virement | Prêt |
| --- | --- |
| Demande soumise | Demande soumise |
| Validé par le chef d’agence | Validé par le chef d’agence |
| Effectué et finalisé | Décaissé et position courante créditée |
| Refusé | Refusé |
| Exécution échouée | Décaissement échoué |

Les modèles rappellent que les contrôles bancaires et mouvements financiers
sont effectués hors de Monalyz.

## Langue du destinataire

Les dix modèles existent en français, anglais, allemand et espagnol. Les
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

## Configuration des e-mails métier

Variables communes :

| Variable | Rôle |
| --- | --- |
| `TRANSACTIONAL_EMAIL_PROVIDER` | `resend` ou `brevo` |
| `TRANSACTIONAL_EMAIL_FROM_EMAIL` | Adresse expéditrice vérifiée |
| `TRANSACTIONAL_EMAIL_FROM_NAME` | Nom visible, `Monalyz` par défaut |
| `TRANSACTIONAL_EMAIL_REPLY_TO` | Adresse de réponse, sinon l’expéditeur |
| `SUPABASE_SECRET_KEY` | Clé serveur privilégiée du worker d’outbox |

`SUPABASE_SERVICE_ROLE_KEY` reste accepté pour les projets utilisant les
anciennes clés JWT. Préférer `SUPABASE_SECRET_KEY`. Ces deux variables sont
strictement serveur et ne doivent jamais porter le préfixe `NEXT_PUBLIC_`.

### Resend métier

```dotenv
TRANSACTIONAL_EMAIL_PROVIDER=resend
TRANSACTIONAL_EMAIL_FROM_EMAIL=support@monalyz.com
TRANSACTIONAL_EMAIL_FROM_NAME=Monalyz
TRANSACTIONAL_EMAIL_REPLY_TO=support@monalyz.com
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

## Exploitation de l’outbox

- un lot contient de 1 à 20 jobs au niveau RPC et 10 au niveau de la route ;
- seules les RPC appelées avec le rôle `service_role` peuvent réclamer ou
  terminer des jobs ;
- `FOR UPDATE SKIP LOCKED` évite que deux workers réclament le même job ;
- un `claim_token` aléatoire lie la complétion au claim en cours ;
- un claim bloqué depuis plus de dix minutes peut être repris ;
- chaque tentative incrémente `attempts` ;
- après cinq échecs, le job devient `failed` ;
- l’erreur fournisseur est conservée avec une taille limitée ;
- seuls les jobs `sent` possèdent `sent_at`.

La route de dispatch exige une origine canonique et une session, puis crée un
client serveur isolé avec `SUPABASE_SECRET_KEY` — ou l’ancienne
`SUPABASE_SERVICE_ROLE_KEY`. Le navigateur ne reçoit jamais cette clé et ne
fournit jamais l’adresse du destinataire, le modèle ou le contenu : ils
proviennent exclusivement de l’outbox.

Pour une exécution régulière sans interaction utilisateur, appeler la même
route depuis un mécanisme planifié authentifié ou déplacer le worker dans une
fonction serveur dédiée. Ce mécanisme d’exploitation n’est pas encore activé.

## Préparation et recette

1. vérifier le domaine expéditeur chez le ou les fournisseurs ;
2. publier les enregistrements SPF, DKIM et DMARC ;
3. renseigner un seul profil métier dans les secrets du serveur ;
4. lancer `npx bun x tsx --test tests/transactional-email.test.ts` ;
5. soumettre un virement et un prêt avec un compte de test ;
6. valider, refuser et finaliser depuis le compte chef d’agence ;
7. vérifier le statut `sent`, l’identifiant fournisseur et les journaux ;
8. provoquer un échec contrôlé et vérifier la remise en attente ;
9. contrôler l’affichage texte et HTML sur mobile et ordinateur.

Références officielles :
[SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp),
[modèles Supabase](https://supabase.com/docs/guides/auth/auth-email-templates),
[API Resend](https://resend.com/docs/api-reference/emails/send-email),
[SMTP Resend](https://resend.com/docs/send-with-smtp),
[API Brevo](https://developers.brevo.com/reference/sendtransacemail) et
[SMTP Brevo](https://developers.brevo.com/docs/smtp-integration).
