# Runbook : mise en production Netlify

> Procédure humaine de liaison, configuration, recette, publication et rollback
> de Monalyz. Les protections applicatives sont versionnées ; le dépôt ne
> prouve pas qu’un site Netlify a déjà été créé ou publié.

## En un coup d’œil

| Élément | Valeur |
| --- | --- |
| Application | Next.js sur Netlify |
| Données, Auth et fichiers | Supabase `qljqldhvbakornnpalua` |
| Branche de production attendue | `main` |
| Health check | `GET /api/health` |
| Worker | `transactional-email-worker`, chaque minute, deploy publié uniquement |
| Responsable du go/no-go | Release manager humain |
| Prérequis bloquant | CI verte, secrets valides, domaine et Supabase configurés |
| Docker local | Non requis ; les portes base s’exécutent dans GitHub Actions |

## Ce qui est déjà automatisé dans le dépôt

- `netlify.toml` fixe `bun run build:netlify`, `.next`, Bun 1.3.14, Node.js 22, le
  dossier des fonctions et `@netlify/plugin-nextjs` 5.15.13. La commande
  prépare puis vérifie les dépendances natives Linux x64 ; une archive/API
  n’est autorisée que si elle est produite par cette commande ;
- le worker exporte son cron `* * * * *` avec le type
  `@netlify/functions`, lit sa configuration avec `Netlify.env`, ne possède pas
  de route publique et ne renvoie aucun corps ;
- la CI exécute lint, typecheck, tests et build, puis une porte Supabase dans un
  runner GitHub isolé ;
- le runner base régénère le snapshot SQL, le publie comme artefact temporaire,
  compare la copie commitée et exécute pgTAP, lint, advisors et types ;
- les sources JPEG, PNG et WebP jusqu’à 25 Mio sont compressées
  progressivement au-delà de 3,5 Mo dans le navigateur, avec un plus grand
  côté de 3 200 px ;
- les PDF restent byte-identiques ;
- les fichiers partent directement du navigateur vers le bucket privé
  `upload-staging`, puis sont finalisés par petits JSON et déplacement
  Storage-vers-Storage ;
- la validation d’une preuve ne lit qu’au plus 4 Kio par `Range` et les PDF officiels
  sont servis par redirection `307` vers une URL signée pendant 60 secondes ;
- la migration de durcissement crée le staging privé à 10 Mio et ferme les
  privilèges `EXECUTE` aux rôles non autorisés ;
- `GET /api/health` retourne un statut minimal sans divulguer de secret.

## Actions humaines obligatoires

| Domaine | Action | Preuve attendue |
| --- | --- | --- |
| Netlify | Créer ou ouvrir le site, relier le dépôt GitHub et choisir `main` comme branche de production | Site ID, dépôt et branche visibles dans les réglages |
| Build | Confirmer que les réglages du dashboard ne surchargent pas `netlify.toml` | Deploy log avec Bun 1.3.14, Node.js 22, `bun run build:netlify` et la validation des dépendances Linux |
| Environnement | Saisir les variables et secrets par contexte | Liste des noms et portées, jamais les valeurs |
| Région | Sélectionner une région Functions européenne disponible, au plus près du projet Supabase `eu-west-3` | Région consignée dans la fiche de release |
| Domaine | Ajouter le domaine canonique, valider le DNS et attendre le certificat SSL Netlify | HTTPS valide sans avertissement |
| E-mail/DNS | Valider le domaine fournisseur et publier SPF, DKIM, DMARC et MX | Contrôles fournisseur et DNS verts |
| Supabase Auth | Renseigner Site URL, redirects, hook e-mail, SMTP et protection mot de passe | Capture ou export de configuration sans secret |
| Continuité | Vérifier sauvegardes, restauration, quotas et alertes de budget | Politique et test de restauration consignés |
| Monitoring | Créer les moniteurs et destinations d’alerte | Test d’alerte reçu par l’astreinte |
| Recette | Recetter un Deploy Preview, puis le deploy publié | Checklist signée et commit SHA |
| Go/no-go | Autoriser explicitement la publication ou déclencher le rollback | Décision et responsable horodatés |

## 1. Valider la version candidate

1. Geler le commit candidat et noter son SHA.
2. Lancer la CI. Si **Database** échoue uniquement sur la comparaison du
   snapshot après une migration, télécharger l’artefact généré, le relire,
   remplacer `supabase/schema.sql`, committer puis relancer toute la CI.
3. Exiger les jobs GitHub Actions **Application** et **Database** verts.
4. Télécharger l’artefact `database-schema-snapshot-<run_attempt>` final et
   confirmer qu’il correspond au snapshot commité et ne contient aucune donnée.
5. Exécuter `bun run db:deploy:check` contre le projet lié après la CI.
6. Relire la migration de durcissement et confirmer qu’aucune migration
   distante imprévue n’apparaît.
7. Confirmer qu’aucun secret, `.env` réel ou artefact utilisateur n’est présent
   dans le diff.

Ne pas lancer Docker sur le poste local. Si la porte Database échoue, corriger
la branche et relancer la CI ; ne pas contourner pgTAP ou les advisors.

