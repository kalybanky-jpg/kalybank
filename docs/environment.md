# Variables d’environnement

> Référence des seules variables runtime requises par KALY.

| Variable | Requise | Utilisée par | Rôle |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Oui | Client, serveur, proxy | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Oui | Client, serveur, proxy | Clé publique RLS |
| `NEXT_PUBLIC_APP_ORIGIN` | Oui | Client Auth | Origine des callbacks e-mail |
| `APP_ORIGIN` | Oui en production | Routes serveur | Origine canonique anti-redirection |

`NEXT_PUBLIC_SUPABASE_ANON_KEY` reste accepté comme compatibilité technique,
mais la clé publiable est la convention documentée.

`.env.remote.example` contient uniquement l’URL et la clé publiable du projet
KALY. Cette clé est destinée au navigateur et reste protégée par RLS ; aucune
clé secrète ou `service_role` n’est versionnée.

Les secrets SMTP ne sont pas des variables runtime de l’application. Ils sont
lus uniquement par le script d’administration décrit dans
[E-mails transactionnels](transactional-email.md), depuis un fichier local
`.env.email.resend.local` ou `.env.email.brevo.local`.

## Règles de sécurité

- Ne jamais exposer de clé `service_role` au navigateur.
- Ne jamais ajouter de variable d’API bancaire : aucune intégration bancaire
  n’appartient au périmètre actuel.
- Configurer les URL de redirection Auth avec l’origine exacte du déploiement.
- Refaire le build quand une variable `NEXT_PUBLIC_*` change.
- Garder `.env.example` sans secret et les fichiers `.env*` réels hors Git.
- Ne jamais injecter un jeton Management API ou un secret SMTP dans Next.js.

## Taux de conversion

Les valeurs de `lib/currency.ts` sont des références statiques et datées.
Il n’existe ni clé de marché ni appel vers un fournisseur externe.
