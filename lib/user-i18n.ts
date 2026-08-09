import { bankingMessages } from './banking-i18n';
import { translations } from './i18n';
import { kycTranslations } from './kyc-i18n';
import { publicMessages } from './public-i18n';
import type {
  AppErrorCode,
  Language,
  LedgerEntryKind,
  LoanMotiveCode,
  NotificationMessageKey,
  OfficialDocumentType,
} from './types';

type DeepStringShape<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Record<string, unknown>
      ? DeepStringShape<T[K]>
      : never;
};

const fr = {
  common: {
    back: 'Retour',
    next: 'Continuer',
    close: 'Fermer',
    cancel: 'Annuler',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    submit: 'Transmettre',
    submitting: 'Transmission…',
    loading: 'Chargement…',
    unavailable: 'Non renseigné',
    other: 'Autre',
    or: 'ou',
  },
  shell: {
    greeting: 'Bonjour, {name}',
    greetingFallback: 'Bonjour',
    welcome: 'Bienvenue dans votre espace bancaire sécurisé.',
    homeAria: 'Accueil {bankName}',
    closeMenu: 'Fermer le menu',
    mainNavigation: 'Navigation principale',
    actions: 'Actions',
    userHelp: 'Besoin d’aide ? Notre équipe vous accompagne.',
    adminHelp: 'Support des opérations et de la conformité.',
    contact: 'Nous contacter',
    loadingSession: 'Chargement de votre espace bancaire…',
  },
  settings: {
    eyebrow: 'Préférences', title: 'Paramètres de votre compte {bankName}',
    displayName: 'Nom affiché', phone: 'Téléphone', interfaceLanguage: 'Langue de l’interface',
    preferredCurrency: 'Devise de simulation préférée', hideAmounts: 'Masquer les montants',
    hideAmountsHint: 'Préférence locale de confidentialité visuelle',
    deploymentNotice: 'La configuration du service est définie par le déploiement et ne peut pas être modifiée depuis votre navigateur.',
    saved: 'Vos préférences ont été enregistrées.', languageFailed: 'La langue n’a pas pu être mise à jour.',
  },
  contact: {
    title: 'Assistance {bankName}', subtitle: 'Assistance par e-mail',
    description: 'Pour toute demande, écrivez à notre équipe d’assistance. Votre messagerie s’ouvrira avec l’adresse {bankName} préremplie.',
  },
  support: {
    openChat: 'Contacter le support',
    unavailable: 'Le support est momentanément indisponible',
    pushTitle: 'Notifications du support',
    pushDescription: 'Recevez une notification sécurisée lorsqu’une nouvelle réponse du support est disponible.',
    pushChecking: 'Vérification de la disponibilité des notifications…',
    pushEnable: 'Activer les notifications',
    pushDisable: 'Désactiver',
    pushEnabled: 'Les notifications du support sont activées sur cet appareil.',
    pushDenied: 'Les notifications sont bloquées dans les réglages de votre navigateur.',
    pushUnsupported: 'Les notifications Web Push ne sont pas disponibles sur cet appareil.',
    pushEnabling: 'Activation…',
    pushDisabling: 'Désactivation…',
    pushError: 'Les notifications n’ont pas pu être configurées. Veuillez réessayer.',
  },
  loanModal: {
    subtitle: 'Simulation en temps réel et dépôt de votre dossier',
    stepInformation: 'Informations', stepSimulation: 'Simulation',
    disclaimer: 'Votre demande est enregistrée pour étude. Cette simulation ne constitue ni une offre de crédit, ni une approbation, ni une promesse de versement.',
    errorIntro: 'Veuillez vérifier les informations signalées :',
    identityNotice: 'Votre identité provient de votre session sécurisée. Aucun nom ni aucune adresse e-mail libre ne peut la remplacer.',
    productUnavailable: 'Aucune offre de prêt active n’est disponible dans cette devise.',
    fixedAnnualRate: 'TAEG fixe',
    perMonth: 'par mois', rateHypothesis: 'Hypothèse indicative à {rate}',
  },
  transferModal: {
    subtitle: 'Instruction préparée dans {bankName} — exécution hors application',
    stepRecipient: 'Bénéficiaire', stepDetails: 'Coordonnées externes', stepAmount: 'Montant',
    errorIntro: 'Veuillez vérifier les informations signalées :', required: '{field} est obligatoire.',
    invalidEmail: 'Saisissez une adresse e-mail valide.',
    canadaSelection: 'Renseignez soit l’adresse e-mail Interac, soit les coordonnées de dépôt direct (transit, institution et compte).',
    positiveAmount: 'Le montant doit être supérieur à zéro.', recipientPlaceholder: 'Ex. : Claire Dupont',
    destinationCanada: 'Canada (CAD)', destinationEurozone: 'Zone euro (EUR)', destinationUsa: 'États-Unis (USD)',
    destinationSwiss: 'Suisse (CHF)', destinationUk: 'Royaume-Uni (GBP)', destinationLatam: 'Amérique latine', destinationAfrica: 'Afrique',
    receivingCurrency: 'Devise de réception', accountOrClabe: 'Numéro de compte / CLABE / CPF',
    recipientInstitution: 'Établissement destinataire déclaré', accountOrRib: 'Numéro de compte / RIB',
    accountOrRibPlaceholder: 'Numéro de compte ou RIB', externalBankCode: 'Code externe BIC / SWIFT / établissement',
    transferMotive: 'Motif du virement (facultatif)', motivePlaceholder: 'Ex. : facture 4029',
    externalFees: 'Frais externes', externalFeesUnknown: 'non connus par {bankName}', rateAsOf: 'Taux indicatif au {date}',
    beneficiary: 'Bénéficiaire', motive: 'Motif', saveInstruction: 'Enregistrer l’instruction',
    fields: {
      recipientName: 'Le nom du bénéficiaire', iban: 'L’IBAN', bicSwift: 'Le code BIC / SWIFT',
      routingNumber: 'Le numéro d’acheminement', accountNumber: 'Le numéro de compte', swissIban: 'L’IBAN suisse',
      clearingNumber: 'Le numéro de clearing', sortCode: 'Le sort code', accountOrClabe: 'Le numéro de compte ou CLABE',
      bankName: 'Le nom de la banque', accountOrRib: 'Le numéro de compte ou RIB', bankCode: 'Le code BIC / SWIFT / établissement',
      transitNumber: 'Le numéro de transit', institutionNumber: 'Le numéro d’institution', interacEmail: 'L’adresse e-mail Interac',
    },
  },
  accountTypes: {
    current: 'Compte courant',
    savings: 'Compte d’épargne',
  },
  loanMotives: {
    personal: 'Projet personnel',
    real_estate: 'Projet immobilier',
    vehicle: 'Achat d’un véhicule',
    renovation: 'Travaux et rénovation',
    business_cashflow: 'Trésorerie professionnelle',
    other: 'Autre',
  },
  ledger: {
    migration_opening_balance: 'Solde initial',
    account_opening: 'Ouverture du compte',
    manual_adjustment: 'Ajustement effectué par la banque',
    transfer_debit: 'Virement à {recipient}',
    loan_credit: 'Versement du prêt {reference}',
  },
  notifications: {
    title: 'Notifications',
    subtitle: 'Suivez l’avancement de vos opérations.',
    empty: 'Vous n’avez aucune notification.',
    markAllRead: 'Tout marquer comme lu',
    openItem: 'Ouvrir le dossier',
    markRead: 'Marquer comme lu',
    generic_info: {
      title: 'Information concernant votre espace',
      message: 'Une mise à jour est disponible dans votre espace sécurisé.',
    },
    transfer_submitted: {
      title: 'Virement enregistré',
      message: 'Votre instruction de virement a été transmise pour vérification.',
    },
    transfer_approved: {
      title: 'Virement approuvé',
      message: 'Votre virement a été approuvé pour exécution.',
    },
    transfer_completed: {
      title: 'Virement exécuté',
      message: 'Votre virement a été exécuté avec succès.',
    },
    transfer_rejected: {
      title: 'Virement refusé',
      message: 'Votre instruction de virement n’a pas été acceptée.',
    },
    transfer_failed: {
      title: 'Virement non exécuté',
      message: 'Votre virement n’a pas pu être exécuté. Consultez son suivi.',
    },
    loan_submitted: {
      title: 'Demande de prêt enregistrée',
      message: 'Votre demande de prêt a été transmise pour analyse.',
    },
    loan_approved: {
      title: 'Prêt approuvé',
      message: 'Votre demande de prêt a été approuvée.',
    },
    loan_disbursed: {
      title: 'Prêt versé',
      message: 'Les fonds de votre prêt ont été crédités sur votre compte.',
    },
    loan_rejected: {
      title: 'Demande de prêt refusée',
      message: 'Votre demande de prêt n’a pas été acceptée.',
    },
    loan_failed: {
      title: 'Versement du prêt interrompu',
      message: 'Le versement de votre prêt n’a pas pu être finalisé. Consultez son suivi.',
    },
    kyc_submitted: {
      title: 'Dossier d’identité transmis',
      message: 'Votre dossier d’identité a été transmis pour vérification.',
    },
    kyc_information_requested: {
      title: 'Informations complémentaires requises',
      message: 'Des éléments complémentaires sont nécessaires pour vérifier votre identité.',
    },
    kyc_resubmitted: {
      title: 'Corrections transmises',
      message: 'Vos corrections ont été transmises pour vérification.',
    },
    kyc_approved: {
      title: 'Identité vérifiée',
      message: 'La vérification de votre identité est terminée.',
    },
    kyc_rejected: {
      title: 'Vérification d’identité non aboutie',
      message: 'Votre dossier d’identité n’a pas pu être validé.',
    },
    document_available: {
      title: 'Nouveau document disponible',
      message: 'Un nouveau document officiel est disponible dans votre espace.',
    },
  },
  documents: {
    bank_details: 'Relevé d’identité bancaire',
    account_statement: 'Relevé de compte',
    balance_certificate: 'Attestation de solde',
    transfer_confirmation: 'Confirmation de virement',
    loan_disbursement_confirmation: 'Confirmation de versement du prêt',
    loan_decision: 'Décision de prêt',
  },
  errors: {
    AUTH_REQUIRED: 'Votre session a expiré. Veuillez vous reconnecter.',
    CONFIGURATION_UNAVAILABLE: 'Le service est temporairement indisponible.',
    INVALID_REQUEST: 'Certaines informations sont invalides. Veuillez les vérifier.',
    NETWORK_ERROR: 'La connexion au service a échoué. Veuillez réessayer.',
    NOT_FOUND: 'L’élément demandé est introuvable.',
    PERMISSION_DENIED: 'Vous n’êtes pas autorisé à effectuer cette opération.',
    SAVE_FAILED: 'L’enregistrement a échoué. Veuillez réessayer.',
    UPLOAD_FAILED: 'Le téléversement a échoué. Veuillez réessayer.',
    UNKNOWN_ERROR: 'Une erreur est survenue. Veuillez réessayer.',
  },
} as const;

