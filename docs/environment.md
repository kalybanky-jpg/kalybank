# Variables d’environnement

> Référence des variables runtime Monalyz et de leur portée Netlify. Aucun
> secret ne doit être écrit dans `netlify.toml` ou exposé avec le préfixe
> `NEXT_PUBLIC_`.

## Runtime applicatif

| Variable | Requise | Portée Netlify | Rôle |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Oui | Build et fonctions | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Oui | Build et fonctions | Clé publique protégée par RLS |
| `NEXT_PUBLIC_APP_ORIGIN` | Oui | Build et fonctions | Origine HTTPS des callbacks e-mail et de l’UI |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Non | Build | Adresse affichée dans l’interface |
| `APP_ORIGIN` | Oui en production | Fonctions/runtime | Origine canonique pour les mutations et redirections |
| `APP_ALLOWED_ORIGINS` | Non | Fonctions/runtime | Origines HTTPS supplémentaires autorisées pour les mutations pendant une migration de domaine, séparées par des virgules |
| `SUPABASE_SECRET_KEY` | Oui en production | Fonctions/runtime, secret | Client privilégié pour staging, marque, PDF, health check et outbox |
| `CLIENT_PURGE_SWEEP_SECRET` | Oui pour la reprise différée | Fonctions/runtime, secret | Secret aléatoire de 32 caractères minimum envoyé uniquement par le planificateur à `POST /api/internal/client-purge-sweep` |
| `CLIENT_PURGE_CHALLENGE_SECRET` | Oui pour la suppression client | Fonctions/runtime, secret | Secret aléatoire distinct de 32 caractères minimum servant à dériver un défi stable pour une même clé d’idempotence, sans stocker sa valeur brute |
| `SEND_EMAIL_HOOK_SECRET` | Oui si le hook Auth est actif | Fonctions/runtime, secret | Signature Standard Webhooks du hook Supabase Auth |
| `TRANSACTIONAL_EMAIL_PROVIDER` | Oui pour l’outbox | Fonctions/runtime | `resend` ou `brevo` |
| `TRANSACTIONAL_EMAIL_FROM_EMAIL` | Oui pour l’outbox | Fonctions/runtime | Adresse expéditrice vérifiée |
| `TRANSACTIONAL_EMAIL_FROM_NAME` | Non | Fonctions/runtime | Nom d’expéditeur de secours, `Monalyz` par défaut |
| `TRANSACTIONAL_EMAIL_REPLY_TO` | Non | Fonctions/runtime | Adresse de réponse, sinon l’expéditeur |
| `TRANSACTIONAL_EMAIL_ASSET_BASE_URL` | Non | Fonctions/runtime | Base HTTPS des assets e-mail ; repli sur les origines applicatives |
| `RESEND_API_KEY` | Oui si Resend | Fonctions/runtime, secret | API REST Resend et, si retenu, mot de passe SMTP Auth |
| `BREVO_API_KEY` | Oui si Brevo | Fonctions/runtime, secret | API REST Brevo pour l’outbox |

