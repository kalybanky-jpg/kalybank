# Variables d’environnement

> Référence des seules variables runtime requises par Monalyz.

| Variable | Requise | Utilisée par | Rôle |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Oui | Client, serveur, proxy | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Oui | Client, serveur, proxy | Clé publique RLS |
| `NEXT_PUBLIC_APP_ORIGIN` | Oui | Client Auth | Origine des callbacks e-mail |
| `APP_ORIGIN` | Oui en production | Routes serveur | Origine canonique anti-redirection |
| `TRANSACTIONAL_EMAIL_ASSET_BASE_URL` | Non | Worker d’e-mails métier | Base publique des images de marque |

`NEXT_PUBLIC_SUPABASE_ANON_KEY` reste accepté comme compatibilité technique,
mais la clé publiable est la convention documentée.

`.env.remote.example` contient uniquement l’URL et la clé publiable du projet
Monalyz. Cette clé est destinée au navigateur et reste protégée par RLS ; aucune
clé secrète ou `service_role` n’est versionnée.

Les secrets SMTP sont accessibles uniquement au serveur et au script
d’administration décrit dans [E-mails transactionnels](transactional-email.md).
Le profil Resend utilise `.env`; le profil Brevo utilise
`.env.email.brevo.local`. Ces fichiers restent hors Git.

Le worker résout les assets e-mail depuis
`TRANSACTIONAL_EMAIL_ASSET_BASE_URL`, puis `APP_ORIGIN`, puis
`NEXT_PUBLIC_APP_ORIGIN`. La valeur doit être une URL HTTP(S) absolue et doit
obligatoirement utiliser HTTPS en production.

Le provisionneur de [comptes de démonstration](demo-accounts.md) lit
`DEMO_ADMIN_PASSWORD`, `DEMO_CLIENT_PASSWORD` et, hors simulation,
`DEMO_SUPABASE_SECRET_KEY` uniquement depuis l’environnement du processus.
`DEMO_SUPABASE_URL` est facultative et doit correspondre exactement à la cible
locale ou au projet distant canonique. Ces variables ne doivent être ajoutées
à aucun fichier `.env`.

## Règles de sécurité

- Ne jamais exposer de clé `service_role` au navigateur.
- Ne jamais ajouter de variable d’API bancaire : aucune intégration bancaire
  n’appartient au périmètre actuel.
- Configurer les URL de redirection Auth avec l’origine exacte du déploiement.
- Refaire le build quand une variable `NEXT_PUBLIC_*` change.
- Garder `.env.example` sans secret et les fichiers `.env*` réels hors Git.
- Ne jamais injecter un jeton Management API ou un secret SMTP dans Next.js.
- Supprimer les variables `DEMO_*` du terminal après le provisionnement.

## Taux de conversion

Les valeurs de `lib/currency.ts` sont des références statiques et datées.
Il n’existe ni clé de marché ni appel vers un fournisseur externe.
