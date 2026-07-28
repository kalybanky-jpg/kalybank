'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type {
  AdminActivityLog,
  BankAccount,
  Currency,
  CurrencyRates,
  KYCApplication,
  Language,
  LoanApplication,
  PendingTransfer,
  SystemNotification,
  Transaction,
  UserRole,
} from './types';
import { DEFAULT_RATES, fetchLiveCurrencyRates } from './currency';
import {
  currencyExponent,
  fromMinorUnits,
  loanProgress,
  maskFinancialIdentifier,
  toMinorUnits,
  transferProgress,
} from './domain/financial';
import { createClient } from './supabase/client';
import { isPublicSupabaseConfigured } from './supabase/config';
import { deleteEvidence, uploadEvidence } from './evidence';
import { authFailureRedirect } from './security/navigation';

type ReviewKey =
  | 'doubleValidation'
  | 'escalade'
  | 'controleConformite'
  | 'autorisationFinale';
type ReviewState = 'termine' | 'en_cours' | 'en_attente';

interface AppState {
  language: Language;
  setLanguage: (language: Language) => void;
  role: UserRole;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  rates: CurrencyRates;
  setRates: (rates: CurrencyRates) => void;
  isMaskedBalance: boolean;
  toggleMaskBalance: () => void;
  isLoading: boolean;
  lastError: string | null;
  refreshData: () => Promise<void>;

  accounts: BankAccount[];
  transactions: Transaction[];
  pendingTransfers: PendingTransfer[];
  loans: LoanApplication[];
  notifications: SystemNotification[];
  activityLogs: AdminActivityLog[];
  kycApplications: KYCApplication[];

  isTransferModalOpen: boolean;
  setIsTransferModalOpen: (open: boolean) => void;
  isLoanModalOpen: boolean;
  setIsLoanModalOpen: (open: boolean) => void;
  isNotificationsDrawerOpen: boolean;
  setIsNotificationsDrawerOpen: (open: boolean) => void;
  isContactModalOpen: boolean;
  setIsContactModalOpen: (open: boolean) => void;
  isStatementsModalOpen: boolean;
  setIsStatementsModalOpen: (open: boolean) => void;
  selectedLoanForReview: LoanApplication | null;
  setSelectedLoanForReview: (loan: LoanApplication | null) => void;

  addTransfer: (
    transfer: Omit<
      PendingTransfer,
      | 'id'
      | 'date'
      | 'status'
      | 'complianceStep'
      | 'complianceProgress'
      | 'complianceChecks'
    >,
  ) => Promise<void>;
  addLoanApplication: (
    loan: Omit<
      LoanApplication,
      | 'id'
      | 'reference'
      | 'requestDate'
      | 'status'
      | 'currentStep'
      | 'complianceProgress'
      | 'repaidAmount'
      | 'complianceChecks'
    > & { evidenceFiles?: File[] },
  ) => Promise<void>;
  advanceLoanStep: (loanId: string) => Promise<void>;
  updateLoanComplianceCheck: (
    loanId: string,
    checkKey: ReviewKey,
    status: ReviewState,
  ) => Promise<void>;
  updateTransferComplianceCheck: (
    transferId: string,
    checkKey: ReviewKey,
    status: ReviewState,
  ) => Promise<void>;
  approveTransfer: (transferId: string) => Promise<void>;
  rejectTransfer: (transferId: string, reason?: string) => Promise<void>;
  recordTransferExternalExecution: (
    transferId: string,
    externalReference: string,
    evidenceFile: File,
    executedAt: string,
    note?: string,
  ) => Promise<void>;
  confirmTransferExternalSettlement: (
    transferId: string,
    note: string,
  ) => Promise<void>;
  rejectLoan: (loanId: string, reason: string) => Promise<void>;
  recordLoanExternalFunding: (
    loanId: string,
    externalReference: string,
    evidenceFile: File,
    executedAt: string,
    note?: string,
  ) => Promise<void>;
  confirmLoanExternalSettlement: (loanId: string, note: string) => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  approveKYCApplication: (kycId: string) => Promise<void>;
  rejectKYCApplication: (kycId: string, reason: string) => Promise<void>;
  updateAccountBalance: (
    accountId: string,
    newAmount: number,
    reason?: string,
  ) => Promise<void>;
}

