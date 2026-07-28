# ADR-0001 : exécution financière exclusivement externe

| Élément | Valeur |
| --- | --- |
| Statut | Accepté |
| Date | 2026-07-27 |
| Propriétaire | Équipe Monalyz |

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
