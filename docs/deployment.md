# Déploiement Netlify

> Le dépôt contient la configuration de build, le worker planifié et les
> parcours de fichiers compatibles avec les limites Netlify. Le site doit
> encore être relié, configuré, recetté puis publié par un opérateur.

## En un coup d’œil

| Élément | Configuration versionnée |
| --- | --- |
| Framework | Next.js, sortie `.next` |
| Commande de build | `bun run build` |
| Runtimes | Bun 1.3.14 et Node.js 22 |
| Dépendances | Installation gelée par `BUN_FLAGS=--frozen-lockfile` |
| Fonctions | `netlify/functions`, bundle `esbuild` |
| Worker e-mail | `transactional-email-worker`, cron exporté en code chaque minute |
| Health check | `GET /api/health` |
| État de publication | Aucun déploiement Netlify attesté dans le dépôt |

La procédure exécutable, les responsabilités humaines et le rollback sont
centralisés dans le
[runbook de mise en production](runbooks/netlify-production-release.md).

## Configuration versionnée

[`netlify.toml`](../netlify.toml) fixe la commande de build, le dossier publié,
les versions de runtime et le dossier des fonctions. La fonction exporte sa
cadence `config.schedule = '* * * * *'` depuis
`netlify/functions/transactional-email-worker.ts`, conformément au contrat
typé de `@netlify/functions` 5.3.0. Aucun de ces fichiers ne contient de secret.
Les variables `NEXT_PUBLIC_*` requises doivent exister au build ; les secrets
servent uniquement aux fonctions et routes serveur. Voir
[Variables d’environnement](environment.md).

Le workflow [CI](../.github/workflows/ci.yml) exécute sur chaque pull request et
chaque push l’installation gelée, le lint sans avertissement, le typecheck, les
tests TypeScript/TSX et le build. Un job distinct utilise une instance Supabase
locale jetable dans le runner GitHub pour les migrations, pgTAP, le snapshot,
les types et les conseillers de sécurité et de performance. Le snapshot SQL
régénéré est aussi publié comme artefact CI éphémère avant la comparaison avec
la version commitée ; aucun Docker local n’est nécessaire sur le poste de
l’opérateur.

## Fichiers sans gros corps HTTP Netlify

Les octets des justificatifs ne transitent pas dans le corps d’une requête ou
d’une réponse Next.js/Netlify :

```text
Navigateur
  -> compression locale des JPEG/PNG/WebP de plus de 3,5 Mo
  -> POST /api/upload-intents (petit JSON)
  -> upload signé direct vers Storage/upload-staging
  -> POST /api/evidence (petit JSON avec stagingPath)
  -> déplacement Storage -> Storage vers le bucket final
  -> lecture Range de 4 Kio au maximum pour valider la signature
```

- `upload-staging` est privé et limité à 10 Mio par migration ;
- les sources JPEG, PNG et WebP jusqu’à 25 Mio sont compressées
  progressivement au-delà de 3,5 Mo, avec un plus grand côté de 3 200 px ;
- les PDF restent byte-identiques et ne sont jamais recompressés ;
- les preuves finales restent limitées à 10 Mio ;
- les images de marque sont compressées et stagées de la même manière,
  limitées à 5 Mio, puis transformées en assets versionnés côté serveur ;
- le téléchargement d’un document officiel répond `307` vers une URL Storage
  signée pendant 60 secondes : le PDF ne traverse pas Netlify.

Le navigateur peut conserver le fichier original lorsque ses API d’image ne
sont pas disponibles. Les limites serveur et Storage restent alors
autoritaires : une image qui dépasse encore la limite est refusée, jamais
silencieusement tronquée.

## Worker d’e-mails

La fonction `transactional-email-worker` est planifiée toutes les minutes. Une
invocation réclame au plus cinq jobs, en traite deux en parallèle et interrompt
chaque appel fournisseur après trois secondes. Elle appelle directement les RPC
privilégiées, lit ses variables avec `Netlify.env` et ne renvoie aucun corps de
réponse. Aucune route publique n’expose le worker ou la clé Supabase.

Netlify exécute automatiquement une fonction planifiée uniquement sur un
déploiement publié. Un Deploy Preview ne déclenche donc pas la cadence ;
l’opérateur peut utiliser l’action **Run now** dans l’interface Netlify pour une
vérification manuelle. La présence de la planification dans le dépôt ne prouve
pas qu’un déploiement de production existe ou que ses secrets sont configurés.

## Smoke tests applicatifs

Après un Deploy Preview configuré, puis après la publication :

- `GET /api/health` retourne `200` et `{ "status": "ok" }` ;
- `/myaccount` sans session redirige vers `/login` et `/admin` vers
  `/admin-login` ;
- les parcours d’inscription et de récupération reviennent sur l’origine HTTPS
  attendue ;
- un JPEG, PNG ou WebP de plus de 3,5 Mo est compressé avant son upload direct ;
- un PDF proche de 10 Mio reste inchangé et atteint le bucket final sans gros
  corps HTTP applicatif ;
- une signature binaire incohérente, un fichier vide ou trop volumineux est
  refusé ;
- une publication de marque produit les logos, favicons et cartes sociales
  attendus ;
- un document officiel propriétaire renvoie `307`, se télécharge depuis
  l’URL signée et reste inaccessible à un autre client ;
- un lot d’outbox passe de `pending` à `sent` sans doublon, puis un échec
  contrôlé suit le backoff attendu ;
- le CSP conserve son nonce et aucun appel n’est effectué vers une API bancaire.

La recette complète et les conditions de go/no-go figurent dans le
[runbook de production](runbooks/netlify-production-release.md). Les portes
automatisées sont détaillées dans [Tests et portes qualité](testing.md).

## Rollback

1. Publier à nouveau le dernier deploy Netlify sain.
2. Suspendre temporairement le worker e-mail si l’incident concerne l’outbox ou
   le fournisseur.
3. Ne jamais réécrire une migration déjà appliquée ; utiliser une migration
   compensatoire revue et une sauvegarde Supabase validée.
4. Suspendre les nouvelles déclarations et confirmations si l’application et le
   schéma ne sont plus compatibles.
5. Exécuter de nouveau le health check et les smoke tests critiques avant de
   rouvrir le service.

Voir aussi [Exploitation Supabase](database-operations.md) et
[E-mails transactionnels](transactional-email.md).
