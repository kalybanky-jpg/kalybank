# Comptes de démonstration

> Procédure idempotente pour créer les deux identités de test Monalyz sans
> versionner de mot de passe, de clé serveur ou de donnée d’environnement.

| Compte | Adresse | Accès |
| --- | --- | --- |
| Administrateur | `admin.demo@monalyz.com` | Back-office, rôle SQL `admin` actif |
| Client | `client.demo@monalyz.com` | Espace client uniquement |

Le client reçoit un KYC synthétique approuvé sans justificatif et une position
interne fictive « Compte courant démo » de 25 000 EUR. Il ne reçoit aucun IBAN,
connexion bancaire, virement, prêt ou mouvement externe. L’administrateur ne
reçoit ni KYC ni position.

## Prévalidation

Fournissez deux mots de passe distincts de 16 caractères minimum, avec
minuscule, majuscule, chiffre et symbole. Gardez-les uniquement dans
l’environnement du terminal :

```powershell
$env:DEMO_ADMIN_PASSWORD = '<mot-de-passe-fort-distinct>'
$env:DEMO_CLIENT_PASSWORD = '<mot-de-passe-fort-distinct>'
npm run demo:provision -- --target=local --dry-run
```

`--dry-run` valide uniquement la cible et les paramètres en mémoire. Il
n’établit aucune connexion à Supabase et ne prétend donc pas vérifier les
permissions ni l’état de la base.

## Provisionnement

La migration contenant `provision_demo_accounts` doit être appliquée avant la
commande. Fournissez ensuite la clé secrète du même environnement :

```powershell
$env:DEMO_SUPABASE_SECRET_KEY = '<clé-secrète-ou-service-role>'
npm run demo:provision -- --target=local
```

Pour le projet hébergé canonique :

```powershell
$env:DEMO_SUPABASE_SECRET_KEY = '<clé-secrète-du-projet-distant>'
npm run demo:provision -- --target=remote
```

Le script refuse toute URL autre que `http://127.0.0.1:54321` pour `local` et
`https://qljqldhvbakornnpalua.supabase.co` pour `remote`. Une éventuelle
`DEMO_SUPABASE_URL` doit correspondre exactement à la cible.

Supprimez les valeurs du terminal après l’opération :

```powershell
Remove-Item Env:DEMO_ADMIN_PASSWORD
Remove-Item Env:DEMO_CLIENT_PASSWORD
Remove-Item Env:DEMO_SUPABASE_SECRET_KEY
```

## Garanties

- Les identités sont créées et confirmées avec Supabase Auth Admin côté serveur.
- Le marqueur de démonstration est dans `app_metadata`, jamais dans une
  métadonnée modifiable utilisée pour l’autorisation.
- La RPC métier est atomique, sérialisée par verrou et exécutable uniquement
  par `service_role`.
- Les UUID du KYC et de la position sont déterministes ; toute collision avec
  une donnée non marquée démo, un autre propriétaire ou une fixture client
  supplémentaire interrompt l’opération sans écrasement.
- Un compte existant sous une adresse démo sans marqueur compatible n’est
  jamais adopté ni modifié.
- La vérification finale exige deux identités, un administrateur actif, aucun
  rôle staff client, un KYC, une position, quatre audits filtrés et zéro flux
  financier.
- Les mots de passe ne sont ni affichés, ni écrits dans un fichier, ni ajoutés
  au snapshot SQL.

Voir aussi [Authentification](authentication.md) et
[Exploitation Supabase](database-operations.md).