type ExtraMessages = DeepStringShape<typeof fr>;

const en: ExtraMessages = {
  common: {
    back: 'Back', next: 'Continue', close: 'Close', cancel: 'Cancel', save: 'Save',
    saving: 'Saving…', submit: 'Submit', submitting: 'Submitting…', loading: 'Loading…',
    unavailable: 'Not provided', other: 'Other', or: 'or',
  },
  shell: {
    greeting: 'Hello, {name}', greetingFallback: 'Hello',
    welcome: 'Welcome to your secure online banking area.', homeAria: '{bankName} home',
    closeMenu: 'Close menu', mainNavigation: 'Main navigation', actions: 'Actions',
    userHelp: 'Need help? Our team is here to assist you.',
    adminHelp: 'Operations and compliance support.', contact: 'Contact us',
    loadingSession: 'Loading your online banking area…',
  },
  settings: {
    eyebrow: 'Preferences', title: 'Your {bankName} account settings', displayName: 'Display name',
    phone: 'Phone number', interfaceLanguage: 'Interface language', preferredCurrency: 'Preferred simulation currency',
    hideAmounts: 'Hide amounts', hideAmountsHint: 'Local visual privacy preference',
    deploymentNotice: 'The service configuration is set by the deployment and cannot be changed from your browser.',
    saved: 'Your preferences have been saved.', languageFailed: 'The language could not be updated.',
  },
  contact: {
    title: '{bankName} support', subtitle: 'Email support',
    description: 'For assistance, email our support team. Your email application will open with the {bankName} address already entered.',
  },
  support: {
    openChat: 'Contact support',
    unavailable: 'Support is temporarily unavailable',
    pushTitle: 'Support notifications',
    pushDescription: 'Receive a secure notification when a new support reply is available.',
    pushChecking: 'Checking notification availability…',
    pushEnable: 'Enable notifications',
    pushDisable: 'Disable',
    pushEnabled: 'Support notifications are enabled on this device.',
    pushDenied: 'Notifications are blocked in your browser settings.',
    pushUnsupported: 'Web Push notifications are not available on this device.',
    pushEnabling: 'Enabling…',
    pushDisabling: 'Disabling…',
    pushError: 'Notifications could not be configured. Please try again.',
  },
  loanModal: {
    subtitle: 'Real-time simulation and application submission', stepInformation: 'Information', stepSimulation: 'Simulation',
    disclaimer: 'Your application has been submitted for review. This simulation is not a credit offer, an approval or a commitment to disburse funds.',
    errorIntro: 'Please review the highlighted information:',
    identityNotice: 'Your identity is taken from your secure session. It cannot be replaced by a freely entered name or email address.',
    productUnavailable: 'No active loan offer is available in this currency.',
    fixedAnnualRate: 'Fixed APR',
    perMonth: 'per month', rateHypothesis: 'Illustrative assumption at {rate}',
  },
  transferModal: {
    subtitle: 'Instruction prepared in {bankName} — execution outside the application', stepRecipient: 'Recipient', stepDetails: 'External details', stepAmount: 'Amount',
    errorIntro: 'Please review the highlighted information:', required: '{field} is required.', invalidEmail: 'Enter a valid email address.',
    canadaSelection: 'Enter either the Interac email address or the direct-deposit details (transit, institution and account).',
    positiveAmount: 'The amount must be greater than zero.', recipientPlaceholder: 'E.g. Claire Dupont',
    destinationCanada: 'Canada (CAD)', destinationEurozone: 'Euro area (EUR)', destinationUsa: 'United States (USD)', destinationSwiss: 'Switzerland (CHF)', destinationUk: 'United Kingdom (GBP)', destinationLatam: 'Latin America', destinationAfrica: 'Africa',
    receivingCurrency: 'Receiving currency', accountOrClabe: 'Account number / CLABE / CPF', recipientInstitution: 'Declared recipient institution',
    accountOrRib: 'Account number / RIB', accountOrRibPlaceholder: 'Account number or RIB', externalBankCode: 'External BIC / SWIFT / institution code',
    transferMotive: 'Transfer purpose (optional)', motivePlaceholder: 'E.g. invoice 4029', externalFees: 'External fees', externalFeesUnknown: 'not known by {bankName}',
    rateAsOf: 'Indicative rate as of {date}', beneficiary: 'Recipient', motive: 'Purpose', saveInstruction: 'Save instruction',
    fields: {
      recipientName: 'Recipient name', iban: 'IBAN', bicSwift: 'BIC / SWIFT code', routingNumber: 'Routing number', accountNumber: 'Account number',
      swissIban: 'Swiss IBAN', clearingNumber: 'Clearing number', sortCode: 'Sort code', accountOrClabe: 'Account number or CLABE', bankName: 'Bank name',
      accountOrRib: 'Account number or RIB', bankCode: 'BIC / SWIFT / institution code', transitNumber: 'Transit number', institutionNumber: 'Institution number', interacEmail: 'Interac email address',
    },
  },
  accountTypes: { current: 'Current account', savings: 'Savings account' },
  loanMotives: {
    personal: 'Personal project', real_estate: 'Property project', vehicle: 'Vehicle purchase',
    renovation: 'Renovation work', business_cashflow: 'Business cash flow', other: 'Other',
  },
  ledger: {
    migration_opening_balance: 'Opening balance', account_opening: 'Account opening',
    manual_adjustment: 'Adjustment made by the bank', transfer_debit: 'Transfer to {recipient}',
    loan_credit: 'Loan disbursement {reference}',
  },
  notifications: {
    title: 'Notifications', subtitle: 'Track the progress of your transactions.',
    empty: 'You have no notifications.', markAllRead: 'Mark all as read', openItem: 'Open record', markRead: 'Mark as read',
    generic_info: { title: 'Account information', message: 'An update is available in your secure area.' },
    transfer_submitted: { title: 'Transfer submitted', message: 'Your transfer instruction has been submitted for review.' },
    transfer_approved: { title: 'Transfer approved', message: 'Your transfer has been approved for execution.' },
    transfer_completed: { title: 'Transfer completed', message: 'Your transfer has been completed successfully.' },
    transfer_rejected: { title: 'Transfer declined', message: 'Your transfer instruction was not approved.' },
    transfer_failed: { title: 'Transfer not completed', message: 'Your transfer could not be completed. Please review its status.' },
    loan_submitted: { title: 'Loan application submitted', message: 'Your loan application has been submitted for review.' },
    loan_approved: { title: 'Loan approved', message: 'Your loan application has been approved.' },
    loan_disbursed: { title: 'Loan disbursed', message: 'Your loan funds have been credited to your account.' },
    loan_rejected: { title: 'Loan application declined', message: 'Your loan application was not approved.' },
    loan_failed: { title: 'Loan disbursement interrupted', message: 'Your loan could not be disbursed. Please review its status.' },
    kyc_submitted: { title: 'Identity file submitted', message: 'Your identity file has been submitted for verification.' },
    kyc_information_requested: { title: 'Additional information required', message: 'Additional items are required to verify your identity.' },
    kyc_resubmitted: { title: 'Corrections submitted', message: 'Your corrections have been submitted for verification.' },
    kyc_approved: { title: 'Identity verified', message: 'Your identity verification is complete.' },
    kyc_rejected: { title: 'Identity verification unsuccessful', message: 'Your identity file could not be approved.' },
    document_available: { title: 'New document available', message: 'A new official document is available in your account.' },
  },
  documents: {
    bank_details: 'Bank account details', account_statement: 'Account statement',
    balance_certificate: 'Balance certificate', transfer_confirmation: 'Transfer confirmation',
    loan_disbursement_confirmation: 'Loan disbursement confirmation', loan_decision: 'Loan decision',
  },
  errors: {
    AUTH_REQUIRED: 'Your session has expired. Please sign in again.',
    CONFIGURATION_UNAVAILABLE: 'The service is temporarily unavailable.',
    INVALID_REQUEST: 'Some information is invalid. Please review it.',
    NETWORK_ERROR: 'The service could not be reached. Please try again.',
    NOT_FOUND: 'The requested item could not be found.',
    PERMISSION_DENIED: 'You are not authorised to perform this action.',
    SAVE_FAILED: 'Your changes could not be saved. Please try again.',
    UPLOAD_FAILED: 'The upload failed. Please try again.',
    UNKNOWN_ERROR: 'Something went wrong. Please try again.',
  },
};

