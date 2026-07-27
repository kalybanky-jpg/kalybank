export type Language = 'fr' | 'en' | 'de' | 'es';

export type Currency = 'EUR' | 'USD' | 'CAD' | 'CHF' | 'GBP';

export type UserRole = 'user' | 'admin';

export type TransferType = 'canada' | 'eurozone' | 'usa' | 'swiss' | 'uk' | 'latam' | 'africa';

export interface BankAccount {
  id: string;
  name: string;
  iban: string;
  balance: number;
  currency: Currency;
  type: 'courant' | 'epargne';
}

export interface Transaction {
  id: string;
  title: string;
  date: string;
  amount: number;
  type: 'credit' | 'debit';
  category: 'salary' | 'shopping' | 'transfer' | 'entertainment' | 'groceries' | 'other';
  logo?: string;
  icon?: string;
}

export interface PendingTransfer {
  id: string;
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
  reference: string;
  clientName: string;
  clientEmail: string;
  requestDate: string;
  requestedAmount: number;
  approvedAmount: number;
  repaidAmount: number;
  currency: Currency;
  status: 'en_cours' | 'en_analyse' | 'valide' | 'refuse' | 'decaisse';
  currentStep: number; // 1: Demande envoyée, 2: Analyse, 3: Validation, 4: Conformité, 5: Décaissement, 6: Viré
  complianceProgress: number; // 0 to 100 percentage
  nextDueDate: string;
  disbursementAccount: string;
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
  email: string;
  pin: string;
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
  submittedAt: string;
  iban?: string;
  rejectionReason?: string;
}

export interface EmailNotification {
  id: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  previewText: string;
  bodyHtml: string;
  sentAt: string;
  type:
    | 'wire_submitted'
    | 'wire_approved'
    | 'loan_submitted'
    | 'loan_updated'
    | 'compliance_alert'
    | 'otp_verification'
    | 'kyc_submitted'
    | 'account_approved'
    | 'action_required';
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
