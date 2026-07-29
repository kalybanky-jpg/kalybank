import type { Language } from './types';

interface BankingMessages {
  common: {
    unavailable: string;
    internalOperationsNotice: string;
  };
  header: {
    userTitle: string;
    adminTitle: string;
    subtitle: string;
    openMenu: string;
    notifications: string;
    sessionMenu: string;
    adminSession: string;
    userSession: string;
    logout: string;
  };
  dashboard: {
    eyebrow: string;
    title: string;
    subtitle: string;
    balances: string;
    balanceSource: string;
    showBalances: string;
    hideBalances: string;
    declaredBalance: string;
    reconciledBalance: string;
    updatedAt: string;
    iban: string;
    ibanPending: string;
    noAccounts: string;
    identityCheck: string;
    identityApproved: string;
    identityRejected: string;
    identityPending: string;
    identityMissing: string;
    identityApprovedHint: string;
    identityPendingHint: string;
    identityRejectedHint: string;
    identityMissingHint: string;
    makeTransfer: string;
    makeTransferHint: string;
    applyForLoan: string;
    applyForLoanHint: string;
    recentTransfers: string;
    noTransfers: string;
    recentTransactions: string;
    noTransactions: string;
  };
  accounts: {
    eyebrow: string;
    title: string;
    subtitle: string;
    availableBalance: string;
    accountStatus: string;
    activeAccount: string;
    lastUpdate: string;
    iban: string;
    ibanPending: string;
    noAccounts: string;
    recentTransactions: string;
    recentTransactionsHint: string;
    downloadStatement: string;
    noTransactions: string;
  };
  transfers: {
    eyebrow: string;
    title: string;
    subtitle: string;
    newTransfer: string;
    searchPlaceholder: string;
    progress: string;
    progressHint: string;
    noTransfers: string;
    statuses: Record<
      | 'submitted'
      | 'under_review'
      | 'approved_for_external_execution'
      | 'external_execution_recorded'
      | 'external_settlement_confirmed'
      | 'rejected'
      | 'cancelled'
      | 'external_failed',
      string
    >;
  };
  loans: {
    eyebrow: string;
    title: string;
    subtitle: string;
    newLoan: string;
    simulatedDuration: string;
    months: string;
    indicativePayment: string;
    progress: string;
    progressHint: string;
    noLoans: string;
    statuses: Record<
      | 'submitted'
      | 'under_review'
      | 'approved_for_external_funding'
      | 'external_funding_recorded'
      | 'external_settlement_confirmed'
      | 'rejected'
      | 'cancelled'
      | 'external_failed',
      string
    >;
  };
}

