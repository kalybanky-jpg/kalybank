# Modèle de base vierge avec administrateur démo

Ce modèle est réservé aux environnements **locaux et GitHub CI**. Après un
reset et son bootstrap, il contient le schéma Monalyz, les paramètres système
créés par les migrations et une seule identité humaine :

| Champ | Valeur |
| --- | --- |
| Adresse | `admin.demo.local@monalyz.test` |
| Mot de passe | `Monalyz-Demo-Local-2026!` |
| Rôle | `admin`, actif |
| Langue | Français |
| Devise de base | CAD |

Connexion locale : [http://127.0.0.1:3000/admin-login](http://127.0.0.1:3000/admin-login).

L’adresse utilise le domaine réservé `.test` et ne reçoit aucun e-mail. Le
mot de passe est public et volontairement limité à ce modèle jetable. Le
compte est marqué `monalyz_demo=true` et `demo_scope=local_clean_baseline`
dans `app_metadata`; aucun rôle n’est dérivé de ces marqueurs. Seule la ligne
SQL `public.staff_members` fait autorité pour l’autorisation.

## Recréation

```powershell
npx bun x supabase start
npx bun x supabase db reset --local
```

Récupérez ensuite les clés **locales** affichées par
`npx bun x supabase status -o env`, puis exécutez :

```powershell
$env:SUPABASE_URL = 'http://127.0.0.1:54321'
$env:SUPABASE_ANON_KEY = '<ANON_KEY locale>'
$env:SUPABASE_SERVICE_ROLE_KEY = '<SERVICE_ROLE_KEY locale>'
npx bun run demo:clean-admin
Remove-Item Env:SUPABASE_URL
Remove-Item Env:SUPABASE_ANON_KEY
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```

Le script crée ou reprend l’unique identité via Supabase Auth Admin, puis
exécute [`supabase/bootstrap/clean-admin-baseline.sql`](../supabase/bootstrap/clean-admin-baseline.sql)
avec `supabase db query --local`. Il refuse toute URL distante, toute deuxième
identité et toute donnée métier. Il ne crée ni client, ni KYC, ni compte
bancaire, ni solde, ni virement, ni prêt, ni document, ni conversation support.
La ligne `support_user_identities` dérivée automatiquement de l’admin est la
seule projection support autorisée.

## Interdiction de production

Le [`supabase/seed.sql`](../supabase/seed.sql) reste volontairement vide.
N’adaptez jamais le bootstrap pour accepter `--linked`, une URL Supabase
distante ou une clé de production. Les identifiants sont publics et ne
constituent pas un secret de production.

La production continue d’utiliser des comptes administrateurs créés par
Supabase Auth et promus explicitement dans `public.staff_members`. Aucun
identifiant, mot de passe, token ou export de production n’est présent dans ce
modèle.

## Vérification

Le job Database de GitHub réinitialise une seconde fois la base de sa pile
Supabase éphémère, exécute le bootstrap, puis se connecte réellement avec les
identifiants ci-dessus via Supabase Auth. La pile CI est détruite à la fin du
job.
