# ADR-0002 : registre bancaire officiel interne

| Élément | Valeur |
| --- | --- |
| Statut | Accepté |
| Date | 2026-07-29 |
| Propriétaire | Équipe Monalyz |
| Remplace | [ADR-0001](0001-external-financial-execution.md) |

## Contexte

Le MVP Monalyz doit présenter les éléments attendus d’un espace bancaire :
comptes, IBAN, soldes, virements, prêts et documents officiels. Pour autant,
aucune API bancaire, aucun agrégateur et aucun système de paiement n’est
connecté. Le personnel de l’établissement effectue les contrôles, créations de
comptes et exécutions dans ses procédures internes, hors Monalyz.

L’application doit donc être utile comme source institutionnelle déclarée et
auditable, sans laisser croire qu’elle commande elle-même un mouvement réel.
Le processus MVP désigne le chef d’agence comme unique autorité de validation
dans l’application après le travail du personnel interne.

## Décision

Monalyz devient le registre bancaire numérique officiel interne de ce
périmètre :

- `financial_positions` porte les comptes enrichis et leur solde courant ;
- `financial_ledger_entries` conserve un grand livre append-only de toute
  variation effective ;
- `official_documents` fige les snapshots, versions, empreintes, émetteurs et
  révocations ; les PDF sont stockés dans un bucket privé ;
- le chef d’agence actif (`admin`) est l’unique rôle autorisé à déclarer un
  compte, ajuster un solde, valider/finaliser une opération et émettre ou
  révoquer un document ;
- l’approbation d’un virement ou d’un prêt n’entraîne aucun mouvement ;
- le débit du virement ou le crédit du prêt n’est enregistré qu’après
  confirmation par le chef d’agence que le personnel a déjà effectué
  l’opération dans les procédures internes ;
- toutes les mutations passent par des RPC idempotentes et atomiques ;
- les comptes et documents de démonstration sont synthétiques, portent
  `is_demo = true` et un filigrane explicite ;
- l’architecture de langue préférée et les e-mails Resend/Brevo demeure
  inchangée.

« Officiel » signifie émis, déclaré et traçable par l’établissement dans
Monalyz. Ce terme ne signifie pas synchronisé avec une banque tierce, certifié
par un réseau de paiement ou exécuté automatiquement.

## Invariants non négociables

1. Aucune clé, URL ou dépendance d’API bancaire n’entre dans le runtime.
2. Aucun clic d’approbation ne débite ou ne crédite un compte.
3. Toute variation de solde est atomique avec une écriture append-only.
4. Une correction crée une nouvelle écriture motivée ; elle ne réécrit jamais
   le grand livre.
5. Les documents officiels sont privés, versionnés, empreintés et révocables
   sans suppression de leur historique.
6. Le chef d’agence confirme dans Monalyz un fait déjà accompli par le
   personnel interne ; Monalyz ne réalise pas ce fait.

## Conséquences

- Positive : l’utilisateur retrouve les objets bancaires essentiels dans une
  interface cohérente.
- Positive : les soldes et documents disposent d’une provenance auditable.
- Positive : le système reste exploitable sans intégration bancaire.
- Négative : la fraîcheur des données dépend de la déclaration humaine.
- Négative : une procédure de rapprochement et de correction motivée est
  nécessaire en cas d’écart avec les sources internes.
- Risque : le mot « officiel » peut être surinterprété ; l’interface et les
  documents doivent rappeler l’absence de routage pour toute fixture démo et
  l’absence d’exécution automatique.

## Alternatives écartées

- Restaurer les simulations historiques en mémoire ou `localStorage` :
  identifiants non fiables, mouvements immédiats et absence d’audit.
- Connecter une API bancaire : explicitement hors périmètre du MVP.
- Conserver uniquement des « positions » masquées sans comptes ni documents :
  ne répond pas au besoin produit.
- Réintroduire deux validateurs applicatifs : incompatible avec l’organisation
  MVP où le chef d’agence est l’unique autorité dans Monalyz.

## Conditions de révision

Toute future connexion à un core banking, un agrégateur, un réseau de paiement
ou une API de banque exige un nouvel ADR, une analyse de menaces, une stratégie
de rapprochement et une autorisation explicite du propriétaire produit.
