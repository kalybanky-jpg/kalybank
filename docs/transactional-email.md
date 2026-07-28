# E-mails transactionnels

> KALY utilise Supabase Auth comme point d’émission unique des e-mails
> d’identité. Le transport SMTP peut être Resend ou Brevo, un seul à la fois.

Cette configuration couvre la confirmation d’inscription, la récupération du
mot de passe et la notification de changement de mot de passe. Elle n’envoie
aucun ordre financier, ne confirme aucune exécution financière et ne crée
aucune connexion bancaire.

## Architecture

```text
Application KALY -> Supabase Auth -> SMTP sélectionné -> destinataire
                                  -> Resend ou Brevo

Développement local -> Supabase Auth -> Mailpit
```

Le fournisseur n’est pas choisi au runtime de l’application. Un script
d’administration applique atomiquement le profil sélectionné à Supabase Auth.
Les secrets SMTP ne sont donc jamais présents dans le bundle Next.js.

## Profils disponibles

| Profil | Hôte | Port | Identifiant | Secret |
| --- | --- | --- | --- | --- |
| Resend | `smtp.resend.com` | `587` | `resend` | Clé API Resend |
| Brevo | `smtp-relay.brevo.com` | `587` | Login SMTP Brevo | Clé SMTP Brevo |

Pour Brevo, une clé API ne remplace pas une clé SMTP. Pour les deux
fournisseurs, l’adresse d’expédition doit appartenir à un domaine vérifié.

## Préparation du domaine

1. réserver de préférence un sous-domaine dédié, par exemple `auth.kaly.tld` ;
2. vérifier ce domaine chez les deux fournisseurs si les deux doivent rester
   disponibles ;
3. publier les enregistrements SPF et DKIM fournis par chaque fournisseur ;
4. publier une politique DMARC et superviser progressivement ses rapports ;
5. désactiver le suivi et la réécriture des liens pour les e-mails Auth ;
6. garder les e-mails marketing sur un domaine ou flux distinct.

## Configuration Resend

```powershell
Copy-Item .env.email.resend.example .env.email.resend.local
# Renseigner le fichier local, puis prévalider sans mutation distante.
npx bun run auth:email:check:resend
# Appliquer uniquement après contrôle du project ref affiché.
npx bun run auth:email:configure:resend
```

## Configuration Brevo

```powershell
Copy-Item .env.email.brevo.example .env.email.brevo.local
# Renseigner le fichier local, puis prévalider sans mutation distante.
npx bun run auth:email:check:brevo
# Appliquer uniquement après contrôle du project ref affiché.
npx bun run auth:email:configure:brevo
```

Les fichiers `.env.email.*.local` restent hors Git. Les fichiers
`.env.email.*.example` décrivent les valeurs attendues sans contenir de secret.

## Variables d’administration

| Variable | Rôle |
| --- | --- |
| `SUPABASE_PROJECT_REF` | Projet hébergé à modifier explicitement |
| `SUPABASE_ACCESS_TOKEN` | Jeton Management API, requis seulement à l’application |
| `AUTH_SMTP_FROM_EMAIL` | Adresse expéditrice vérifiée |
| `AUTH_SMTP_SENDER_NAME` | Nom visible de l’expéditeur |
| `AUTH_EMAIL_RATE_LIMIT_PER_HOUR` | Limite Supabase d’e-mails par heure |
| `AUTH_SMTP_MAX_FREQUENCY_SECONDS` | Délai minimal entre deux demandes Auth |
| `RESEND_API_KEY` | Secret SMTP du profil Resend |
| `BREVO_SMTP_LOGIN` | Login SMTP du profil Brevo |
| `BREVO_SMTP_KEY` | Clé SMTP du profil Brevo |

Le jeton Supabase doit autoriser la lecture et l’écriture de la configuration
Auth du projet. Le script ne l’affiche jamais et ne compare jamais le mot de
passe SMTP lors de sa vérification distante.

## Ce que le script applique

- confirmation d’adresse obligatoire ;
- double confirmation des changements d’adresse ;
- réauthentification pour un changement sensible de mot de passe ;
- SMTP du fournisseur sélectionné ;
- limite horaire et délai anti-abus ;
- modèles versionnés dans `supabase/templates` ;
- notification de sécurité après changement de mot de passe.

Avant toute requête distante, les modèles sont aussi contrôlés : le script
refuse un fichier vide, surdimensionné ou privé des marqueurs indispensables au
parcours concerné (`SiteURL`, `TokenHash`, type Auth ou adresse du compte).

Après le `PATCH`, le script relit la configuration distante et compare tous les
champs non secrets. Une divergence provoque un échec explicite.

## Vérification opérationnelle

1. créer un compte de test sur l’environnement visé ;
2. contrôler la réception et le lien de confirmation ;
3. demander une récupération de mot de passe et terminer le parcours ;
4. contrôler l’alerte reçue après changement du mot de passe ;
5. vérifier les journaux Auth Supabase et le journal de livraison du
   fournisseur ;
6. supprimer le compte de test.

Ne passez pas en production tant que SPF, DKIM, DMARC, le domaine expéditeur,
les URL Auth et les trois parcours ci-dessus ne sont pas validés.

## Bascule et retour arrière

Il n’y a pas de bascule automatique : elle masquerait des incidents de
réputation, de quota ou de configuration DNS. Pour changer de fournisseur,
prévalidez puis exécutez la commande `configure` de l’autre profil. L’opération
remplace en une seule requête la configuration SMTP et conserve les mêmes
protections et modèles.

Conservez les deux fichiers locaux dans un coffre de secrets approprié et
révoquez immédiatement toute clé soupçonnée d’exposition.

Références officielles :
[SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp),
[modèles Supabase](https://supabase.com/docs/guides/auth/auth-email-templates),
[SMTP Resend](https://resend.com/docs/send-with-smtp) et
[SMTP Brevo](https://developers.brevo.com/docs/smtp-integration).