interface ReviewRow {
  check_kind: string;
  status: string;
}

interface PositionRow {
  id: string;
  owner_id: string;
  label: string;
  position_kind: 'declared' | 'internally_reconciled';
  currency: string;
  amount_minor: number;
  reserved_minor: number;
  as_of: string;
  external_identifier_masked: string | null;
}

interface TransferRow {
  id: string;
  source_position_id: string;
  recipient_name: string;
  recipient_account_masked: string;
  beneficiary_details: Record<string, string>;
  transfer_type: PendingTransfer['transferType'];
  amount_minor: number;
  currency: Currency;
  target_amount_minor: number;
  target_currency: string;
  submitted_at: string;
  status: NonNullable<PendingTransfer['workflowStatus']>;
  transfer_review_checks?: ReviewRow[];
}

interface LoanRow {
  id: string;
  reference: string;
  requested_amount_minor: number;
  currency: Currency;
  duration_months: number;
  indicative_monthly_payment_minor: number | null;
  motive: string;
  submitted_at: string;
  status: NonNullable<LoanApplication['workflowStatus']>;
  loan_review_checks?: ReviewRow[];
  owner_id: string;
}

interface KycRow {
  id: string;
  owner_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  place_of_birth: string;
  nationality: string;
  address: KYCApplication['address'];
  occupation: string;
  income_range: string;
  fatca: boolean;
  pep: boolean;
  document_object_paths: Record<string, string>;
  status: NonNullable<KYCApplication['workflowStatus']>;
  submitted_at: string;
  review_note: string | null;
}

const REVIEW_KEYS: Record<ReviewKey, string> = {
  doubleValidation: 'dual_review',
  escalade: 'escalation',
  controleConformite: 'compliance',
  autorisationFinale: 'final_authorization',
};

const REVIEW_STATES: Record<ReviewState, string> = {
  termine: 'completed',
  en_cours: 'in_progress',
  en_attente: 'pending',
};

function friendlyDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function mapReviewChecks(rows: ReviewRow[] = []) {
  const get = (kind: string): ReviewState => {
    const status = rows.find((row) => row.check_kind === kind)?.status;
    if (status === 'completed') return 'termine';
    if (status === 'in_progress' || status === 'failed') return 'en_cours';
    return 'en_attente';
  };
  return {
    doubleValidation: get('dual_review'),
    escalade: get('escalation'),
    controleConformite: get('compliance'),
    autorisationFinale: get('final_authorization'),
  };
}

function mapTransferStatus(status: TransferRow['status']): PendingTransfer['status'] {
  if (status === 'external_settlement_confirmed') return 'valide';
  if (['rejected', 'cancelled', 'external_failed'].includes(status)) return 'rejete';
  if (status === 'submitted') return 'en_attente';
  return 'en_cours';
}

function mapLoanStatus(status: LoanRow['status']): LoanApplication['status'] {
  if (status === 'external_settlement_confirmed') return 'decaisse';
  if (status === 'rejected' || status === 'cancelled' || status === 'external_failed') {
    return 'refuse';
  }
  if (status === 'approved_for_external_funding' || status === 'external_funding_recorded') {
    return 'valide';
  }
  if (status === 'under_review') return 'en_analyse';
  return 'en_cours';
}

