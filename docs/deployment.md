# Déploiement

> Checklist plateforme-agnostique. Le workflow CI du dépôt valide la qualité,
> le build et la base locale ; aucune cible d’hébergement n’est encore
> configurée.

## Prévol

1. Lier le dépôt au projet `qljqldhvbakornnpalua`.
2. Prévisualiser puis appliquer toutes les migrations versionnées.
3. Configurer les URL Auth et les quatre variables documentées dans
   [authentication.md](authentication.md).
4. Prévalider puis appliquer exactement un profil SMTP depuis
   [E-mails transactionnels](transactional-email.md).
5. Vérifier que `kyc-evidence`, `loan-evidence`,
   `external-execution-evidence` et `official-documents` restent privés ; le
   dernier n’accepte que des PDF de 10 Mo maximum.
6. Régénérer et vérifier `supabase/schema.sql`.
7. Accorder les rôles staff seulement après création des comptes Auth.
8. Exécuter les portes qualité de [testing.md](testing.md).

## Build et démarrage

```powershell
bun install --frozen-lockfile
bun run build
bun run start
```

Bun 1.3.14 est fixé dans `package.json` et `bun.lock` est l’unique lockfile.
Node.js 20.9 ou ultérieur reste requis par Next.js pour les outils qui
s’exécutent avec Node.

Les variables `NEXT_PUBLIC_*` doivent être présentes au moment du build.
`APP_ORIGIN` doit aussi être disponible au runtime.

Le workflow [CI](../.github/workflows/ci.yml) exécute sur chaque pull request et
chaque push l’installation gelée, le lint sans avertissement, le typecheck, les
tests TypeScript/TSX et le build. Un job séparé démarre Supabase localement,
réinitialise la base, lance toutes les suites pgTAP puis les contrôles de schéma
et les conseillers sécurité/performance.

## Smoke tests

- `/login` indique sans ambiguïté qu’aucune API bancaire n’est connectée et que
  les exécutions sont prises en charge en interne par l’établissement.
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
- le chef d’agence peut déclarer un compte avec IBAN après configuration du
  préfixe ; la base attribue automatiquement son numéro unique de 10 chiffres ;
- le client propriétaire voit son numéro de compte et son grand livre, jamais
  son IBAN dans les nouveaux écrans ou documents ;
- un document de coordonnées ou relevé émis est téléchargeable en PDF privé par son propriétaire,
  tandis qu’un autre client reçoit `404` ;
- tout PDF démo affiche « DÉMONSTRATION — AUCUNE VALEUR » ;
- une approbation de virement ne change pas le solde ; seule la confirmation
  par le chef d’agence après exécution interne ajoute le débit au grand livre ;
- une approbation de prêt ne change pas le solde ; seule la confirmation du
  décaissement interne crédite le compte courant ;
- aucun appel réseau n’est effectué vers une API bancaire ou un agrégateur.

## Rollback

1. Redéployer la version applicative précédente.
2. Ne jamais rétrograder une migration destructivement sans migration inverse
   revue et sauvegarde validée.
3. Suspendre les nouvelles déclarations et confirmations internes si le schéma
   et l’application ne sont plus compatibles.

## État plateforme

La base distante Supabase est identifiée, les migrations sont gérées depuis le
dépôt et un workflow CI vérifie l’application ainsi qu’une base locale jetable.
Il n’existe encore aucun fichier Vercel, Netlify, Render, Cloudflare ou Docker
de production. Ajouter une cible applicative explicite avant le premier
déploiement ; ne pas considérer `next start` comme une stratégie d’exploitation
complète.
