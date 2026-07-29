# ADR-0001 : exécution financière exclusivement externe

| Élément | Valeur |
| --- | --- |
| Statut | Remplacé par [ADR-0002](0002-internal-official-banking-register.md) |
| Date | 2026-07-27 |
| Propriétaire | Équipe Monalyz |

> [!NOTE]
> Cette décision est conservée comme historique. Le principe « aucune API
> bancaire, aucune exécution automatique » reste valide, mais le modèle à deux
> validateurs et le refus d’un registre de comptes ont été remplacés le
> 2026-07-29 par un chef d’agence unique et un registre bancaire officiel
> interne.

## Contexte

Monalyz doit initier et suivre des opérations sans banque connectée et sans API
bancaire. L’interface ne doit jamais laisser entendre qu’une approbation
applicative constitue un mouvement d’argent.

## Décision

Monalyz persiste une intention, réserve éventuellement un montant interne, exige
des contrôles humains distincts, puis attend une preuve d’exécution réalisée
hors application. Un second membre habilité confirme le règlement avant tout
ajustement de position.

## Conséquences

- Positive : la base distingue clairement intention, autorisation, preuve et règlement.
- Positive : l’audit conserve les acteurs et références de chaque étape.
- Négative : la confirmation et le rapprochement restent manuels.
- Négative : Monalyz ne peut pas garantir seul la finalité bancaire du mouvement.

## Alternatives écartées

- Simulation locale de comptes ou transactions : trompeuse et non auditable.
- Intégration d’une API bancaire : hors périmètre et explicitement interdite.
- Ajustement au moment de l’approbation : confond décision interne et exécution réelle.

## Suivi

Toute future intégration financière exigerait un nouvel ADR, une revue de menace,
un modèle de rapprochement et une autorisation explicite du propriétaire produit.

Le suivi actif de cette décision est désormais porté par
[ADR-0002](0002-internal-official-banking-register.md).