## 2. Relier et configurer Netlify

1. Créer ou sélectionner le site Netlify de production.
2. Relier le dépôt GitHub Monalyz et définir `main` comme branche de
   production.
3. Conserver les réglages versionnés de `netlify.toml`. Supprimer toute
   surcharge de commande, dossier publié ou version runtime qui les contredit.
4. Choisir une région Functions européenne disponible, proche de la région
   Supabase `eu-west-3`.
5. Configurer les variables de
   [l’environnement](../environment.md) dans le dashboard, avec leurs portées
   Build/Functions et leur contexte exact.
6. Pour Production, saisir les origines HTTPS canoniques, le projet Supabase de
   production, `SUPABASE_SECRET_KEY`, `SEND_EMAIL_HOOK_SECRET` et un seul
   fournisseur e-mail.
7. Pour Deploy Preview, utiliser des services non productifs. Ne jamais donner
   un secret de production à une PR non approuvée.
8. Après avoir obtenu l’URL stable de la preview, la recopier exactement dans
   `APP_ORIGIN` et `NEXT_PUBLIC_APP_ORIGIN`, puis relancer ce deploy avant toute
   recette authentifiée.

## 3. Configurer domaine, SSL et DNS e-mail

1. Ajouter le domaine applicatif canonique au site Netlify.
2. Publier les enregistrements DNS demandés par Netlify et attendre leur
   propagation.
3. Attendre un certificat SSL valide, puis forcer l’usage de HTTPS.
4. Valider le domaine expéditeur auprès de Resend ou Brevo.
5. Publier les DKIM fournis par le prestataire.
6. Maintenir un seul enregistrement SPF ; fusionner les mécanismes nécessaires
   au lieu d’ajouter plusieurs enregistrements SPF concurrents.
7. Publier DMARC avec une adresse de rapport surveillée. Commencer par une
   politique d’observation si le domaine n’a aucun historique, puis renforcer
   vers `quarantine` ou `reject` après analyse.
8. Configurer les MX du domaine si `TRANSACTIONAL_EMAIL_REPLY_TO` ou l’adresse
   support doit recevoir des réponses.
9. Tester l’alignement SPF/DKIM/DMARC et la réception sur plusieurs fournisseurs
   de boîtes mail.

## 4. Configurer Supabase

1. Après une CI verte et le dry-run, appliquer les migrations par un seul
   opérateur avec `bun run db:deploy`.
2. Comparer la liste distante au dossier local et exécuter les advisors.
3. Confirmer que `upload-staging` est privé, limité à 10 Mio et restreint à
   PDF/JPEG/PNG/WebP/SVG.
4. Confirmer que `anon` ne peut exécuter aucune fonction applicative, que
   `authenticated` conserve uniquement les RPC prévues et que `service_role`
   garde les RPC de worker et de PDF.
5. Définir la **Site URL** Auth sur l’origine HTTPS canonique.
6. Ajouter uniquement les redirect URLs exactes et approuvées. Une preview ne
   doit être ajoutée que si elle utilise un environnement non productif et une
   URL stable contrôlée.
7. Configurer le Send Email Hook vers
   `https://<domaine-canonique>/api/auth/send-email-hook` et saisir le même
   secret dans Supabase et Netlify.
8. Appliquer et relire le profil SMTP Resend ou Brevo décrit dans
   [E-mails transactionnels](../transactional-email.md).
9. Activer la protection contre les mots de passe compromis avec HIBP. Cette
   protection exige un plan Supabase Pro ou supérieur ; effectuer la mise à
   niveau ou consigner explicitement le blocage avant le go-live.
10. Vérifier la politique de sauvegarde, la rétention et, si le plan le permet,
    le PITR. Exécuter un test de restauration dans un environnement isolé.
11. Relever les quotas base, Storage, bande passante, Auth et e-mail ; configurer
    les alertes de consommation et de budget avant l’ouverture.

## 5. Configurer le monitoring

Créer des alertes actionnables avec un propriétaire et une destination
d’astreinte :

- moniteur HTTPS externe sur `/api/health`, attendu `200` et
  `{ "status": "ok" }` ;
- taux de `5xx`, erreurs de fonctions et durée des invocations Netlify ;
- absence d’invocation du worker après publication, événements
  `transactional_email_worker_failed` et finalisations incomplètes ;
- jobs outbox `pending` trop anciens, nombre de `failed` et croissance anormale
  des nouvelles tentatives ;
- erreurs Auth, Storage, base, advisors et consommation des quotas Supabase ;
- rejets, bounces, plaintes et dégradation de délivrabilité chez le fournisseur
  e-mail ;
- expiration SSL et anomalies DNS critiques.

Provoquer au moins une alerte non destructive et confirmer sa réception. Un
moniteur créé mais jamais testé ne satisfait pas la porte de production.

## 6. Recetter le Deploy Preview

La planification automatique ne s’exécute pas sur Deploy Preview.

1. Déployer le commit candidat dans une preview avec des secrets non
   productifs et les origines exactes.