const de: ExtraMessages = {
  common: {
    back: 'Zurück', next: 'Weiter', close: 'Schließen', cancel: 'Abbrechen', save: 'Speichern',
    saving: 'Wird gespeichert…', submit: 'Übermitteln', submitting: 'Wird übermittelt…', loading: 'Wird geladen…',
    unavailable: 'Nicht angegeben', other: 'Sonstiges', or: 'oder',
  },
  shell: {
    greeting: 'Guten Tag, {name}', greetingFallback: 'Guten Tag',
    welcome: 'Willkommen in Ihrem sicheren Online-Banking.', homeAria: '{bankName}-Startseite',
    closeMenu: 'Menü schließen', mainNavigation: 'Hauptnavigation', actions: 'Aktionen',
    userHelp: 'Benötigen Sie Hilfe? Unser Team unterstützt Sie gerne.',
    adminHelp: 'Unterstützung für Betrieb und Compliance.', contact: 'Kontakt',
    loadingSession: 'Ihr Online-Banking wird geladen…',
  },
  settings: {
    eyebrow: 'Einstellungen', title: 'Einstellungen Ihres {bankName}-Kontos', displayName: 'Anzeigename',
    phone: 'Telefonnummer', interfaceLanguage: 'Sprache der Benutzeroberfläche', preferredCurrency: 'Bevorzugte Simulationswährung',
    hideAmounts: 'Beträge ausblenden', hideAmountsHint: 'Lokale Einstellung zum Schutz Ihrer Privatsphäre',
    deploymentNotice: 'Die Dienstkonfiguration wird bei der Bereitstellung festgelegt und kann nicht in Ihrem Browser geändert werden.',
    saved: 'Ihre Einstellungen wurden gespeichert.', languageFailed: 'Die Sprache konnte nicht aktualisiert werden.',
  },
  contact: {
    title: '{bankName}-Support', subtitle: 'Support per E-Mail',
    description: 'Bei Fragen wenden Sie sich per E-Mail an unser Supportteam. Ihr E-Mail-Programm wird mit der bereits eingetragenen {bankName}-Adresse geöffnet.',
  },
  support: {
    openChat: 'Support kontaktieren',
    unavailable: 'Der Support ist vorübergehend nicht verfügbar',
    pushTitle: 'Support-Benachrichtigungen',
    pushDescription: 'Erhalten Sie eine sichere Benachrichtigung, sobald eine neue Support-Antwort verfügbar ist.',
    pushChecking: 'Verfügbarkeit der Benachrichtigungen wird geprüft…',
    pushEnable: 'Benachrichtigungen aktivieren',
    pushDisable: 'Deaktivieren',
    pushEnabled: 'Support-Benachrichtigungen sind auf diesem Gerät aktiviert.',
    pushDenied: 'Benachrichtigungen sind in Ihren Browsereinstellungen blockiert.',
    pushUnsupported: 'Web-Push-Benachrichtigungen sind auf diesem Gerät nicht verfügbar.',
    pushEnabling: 'Wird aktiviert…',
    pushDisabling: 'Wird deaktiviert…',
    pushError: 'Benachrichtigungen konnten nicht eingerichtet werden. Bitte versuchen Sie es erneut.',
  },
  loanModal: {
    subtitle: 'Echtzeitsimulation und Einreichung Ihres Antrags', stepInformation: 'Angaben', stepSimulation: 'Simulation',
    disclaimer: 'Ihr Antrag wurde zur Prüfung eingereicht. Diese Simulation stellt weder ein Kreditangebot noch eine Genehmigung oder Auszahlungszusage dar.',
    errorIntro: 'Bitte prüfen Sie die markierten Angaben:',
    identityNotice: 'Ihre Identität wird aus Ihrer sicheren Sitzung übernommen. Sie kann nicht durch einen frei eingegebenen Namen oder eine E-Mail-Adresse ersetzt werden.',
    productUnavailable: 'In dieser Währung ist derzeit kein aktives Kreditangebot verfügbar.',
    fixedAnnualRate: 'Eff. Jahreszins',
    perMonth: 'pro Monat', rateHypothesis: 'Unverbindliche Annahme mit {rate}',
  },
  transferModal: {
    subtitle: 'In {bankName} vorbereiteter Auftrag — Ausführung außerhalb der Anwendung', stepRecipient: 'Empfänger', stepDetails: 'Externe Bankdaten', stepAmount: 'Betrag',
    errorIntro: 'Bitte prüfen Sie die markierten Angaben:', required: '{field} ist erforderlich.', invalidEmail: 'Geben Sie eine gültige E-Mail-Adresse ein.',
    canadaSelection: 'Geben Sie entweder die Interac-E-Mail-Adresse oder die Daten für die Direktgutschrift (Transit, Institut und Konto) ein.',
    positiveAmount: 'Der Betrag muss größer als null sein.', recipientPlaceholder: 'Z. B. Claire Dupont',
    destinationCanada: 'Kanada (CAD)', destinationEurozone: 'Euro-Raum (EUR)', destinationUsa: 'Vereinigte Staaten (USD)', destinationSwiss: 'Schweiz (CHF)', destinationUk: 'Vereinigtes Königreich (GBP)', destinationLatam: 'Lateinamerika', destinationAfrica: 'Afrika',
    receivingCurrency: 'Empfangswährung', accountOrClabe: 'Kontonummer / CLABE / CPF', recipientInstitution: 'Angegebenes Empfängerinstitut',
    accountOrRib: 'Kontonummer / RIB', accountOrRibPlaceholder: 'Kontonummer oder RIB', externalBankCode: 'Externer BIC-/SWIFT-/Institutscode',
    transferMotive: 'Verwendungszweck (optional)', motivePlaceholder: 'Z. B. Rechnung 4029', externalFees: 'Externe Gebühren', externalFeesUnknown: '{bankName} nicht bekannt',
    rateAsOf: 'Unverbindlicher Kurs vom {date}', beneficiary: 'Empfänger', motive: 'Verwendungszweck', saveInstruction: 'Auftrag speichern',
    fields: {
      recipientName: 'Name des Empfängers', iban: 'IBAN', bicSwift: 'BIC-/SWIFT-Code', routingNumber: 'Routing-Nummer', accountNumber: 'Kontonummer',
      swissIban: 'Schweizer IBAN', clearingNumber: 'Clearing-Nummer', sortCode: 'Sort Code', accountOrClabe: 'Kontonummer oder CLABE', bankName: 'Name der Bank',
      accountOrRib: 'Kontonummer oder RIB', bankCode: 'BIC-/SWIFT-/Institutscode', transitNumber: 'Transit-Nummer', institutionNumber: 'Institutionsnummer', interacEmail: 'Interac-E-Mail-Adresse',
    },
  },
  accountTypes: { current: 'Girokonto', savings: 'Sparkonto' },
  loanMotives: {
    personal: 'Persönliches Vorhaben', real_estate: 'Immobilienvorhaben', vehicle: 'Fahrzeugkauf',
    renovation: 'Renovierung', business_cashflow: 'Betriebliche Liquidität', other: 'Sonstiges',
  },
  ledger: {
    migration_opening_balance: 'Anfangssaldo', account_opening: 'Kontoeröffnung',
    manual_adjustment: 'Anpassung durch die Bank', transfer_debit: 'Überweisung an {recipient}',
    loan_credit: 'Kreditauszahlung {reference}',
  },
  notifications: {
    title: 'Benachrichtigungen', subtitle: 'Verfolgen Sie den Status Ihrer Vorgänge.',
    empty: 'Sie haben keine Benachrichtigungen.', markAllRead: 'Alle als gelesen markieren', openItem: 'Vorgang öffnen', markRead: 'Als gelesen markieren',
    generic_info: { title: 'Information zu Ihrem Konto', message: 'In Ihrem sicheren Bereich ist eine Aktualisierung verfügbar.' },
    transfer_submitted: { title: 'Überweisung eingereicht', message: 'Ihr Überweisungsauftrag wurde zur Prüfung eingereicht.' },
    transfer_approved: { title: 'Überweisung genehmigt', message: 'Ihre Überweisung wurde zur Ausführung genehmigt.' },
    transfer_completed: { title: 'Überweisung ausgeführt', message: 'Ihre Überweisung wurde erfolgreich ausgeführt.' },
    transfer_rejected: { title: 'Überweisung abgelehnt', message: 'Ihr Überweisungsauftrag wurde nicht genehmigt.' },
    transfer_failed: { title: 'Überweisung nicht ausgeführt', message: 'Ihre Überweisung konnte nicht ausgeführt werden. Bitte prüfen Sie den Status.' },
    loan_submitted: { title: 'Kreditantrag eingereicht', message: 'Ihr Kreditantrag wurde zur Prüfung eingereicht.' },
    loan_approved: { title: 'Kredit genehmigt', message: 'Ihr Kreditantrag wurde genehmigt.' },
    loan_disbursed: { title: 'Kredit ausgezahlt', message: 'Der Kreditbetrag wurde Ihrem Konto gutgeschrieben.' },
    loan_rejected: { title: 'Kreditantrag abgelehnt', message: 'Ihr Kreditantrag wurde nicht genehmigt.' },
    loan_failed: { title: 'Kreditauszahlung unterbrochen', message: 'Ihr Kredit konnte nicht ausgezahlt werden. Bitte prüfen Sie den Status.' },
    kyc_submitted: { title: 'Identitätsunterlagen eingereicht', message: 'Ihre Identitätsunterlagen wurden zur Prüfung eingereicht.' },
    kyc_information_requested: { title: 'Zusätzliche Angaben erforderlich', message: 'Für die Identitätsprüfung sind weitere Angaben erforderlich.' },
    kyc_resubmitted: { title: 'Korrekturen eingereicht', message: 'Ihre Korrekturen wurden zur Prüfung eingereicht.' },
    kyc_approved: { title: 'Identität bestätigt', message: 'Ihre Identitätsprüfung ist abgeschlossen.' },
    kyc_rejected: { title: 'Identitätsprüfung nicht erfolgreich', message: 'Ihre Identitätsunterlagen konnten nicht genehmigt werden.' },
    document_available: { title: 'Neues Dokument verfügbar', message: 'In Ihrem Konto ist ein neues offizielles Dokument verfügbar.' },
  },
  documents: {
    bank_details: 'Bankverbindung', account_statement: 'Kontoauszug',
    balance_certificate: 'Saldenbestätigung', transfer_confirmation: 'Überweisungsbestätigung',
    loan_disbursement_confirmation: 'Bestätigung der Kreditauszahlung', loan_decision: 'Kreditentscheidung',
  },
  errors: {
    AUTH_REQUIRED: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
    CONFIGURATION_UNAVAILABLE: 'Der Dienst ist vorübergehend nicht verfügbar.',
    INVALID_REQUEST: 'Einige Angaben sind ungültig. Bitte prüfen Sie sie.',
    NETWORK_ERROR: 'Der Dienst konnte nicht erreicht werden. Bitte versuchen Sie es erneut.',
    NOT_FOUND: 'Das angeforderte Element wurde nicht gefunden.',
    PERMISSION_DENIED: 'Sie sind zu dieser Aktion nicht berechtigt.',
    SAVE_FAILED: 'Die Angaben konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.',
    UPLOAD_FAILED: 'Das Hochladen ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
    UNKNOWN_ERROR: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
  },
};

