# Documentation Monalyz

> Point d’entrée de la documentation technique et opérationnelle.

## Parcours recommandé

1. [Installation](setup.md) pour lancer l’application et Supabase.
2. [Authentification](authentication.md) pour les sessions et liens e-mail.
3. [E-mails transactionnels](transactional-email.md) pour choisir Resend ou Brevo.
4. [Comptes de démonstration](demo-accounts.md) pour les accès de test.
5. [Exploitation Supabase](database-operations.md) pour les migrations et snapshots.
6. [Architecture](architecture.md) pour comprendre les frontières de confiance.
7. [Modèle de données](data-model.md) pour les machines d’état et invariants.
8. [Tests](testing.md) avant toute modification métier.

## Carte documentaire

| Document | Public |
| --- | --- |
| [Installation](setup.md) | Développeurs |
| [Architecture](architecture.md) | Développeurs et reviewers |
| [Authentification](authentication.md) | Développeurs et opérateurs |
| [Comptes de démonstration](demo-accounts.md) | Testeurs et opérateurs |
| [E-mails transactionnels](transactional-email.md) | Opérateurs |
| [Exploitation Supabase](database-operations.md) | Développeurs et opérateurs |
| [Environnement](environment.md) | Développeurs et opérateurs |
| [Modèle de données](data-model.md) | Backend et conformité |
| [API](api.md) | Frontend et backend |
| [Tests](testing.md) | Contributeurs |
| [Déploiement](deployment.md) | Opérateurs |
| [Incident de preuve externe](runbooks/external-evidence-incident.md) | Opérateurs |
| [ADR-0001](adr/0001-external-financial-execution.md) | Tous |

## Règle de mise à jour

Toute modification d’un état financier, d’une RPC, d’une variable
d’environnement ou d’une commande doit mettre à jour le document canonique
correspondant. Une capacité planifiée doit être explicitement marquée comme telle.