`NEXT_PUBLIC_SUPABASE_ANON_KEY` reste accepté pour compatibilité, mais
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` est la convention. L’ancienne
`SUPABASE_SERVICE_ROLE_KEY` reste acceptée côté serveur ; préférer
`SUPABASE_SECRET_KEY`. Aucune de ces clés privilégiées ne doit porter le
préfixe `NEXT_PUBLIC_`.

Le sweep de suppression de clients est planifié toutes les minutes par
la Scheduled Function versionnée `netlify/functions/client-purge-sweep.ts`,
qui appelle la route interne avec l’en-tête `x-client-purge-sweep-secret`. Il ne contourne pas les
gardes métier : seules les opérations déjà consommées, avec une cible encore
gelée ou sans profil, sont reprises sous l’identité d’un administrateur actif.
La reprise manuelle reste disponible, mais ne remplace pas cette planification.
Le secret ne doit jamais être inclus
dans une URL, un log ou une variable `NEXT_PUBLIC_*`.

L’inventaire Storage est diffusé sans tableau global puis persisté de façon
idempotente dans une table privée normalisée, par pages de 1 000 objets. Sa
lecture et chaque suppression suivent un curseur avec la même borne. Il
n’existe pas de plafond global applicatif à 10 000 objets. Une référence historique qui ne
respecte pas l’appartenance du client est signalée et ignorée : sa ligne métier
est supprimée, mais l’objet étranger n’entre jamais dans le manifeste.
Le sweep différé attend au moins 2 h 05 après la phase relationnelle, soit cinq
minutes de marge au-delà de la durée maximale des URL signées. Après la
suppression Auth, un dernier sweep ciblé et une seconde vérification Storage
sont exigés avant la finalisation sans trace.

Le scénario destructif `test:client-purge:integration` est verrouillé à
GitHub Actions, `CI=true`, une instance Supabase locale sur le port `54321` et
`MONALYZ_ALLOW_DESTRUCTIVE_LOCAL_PURGE_TEST=1`. Le job `database` le lance en
dernier sur l’instance éphémère, après pgTAP et les contrôles de schéma. Il ne
doit jamais être lancé contre un projet lié ou distant.

Le worker résout la base des assets dans cet ordre :
`TRANSACTIONAL_EMAIL_ASSET_BASE_URL`, `APP_ORIGIN`, puis
`NEXT_PUBLIC_APP_ORIGIN`. En production, l’URL retenue doit être absolue et
utiliser HTTPS.

`APP_ALLOWED_ORIGINS` ne remplace jamais l’origine canonique. L’application
ajoute toujours `APP_ORIGIN` et `NEXT_PUBLIC_APP_ORIGIN` à la liste. Cette
variable sert notamment à garder l’ancien domaine fonctionnel pendant une
bascule DNS sans ouvrir les mutations à des origines non maîtrisées.

## Contextes Netlify

Configurer les valeurs dans l’interface Netlify et limiter leur portée au
besoin :

| Contexte | Valeurs attendues |
| --- | --- |
| Production | Projet Supabase de production, origine canonique, clé serveur et fournisseur e-mail de production |
| Deploy Preview | Projet et fournisseur non productifs recommandés ; ne jamais donner les secrets de production à une PR non approuvée |
| Branch deploy | Valeurs non productives ou secrets désactivés si ce contexte n’est pas utilisé |

Les `NEXT_PUBLIC_*` sont incorporées au bundle et exigent un nouveau build
après modification. Les variables serveur doivent être disponibles aux
fonctions Netlify, dont `transactional-email-worker`. Ce worker lit une liste
fermée de clés avec `Netlify.env` ; une variable présente dans le dashboard mais
absente de cette liste n’est pas transmise au service de dispatch.

Une recette authentifiée sur Deploy Preview exige que `APP_ORIGIN` et
`NEXT_PUBLIC_APP_ORIGIN` correspondent exactement à l’URL HTTPS stable de la
preview. Si cette URL n’est connue qu’après le premier deploy, la renseigner
puis relancer le deploy. Sans cette étape, les mutations same-origin doivent
être refusées et la preview ne peut servir qu’aux contrôles publics.

## Variables d’administration hors Netlify

Ces variables servent aux scripts opérateurs. Elles ne sont pas requises par
l’application déployée et ne doivent pas être copiées dans Netlify :

| Variable | Rôle |
| --- | --- |
| `SUPABASE_PROJECT_REF` | Projet Supabase ciblé par le script SMTP |
| `SUPABASE_ACCESS_TOKEN` | Jeton Management API du script SMTP |
| `AUTH_SMTP_FROM_EMAIL` | Expéditeur Supabase Auth vérifié |
| `AUTH_SMTP_SENDER_NAME` | Nom visible des e-mails Auth |
| `AUTH_EMAIL_RATE_LIMIT_PER_HOUR` | Limite d’envoi Auth par heure |
| `AUTH_SMTP_MAX_FREQUENCY_SECONDS` | Délai anti-abus entre deux envois |
| `BREVO_SMTP_LOGIN` | Identifiant SMTP Brevo pour Supabase Auth |
| `BREVO_SMTP_KEY` | Secret SMTP Brevo pour Supabase Auth |

Le provisionneur de [comptes de démonstration](demo-accounts.md) lit
`DEMO_ADMIN_PASSWORD`, `DEMO_CLIENT_PASSWORD` et, hors simulation,
`DEMO_SUPABASE_SECRET_KEY` depuis l’environnement du processus.
`DEMO_SUPABASE_URL` est facultative et doit correspondre exactement à la cible
autorisée. Ne jamais ajouter ces variables à Netlify.

## Fichiers locaux

`.env.example` documente un environnement local sans secret réel.
`.env.remote.example` contient uniquement l’URL et la clé publiable du projet
canonique. Les profils Resend et Brevo utilisent des fichiers `.env*` ignorés
par Git, comme décrit dans
[E-mails transactionnels](transactional-email.md).

## Règles de sécurité

- Ne jamais exposer `SUPABASE_SECRET_KEY`, une clé `service_role`, un secret
  SMTP ou un jeton Management API au navigateur.
- Utiliser les valeurs de production uniquement dans le contexte Netlify
  Production et pour des deploys approuvés.
- Configurer les URL Auth Supabase avec les origines exactes des environnements
  autorisés.
- Faire tourner les secrets après une exposition ou un départ d’opérateur.
- Garder les fichiers `.env*` réels hors Git.
- Ne pas ajouter de variable d’API bancaire : aucune intégration bancaire
  n’appartient au périmètre actuel.
- Supprimer les variables `DEMO_*` du terminal après le provisionnement.

## Taux de conversion

Les valeurs de `lib/currency.ts` sont des références statiques et datées. Il
n’existe ni clé de marché ni appel vers un fournisseur externe.

Pour la saisie et la validation humaine des valeurs de production, suivre le
[runbook Netlify](runbooks/netlify-production-release.md).