const es: ExtraMessages = {
  common: {
    back: 'Volver', next: 'Continuar', close: 'Cerrar', cancel: 'Cancelar', save: 'Guardar',
    saving: 'Guardando…', submit: 'Enviar', submitting: 'Enviando…', loading: 'Cargando…',
    unavailable: 'No informado', other: 'Otro', or: 'o',
  },
  shell: {
    greeting: 'Hola, {name}', greetingFallback: 'Hola',
    welcome: 'Le damos la bienvenida a su banca en línea segura.', homeAria: 'Inicio de {bankName}',
    closeMenu: 'Cerrar el menú', mainNavigation: 'Navegación principal', actions: 'Acciones',
    userHelp: '¿Necesita ayuda? Nuestro equipo está a su disposición.',
    adminHelp: 'Asistencia de operaciones y cumplimiento.', contact: 'Contáctenos',
    loadingSession: 'Cargando su banca en línea…',
  },
  settings: {
    eyebrow: 'Preferencias', title: 'Configuración de su cuenta {bankName}', displayName: 'Nombre visible',
    phone: 'Teléfono', interfaceLanguage: 'Idioma de la interfaz', preferredCurrency: 'Moneda de simulación preferida',
    hideAmounts: 'Ocultar importes', hideAmountsHint: 'Preferencia local de privacidad visual',
    deploymentNotice: 'La configuración del servicio se establece durante el despliegue y no puede modificarse desde su navegador.',
    saved: 'Sus preferencias se han guardado.', languageFailed: 'No se pudo actualizar el idioma.',
  },
  contact: {
    title: 'Asistencia de {bankName}', subtitle: 'Asistencia por correo electrónico',
    description: 'Para cualquier consulta, escriba a nuestro equipo de asistencia. Su aplicación de correo se abrirá con la dirección de {bankName} ya indicada.',
  },
  support: {
    openChat: 'Contactar con soporte',
    unavailable: 'El soporte no está disponible temporalmente',
    pushTitle: 'Notificaciones de soporte',
    pushDescription: 'Reciba una notificación segura cuando haya una nueva respuesta de soporte.',
    pushChecking: 'Comprobando la disponibilidad de las notificaciones…',
    pushEnable: 'Activar notificaciones',
    pushDisable: 'Desactivar',
    pushEnabled: 'Las notificaciones de soporte están activadas en este dispositivo.',
    pushDenied: 'Las notificaciones están bloqueadas en la configuración de su navegador.',
    pushUnsupported: 'Las notificaciones Web Push no están disponibles en este dispositivo.',
    pushEnabling: 'Activando…',
    pushDisabling: 'Desactivando…',
    pushError: 'No se pudieron configurar las notificaciones. Inténtelo de nuevo.',
  },
  loanModal: {
    subtitle: 'Simulación en tiempo real y envío de su solicitud', stepInformation: 'Información', stepSimulation: 'Simulación',
    disclaimer: 'Su solicitud se ha enviado para su evaluación. Esta simulación no constituye una oferta de crédito, una aprobación ni un compromiso de desembolso.',
    errorIntro: 'Revise los datos señalados:',
    identityNotice: 'Su identidad procede de su sesión segura. No puede sustituirse por un nombre o una dirección de correo introducidos libremente.',
    productUnavailable: 'No hay ninguna oferta de préstamo activa disponible en esta moneda.',
    fixedAnnualRate: 'TAE fija',
    perMonth: 'al mes', rateHypothesis: 'Hipótesis orientativa al {rate}',
  },
  transferModal: {
    subtitle: 'Orden preparada en {bankName} — ejecución fuera de la aplicación', stepRecipient: 'Beneficiario', stepDetails: 'Datos bancarios externos', stepAmount: 'Importe',
    errorIntro: 'Revise los datos señalados:', required: '{field} es obligatorio.', invalidEmail: 'Introduzca una dirección de correo válida.',
    canadaSelection: 'Indique el correo de Interac o los datos de depósito directo (tránsito, institución y cuenta).',
    positiveAmount: 'El importe debe ser superior a cero.', recipientPlaceholder: 'Ej.: Claire Dupont',
    destinationCanada: 'Canadá (CAD)', destinationEurozone: 'Zona euro (EUR)', destinationUsa: 'Estados Unidos (USD)', destinationSwiss: 'Suiza (CHF)', destinationUk: 'Reino Unido (GBP)', destinationLatam: 'América Latina', destinationAfrica: 'África',
    receivingCurrency: 'Moneda de recepción', accountOrClabe: 'Número de cuenta / CLABE / CPF', recipientInstitution: 'Entidad beneficiaria declarada',
    accountOrRib: 'Número de cuenta / RIB', accountOrRibPlaceholder: 'Número de cuenta o RIB', externalBankCode: 'Código externo BIC / SWIFT / entidad',
    transferMotive: 'Concepto de la transferencia (opcional)', motivePlaceholder: 'Ej.: factura 4029', externalFees: 'Comisiones externas', externalFeesUnknown: '{bankName} no las conoce',
    rateAsOf: 'Tipo indicativo a fecha de {date}', beneficiary: 'Beneficiario', motive: 'Concepto', saveInstruction: 'Guardar orden',
    fields: {
      recipientName: 'Nombre del beneficiario', iban: 'IBAN', bicSwift: 'Código BIC / SWIFT', routingNumber: 'Número de ruta', accountNumber: 'Número de cuenta',
      swissIban: 'IBAN suizo', clearingNumber: 'Número de clearing', sortCode: 'Sort code', accountOrClabe: 'Número de cuenta o CLABE', bankName: 'Nombre del banco',
      accountOrRib: 'Número de cuenta o RIB', bankCode: 'Código BIC / SWIFT / entidad', transitNumber: 'Número de tránsito', institutionNumber: 'Número de institución', interacEmail: 'Correo de Interac',
    },
  },
  accountTypes: { current: 'Cuenta corriente', savings: 'Cuenta de ahorro' },
  loanMotives: {
    personal: 'Proyecto personal', real_estate: 'Proyecto inmobiliario', vehicle: 'Compra de un vehículo',
    renovation: 'Obras y reformas', business_cashflow: 'Liquidez empresarial', other: 'Otro',
  },
  ledger: {
    migration_opening_balance: 'Saldo inicial', account_opening: 'Apertura de la cuenta',
    manual_adjustment: 'Ajuste realizado por el banco', transfer_debit: 'Transferencia a {recipient}',
    loan_credit: 'Desembolso del préstamo {reference}',
  },
  notifications: {
    title: 'Notificaciones', subtitle: 'Consulte el progreso de sus operaciones.',
    empty: 'No tiene notificaciones.', markAllRead: 'Marcar todo como leído', openItem: 'Abrir expediente', markRead: 'Marcar como leído',
    generic_info: { title: 'Información de su cuenta', message: 'Hay una actualización disponible en su espacio seguro.' },
    transfer_submitted: { title: 'Transferencia enviada', message: 'Su orden de transferencia se ha enviado para su revisión.' },
    transfer_approved: { title: 'Transferencia aprobada', message: 'Su transferencia ha sido aprobada para su ejecución.' },
    transfer_completed: { title: 'Transferencia ejecutada', message: 'Su transferencia se ha ejecutado correctamente.' },
    transfer_rejected: { title: 'Transferencia rechazada', message: 'Su orden de transferencia no ha sido aprobada.' },
    transfer_failed: { title: 'Transferencia no ejecutada', message: 'No se pudo ejecutar su transferencia. Consulte su estado.' },
    loan_submitted: { title: 'Solicitud de préstamo enviada', message: 'Su solicitud de préstamo se ha enviado para su evaluación.' },
    loan_approved: { title: 'Préstamo aprobado', message: 'Su solicitud de préstamo ha sido aprobada.' },
    loan_disbursed: { title: 'Préstamo desembolsado', message: 'Los fondos de su préstamo se han abonado en su cuenta.' },
    loan_rejected: { title: 'Solicitud de préstamo rechazada', message: 'Su solicitud de préstamo no ha sido aprobada.' },
    loan_failed: { title: 'Desembolso del préstamo interrumpido', message: 'No se pudo desembolsar su préstamo. Consulte su estado.' },
    kyc_submitted: { title: 'Expediente de identidad enviado', message: 'Su expediente de identidad se ha enviado para su verificación.' },
    kyc_information_requested: { title: 'Información adicional requerida', message: 'Se necesitan datos adicionales para verificar su identidad.' },
    kyc_resubmitted: { title: 'Correcciones enviadas', message: 'Sus correcciones se han enviado para su verificación.' },
    kyc_approved: { title: 'Identidad verificada', message: 'La verificación de su identidad ha finalizado.' },
    kyc_rejected: { title: 'Verificación de identidad no completada', message: 'No se pudo aprobar su expediente de identidad.' },
    document_available: { title: 'Nuevo documento disponible', message: 'Hay un nuevo documento oficial disponible en su cuenta.' },
  },
  documents: {
    bank_details: 'Datos bancarios', account_statement: 'Estado de cuenta',
    balance_certificate: 'Certificado de saldo', transfer_confirmation: 'Confirmación de transferencia',
    loan_disbursement_confirmation: 'Confirmación de desembolso del préstamo', loan_decision: 'Decisión de préstamo',
  },
  errors: {
    AUTH_REQUIRED: 'Su sesión ha caducado. Vuelva a iniciar sesión.',
    CONFIGURATION_UNAVAILABLE: 'El servicio no está disponible temporalmente.',
    INVALID_REQUEST: 'Algunos datos no son válidos. Revíselos.',
    NETWORK_ERROR: 'No se pudo conectar con el servicio. Inténtelo de nuevo.',
    NOT_FOUND: 'No se encontró el elemento solicitado.',
    PERMISSION_DENIED: 'No tiene autorización para realizar esta operación.',
    SAVE_FAILED: 'No se pudieron guardar los cambios. Inténtelo de nuevo.',
    UPLOAD_FAILED: 'La carga ha fallado. Inténtelo de nuevo.',
    UNKNOWN_ERROR: 'Se ha producido un error. Inténtelo de nuevo.',
  },
};