2. Vérifier `/login`, les redirections protégées, l’inscription, la récupération
   et le hook e-mail.
3. Appeler `/api/health` et exiger `200`.
4. Envoyer une preuve JPEG ou PNG de plus de 3,5 Mo. Vérifier dans les outils
   réseau que les octets partent vers Supabase, pas vers une route Netlify, et
   que l’objet préparé respecte la limite. Recetter WebP dans le parcours de
   marque de l’étape 7.
5. Envoyer un PDF de test proche de 10 Mio, comparer son empreinte avant et
   après Storage et confirmer qu’il reste byte-identique.
6. Tenter un fichier trop volumineux, vide et à signature incohérente ; exiger
   leur refus et l’absence d’objet final.
7. Publier une source de marque PNG/WebP supérieure à 5 Mio et inférieure à
   25 Mio, vérifier sa compression sous 5 Mio puis contrôler les assets
   générés. Tester aussi un SVG autorisé.
8. Émettre un document officiel, confirmer la réponse `307`, la validité de
   l’URL signée pendant 60 secondes et le refus pour un autre utilisateur.
9. Déclencher **Run now** sur la fonction planifiée. Vérifier un lot maximal de
   cinq jobs, la concurrence de deux, les journaux structurés et l’absence de
   corps retourné par le handler.
10. Provoquer un échec fournisseur contrôlé et confirmer le timeout de trois
    secondes, la remise en attente et l’absence de doublon.
11. Exécuter les smoke tests financiers et de CSP de
    [Déploiement](../deployment.md).

Tout écart critique produit un **no-go**. Corriger sur une nouvelle branche,
laisser repasser la CI et recréer la preview ; ne pas corriger directement le
deploy ou la base depuis une console.

## 7. Publier en production

1. Confirmer que les secrets Production, le domaine, SSL, DNS e-mail, Supabase
   Auth, le hook, SMTP, les sauvegardes et le monitoring sont verts.
2. Confirmer que la migration requise est appliquée avant l’activation des
   nouveaux parcours d’upload.
3. Faire approuver le commit SHA et la checklist par le release manager.
4. Fusionner ou promouvoir exclusivement ce commit sur `main` selon le flux
   Git retenu.
5. Vérifier dans Netlify que le deploy publié correspond au SHA approuvé et que
   le build n’a utilisé aucune surcharge.
6. Rejouer immédiatement le health check, l’authentification, un upload direct,
   un PDF officiel et un e-mail de test avec des données synthétiques.
7. Observer au moins deux invocations automatiques du worker. Confirmer leur
   cadence, l’absence de doublon et l’absence de job bloqué.
8. Confirmer la réception des alertes de test, puis clore le go-live avec le
   SHA, l’URL, l’heure, l’opérateur et le résultat des smoke tests.

## 8. Rollback

Déclencher le rollback si le health check échoue durablement, si Auth ou les
uploads sont indisponibles, si un document est exposé au mauvais utilisateur,
si une anomalie de grand livre apparaît ou si le worker duplique des e-mails.

1. Déclarer l’incident, geler les nouvelles publications et noter le premier
   symptôme.
2. Si des e-mails indésirables partent, révoquer temporairement la clé API chez
   le fournisseur pour arrêter les envois, puis préparer une révision qui
   désactive la planification. Ne pas supprimer les jobs d’outbox.
3. Republier dans Netlify le dernier deploy sain connu.
4. Vérifier que ses variables et son schéma restent compatibles. Une migration
   déjà appliquée n’est jamais réécrite ou rétrogradée ; utiliser une migration
   compensatoire revue si nécessaire.
5. Pour une corruption ou indisponibilité de données, suspendre les mutations,
   conserver les journaux et faire restaurer une sauvegarde dans un
   environnement isolé avant toute décision sur la production.
6. Rejouer `/api/health`, Auth, upload, PDF, outbox et les contrôles financiers
   critiques.
7. Réactiver le trafic et les e-mails seulement après une nouvelle décision
   humaine de go.
8. Documenter la cause, l’impact, la fenêtre, le deploy restauré et les actions
   correctives.

## Fiche de clôture

- [ ] SHA candidat et SHA publié identiques
- [ ] CI Application et Database vertes
- [ ] Snapshot SQL régénéré, archivé et sans diff
- [ ] Migration distante et advisors vérifiés
- [ ] Site/dépôt/branche Netlify reliés
- [ ] Variables par contexte et région UE vérifiées
- [ ] Domaine, SSL, SPF, DKIM, DMARC et MX vérifiés
- [ ] Site URL, redirects, hook, SMTP et HIBP vérifiés
- [ ] Sauvegardes, restauration, quotas et budget vérifiés
- [ ] Monitoring testé
- [ ] Deploy Preview recetté
- [ ] Production recettée et worker observé
- [ ] Rollback connu et dernier deploy sain identifié
- [ ] Go/no-go signé par un humain

Voir aussi [Variables d’environnement](../environment.md),
[Exploitation Supabase](../database-operations.md),
[Tests et portes qualité](../testing.md) et
[E-mails transactionnels](../transactional-email.md).
