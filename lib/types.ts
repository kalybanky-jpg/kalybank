export type Language = 'fr' | 'en' | 'de' | 'es';

export type Currency = 'EUR' | 'USD' | 'CAD' | 'CHF' | 'GBP';

export type UserRole = 'user' | 'admin';

export type TransferType = 'canada' | 'eurozone' | 'usa' | 'swiss' | 'uk' | 'latam' | 'africa';

export interface BankAccount {
  id: string;
  name: string;
  /** IBAN assigned through the bank's internal account-opening process. */
  iban?: string;
  accountNumber?: string;
  bic?: string;
  accountHolderName?: string;
  institutionName?: string;
  branchName?: string;
  branchCode?: string;
  accountStatus?: 'pending' | 'active' | 'restricted' | 'closed';
  openedAt?: string;
  isDemo?: boolean;
  /** Balance maintained by bank staff in Monalyz. */
  balance: number;
  availableBalance?: number;
  currency: Currency;
  type: 'courant' | 'epargne';
  positionKind?: 'declared' | 'internally_reconciled';
  asOf?: string;
  ownerId?: string;
}

export interface Transaction {
  id: string;
  accountId?: string;
  title: string;
  date: string;
  amount: number;
  currency?: Currency;
  balanceAfter?: number;
  reference?: string;
  type: 'credit' | 'debit';
  category: 'salary' | 'shopping' | 'transfer' | 'entertainment' | 'groceries' | 'other';
  logo?: string;
  icon?: string;
}

export type OfficialDocumentType =
  | 'bank_details'
  | 'account_statement'
  | 'balance_certificate'
  | 'transfer_confirmation'
  | 'loan_disbursement_confirmation'
  | 'loan_decision';

export interface OfficialDocument {
  id: string;
  ownerId: string;
  accountId?: string;
  transferId?: string;
  loanId?: string;
  documentNumber: string;
  documentType: OfficialDocumentType;
  title: string;
  language: Language;
  periodStart?: string;
  periodEnd?: string;
  version: number;
  status: 'pending' | 'issued' | 'failed' | 'revoked';
  contentHash?: string;
  storagePath?: string;
  issuedAt?: string;
  revokedAt?: string;
  isDemo: boolean;
}

export interface PendingTransfer {
  id: string;
  ownerId: string;
  sourceAccountId?: string;
  recipientName: string;
  recipientAccount: string; // IBAN / Transit / Routing Number
  transferType: TransferType;
  amount: number;
  currency: Currency;
  convertedAmount: number;
  targetCurrency: string;
  date: string;
  status: 'en_attente' | 'en_cours' | 'valide' | 'rejete';
  workflowStatus?:
    | 'submitted'
    | 'under_review'
    | 'approved_for_external_execution'
    | 'external_execution_recorded'
    | 'external_settlement_confirmed'
    | 'rejected'
    | 'cancelled'
    | 'external_failed';
  complianceStep: number; // 1 to 4
  complianceProgress: number; // 0 to 100 percentage
  complianceChecks: {
    doubleValidation: 'termine' | 'en_cours' | 'en_attente';
    escalade: 'termine' | 'en_cours' | 'en_attente';
    controleConformite: 'termine' | 'en_cours' | 'en_attente';
    autorisationFinale: 'termine' | 'en_cours' | 'en_attente';
  };
  details?: {
    institutionNumber?: string;
    transitNumber?: string;
    routingNumber?: string;
    interacEmail?: string;
    bicSwift?: string;
    clearingNumber?: string;
    wireType?: string;
    motive?: string;
  };
}

export interface LoanApplication {
  id: string;
  ownerId: string;
  reference: string;
  clientName: string;
  clientEmail: string;
  requestDate: string;
  requestedAmount: number;
  approvedAmount: number;
  repaidAmount: number;
  currency: Currency;
  status: 'en_cours' | 'en_analyse' | 'valide' | 'refuse' | 'decaisse';
  workflowStatus?:
    | 'submitted'
    | 'under_review'
    | 'approved_for_external_funding'
    | 'external_funding_recorded'
    | 'external_settlement_confirmed'
    | 'rejected'
    | 'cancelled'
    | 'external_failed';
  currentStep: number; // 1: Demande envoyée, 2: Analyse, 3: Validation, 4: Conformité, 5: Décaissement, 6: Viré
  complianceProgress: number; // 0 to 100 percentage
  nextDueDate: string;
  disbursementAccount: string;
  creditedPositionId?: string;
  durationMonths: number;
  monthlyPayment: number;
  motive: string;
  complianceChecks: {
    doubleValidation: 'termine' | 'en_cours' | 'en_attente';
    escalade: 'termine' | 'en_cours' | 'en_attente';
    controleConformite: 'termine' | 'en_cours' | 'en_attente';
    autorisationFinale: 'termine' | 'en_cours' | 'en_attente';
  };
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success' | 'alert' | 'transfer' | 'loan';
}

export interface KYCApplication {
  id: string;
  ownerId?: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  address: {
    street: string;
    complement?: string;
    postalCode: string;
    city: string;
    country: string;
  };
  profile: {
    occupation: string;
    incomeRange: string;
    fatca: boolean; // US tax resident
    pep: boolean; // Politically Exposed Person
  };
  documents: {
    idFrontUrl: string;
    idBackUrl: string;
    selfieUrl: string;
  };
  status: 'en_attente' | 'valide' | 'rejete';
  workflowStatus?: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'needs_information';
  submittedAt: string;
  iban?: string;
  rejectionReason?: string;
}

export interface AdminActivityLog {
  id: string;
  timestamp: string;
  description: string;
  type: 'success' | 'info' | 'alert';
}

export interface CurrencyRates {
  base: Currency;
  rates: Record<string, number>;
  updatedAt: string;
}
