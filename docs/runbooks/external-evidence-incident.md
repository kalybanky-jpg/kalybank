# Runbook : confirmation interne, solde ou document incohérent

> Procédure lorsqu’une confirmation d’exécution interne, un identifiant de
> compte, un solde ou un document officiel Monalyz est contesté.

## Symptômes

- confirmation interne illisible ou incompatible avec la référence ;
- montant ou devise différents de l’intention validée ;
- solde agrégé différent du dernier solde du grand livre ;
- IBAN, numéro de compte ou BIC différent de la source interne ;
- PDF absent, empreinte différente, snapshot erroné ou document révoqué ;
- dossier bloqué dans un ancien état `external_execution_recorded` ou
  `external_funding_recorded`.

## Actions immédiates

1. Ne pas finaliser l’opération et ne pas émettre de nouveau document.
2. Conserver les identifiants du dossier, du compte, des écritures et du
   document ainsi que les événements d’audit.
3. Comparer le statut, le montant, la devise, la référence interne et la
   séquence du grand livre avec la source tenue par le personnel de
   l’établissement.
4. Pour un PDF, comparer `snapshot_hash`, `content_hash`, la version et le
   chemin privé ; ne jamais rendre le bucket public pour diagnostiquer.
5. Faire confirmer le résultat par le chef d’agence, unique autorité de
   validation dans Monalyz.

## Correction

- Si l’exécution interne n’a pas eu lieu, utiliser la transition de rejet ou
  d’échec autorisée et documenter le motif.
- Si l’exécution a eu lieu mais n’est pas suffisamment confirmée, attendre une
  nouvelle confirmation interne ; une approbation seule ne justifie jamais un
  débit ou un crédit.
- Si un solde erroné a déjà été enregistré, le chef d’agence appelle
  `branch_manager_adjust_balance` avec le solde cible, la date de valeur, un
  motif explicite et une nouvelle clé d’idempotence. La correction devient une
  écriture additionnelle du grand livre.
- Si un PDF est incorrect, appeler
  `branch_manager_revoke_official_document` avec un motif, puis émettre une
  nouvelle version. Ne jamais remplacer silencieusement l’objet Storage.
- Si l’empreinte ou la séquence de grand livre ne peut pas être expliquée,
  suspendre les confirmations et escalader comme incident d’intégrité.

## Interdictions

- Ne jamais fabriquer une référence ou un justificatif.
- Ne jamais marquer un dossier réglé sur la seule base d’une approbation Monalyz.
- Ne jamais modifier directement une table métier pour contourner la machine d’état.
- Ne jamais modifier ou supprimer une écriture de
  `financial_ledger_entries`.
- Ne jamais présenter un compte ou document `is_demo` comme routable ou réel.
- Ne jamais connecter temporairement une API bancaire pour « réparer » un
  rapprochement.

Après résolution, vérifier l’équation
`balance_after_minor = balance_before_minor + amount_minor`, l’unicité des
références et l’accès propriétaire au document. Ajouter l’analyse de cause à
`audit_events` ou au système d’incident de l’organisation lorsqu’il sera
disponible.