export const extraUserMessages: Record<Language, ExtraMessages> = { fr, en, de, es };

export const userMessages = {
  fr: { app: translations.fr, banking: bankingMessages.fr, public: publicMessages.fr, kyc: kycTranslations.fr, extra: fr },
  en: { app: translations.en, banking: bankingMessages.en, public: publicMessages.en, kyc: kycTranslations.en, extra: en },
  de: { app: translations.de, banking: bankingMessages.de, public: publicMessages.de, kyc: kycTranslations.de, extra: de },
  es: { app: translations.es, banking: bankingMessages.es, public: publicMessages.es, kyc: kycTranslations.es, extra: es },
} as const;

export function interpolate(message: string, params: Record<string, unknown> = {}) {
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    const value = params[key];
    return value === undefined || value === null || value === '' ? '—' : String(value);
  });
}

export function notificationCopy(
  language: Language,
  key: NotificationMessageKey,
  params: Record<string, unknown> = {},
) {
  const message = extraUserMessages[language].notifications[key];
  return { title: interpolate(message.title, params), message: interpolate(message.message, params) };
}

export function localizedAppError(language: Language, code: AppErrorCode = 'UNKNOWN_ERROR') {
  return extraUserMessages[language].errors[code];
}

export function appErrorCode(error: unknown): AppErrorCode {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    if (code === 'PGRST301' || code === '401') return 'AUTH_REQUIRED';
    if (code === '42501' || code === '403') return 'PERMISSION_DENIED';
    if (code === 'PGRST116' || code === '404') return 'NOT_FOUND';
    if ((fr.errors as Record<string, string>)[code]) return code as AppErrorCode;
  }
  if (error instanceof TypeError) return 'NETWORK_ERROR';
  return 'UNKNOWN_ERROR';
}