export const bankingMessages: Record<Language, BankingMessages> = {
  fr: {
    common: {
      unavailable: 'Non renseigné',
      internalOperationsNotice:
        'Tenue des comptes et exécution assurées en interne par le personnel de la banque, sans API bancaire externe.',
    },
    header: {
      userTitle: 'Espace bancaire Monalyz',
      adminTitle: 'Espace chef d’agence Monalyz',
      subtitle: 'Comptes et opérations gérés en interne par la banque',
      openMenu: 'Ouvrir le menu',
      notifications: 'Notifications',
      sessionMenu: 'Menu de session',
      adminSession: 'Chef d’agence habilité',
      userSession: 'Client authentifié',
      logout: 'Se déconnecter',
    },
    dashboard: {
      eyebrow: 'Votre banque en ligne',
      title: 'Vos comptes en un coup d’œil',
      subtitle:
        'Consultez vos soldes, vos IBAN et l’avancement de vos virements et prêts depuis votre espace sécurisé.',
      balances: 'Soldes de vos comptes',
      balanceSource: 'Soldes déclarés et tenus à jour par la banque',
      showBalances: 'Afficher les soldes',
      hideBalances: 'Masquer les soldes',
      declaredBalance: 'Solde déclaré',
      reconciledBalance: 'Solde rapproché',
      updatedAt: 'Mis à jour le',
      iban: 'IBAN',
      ibanPending: 'IBAN en cours d’attribution',
      noAccounts: 'Aucun compte bancaire n’est encore déclaré.',
      identityCheck: 'Vérification d’identité',
      identityApproved: 'Identité vérifiée',
      identityRejected: 'Dossier à corriger',
      identityPending: 'Vérification en cours',
      identityMissing: 'Dossier à compléter',
      identityApprovedHint: 'Votre dossier bancaire est validé.',
      identityPendingHint: 'Le personnel de la banque traite votre dossier.',
      identityRejectedHint: 'Consultez le motif du refus et complétez votre dossier.',
      identityMissingHint: 'Complétez la vérification pour activer vos services bancaires.',
      makeTransfer: 'Faire un virement',
      makeTransferHint: 'Envoyez votre demande depuis votre compte Monalyz',
      applyForLoan: 'Demander un prêt',
      applyForLoanHint: 'Simulez puis transmettez votre dossier de prêt',
      recentTransfers: 'Virements récents',
      noTransfers: 'Aucun virement pour le moment.',
      recentTransactions: 'Dernières opérations',
      noTransactions: 'Aucune opération finalisée.',
    },
    accounts: {
      eyebrow: 'Mes comptes',
      title: 'Comptes, soldes et IBAN',
      subtitle:
        'Retrouvez les coordonnées et les soldes déclarés de vos comptes Monalyz. Les mises à jour sont saisies par le personnel de la banque.',
      availableBalance: 'Solde disponible',
      accountStatus: 'Statut du compte',
      activeAccount: 'Actif',
      lastUpdate: 'Dernière mise à jour',
      iban: 'IBAN',
      ibanPending: 'En cours d’attribution',
      noAccounts: 'Aucun compte bancaire n’est encore disponible.',
      recentTransactions: 'Opérations du compte',
      recentTransactionsHint: 'Virements et décaissements finalisés par la banque',
      downloadStatement: 'Télécharger un relevé',
      noTransactions: 'Aucune opération finalisée.',
    },
    transfers: {
      eyebrow: 'Virements',
      title: 'Vos virements',
      subtitle:
        'Initiez et suivez vos virements dans Monalyz. Leur exécution est réalisée en interne par le personnel de la banque.',
      newTransfer: 'Nouveau virement',
      searchPlaceholder: 'Bénéficiaire ou référence',
      progress: 'Avancement du traitement',
      progressHint: 'Le statut est confirmé dans Monalyz par le chef d’agence.',
      noTransfers: 'Aucun virement pour le moment.',
      statuses: {
        submitted: 'Demande de virement envoyée',
        under_review: 'Virement en cours d’examen',
        approved_for_external_execution: 'Virement validé par le chef d’agence',
        external_execution_recorded: 'Exécution interne enregistrée',
        external_settlement_confirmed: 'Virement effectué',
        rejected: 'Virement refusé',
        cancelled: 'Virement annulé',
        external_failed: 'Échec d’exécution déclaré',
      },
    },
    loans: {
      eyebrow: 'Prêts',
      title: 'Vos demandes de prêt',
      subtitle:
        'Simulez votre prêt, transmettez vos justificatifs et suivez chaque étape jusqu’au décaissement sur votre compte courant.',
      newLoan: 'Nouvelle demande',
      simulatedDuration: 'Durée',
      months: 'mois',
      indicativePayment: 'Mensualité indicative',
      progress: 'Avancement du dossier',
      progressHint: 'L’étude et le décaissement sont réalisés en interne par la banque.',
      noLoans: 'Aucune demande de prêt enregistrée.',
      statuses: {
        submitted: 'Demande de prêt envoyée',
        under_review: 'Dossier en cours d’étude',
        approved_for_external_funding: 'Prêt validé par le chef d’agence',
        external_funding_recorded: 'Décaissement interne enregistré',
        external_settlement_confirmed: 'Prêt décaissé',
        rejected: 'Demande de prêt refusée',
        cancelled: 'Demande de prêt annulée',
        external_failed: 'Échec de décaissement déclaré',
      },
    },
  },
  en: {
    common: {
      unavailable: 'Not provided',
      internalOperationsNotice:
        'Account servicing and execution are handled internally by bank staff, without an external banking API.',
    },
    header: {
      userTitle: 'Monalyz online banking',
      adminTitle: 'Monalyz branch manager workspace',
      subtitle: 'Accounts and operations managed internally by the bank',
      openMenu: 'Open menu',
      notifications: 'Notifications',
      sessionMenu: 'Session menu',
      adminSession: 'Authorized branch manager',
      userSession: 'Authenticated client',
      logout: 'Sign out',
    },
    dashboard: {
      eyebrow: 'Your online bank',
      title: 'Your accounts at a glance',
      subtitle:
        'View your balances, IBANs, transfers and loan progress from your secure workspace.',
      balances: 'Account balances',
      balanceSource: 'Balances declared and maintained by the bank',
      showBalances: 'Show balances',
      hideBalances: 'Hide balances',
      declaredBalance: 'Declared balance',
      reconciledBalance: 'Reconciled balance',
      updatedAt: 'Updated on',
      iban: 'IBAN',
      ibanPending: 'IBAN assignment in progress',
      noAccounts: 'No bank account has been declared yet.',
      identityCheck: 'Identity verification',
      identityApproved: 'Identity verified',
      identityRejected: 'File needs attention',
      identityPending: 'Verification in progress',
      identityMissing: 'File to complete',
      identityApprovedHint: 'Your banking file has been approved.',
      identityPendingHint: 'Bank staff are processing your file.',
      identityRejectedHint: 'Review the rejection reason and complete your file.',
      identityMissingHint: 'Complete verification to activate your banking services.',
      makeTransfer: 'Make a transfer',
      makeTransferHint: 'Send a request from your Monalyz account',
      applyForLoan: 'Apply for a loan',
      applyForLoanHint: 'Simulate and submit your loan application',
      recentTransfers: 'Recent transfers',
      noTransfers: 'No transfers yet.',
      recentTransactions: 'Latest transactions',
      noTransactions: 'No finalized transaction.',
    },
    accounts: {
      eyebrow: 'My accounts',
      title: 'Accounts, balances and IBANs',
      subtitle:
        'Find the details and declared balances of your Monalyz accounts. Updates are entered by bank staff.',
      availableBalance: 'Available balance',
      accountStatus: 'Account status',
      activeAccount: 'Active',
      lastUpdate: 'Last update',
      iban: 'IBAN',
      ibanPending: 'Assignment in progress',
      noAccounts: 'No bank account is available yet.',
      recentTransactions: 'Account transactions',
      recentTransactionsHint: 'Transfers and disbursements finalized by the bank',
      downloadStatement: 'Download a statement',
      noTransactions: 'No finalized transaction.',
    },
    transfers: {
      eyebrow: 'Transfers',
      title: 'Your transfers',
      subtitle:
        'Initiate and track your transfers in Monalyz. Execution is handled internally by bank staff.',
      newTransfer: 'New transfer',
      searchPlaceholder: 'Recipient or reference',
      progress: 'Processing progress',
      progressHint: 'The status is confirmed in Monalyz by the branch manager.',
      noTransfers: 'No transfers yet.',
      statuses: {
        submitted: 'Transfer request sent',
        under_review: 'Transfer under review',
        approved_for_external_execution: 'Transfer approved by the branch manager',
        external_execution_recorded: 'Internal execution recorded',
        external_settlement_confirmed: 'Transfer completed',
        rejected: 'Transfer rejected',
        cancelled: 'Transfer cancelled',
        external_failed: 'Execution failure reported',
      },
    },
    loans: {
      eyebrow: 'Loans',
      title: 'Your loan applications',
      subtitle:
        'Simulate your loan, submit supporting documents and follow each step through disbursement to your checking account.',
      newLoan: 'New application',
      simulatedDuration: 'Term',
      months: 'months',
      indicativePayment: 'Indicative payment',
      progress: 'Application progress',
      progressHint: 'Review and disbursement are handled internally by the bank.',
      noLoans: 'No loan application recorded.',
      statuses: {
        submitted: 'Loan application sent',
        under_review: 'Application under review',
        approved_for_external_funding: 'Loan approved by the branch manager',
        external_funding_recorded: 'Internal disbursement recorded',
        external_settlement_confirmed: 'Loan disbursed',
        rejected: 'Loan application rejected',
        cancelled: 'Loan application cancelled',
        external_failed: 'Disbursement failure reported',
      },
    },
  },
  de: {
    common: {
      unavailable: 'Nicht angegeben',
      internalOperationsNotice:
        'Kontoführung und Ausführung erfolgen intern durch das Bankpersonal, ohne externe Banking-API.',
    },
    header: {
      userTitle: 'Monalyz Online-Banking',
      adminTitle: 'Monalyz Filialleiterbereich',
      subtitle: 'Konten und Vorgänge werden bankintern verwaltet',
      openMenu: 'Menü öffnen',
      notifications: 'Benachrichtigungen',
      sessionMenu: 'Sitzungsmenü',
      adminSession: 'Autorisierter Filialleiter',
      userSession: 'Angemeldeter Kunde',
      logout: 'Abmelden',
    },
    dashboard: {
      eyebrow: 'Ihre Online-Bank',
      title: 'Ihre Konten auf einen Blick',
      subtitle:
        'Sehen Sie Salden, IBANs sowie den Stand Ihrer Überweisungen und Kredite in Ihrem sicheren Bereich.',
      balances: 'Kontosalden',
      balanceSource: 'Von der Bank erfasste und gepflegte Salden',
      showBalances: 'Salden anzeigen',
      hideBalances: 'Salden ausblenden',
      declaredBalance: 'Erfasster Saldo',
      reconciledBalance: 'Abgestimmter Saldo',
      updatedAt: 'Aktualisiert am',
      iban: 'IBAN',
      ibanPending: 'IBAN-Zuweisung läuft',
      noAccounts: 'Es wurde noch kein Bankkonto erfasst.',
      identityCheck: 'Identitätsprüfung',
      identityApproved: 'Identität bestätigt',
      identityRejected: 'Unterlagen zu korrigieren',
      identityPending: 'Prüfung läuft',
      identityMissing: 'Unterlagen vervollständigen',
      identityApprovedHint: 'Ihre Bankunterlagen wurden freigegeben.',
      identityPendingHint: 'Das Bankpersonal bearbeitet Ihre Unterlagen.',
      identityRejectedHint: 'Prüfen Sie den Ablehnungsgrund und ergänzen Sie Ihre Unterlagen.',
      identityMissingHint: 'Schließen Sie die Prüfung ab, um Ihre Bankdienste zu aktivieren.',
      makeTransfer: 'Überweisung tätigen',
      makeTransferHint: 'Auftrag von Ihrem Monalyz-Konto senden',
      applyForLoan: 'Kredit beantragen',
      applyForLoanHint: 'Kredit simulieren und Antrag einreichen',
      recentTransfers: 'Letzte Überweisungen',
      noTransfers: 'Noch keine Überweisung.',
      recentTransactions: 'Letzte Umsätze',
      noTransactions: 'Keine abgeschlossene Buchung.',
    },
    accounts: {
      eyebrow: 'Meine Konten',
      title: 'Konten, Salden und IBANs',
      subtitle:
        'Hier finden Sie die Daten und erfassten Salden Ihrer Monalyz-Konten. Aktualisierungen werden vom Bankpersonal eingetragen.',
      availableBalance: 'Verfügbarer Saldo',
      accountStatus: 'Kontostatus',
      activeAccount: 'Aktiv',
      lastUpdate: 'Letzte Aktualisierung',
      iban: 'IBAN',
      ibanPending: 'Zuweisung läuft',
      noAccounts: 'Noch kein Bankkonto verfügbar.',
      recentTransactions: 'Kontoumsätze',
      recentTransactionsHint: 'Von der Bank abgeschlossene Überweisungen und Auszahlungen',
      downloadStatement: 'Kontoauszug herunterladen',
      noTransactions: 'Keine abgeschlossene Buchung.',
    },
    transfers: {
      eyebrow: 'Überweisungen',
      title: 'Ihre Überweisungen',
      subtitle:
        'Starten und verfolgen Sie Überweisungen in Monalyz. Die Ausführung erfolgt intern durch das Bankpersonal.',
      newTransfer: 'Neue Überweisung',
      searchPlaceholder: 'Empfänger oder Referenz',
      progress: 'Bearbeitungsstand',
      progressHint: 'Der Status wird in Monalyz vom Filialleiter bestätigt.',
      noTransfers: 'Noch keine Überweisung.',
      statuses: {
        submitted: 'Überweisungsauftrag gesendet',
        under_review: 'Überweisung wird geprüft',
        approved_for_external_execution: 'Vom Filialleiter freigegeben',
        external_execution_recorded: 'Interne Ausführung erfasst',
        external_settlement_confirmed: 'Überweisung ausgeführt',
        rejected: 'Überweisung abgelehnt',
        cancelled: 'Überweisung storniert',
        external_failed: 'Ausführungsfehler gemeldet',
      },
    },
    loans: {
      eyebrow: 'Kredite',
      title: 'Ihre Kreditanträge',
      subtitle:
        'Simulieren Sie Ihren Kredit, reichen Sie Nachweise ein und verfolgen Sie alle Schritte bis zur Auszahlung auf Ihr Girokonto.',
      newLoan: 'Neuer Antrag',
      simulatedDuration: 'Laufzeit',
      months: 'Monate',
      indicativePayment: 'Unverbindliche Rate',
      progress: 'Bearbeitungsstand',
      progressHint: 'Prüfung und Auszahlung erfolgen bankintern.',
      noLoans: 'Kein Kreditantrag vorhanden.',
      statuses: {
        submitted: 'Kreditantrag gesendet',
        under_review: 'Antrag wird geprüft',
        approved_for_external_funding: 'Vom Filialleiter genehmigt',
        external_funding_recorded: 'Interne Auszahlung erfasst',
        external_settlement_confirmed: 'Kredit ausgezahlt',
        rejected: 'Kreditantrag abgelehnt',
        cancelled: 'Kreditantrag storniert',
        external_failed: 'Auszahlungsfehler gemeldet',
      },
    },
  },
  es: {
    common: {
      unavailable: 'No indicado',
      internalOperationsNotice:
        'La gestión de cuentas y la ejecución se realizan internamente por el personal del banco, sin API bancaria externa.',
    },
    header: {
      userTitle: 'Banca en línea Monalyz',
      adminTitle: 'Espacio del director de sucursal Monalyz',
      subtitle: 'Cuentas y operaciones gestionadas internamente por el banco',
      openMenu: 'Abrir el menú',
      notifications: 'Notificaciones',
      sessionMenu: 'Menú de sesión',
      adminSession: 'Director de sucursal autorizado',
      userSession: 'Cliente autenticado',
      logout: 'Cerrar sesión',
    },
    dashboard: {
      eyebrow: 'Su banco en línea',
      title: 'Sus cuentas de un vistazo',
      subtitle:
        'Consulte saldos, IBAN y el progreso de sus transferencias y préstamos desde su espacio seguro.',
      balances: 'Saldos de sus cuentas',
      balanceSource: 'Saldos declarados y mantenidos por el banco',
      showBalances: 'Mostrar saldos',
      hideBalances: 'Ocultar saldos',
      declaredBalance: 'Saldo declarado',
      reconciledBalance: 'Saldo conciliado',
      updatedAt: 'Actualizado el',
      iban: 'IBAN',
      ibanPending: 'Asignación del IBAN en curso',
      noAccounts: 'Aún no se ha declarado ninguna cuenta bancaria.',
      identityCheck: 'Verificación de identidad',
      identityApproved: 'Identidad verificada',
      identityRejected: 'Expediente por corregir',
      identityPending: 'Verificación en curso',
      identityMissing: 'Expediente por completar',
      identityApprovedHint: 'Su expediente bancario ha sido aprobado.',
      identityPendingHint: 'El personal del banco está tramitando su expediente.',
      identityRejectedHint: 'Consulte el motivo del rechazo y complete su expediente.',
      identityMissingHint: 'Complete la verificación para activar sus servicios bancarios.',
      makeTransfer: 'Hacer una transferencia',
      makeTransferHint: 'Envíe una solicitud desde su cuenta Monalyz',
      applyForLoan: 'Solicitar un préstamo',
      applyForLoanHint: 'Simule y envíe su solicitud de préstamo',
      recentTransfers: 'Transferencias recientes',
      noTransfers: 'Aún no hay transferencias.',
      recentTransactions: 'Últimas operaciones',
      noTransactions: 'No hay operaciones finalizadas.',
    },
    accounts: {
      eyebrow: 'Mis cuentas',
      title: 'Cuentas, saldos e IBAN',
      subtitle:
        'Consulte los datos y saldos declarados de sus cuentas Monalyz. El personal del banco registra las actualizaciones.',
      availableBalance: 'Saldo disponible',
      accountStatus: 'Estado de la cuenta',
      activeAccount: 'Activa',
      lastUpdate: 'Última actualización',
      iban: 'IBAN',
      ibanPending: 'Asignación en curso',
      noAccounts: 'Aún no hay ninguna cuenta bancaria disponible.',
      recentTransactions: 'Operaciones de la cuenta',
      recentTransactionsHint: 'Transferencias y desembolsos finalizados por el banco',
      downloadStatement: 'Descargar un extracto',
      noTransactions: 'No hay operaciones finalizadas.',
    },
    transfers: {
      eyebrow: 'Transferencias',
      title: 'Sus transferencias',
      subtitle:
        'Inicie y siga sus transferencias en Monalyz. La ejecución la realiza internamente el personal del banco.',
      newTransfer: 'Nueva transferencia',
      searchPlaceholder: 'Beneficiario o referencia',
      progress: 'Progreso de la tramitación',
      progressHint: 'El director de sucursal confirma el estado en Monalyz.',
      noTransfers: 'Aún no hay transferencias.',
      statuses: {
        submitted: 'Solicitud de transferencia enviada',
        under_review: 'Transferencia en revisión',
        approved_for_external_execution: 'Aprobada por el director de sucursal',
        external_execution_recorded: 'Ejecución interna registrada',
        external_settlement_confirmed: 'Transferencia realizada',
        rejected: 'Transferencia rechazada',
        cancelled: 'Transferencia cancelada',
        external_failed: 'Error de ejecución declarado',
      },
    },
    loans: {
      eyebrow: 'Préstamos',
      title: 'Sus solicitudes de préstamo',
      subtitle:
        'Simule su préstamo, envíe justificantes y siga cada etapa hasta el desembolso en su cuenta corriente.',
      newLoan: 'Nueva solicitud',
      simulatedDuration: 'Duración',
      months: 'meses',
      indicativePayment: 'Cuota indicativa',
      progress: 'Progreso del expediente',
      progressHint: 'El estudio y el desembolso se realizan internamente en el banco.',
      noLoans: 'No hay solicitudes de préstamo.',
      statuses: {
        submitted: 'Solicitud de préstamo enviada',
        under_review: 'Expediente en estudio',
        approved_for_external_funding: 'Aprobado por el director de sucursal',
        external_funding_recorded: 'Desembolso interno registrado',
        external_settlement_confirmed: 'Préstamo desembolsado',
        rejected: 'Solicitud de préstamo rechazada',
        cancelled: 'Solicitud de préstamo cancelada',
        external_failed: 'Error de desembolso declarado',
      },
    },
  },
};

export function accountIbanLabel(value: string | undefined, fallback: string) {
  if (
    !value ||
    /référence externe non renseignée|external reference not provided/i.test(value)
  ) {
    return fallback;
  }
  return value;
}
