# Documentation Monalyz

> Point d’entrée de la documentation technique et opérationnelle.

## Parcours recommandé

1. [Installation](setup.md) pour lancer l’application et Supabase.
2. [Authentification](authentication.md) pour les sessions et liens e-mail.
3. [E-mails transactionnels](transactional-email.md) pour choisir Resend ou Brevo.
4. [Modèle vierge avec admin démo](clean-admin-baseline.md) pour la base locale/CI minimale.
5. [Comptes de démonstration](demo-accounts.md) pour les jeux fonctionnels complets.
6. [Exploitation Supabase](database-operations.md) pour les migrations et snapshots.
7. [Architecture](architecture.md) pour comprendre les frontières de confiance.
8. [ADR-0002](adr/0002-internal-official-banking-register.md) pour la décision
   de registre bancaire interne.
9. [Modèle de données](data-model.md) pour les comptes, le grand livre, les
   documents, machines d’état et invariants.
10. [Tests](testing.md) avant toute modification métier.
11. [Déploiement Netlify](deployment.md) puis
    [runbook de mise en production](runbooks/netlify-production-release.md)
    pour préparer, publier, recetter et revenir en arrière.

## Carte documentaire

| Document | Public |
| --- | --- |
| [Installation](setup.md) | Développeurs |
| [Architecture](architecture.md) | Développeurs et reviewers |
| [Authentification](authentication.md) | Développeurs et opérateurs |
| [Modèle vierge avec admin démo](clean-admin-baseline.md) | Développeurs et testeurs |
| [Comptes de démonstration](demo-accounts.md) | Testeurs et opérateurs |
| [E-mails transactionnels](transactional-email.md) | Opérateurs |
| [Exploitation Supabase](database-operations.md) | Développeurs et opérateurs |
| [Environnement](environment.md) | Développeurs et opérateurs |
| [Modèle de données](data-model.md) | Backend et conformité |
| [API](api.md) | Frontend et backend |
| [Tests](testing.md) | Contributeurs |
| [Déploiement](deployment.md) | Opérateurs |
| [Mise en production Netlify](runbooks/netlify-production-release.md) | Release manager et opérateurs |
| [Incident de confirmation ou document](runbooks/external-evidence-incident.md) | Opérateurs |
| [ADR-0001 — remplacé](adr/0001-external-financial-execution.md) | Historique |
| [ADR-0002 — registre bancaire interne](adr/0002-internal-official-banking-register.md) | Tous |

## Règle de mise à jour

Toute modification d’un état financier, d’une RPC, d’une variable
d’environnement ou d’une commande doit mettre à jour le document canonique
correspondant. Une capacité planifiée doit être explicitement marquée comme telle.
