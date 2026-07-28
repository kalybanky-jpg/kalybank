# Déploiement

> Checklist plateforme-agnostique ; aucune cible d’hébergement ni CI n’est actuellement configurée dans le dépôt.

## Prévol

1. Lier le dépôt au projet `qljqldhvbakornnpalua`.
2. Prévisualiser puis appliquer toutes les migrations versionnées.
3. Configurer les URL Auth et les quatre variables documentées dans
   [authentication.md](authentication.md).
4. Prévalider puis appliquer exactement un profil SMTP depuis
   [E-mails transactionnels](transactional-email.md).
5. Vérifier que les buckets créés par migration restent privés.
6. Régénérer et vérifier `supabase/schema.sql`.
7. Accorder les rôles staff seulement après création des comptes Auth.
8. Exécuter les portes qualité de [testing.md](testing.md).

## Build et démarrage

```powershell
npx bun install --frozen-lockfile
npx bun run build
npx bun run start
```

Les variables `NEXT_PUBLIC_*` doivent être présentes au moment du build.
`APP_ORIGIN` doit aussi être disponible au runtime.

## Smoke tests

- `/login` affiche « Aucune banque n’est connectée » sans erreur console.
- `/myaccount` sans session redirige vers `/login`.
- `/admin` sans session redirige vers `/admin-login`.
- un lien d’inscription confirme la session puis ouvre `/onboarding` ;
- un lien de récupération valide ouvre `/reset-pin?mode=update`, tandis qu’un
  accès direct sans session est refusé ;
- l’alerte de changement de mot de passe est reçue et le fournisseur ne
  réécrit aucun lien Auth ;
- le CSP contient un nonce et tous les scripts HTML utilisent ce même nonce ;
- l’API de justificatifs refuse session absente, origine étrangère, fichier
  trop volumineux et contenu dont la signature ne correspond pas au MIME ;
- un transfert de test ne change pas la position avant confirmation externe.

## Rollback

1. Redéployer la version applicative précédente.
2. Ne jamais rétrograder une migration destructivement sans migration inverse
   revue et sauvegarde validée.
3. Suspendre les nouvelles transitions externes si le schéma et l’application
   ne sont plus compatibles.

## État plateforme

La base distante Supabase est identifiée et les migrations sont gérées depuis
le dépôt. Il n’existe encore aucun fichier Vercel, Netlify, Render, Cloudflare,
Docker de production ou workflow CI. Ajouter une cible applicative explicite
avant le premier déploiement ; ne pas considérer `next start` comme une
stratégie d’exploitation complète.