export function accountTypeLabel(language: Language, type: 'current' | 'savings') {
  return extraUserMessages[language].accountTypes[type];
}

export function loanMotiveLabel(language: Language, code: LoanMotiveCode) {
  return extraUserMessages[language].loanMotives[code];
}

export function normalizeLoanMotiveCode(value: string | null | undefined): LoanMotiveCode {
  const normalized = value?.trim().toLocaleLowerCase('fr-FR') ?? '';
  const mapping: Record<string, LoanMotiveCode> = {
    personal: 'personal', 'prêt personnel': 'personal', 'projet personnel': 'personal',
    real_estate: 'real_estate', 'projet immobilier': 'real_estate', immobilier: 'real_estate',
    vehicle: 'vehicle', 'achat véhicule': 'vehicle', 'achat véhicule / auto': 'vehicle', auto: 'vehicle',
    renovation: 'renovation', travaux: 'renovation', 'travaux / rénovation': 'renovation',
    business_cashflow: 'business_cashflow', 'trésorerie entreprise': 'business_cashflow',
    other: 'other', autre: 'other',
  };
  return mapping[normalized] ?? 'other';
}

export function ledgerEntryLabel(
  language: Language,
  kind: LedgerEntryKind,
  metadata: Record<string, unknown> = {},
) {
  return interpolate(extraUserMessages[language].ledger[kind], {
    recipient: metadata.recipient_name ?? metadata.recipient ?? extraUserMessages[language].common.unavailable,
    reference: metadata.loan_reference ?? metadata.reference ?? '',
  });
}

export function officialDocumentTitle(language: Language, type: OfficialDocumentType) {
  return extraUserMessages[language].documents[type];
}