function mapKycStatus(status: KycRow['status']): KYCApplication['status'] {
  if (status === 'approved') return 'valide';
  if (status === 'rejected') return 'rejete';
  return 'en_attente';
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('fr');
  const [role, setRole] = useState<UserRole>('user');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [rates, setRates] = useState<CurrencyRates>(DEFAULT_RATES);
  const [isMaskedBalance, setIsMaskedBalance] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [activityLogs, setActivityLogs] = useState<AdminActivityLog[]>([]);
  const [kycApplications, setKycApplications] = useState<KYCApplication[]>([]);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isStatementsModalOpen, setIsStatementsModalOpen] = useState(false);
  const [selectedLoanForReview, setSelectedLoanForReview] =
    useState<LoanApplication | null>(null);

  const clearBusinessData = useCallback(() => {
    setAccounts([]);
    setTransactions([]);
    setPendingTransfers([]);
    setLoans([]);
    setNotifications([]);
    setActivityLogs([]);
    setKycApplications([]);
    setRole('user');
  }, []);

  const refreshData = useCallback(async () => {
    if (!isPublicSupabaseConfigured()) {
      clearBusinessData();
      setLastError('Supabase n’est pas configuré.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLastError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        clearBusinessData();
        const redirectPath = authFailureRedirect(
          window.location.pathname,
          window.location.search,
        );
        if (redirectPath) {
          if (userError) {
            await supabase.auth.signOut({ scope: 'local' });
          }
          window.location.replace(redirectPath);
        }
        return;
      }

      const [
        roleResult,
        profileResult,
        positionsResult,
        transfersResult,
        loansResult,
        notificationResult,
        kycResult,
        auditResult,
      ] = await Promise.all([
        supabase.rpc('current_app_role'),
        supabase.from('profiles').select('user_id,email'),
        supabase.from('financial_positions').select('*').order('created_at'),
        supabase
          .from('transfer_intents')
          .select('*,transfer_review_checks(check_kind,status)')
          .order('submitted_at', { ascending: false }),
        supabase
          .from('loan_applications')
          .select('*,loan_review_checks(check_kind,status)')
          .order('submitted_at', { ascending: false }),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }),
        supabase.from('kyc_applications').select('*').order('submitted_at', { ascending: false }),
        supabase.from('audit_events').select('*').order('created_at', { ascending: false }).limit(100),
      ]);

      const firstError = [
        roleResult,
        profileResult,
        positionsResult,
        transfersResult,
        loansResult,
        notificationResult,
        kycResult,
        auditResult,
      ].find((result) => result.error)?.error;
      if (firstError) throw firstError;

      setRole(roleResult.data && roleResult.data !== 'user' ? 'admin' : 'user');

      const profileEmails = new Map(
        (profileResult.data ?? []).map((profile) => [profile.user_id, profile.email]),
      );

      const positionRows = (positionsResult.data ?? []) as PositionRow[];
      setAccounts(
        positionRows.map((position) => ({
          id: position.id,
          ownerId: position.owner_id,
          name: position.label,
          iban: position.external_identifier_masked ?? 'Référence externe non renseignée',
          balance: fromMinorUnits(position.amount_minor, position.currency),
          availableBalance: fromMinorUnits(
            position.amount_minor - position.reserved_minor,
            position.currency,
          ),
          currency: position.currency as Currency,
          type: position.label.toLowerCase().includes('épargne') ? 'epargne' : 'courant',
          positionKind: position.position_kind,
          asOf: position.as_of,
        })),
      );

      const transferRows = (transfersResult.data ?? []) as TransferRow[];
      const mappedTransfers = transferRows.map((transfer): PendingTransfer => {
        const checks = mapReviewChecks(transfer.transfer_review_checks);
        const completed = Object.values(checks).filter((status) => status === 'termine').length;
        const details = transfer.beneficiary_details ?? {};
        return {
          id: transfer.id,
          sourceAccountId: transfer.source_position_id,
          recipientName: transfer.recipient_name,
          recipientAccount: transfer.recipient_account_masked,
          transferType: transfer.transfer_type,
          amount: fromMinorUnits(transfer.amount_minor, transfer.currency),
          currency: transfer.currency,
          convertedAmount: fromMinorUnits(
            transfer.target_amount_minor,
            transfer.target_currency,
          ),
          targetCurrency: transfer.target_currency,
          date: friendlyDate(transfer.submitted_at),
          status: mapTransferStatus(transfer.status),
          workflowStatus: transfer.status,
          complianceStep: Math.min(4, completed + 1),
          complianceProgress: transferProgress(transfer.status, completed),
          complianceChecks: checks,
          details: {
            institutionNumber: details.institutionNumber,
            transitNumber: details.transitNumber,
            routingNumber: details.routingNumber,
            interacEmail: details.interacEmail,
            bicSwift: details.bicSwift,
            clearingNumber: details.clearingNumber,
            motive: details.motive,
          },
        };
      });
      setPendingTransfers(mappedTransfers);
      setTransactions(
        mappedTransfers
          .filter((transfer) => transfer.workflowStatus === 'external_settlement_confirmed')
          .map((transfer) => ({
            id: `external-${transfer.id}`,
            title: `Règlement externe confirmé — ${transfer.recipientName}`,
            date: transfer.date,
            amount: -transfer.amount,
            type: 'debit' as const,
            category: 'transfer' as const,
          })),
      );

      const loanRows = (loansResult.data ?? []) as LoanRow[];
      setLoans(
        loanRows.map((loan): LoanApplication => {
          const checks = mapReviewChecks(loan.loan_review_checks);
          const completed = Object.values(checks).filter((status) => status === 'termine').length;
          const amount = fromMinorUnits(loan.requested_amount_minor, loan.currency);
          return {
            id: loan.id,
            reference: loan.reference,
            clientName: profileEmails.get(loan.owner_id)?.split('@')[0] ?? 'Utilisateur',
            clientEmail: profileEmails.get(loan.owner_id) ?? '',
            requestDate: friendlyDate(loan.submitted_at),
            requestedAmount: amount,
            approvedAmount:
              loan.status === 'approved_for_external_funding' ||
              loan.status === 'external_funding_recorded' ||
              loan.status === 'external_settlement_confirmed'
                ? amount
                : 0,
            repaidAmount: 0,
            currency: loan.currency,
            status: mapLoanStatus(loan.status),
            workflowStatus: loan.status,
            currentStep: Math.min(6, completed + 1),
            complianceProgress: loanProgress(loan.status, completed),
            nextDueDate: 'Non applicable avant contractualisation externe',
            disbursementAccount: 'Destination externe non connectée',
            durationMonths: loan.duration_months,
            monthlyPayment: loan.indicative_monthly_payment_minor
              ? fromMinorUnits(loan.indicative_monthly_payment_minor, loan.currency)
              : 0,
            motive: loan.motive,
            complianceChecks: checks,
          };
        }),
      );

      setNotifications(
        (notificationResult.data ?? []).map((notification) => ({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          timestamp: friendlyDate(notification.created_at),
          read: Boolean(notification.read_at),
          type:
            notification.notification_type === 'kyc'
              ? 'info'
              : notification.notification_type,
        })),
      );

      const kycRows = (kycResult.data ?? []) as KycRow[];
      const mappedKyc = await Promise.all(
        kycRows.map(async (kyc): Promise<KYCApplication> => {
          const pathEntries = Object.entries(kyc.document_object_paths ?? {});
          const signedEntries = await Promise.all(
            pathEntries.map(async ([key, path]) => {
              const { data } = await supabase.storage
                .from('kyc-evidence')
                .createSignedUrl(path, 300);
              return [key, data?.signedUrl ?? ''] as const;
            }),
          );
          const signed = Object.fromEntries(signedEntries);
          return {
            id: kyc.id,
            ownerId: kyc.owner_id,
            email: profileEmails.get(kyc.owner_id) ?? '',
            firstName: kyc.first_name,
            lastName: kyc.last_name,
            dateOfBirth: kyc.date_of_birth,
            placeOfBirth: kyc.place_of_birth,
            nationality: kyc.nationality,
            address: kyc.address,
            profile: {
              occupation: kyc.occupation,
              incomeRange: kyc.income_range,
              fatca: kyc.fatca,
              pep: kyc.pep,
            },
            documents: {
              idFrontUrl: signed.id_front ?? '',
              idBackUrl: signed.id_back ?? '',
              selfieUrl: signed.selfie ?? '',
            },
            status: mapKycStatus(kyc.status),
            workflowStatus: kyc.status,
            submittedAt: friendlyDate(kyc.submitted_at),
            rejectionReason: kyc.review_note ?? undefined,
          };
        }),
      );
      setKycApplications(mappedKyc);

      setActivityLogs(
        (auditResult.data ?? []).map((event) => ({
          id: String(event.id),
          timestamp: friendlyDate(event.created_at),
          description: `${event.action} — ${event.entity_type}`,
          type: event.action.includes('failed') || event.action.includes('reject')
            ? 'alert'
            : 'info',
        })),
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Chargement des données impossible.';
      setLastError(message);
      clearBusinessData();
    } finally {
      setIsLoading(false);
    }
  }, [clearBusinessData]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void refreshData();
    }, 0);
    if (!isPublicSupabaseConfigured()) {
      return () => window.clearTimeout(initialRefresh);
    }

    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearBusinessData();
        setIsLoading(false);
        if (
          authFailureRedirect(window.location.pathname, window.location.search)
        ) {
          window.location.replace('/login');
        }
        return;
      }
      window.setTimeout(() => {
        void refreshData();
      }, 0);
    });
    return () => {
      window.clearTimeout(initialRefresh);
      data.subscription.unsubscribe();
    };
  }, [clearBusinessData, refreshData]);

  useEffect(() => {
    void fetchLiveCurrencyRates().then(setRates);
  }, []);

  const executeAndRefresh = useCallback(
    async (
      operation: () => PromiseLike<{ error: { message: string } | null }>,
    ) => {
      setLastError(null);
      const { error } = await operation();
      if (error) {
        setLastError(error.message);
        throw new Error(error.message);
      }
      await refreshData();
    },
    [refreshData],
  );

  const addTransfer: AppState['addTransfer'] = async (transfer) => {
    const account = accounts.find((candidate) => candidate.id === transfer.sourceAccountId);
    if (!account) throw new Error('Position source introuvable.');
    const idempotencyKey = crypto.randomUUID();
    const rate =
      transfer.amount > 0 ? transfer.convertedAmount / transfer.amount : 0;

    await executeAndRefresh(() =>
      createClient().rpc('submit_transfer_intent', {
        p_source_position_id: account.id,
        p_recipient_name: transfer.recipientName.trim(),
        p_recipient_account_masked: maskFinancialIdentifier(transfer.recipientAccount),
        p_beneficiary_details: {
          recipientAccount: transfer.recipientAccount,
          ...transfer.details,
        },
        p_transfer_type: transfer.transferType,
        p_amount_minor: toMinorUnits(transfer.amount, account.currency),
        p_currency: account.currency,
        p_target_amount_minor: toMinorUnits(
          transfer.convertedAmount,
          transfer.targetCurrency,
        ),
        p_target_currency: transfer.targetCurrency,
        p_quote_rate: rate,
        p_quote_as_of: rates.updatedAt,
        p_motive: transfer.details?.motive ?? null,
        p_idempotency_key: idempotencyKey,
      }),
    );
  };

  const addLoanApplication: AppState['addLoanApplication'] = async (loan) => {
    if (!loan.evidenceFiles?.length) {
      throw new Error('Au moins un justificatif est obligatoire.');
    }

    setLastError(null);
    const supabase = createClient();
    const idempotencyKey = crypto.randomUUID();
    const uploadedPaths: string[] = [];
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Session expirée.');

      for (const file of loan.evidenceFiles) {
        if (
          file.size > 10 * 1024 * 1024 ||
          !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)
        ) {
          throw new Error('Chaque justificatif doit être un PDF, PNG ou JPEG de 10 Mo maximum.');
        }
        const path = await uploadEvidence(
          'loan-evidence',
          `${idempotencyKey}-${crypto.randomUUID()}`,
          file,
        );
        uploadedPaths.push(path);
      }

      const { error } = await supabase.rpc('submit_loan_application', {
        p_requested_amount_minor: toMinorUnits(loan.requestedAmount, loan.currency),
        p_currency: loan.currency,
        p_duration_months: loan.durationMonths,
        p_indicative_monthly_payment_minor: toMinorUnits(
          loan.monthlyPayment,
          loan.currency,
        ),
        p_indicative_annual_rate: 0.035,
        p_motive: loan.motive,
        p_document_object_paths: uploadedPaths,
        p_idempotency_key: idempotencyKey,
      });
      if (error) throw error;
      await refreshData();
    } catch (caughtError) {
      if (uploadedPaths.length) {
        await deleteEvidence('loan-evidence', uploadedPaths);
      }
      const message =
        caughtError instanceof Error ? caughtError.message : 'Dépôt de la demande impossible.';
      setLastError(message);
      throw new Error(message);
    }
  };

  const updateTransferComplianceCheck: AppState['updateTransferComplianceCheck'] =
    async (transferId, checkKey, status) => {
      await executeAndRefresh(() =>
        createClient().rpc('review_transfer_check', {
          p_transfer_id: transferId,
          p_check_kind: REVIEW_KEYS[checkKey],
          p_status: REVIEW_STATES[status],
          p_note: 'Contrôle enregistré depuis le Back-Office KALY.',
        }),
      );
    };

  const updateLoanComplianceCheck: AppState['updateLoanComplianceCheck'] = async (
    loanId,
    checkKey,
    status,
  ) => {
    await executeAndRefresh(() =>
      createClient().rpc('review_loan_check', {
        p_loan_id: loanId,
        p_check_kind: REVIEW_KEYS[checkKey],
        p_status: REVIEW_STATES[status],
        p_note: 'Contrôle enregistré depuis le Back-Office KALY.',
      }),
    );
  };

  const advanceLoanStep: AppState['advanceLoanStep'] = async (loanId) => {
    const loan = loans.find((candidate) => candidate.id === loanId);
    if (!loan) throw new Error('Dossier introuvable.');
    const next = (Object.keys(REVIEW_KEYS) as ReviewKey[]).find(
      (key) => loan.complianceChecks[key] !== 'termine',
    );
    if (!next) throw new Error('Tous les contrôles sont déjà terminés.');
    await updateLoanComplianceCheck(loanId, next, 'termine');
  };

  const approveTransfer: AppState['approveTransfer'] = async (transferId) => {
    const transfer = pendingTransfers.find((candidate) => candidate.id === transferId);
    if (!transfer) throw new Error('Instruction introuvable.');
    const incomplete = (Object.keys(REVIEW_KEYS) as ReviewKey[]).find(
      (key) => transfer.complianceChecks[key] !== 'termine',
    );
    if (incomplete) {
      throw new Error(
        'Tous les contrôles doivent être terminés avant l’autorisation de traitement externe.',
      );
    }
    await refreshData();
  };

  const rejectTransfer: AppState['rejectTransfer'] = async (
    transferId,
    reason = 'Instruction rejetée après contrôle manuel.',
  ) => {
    await executeAndRefresh(() =>
      createClient().rpc('transition_transfer', {
        p_transfer_id: transferId,
        p_action: 'reject',
        p_reason: reason,
      }),
    );
  };

  const uploadExternalEvidence = async (
    entityType: 'transfer' | 'loan',
    entityId: string,
    evidenceFile: File,
  ) => {
    if (
      evidenceFile.size > 10 * 1024 * 1024 ||
      !['image/jpeg', 'image/png', 'application/pdf'].includes(evidenceFile.type)
    ) {
      throw new Error('Le justificatif doit être un PDF, PNG ou JPEG de 10 Mo maximum.');
    }
    return uploadEvidence(
      'external-execution-evidence',
      `${entityType}-${entityId}-${crypto.randomUUID()}`,
      evidenceFile,
    );
  };

  const recordTransferExternalExecution: AppState['recordTransferExternalExecution'] =
    async (transferId, externalReference, evidenceFile, executedAt, note) => {
      const supabase = createClient();
      const path = await uploadExternalEvidence('transfer', transferId, evidenceFile);
      try {
        const { error } = await supabase.rpc('transition_transfer', {
          p_transfer_id: transferId,
          p_action: 'record_external_execution',
          p_reason: note ?? null,
          p_external_reference: externalReference.trim(),
          p_evidence_object_path: path,
          p_executed_at: new Date(executedAt).toISOString(),
        });
        if (error) throw error;
        await refreshData();
      } catch (caughtError) {
        await deleteEvidence('external-execution-evidence', [path]);
        throw caughtError;
      }
    };

  const confirmTransferExternalSettlement: AppState['confirmTransferExternalSettlement'] =
    async (transferId, note) => {
      await executeAndRefresh(() =>
        createClient().rpc('transition_transfer', {
          p_transfer_id: transferId,
          p_action: 'confirm_external_settlement',
          p_reason: note,
        }),
      );
    };

  const rejectLoan: AppState['rejectLoan'] = async (loanId, reason) => {
    await executeAndRefresh(() =>
      createClient().rpc('transition_loan', {
        p_loan_id: loanId,
        p_action: 'reject',
        p_reason: reason,
      }),
    );
  };

  const recordLoanExternalFunding: AppState['recordLoanExternalFunding'] = async (
    loanId,
    externalReference,
    evidenceFile,
    executedAt,
    note,
  ) => {
    const supabase = createClient();
    const path = await uploadExternalEvidence('loan', loanId, evidenceFile);
    try {
      const { error } = await supabase.rpc('transition_loan', {
        p_loan_id: loanId,
        p_action: 'record_external_funding',
        p_reason: note ?? null,
        p_external_reference: externalReference.trim(),
        p_evidence_object_path: path,
        p_executed_at: new Date(executedAt).toISOString(),
      });
      if (error) throw error;
      await refreshData();
    } catch (caughtError) {
      await deleteEvidence('external-execution-evidence', [path]);
      throw caughtError;
    }
  };

  const confirmLoanExternalSettlement: AppState['confirmLoanExternalSettlement'] = async (
    loanId,
    note,
  ) => {
    await executeAndRefresh(() =>
      createClient().rpc('transition_loan', {
        p_loan_id: loanId,
        p_action: 'confirm_external_settlement',
        p_reason: note,
      }),
    );
  };

  const markNotificationAsRead: AppState['markNotificationAsRead'] = async (
    notificationId,
  ) => {
    await executeAndRefresh(() =>
      createClient().rpc('mark_notification_read', {
        p_notification_id: notificationId,
      }),
    );
  };

  const approveKYCApplication: AppState['approveKYCApplication'] = async (kycId) => {
    await executeAndRefresh(() =>
      createClient().rpc('review_kyc_application', {
        p_kyc_id: kycId,
        p_status: 'approved',
        p_note: 'Identité approuvée après contrôle humain.',
      }),
    );
  };

  const rejectKYCApplication: AppState['rejectKYCApplication'] = async (
    kycId,
    reason,
  ) => {
    await executeAndRefresh(() =>
      createClient().rpc('review_kyc_application', {
        p_kyc_id: kycId,
        p_status: 'rejected',
        p_note: reason,
      }),
    );
  };

  const updateAccountBalance: AppState['updateAccountBalance'] = async (
    accountId,
    newAmount,
    reason = 'Rapprochement manuel avec justificatif externe.',
  ) => {
    const account = accounts.find((candidate) => candidate.id === accountId);
    if (!account) throw new Error('Position introuvable.');
    if (!Number.isFinite(newAmount) || newAmount < 0) {
      throw new Error('La position déclarée ne peut pas être négative.');
    }
    const factor = 10 ** currencyExponent(account.currency);
    const currentMinor = Math.round(account.balance * factor);
    const targetMinor = Math.round(newAmount * factor);
    const delta = targetMinor - currentMinor;
    if (delta === 0) return;

    await executeAndRefresh(() =>
      createClient().rpc('adjust_financial_position', {
        p_position_id: accountId,
        p_delta_minor: delta,
        p_as_of: new Date().toISOString(),
        p_reason: reason,
      }),
    );
  };

  const value: AppState = {
    language,
    setLanguage,
    role,
    activeTab,
    setActiveTab,
    currency,
    setCurrency,
    rates,
    setRates,
    isMaskedBalance,
    toggleMaskBalance: () => setIsMaskedBalance((masked) => !masked),
    isLoading,
    lastError,
    refreshData,
    accounts,
    transactions,
    pendingTransfers,
    loans,
    notifications,
    activityLogs,
    kycApplications,
    isTransferModalOpen,
    setIsTransferModalOpen,
    isLoanModalOpen,
    setIsLoanModalOpen,
    isNotificationsDrawerOpen,
    setIsNotificationsDrawerOpen,
    isContactModalOpen,
    setIsContactModalOpen,
    isStatementsModalOpen,
    setIsStatementsModalOpen,
    selectedLoanForReview,
    setSelectedLoanForReview,
    addTransfer,
    addLoanApplication,
    advanceLoanStep,
    updateLoanComplianceCheck,
    updateTransferComplianceCheck,
    approveTransfer,
    rejectTransfer,
    recordTransferExternalExecution,
    confirmTransferExternalSettlement,
    rejectLoan,
    recordLoanExternalFunding,
    confirmLoanExternalSettlement,
    markNotificationAsRead,
    approveKYCApplication,
    rejectKYCApplication,
    updateAccountBalance,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore doit être utilisé dans AppProvider.');
  return context;
}
