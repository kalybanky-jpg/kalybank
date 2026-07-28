# Runbook : preuve externe incohérente ou indisponible

> Procédure lorsque la référence, le justificatif ou la confirmation d’une opération externe est contesté.

## Symptômes

- preuve illisible, expirée ou incompatible avec la référence ;
- montant ou devise différents de l’intention ;
- même acteur tenté comme exécutant et confirmateur ;
- dossier bloqué à `external_execution_recorded` ou `external_funding_recorded`.

## Actions immédiates

1. Ne pas confirmer le règlement.
2. Conserver l’identifiant public du dossier et les événements d’audit.
3. Vérifier le statut, les checks, l’exécutant et la référence externe en base.
4. Comparer avec le justificatif original fourni par le système externe.

## Correction

- Si l’exécution n’a pas eu lieu, utiliser la transition de rejet ou d’échec
  autorisée et documenter le motif.
- Si la preuve est invalide, demander une nouvelle preuve ; ne pas remplacer
  silencieusement l’historique.
- Si un ajustement interne erroné a déjà été confirmé, un administrateur utilise
  `adjust_financial_position` avec un motif explicite après revue.

## Interdictions

- Ne jamais fabriquer une référence ou un justificatif.
- Ne jamais marquer un dossier réglé sur la seule base d’une approbation KALY.
- Ne jamais modifier directement une table métier pour contourner la machine d’état.

Après résolution, ajouter l’analyse de cause à `audit_events` ou au système
d’incident de l’organisation lorsqu’il sera disponible.
