# Authentification

> Supabase Auth gère les identités applicatives. Aucune identité bancaire,
> API bancaire ou connexion à un établissement financier n’est utilisée.

## Parcours pris en charge

| Parcours | Entrée | Validation serveur | Sortie |
| --- | --- | --- | --- |
| Inscription | `/register` | `/auth/confirm` avec `token_hash` | `/onboarding` |
| Connexion utilisateur | `/login` | Mot de passe Supabase Auth | `/myaccount` ou `/onboarding` |
| Connexion staff | `/admin-login` | Mot de passe puis rôle SQL actif | `/admin` |
| Mot de passe oublié | `/reset-pin` | `/auth/confirm` avec type `recovery` | `/reset-pin?mode=update` |
| Callback PKCE | Fournisseur Auth | `/auth/callback` avec `code` | Chemin interne autorisé |

Le Proxy renouvelle les cookies de session avec `getClaims()`, protège les
routes utilisateur et staff, puis vérifie `current_app_role` avant tout accès
au Back-Office. La possession d’un compte Auth ne confère jamais un rôle staff.

## Langue avant et après l’inscription

Les pages `/login`, `/register`, `/admin-login` et `/reset-pin` utilisent la
langue globale dès leur premier rendu. Le serveur s’appuie sur
`Accept-Language`, puis le navigateur confirme l’ordre de préférence exposé
par `navigator.languages`. Un sélecteur reste disponible avant et après
connexion ; sa valeur explicite gagne toujours sur la détection automatique.

À l’inscription, la langue courante est transmise dans
`user_metadata.preferred_language`. Le trigger de création du profil ne
recopie que `fr`, `en`, `de` ou `es`, avec `fr` comme repli. Cette métadonnée
est modifiable par l’utilisateur et ne participe jamais à une décision
d’autorisation.

Les e-mails Supabase Auth de confirmation et de récupération restent un flux
distinct des notifications métier. Leur localisation complète dépend de la
configuration des modèles Auth ; la préférence enregistrée permet de
l’ajouter sans modifier le modèle d’autorisation.

## Configuration Supabase hébergée

Avant le premier déploiement :

1. définir l’URL du site avec l’origine HTTPS canonique de l’application ;
2. autoriser exactement `<origine>/auth/callback` dans les Redirect URLs ;
3. activer la confirmation des adresses e-mail ;
4. imposer dix caractères minimum avec lettres et chiffres ;
5. activer la protection de changement de mot de passe ;
6. choisir et appliquer un des profils documentés dans
   [E-mails transactionnels](transactional-email.md) ;
7. vérifier les modèles versionnés de confirmation, récupération et
   notification de changement de mot de passe ;
8. désactiver le suivi et la réécriture des liens chez le fournisseur.

Les modèles utilisent `{{ .SiteURL }}`, `{{ .TokenHash }}` et un type OTP
constant. La route serveur refuse les types inconnus, les redirections externes
et toute origine applicative non HTTP(S).

## Cookies et redirections

- Seules les bibliothèques `@supabase/ssr` et `@supabase/supabase-js` gèrent la session.
- Les réponses de confirmation et de callback portent `Cache-Control: no-store`.
- `APP_ORIGIN` est obligatoire en production afin de ne jamais faire confiance
  à un en-tête Host arbitraire.
- Les paramètres `next` sont limités aux chemins internes normalisés.
- Aucun token, secret ou rôle `service_role` n’est envoyé au navigateur.

## Récupération

Une page `mode=update` sans session de récupération valide est renvoyée vers
le formulaire avec une erreur neutre. Après modification réussie, toutes les
données de session présentes dans le navigateur sont supprimées et
l’utilisateur doit se reconnecter.

## Limites d’exploitation

Le SMTP par défaut Supabase est destiné au test et applique des quotas stricts.
Une authentification de production n’est considérée opérationnelle qu’après
configuration d’un SMTP dédié, de ses enregistrements DNS et d’une supervision
des échecs d’envoi. Monalyz fournit deux profils mutuellement exclusifs, Resend et
Brevo ; aucun secret fournisseur n’est chargé par l’application.
