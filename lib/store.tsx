'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  BankAccount,
  Transaction,
  PendingTransfer,
  LoanApplication,
  SystemNotification,
  EmailNotification,
  AdminActivityLog,
  Language,
  Currency,
  UserRole,
  CurrencyRates,
  KYCApplication,
} from './types';
import { DEFAULT_RATES, fetchLiveCurrencyRates, convertAnyAmount, getDefaultCurrencyByCountry } from './currency';
import {
  createWireSubmittedEmail,
  createLoanStatusEmail,
  createComplianceAlertEmail,
  createOtpVerificationEmail,
  createKycSubmittedEmail,
  createAccountApprovedEmail,
  createKycRejectedEmail,
} from './emailService';

interface AppState {
  language: Language;
  setLanguage: (lang: Language) => void;
  role: UserRole;
  setRole: (r: UserRole) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates: CurrencyRates;
  setRates: (r: CurrencyRates) => void;
  isMaskedBalance: boolean;
  toggleMaskBalance: () => void;

  accounts: BankAccount[];
  transactions: Transaction[];
  pendingTransfers: PendingTransfer[];
  loans: LoanApplication[];
  notifications: SystemNotification[];
  emails: EmailNotification[];
  activityLogs: AdminActivityLog[];
  kycApplications: KYCApplication[];

  // Modals & Drawers state
  isTransferModalOpen: boolean;
  setIsTransferModalOpen: (open: boolean) => void;
  isLoanModalOpen: boolean;
  setIsLoanModalOpen: (open: boolean) => void;
  isEmailDrawerOpen: boolean;
  setIsEmailDrawerOpen: (open: boolean) => void;
  isNotificationsDrawerOpen: boolean;
  setIsNotificationsDrawerOpen: (open: boolean) => void;
  isContactModalOpen: boolean;
  setIsContactModalOpen: (open: boolean) => void;
  isSupabaseModalOpen: boolean;
  setIsSupabaseModalOpen: (open: boolean) => void;
  isStatementsModalOpen: boolean;
  setIsStatementsModalOpen: (open: boolean) => void;

  // Selected item for admin detailed compliance review
  selectedLoanForReview: LoanApplication | null;
  setSelectedLoanForReview: (loan: LoanApplication | null) => void;

  // Actions
  addTransfer: (transferData: Omit<PendingTransfer, 'id' | 'date' | 'status' | 'complianceStep' | 'complianceProgress' | 'complianceChecks'>) => void;
  addLoanApplication: (loanData: Omit<LoanApplication, 'id' | 'reference' | 'requestDate' | 'status' | 'currentStep' | 'complianceProgress' | 'repaidAmount' | 'complianceChecks'>) => void;
  advanceLoanStep: (loanId: string) => void;
  updateLoanComplianceCheck: (
    loanId: string,
    checkKey: 'doubleValidation' | 'escalade' | 'controleConformite' | 'autorisationFinale',
    newStatus: 'termine' | 'en_cours' | 'en_attente'
  ) => void;
  updateTransferComplianceCheck: (
    transferId: string,
    checkKey: 'doubleValidation' | 'escalade' | 'controleConformite' | 'autorisationFinale',
    newStatus: 'termine' | 'en_cours' | 'en_attente'
  ) => void;
  approveTransfer: (transferId: string) => void;
  rejectTransfer: (transferId: string) => void;
  markNotificationAsRead: (notifId: string) => void;
  sendOtpEmail: (email: string) => string;
  addKYCApplication: (appData: Omit<KYCApplication, 'id' | 'submittedAt' | 'status'>) => string;
  approveKYCApplication: (kycId: string) => void;
  rejectKYCApplication: (kycId: string, reason: string) => void;
  updateAccountBalance: (accountId: string, newBalance: number) => void;
  resetToDefaults: () => void;
}

const STORAGE_KEY = 'novabank_state_v1';

const INITIAL_ACCOUNTS: BankAccount[] = [
  {
    id: 'acc_1',
    name: 'Compte courant',
    iban: 'FR76 1234 5678 9012 3456 789',
    balance: 12540.45,
    currency: 'EUR',
    type: 'courant',
  },
  {
    id: 'acc_2',
    name: 'Compte épargne',
    iban: 'FR76 9876 5432 1098 7654 321',
    balance: 6000.0,
    currency: 'EUR',
    type: 'epargne',
  },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_1',
    title: 'Salaire',
    date: '24 mai 2024',
    amount: 2450.0,
    type: 'credit',
    category: 'salary',
  },
  {
    id: 'tx_2',
    title: 'Amazon.fr',
    date: '24 mai 2024',
    amount: -59.99,
    type: 'debit',
    category: 'shopping',
  },
  {
    id: 'tx_3',
    title: 'Carrefour',
    date: '22 mai 2024',
    amount: -87.64,
    type: 'debit',
    category: 'groceries',
  },
  {
    id: 'tx_4',
    title: 'Virement vers Emma',
    date: '18 mai 2024',
    amount: 120.0,
    type: 'credit',
    category: 'transfer',
  },
  {
    id: 'tx_5',
    title: 'Netflix',
    date: '20 mai 2024',
    amount: -15.99,
    type: 'debit',
    category: 'entertainment',
  },
  {
    id: 'tx_6',
    title: 'Apple.com',
    date: '18 mai 2024',
    amount: -2.99,
    type: 'debit',
    category: 'shopping',
  },
];

const INITIAL_PENDING_TRANSFERS: PendingTransfer[] = [
  {
    id: 'tr_1',
    recipientName: 'Claire Dupont',
    recipientAccount: 'FR76 1234 5678 9012 3456 789',
    transferType: 'eurozone',
    amount: 850.0,
    currency: 'EUR',
    convertedAmount: 850.0,
    targetCurrency: 'EUR',
    date: '18 mai 2024',
    status: 'en_cours',
    complianceStep: 3,
    complianceProgress: 50,
    complianceChecks: {
      doubleValidation: 'termine',
      escalade: 'termine',
      controleConformite: 'en_cours',
      autorisationFinale: 'en_attente',
    },
  },
  {
    id: 'tr_2',
    recipientName: 'SARL Design Plus',
    recipientAccount: 'FR76 9876 5432 1098 7654 321',
    transferType: 'eurozone',
    amount: 1200.0,
    currency: 'EUR',
    convertedAmount: 1200.0,
    targetCurrency: 'EUR',
    date: '19 mai 2024',
    status: 'en_attente',
    complianceStep: 2,
    complianceProgress: 25,
    complianceChecks: {
      doubleValidation: 'termine',
      escalade: 'en_cours',
      controleConformite: 'en_attente',
      autorisationFinale: 'en_attente',
    },
  },
];

const INITIAL_LOANS: LoanApplication[] = [
  {
    id: 'loan_1',
    reference: 'PP-2024-0005678',
    clientName: 'Thomas Martin',
    clientEmail: 'urbainmorel@gmail.com',
    requestDate: '15 mai 2024',
    requestedAmount: 8000.0,
    approvedAmount: 8000.0,
    repaidAmount: 2679.55, // 8000 - 5320.45 remaining
    currency: 'EUR',
    status: 'en_cours',
    currentStep: 3, // Validation
    complianceProgress: 82,
    nextDueDate: '15 juin 2024',
    disbursementAccount: 'Compte courant (FR76 ... 789)',
    durationMonths: 36,
    monthlyPayment: 238.5,
    motive: 'Prêt personnel',
    complianceChecks: {
      doubleValidation: 'termine',
      escalade: 'termine',
      controleConformite: 'en_cours',
      autorisationFinale: 'en_attente',
    },
  },
  {
    id: 'loan_2',
    reference: 'PP-2024-0005671',
    clientName: 'SARL Design Plus',
    clientEmail: 'contact@sarldesignplus.fr',
    requestDate: '16 mai 2024',
    requestedAmount: 12000.0,
    approvedAmount: 12000.0,
    repaidAmount: 0,
    currency: 'EUR',
    status: 'en_cours',
    currentStep: 2,
    complianceProgress: 40,
    nextDueDate: '01 juillet 2024',
    disbursementAccount: 'FR76 9876 5432 1098 7654 321',
    durationMonths: 24,
    monthlyPayment: 520.0,
    motive: 'Équipement professionnel',
    complianceChecks: {
      doubleValidation: 'termine',
      escalade: 'en_cours',
      controleConformite: 'en_attente',
      autorisationFinale: 'en_attente',
    },
  },
  {
    id: 'loan_3',
    reference: 'PP-2024-0005669',
    clientName: 'Emma Martin',
    clientEmail: 'emma.martin@example.com',
    requestDate: '17 mai 2024',
    requestedAmount: 5200.0,
    approvedAmount: 5200.0,
    repaidAmount: 0,
    currency: 'EUR',
    status: 'en_cours',
    currentStep: 3,
    complianceProgress: 75,
    nextDueDate: '15 juin 2024',
    disbursementAccount: 'FR76 1111 2222 3333 4444 555',
    durationMonths: 12,
    monthlyPayment: 445.0,
    motive: 'Projet travaux',
    complianceChecks: {
      doubleValidation: 'termine',
      escalade: 'termine',
      controleConformite: 'en_cours',
      autorisationFinale: 'en_attente',
    },
  },
  {
    id: 'loan_4',
    reference: 'PP-2024-0005662',
    clientName: 'Amazon.fr',
    clientEmail: 'finance@amazon.fr',
    requestDate: '18 mai 2024',
    requestedAmount: 15000.0,
    approvedAmount: 15000.0,
    repaidAmount: 15000.0,
    currency: 'EUR',
    status: 'decaisse',
    currentStep: 6,
    complianceProgress: 100,
    nextDueDate: 'Terminé',
    disbursementAccount: 'FR76 8888 7777 6666 5555 444',
    durationMonths: 48,
    monthlyPayment: 340.0,
    motive: 'Achat matériel',
    complianceChecks: {
      doubleValidation: 'termine',
      escalade: 'termine',
      controleConformite: 'termine',
      autorisationFinale: 'termine',
    },
  },
  {
    id: 'loan_5',
    reference: 'PP-2024-0005659',
    clientName: 'Carrefour',
    clientEmail: 'facturation@carrefour.fr',
    requestDate: '19 mai 2024',
    requestedAmount: 9500.0,
    approvedAmount: 9500.0,
    repaidAmount: 0,
    currency: 'EUR',
    status: 'en_analyse',
    currentStep: 1,
    complianceProgress: 15,
    nextDueDate: 'En attente',
    disbursementAccount: 'FR76 3333 4444 5555 6666 777',
    durationMonths: 24,
    monthlyPayment: 412.0,
    motive: 'Trésorerie',
    complianceChecks: {
      doubleValidation: 'en_cours',
      escalade: 'en_attente',
      controleConformite: 'en_attente',
      autorisationFinale: 'en_attente',
    },
  },
];

const INITIAL_NOTIFICATIONS: SystemNotification[] = [
  {
    id: 'n1',
    title: 'Avis de conformité',
    message: 'Votre dossier PP-2024-0005678 est actuellement à 82% de validation.',
    timestamp: 'Il y a 10 min',
    read: false,
    type: 'info',
  },
  {
    id: 'n2',
    title: 'Demande de prêt enregistrée',
    message: 'La demande de prêt personnel de 8 000,00 € a passé la double validation interne.',
    timestamp: 'Il y a 1 heure',
    read: false,
    type: 'success',
  },
];

const INITIAL_EMAILS: EmailNotification[] = [
  createLoanStatusEmail(
    'Thomas Martin',
    'urbainmorel@gmail.com',
    'PP-2024-0005678',
    'Contrôle conformité',
    '82% d\'avancement',
    '8 000,00 €'
  ),
  createComplianceAlertEmail(
    'SARL Design Plus',
    'contact@sarldesignplus.fr',
    'PP-2024-0005671',
    'Escalade hiérarchique lancée par le service conformité.'
  ),
];

const INITIAL_ACTIVITY_LOGS: AdminActivityLog[] = [
  {
    id: 'a1',
    timestamp: '10:45',
    description: 'Décaissement effectué pour Claire Dupont',
    type: 'success',
  },
  {
    id: 'a2',
    timestamp: '10:30',
    description: 'Demande PP-2024-0005671 validée par Manager',
    type: 'info',
  },
  {
    id: 'a3',
    timestamp: '10:15',
    description: 'Contrôle conformité terminé - Emma Martin',
    type: 'success',
  },
  {
    id: 'a4',
    timestamp: '09:58',
    description: 'Alerte conformité – Document manquant',
    type: 'alert',
  },
  {
    id: 'a5',
    timestamp: '09:40',
    description: 'Escalade hiérarchique lancée - SARL Design Plus',
    type: 'info',
  },
];

const INITIAL_KYC_APPLICATIONS: KYCApplication[] = [
  {
    id: 'kyc_1001',
    email: 'thomas.martin@example.com',
    pin: '1234',
    firstName: 'Thomas',
    lastName: 'Martin',
    dateOfBirth: '1990-05-14',
    placeOfBirth: 'Paris (75015)',
    nationality: 'Française',
    address: {
      street: '14 Rue de la Paix',
      complement: 'Apt 4B',
      postalCode: '75002',
      city: 'Paris',
      country: 'France',
    },
    profile: {
      occupation: 'Salarié',
      incomeRange: '1500-3000€',
      fatca: false,
      pep: false,
    },
    documents: {
      idFrontUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
      idBackUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      selfieUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
    },
    status: 'en_attente',
    submittedAt: '23 juil. 2026 - 10:15',
  },
  {
    id: 'kyc_1002',
    email: 'sophie.bernard@example.com',
    pin: '5678',
    firstName: 'Sophie',
    lastName: 'Bernard',
    dateOfBirth: '1988-11-20',
    placeOfBirth: 'Lyon (69002)',
    nationality: 'Française',
    address: {
      street: '8 Place Bellecour',
      postalCode: '69002',
      city: 'Lyon',
      country: 'France',
    },
    profile: {
      occupation: 'Indépendant',
      incomeRange: '>3000€',
      fatca: false,
      pep: false,
    },
    documents: {
      idFrontUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
      idBackUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      selfieUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
    },
    status: 'valide',
    submittedAt: '22 juil. 2026 - 14:30',
    iban: 'FR76 3000 2026 0001 8829 331',
  },
];

function generateIBAN(): string {
  const bankCode = '3000';
  const counterCode = '2026';
  const accountNum = Math.floor(10000000000 + Math.random() * 90000000000).toString();
  const ribKey = Math.floor(10 + Math.random() * 89).toString();
  return `FR76 ${bankCode} ${counterCode} ${accountNum.substring(0, 4)} ${accountNum.substring(4, 8)} ${ribKey}`;
}

const AppContext = createContext<AppState | undefined>(undefined);

function getInitialStorageData<T>(key: string, fallback: T): T {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed[key] !== undefined) return parsed[key];
      }
    } catch (e) {
      // ignore
    }
  }
  return fallback;
}

let globalIdSequence = 0;
const uniqueId = (prefix: string) => {
  globalIdSequence += 1;
  return `${prefix}_${Date.now()}_${globalIdSequence}_${Math.random().toString(36).substring(2, 6)}`;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [language, setLanguage] = useState<Language>('fr');
  const [role, setRole] = useState<UserRole>('user');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [rates, setRates] = useState<CurrencyRates>(DEFAULT_RATES);
  const [isMaskedBalance, setIsMaskedBalance] = useState<boolean>(false);

  const [accounts, setAccounts] = useState<BankAccount[]>(INITIAL_ACCOUNTS);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>(INITIAL_PENDING_TRANSFERS);
  const [loans, setLoans] = useState<LoanApplication[]>(INITIAL_LOANS);
  const [notifications, setNotifications] = useState<SystemNotification[]>(INITIAL_NOTIFICATIONS);
  const [emails, setEmails] = useState<EmailNotification[]>(INITIAL_EMAILS);
  const [activityLogs, setActivityLogs] = useState<AdminActivityLog[]>(INITIAL_ACTIVITY_LOGS);
  const [kycApplications, setKycApplications] = useState<KYCApplication[]>(INITIAL_KYC_APPLICATIONS);

  const setCurrencyAndConvert = (newCurrency: Currency) => {
    setCurrency(newCurrency);
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.currency !== newCurrency) {
          const convertedBalance = convertAnyAmount(acc.balance, acc.currency, newCurrency, rates);
          return {
            ...acc,
            balance: Number(convertedBalance.toFixed(2)),
            currency: newCurrency,
          };
        }
        return acc;
      })
    );
  };

  // Load saved state from localStorage after initial client mount to avoid hydration mismatch
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            const activeCurrency = (parsed.currency || 'EUR') as Currency;
            if (parsed.language) setLanguage(parsed.language);
            if (parsed.currency) setCurrency(activeCurrency);
            if (parsed.accounts) {
              const alignedAccounts = parsed.accounts.map((acc: BankAccount) => {
                if (acc.currency !== activeCurrency) {
                  const converted = convertAnyAmount(acc.balance, acc.currency, activeCurrency, DEFAULT_RATES);
                  return {
                    ...acc,
                    balance: Number(converted.toFixed(2)),
                    currency: activeCurrency,
                  };
                }
                return acc;
              });
              setAccounts(alignedAccounts);
            }
            if (parsed.transactions) setTransactions(parsed.transactions);
            if (parsed.pendingTransfers) setPendingTransfers(parsed.pendingTransfers);
            if (parsed.loans) setLoans(parsed.loans);
            if (parsed.notifications) setNotifications(parsed.notifications);
            if (parsed.emails) setEmails(parsed.emails);
            if (parsed.activityLogs) setActivityLogs(parsed.activityLogs);
            if (parsed.kycApplications) setKycApplications(parsed.kycApplications);
          } else {
            const activeKyc = INITIAL_KYC_APPLICATIONS.find((app) => app.status === 'valide');
            if (activeKyc) {
              const detected = getDefaultCurrencyByCountry(activeKyc.address.country);
              setCurrency(detected);
              setAccounts((prev) =>
                prev.map((acc) => ({
                  ...acc,
                  currency: detected,
                }))
              );
            }
          }
        } catch (e) {
          console.warn('Could not restore saved state from localStorage', e);
        } finally {
          setIsLoaded(true);
        }
      } else {
        setIsLoaded(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Modals
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [isEmailDrawerOpen, setIsEmailDrawerOpen] = useState(false);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isStatementsModalOpen, setIsStatementsModalOpen] = useState(false);
  const [selectedLoanForReview, setSelectedLoanForReview] = useState<LoanApplication | null>(null);

  // Fetch live currency rates on mount
  useEffect(() => {
    fetchLiveCurrencyRates().then((liveRates) => {
      setRates(liveRates);
    });
  }, []);

  // Save changes to localStorage only after initial load
  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      const payload = {
        accounts,
        transactions,
        pendingTransfers,
        loans,
        notifications,
        emails,
        activityLogs,
        kycApplications,
        language,
        currency,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  }, [isLoaded, accounts, transactions, pendingTransfers, loans, notifications, emails, activityLogs, kycApplications, language, currency]);

  const toggleMaskBalance = () => setIsMaskedBalance((prev) => !prev);

  const addTransfer = (
    transferData: Omit<
      PendingTransfer,
      'id' | 'date' | 'status' | 'complianceStep' | 'complianceProgress' | 'complianceChecks'
    >
  ) => {
    const newId = uniqueId('tr');
    const formattedDate = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const newTransfer: PendingTransfer = {
      ...transferData,
      id: newId,
      date: formattedDate,
      status: 'en_attente',
      complianceStep: 1,
      complianceProgress: 25,
      complianceChecks: {
        doubleValidation: 'en_cours',
        escalade: 'en_attente',
        controleConformite: 'en_attente',
        autorisationFinale: 'en_attente',
      },
    };

    // Deduct the amount immediately from the selected account
    if (transferData.sourceAccountId) {
      setAccounts((prevAccounts) =>
        prevAccounts.map((acc) => {
          if (acc.id === transferData.sourceAccountId) {
            return {
              ...acc,
              balance: Number((acc.balance - transferData.amount).toFixed(2)),
            };
          }
          return acc;
        })
      );
    }

    setPendingTransfers((prev) => [newTransfer, ...prev]);

    // Create system notification
    const newNotif: SystemNotification = {
      id: uniqueId('n'),
      title: 'Virement initié',
      message: `Virement de ${transferData.amount} ${transferData.currency} vers ${transferData.recipientName} enregistré.`,
      timestamp: 'À l\'instant',
      read: false,
      type: 'transfer',
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // Send automated email
    const email = createWireSubmittedEmail(
      'Thomas Martin',
      'urbainmorel@gmail.com',
      `${transferData.amount} ${transferData.currency}`,
      transferData.recipientName,
      newId.toUpperCase()
    );
    setEmails((prev) => [email, ...prev]);

    // Add activity log for admin
    const newLog: AdminActivityLog = {
      id: uniqueId('log'),
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      description: `Nouveau virement soumis : ${transferData.recipientName} (${transferData.amount} ${transferData.currency})`,
      type: 'info',
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  const addLoanApplication = (
    loanData: Omit<
      LoanApplication,
      'id' | 'reference' | 'requestDate' | 'status' | 'currentStep' | 'complianceProgress' | 'repaidAmount' | 'complianceChecks'
    >
  ) => {
    const newRef = `PP-2024-${Math.floor(1000000 + Math.random() * 9000000)}`;
    const formattedDate = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const newLoan: LoanApplication = {
      ...loanData,
      id: uniqueId('loan'),
      reference: newRef,
      requestDate: formattedDate,
      status: 'en_analyse',
      currentStep: 1,
      complianceProgress: 15,
      repaidAmount: 0,
      complianceChecks: {
        doubleValidation: 'en_cours',
        escalade: 'en_attente',
        controleConformite: 'en_attente',
        autorisationFinale: 'en_attente',
      },
    };

    setLoans((prev) => [newLoan, ...prev]);

    // System notification
    const newNotif: SystemNotification = {
      id: uniqueId('n'),
      title: 'Prêt enregistré',
      message: `Demande ${newRef} de ${loanData.requestedAmount} € transmise au service analyse.`,
      timestamp: 'À l\'instant',
      read: false,
      type: 'loan',
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // Email notification
    const email = createLoanStatusEmail(
      loanData.clientName,
      loanData.clientEmail || 'urbainmorel@gmail.com',
      newRef,
      'Demande reçue',
      'Analyse initiale en cours',
      `${loanData.requestedAmount} €`
    );
    setEmails((prev) => [email, ...prev]);

    // Admin activity
    const newLog: AdminActivityLog = {
      id: uniqueId('log'),
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      description: `Nouvelle demande de prêt reçue : ${newRef} (${loanData.clientName})`,
      type: 'info',
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  const advanceLoanStep = (loanId: string) => {
    setLoans((prev) =>
      prev.map((l) => {
        if (l.id !== loanId) return l;

        const nextStep = Math.min(6, l.currentStep + 1);
        let progress = l.complianceProgress;
        let status = l.status;
        const checks = { ...l.complianceChecks };

        if (nextStep === 2) {
          progress = 40;
          checks.doubleValidation = 'termine';
          checks.escalade = 'en_cours';
        } else if (nextStep === 3) {
          progress = 75;
          checks.escalade = 'termine';
          checks.controleConformite = 'en_cours';
        } else if (nextStep === 4) {
          progress = 85;
          checks.controleConformite = 'termine';
          checks.autorisationFinale = 'en_cours';
        } else if (nextStep === 5) {
          progress = 95;
          checks.autorisationFinale = 'termine';
          status = 'valide';
        } else if (nextStep === 6) {
          progress = 100;
          status = 'decaisse';
        }

        const stepNames = [
          'Demande reçue',
          'Analyse',
          'Validation',
          'Conformité & sécurité',
          'Décaissement',
          'Viré sur compte courant',
        ];

        // Trigger email update
        const email = createLoanStatusEmail(
          l.clientName,
          l.clientEmail,
          l.reference,
          stepNames[nextStep - 1],
          `${progress}% d'avancement`,
          `${l.approvedAmount} €`
        );
        setEmails((emailsPrev) => [email, ...emailsPrev]);

        return {
          ...l,
          currentStep: nextStep,
          complianceProgress: progress,
          status,
          complianceChecks: checks,
        };
      })
    );

    const newLog: AdminActivityLog = {
      id: uniqueId('log'),
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      description: `Avancement du dossier de prêt ${loanId}`,
      type: 'success',
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  const updateLoanComplianceCheck = (
    loanId: string,
    checkKey: 'doubleValidation' | 'escalade' | 'controleConformite' | 'autorisationFinale',
    newStatus: 'termine' | 'en_cours' | 'en_attente'
  ) => {
    setLoans((prev) =>
      prev.map((l) => {
        if (l.id !== loanId) return l;

        const updatedChecks = {
          ...l.complianceChecks,
          [checkKey]: newStatus,
        };

        const checkKeys: ('doubleValidation' | 'escalade' | 'controleConformite' | 'autorisationFinale')[] = [
          'doubleValidation',
          'escalade',
          'controleConformite',
          'autorisationFinale',
        ];

        let totalScore = 0;
        checkKeys.forEach((key) => {
          const st = updatedChecks[key];
          if (st === 'termine') totalScore += 25;
          else if (st === 'en_cours') totalScore += 12;
        });

        const progress = Math.min(100, totalScore);

        let status = l.status;
        let currentStep = l.currentStep;

        if (progress === 100) {
          status = 'decaisse';
          currentStep = 6;
        } else if (progress >= 75) {
          currentStep = 4;
        } else if (progress >= 50) {
          currentStep = 3;
        } else if (progress >= 25) {
          currentStep = 2;
        }

        const stepTitles: Record<string, string> = {
          doubleValidation: 'Double validation interne',
          escalade: 'Escalade hiérarchique',
          controleConformite: 'Contrôle conformité & sécurité',
          autorisationFinale: 'Autorisation finale de virement',
        };

        // If newly reached 100%, credit account if not done
        if (progress === 100 && l.status !== 'decaisse') {
          setAccounts((accs) =>
            accs.map((a) =>
              a.type === 'courant'
                ? { ...a, balance: a.balance + l.approvedAmount }
                : a
            )
          );
          setTransactions((txs) => [
            {
              id: uniqueId('tx_loan'),
              title: `Décaissement prêt ${l.reference}`,
              date: 'Aujourd\'hui',
              amount: l.approvedAmount,
              type: 'credit',
              category: 'transfer',
            },
            ...txs,
          ]);
        }

        // Notification for user
        const notif: SystemNotification = {
          id: uniqueId('n'),
          title: 'Mise à jour conformité virement',
          message: `Étape "${stepTitles[checkKey]}" : ${
            newStatus === 'termine' ? 'Validée (Terminé)' : newStatus === 'en_cours' ? 'En cours de vérification' : 'En attente'
          }. Avancement : ${progress}%.`,
          timestamp: 'À l\'instant',
          read: false,
          type: newStatus === 'termine' ? 'success' : 'info',
        };
        setNotifications((notifsPrev) => [notif, ...notifsPrev]);

        // Email notification
        const email = createLoanStatusEmail(
          l.clientName,
          l.clientEmail,
          l.reference,
          stepTitles[checkKey],
          `${progress}% d'avancement`,
          `${l.approvedAmount} €`
        );
        setEmails((emailsPrev) => [email, ...emailsPrev]);

        // Admin activity log
        const newLog: AdminActivityLog = {
          id: uniqueId('log'),
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          description: `Validation manuelle [${stepTitles[checkKey]}] -> ${newStatus.toUpperCase()} (${l.clientName} - ${l.reference})`,
          type: newStatus === 'termine' ? 'success' : 'info',
        };
        setActivityLogs((logsPrev) => [newLog, ...logsPrev]);

        return {
          ...l,
          complianceChecks: updatedChecks,
          complianceProgress: progress,
          status,
          currentStep,
        };
      })
    );
  };

  const updateTransferComplianceCheck = (
    transferId: string,
    checkKey: 'doubleValidation' | 'escalade' | 'controleConformite' | 'autorisationFinale',
    newStatus: 'termine' | 'en_cours' | 'en_attente'
  ) => {
    setPendingTransfers((prev) =>
      prev.map((tr) => {
        if (tr.id !== transferId) return tr;

        const updatedChecks = {
          ...tr.complianceChecks,
          [checkKey]: newStatus,
        };

        const checkKeys: ('doubleValidation' | 'escalade' | 'controleConformite' | 'autorisationFinale')[] = [
          'doubleValidation',
          'escalade',
          'controleConformite',
          'autorisationFinale',
        ];

        let totalScore = 0;
        checkKeys.forEach((key) => {
          const st = updatedChecks[key];
          if (st === 'termine') totalScore += 25;
          else if (st === 'en_cours') totalScore += 12;
        });

        const progress = Math.min(100, totalScore);

        let status = tr.status;
        let complianceStep = tr.complianceStep;

        if (progress === 100) {
          status = 'valide';
          complianceStep = 4;
        } else if (progress >= 75) {
          status = 'en_cours';
          complianceStep = 3;
        } else if (progress >= 50) {
          status = 'en_cours';
          complianceStep = 2;
        } else if (progress >= 25) {
          status = 'en_cours';
          complianceStep = 1;
        }

        const stepTitles: Record<string, string> = {
          doubleValidation: 'Double validation interne',
          escalade: 'Escalade hiérarchique',
          controleConformite: 'Contrôle conformité & sécurité',
          autorisationFinale: 'Autorisation finale de virement',
        };

        // If 100% / final step validated, send "Virement déjà effectué" notification
        if (progress === 100 && tr.status !== 'valide') {
          // Add transaction debit entry
          setTransactions((txs) => [
            {
              id: uniqueId('tx_wire'),
              title: `Virement - ${tr.recipientName}`,
              date: 'Aujourd\'hui',
              amount: -tr.amount,
              type: 'debit',
              category: 'transfer',
            },
            ...txs,
          ]);

          const notifFinished: SystemNotification = {
            id: uniqueId('n'),
            title: 'Virement bancaire déjà effectué',
            message: `Votre virement de ${tr.amount} ${tr.currency} vers ${tr.recipientName} a été validé à 100% par le service conformité et est désormais exécuté.`,
            timestamp: 'À l\'instant',
            read: false,
            type: 'success',
          };
          setNotifications((notifsPrev) => [notifFinished, ...notifsPrev]);
        } else {
          // Regular step update notification
          const notifStep: SystemNotification = {
            id: uniqueId('n'),
            title: 'Contrôle conformité virement',
            message: `Étape "${stepTitles[checkKey]}" du virement vers ${tr.recipientName} : ${
              newStatus === 'termine' ? 'Validée' : newStatus === 'en_cours' ? 'En cours' : 'En attente'
            }. Avancement : ${progress}%.`,
            timestamp: 'À l\'instant',
            read: false,
            type: newStatus === 'termine' ? 'success' : 'info',
          };
          setNotifications((notifsPrev) => [notifStep, ...notifsPrev]);
        }

        // Email notification
        const email = createWireSubmittedEmail(
          'Thomas Martin',
          'urbainmorel@gmail.com',
          `${tr.amount} ${tr.currency}`,
          tr.recipientName,
          `REF-${tr.id.toUpperCase()}`
        );
        setEmails((emailsPrev) => [email, ...emailsPrev]);

        // Admin activity log
        const newLog: AdminActivityLog = {
          id: uniqueId('log'),
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          description: `Validation manuelle virement [${stepTitles[checkKey]}] -> ${newStatus.toUpperCase()} (${tr.recipientName} - ${tr.amount} ${tr.currency})`,
          type: newStatus === 'termine' ? 'success' : 'info',
        };
        setActivityLogs((logsPrev) => [newLog, ...logsPrev]);

        return {
          ...tr,
          complianceChecks: updatedChecks,
          complianceProgress: progress,
          status,
          complianceStep,
        };
      })
    );
  };

  const approveTransfer = (transferId: string) => {
    setPendingTransfers((prev) =>
      prev.map((tr) =>
        tr.id === transferId
          ? {
              ...tr,
              status: 'valide',
              complianceProgress: 100,
              complianceStep: 4,
              complianceChecks: {
                doubleValidation: 'termine',
                escalade: 'termine',
                controleConformite: 'termine',
                autorisationFinale: 'termine',
              },
            }
          : tr
      )
    );

    const log: AdminActivityLog = {
      id: uniqueId('log'),
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      description: `Virement ${transferId} approuvé et exécuté.`,
      type: 'success',
    };
    setActivityLogs((prev) => [log, ...prev]);
  };

  const rejectTransfer = (transferId: string) => {
    setPendingTransfers((prev) =>
      prev.map((tr) => {
        if (tr.id === transferId && tr.status !== 'rejete') {
          // Refund the amount to the source account if it exists
          if (tr.sourceAccountId) {
            setAccounts((accs) =>
              accs.map((acc) => {
                if (acc.id === tr.sourceAccountId) {
                  return {
                    ...acc,
                    balance: Number((acc.balance + tr.amount).toFixed(2)),
                  };
                }
                return acc;
              })
            );
          }

          // Create a system notification to inform user about the refusal and refund
          const notifReject: SystemNotification = {
            id: uniqueId('n'),
            title: 'Virement bancaire refusé',
            message: `Votre virement de ${tr.amount} ${tr.currency} vers ${tr.recipientName} a été refusé par le service conformité. Les fonds ont été intégralement recrédités sur votre compte.`,
            timestamp: 'À l\'instant',
            read: false,
            type: 'alert',
          };
          setNotifications((notifsPrev) => [notifReject, ...notifsPrev]);

          return {
            ...tr,
            status: 'rejete',
            complianceProgress: 0,
            complianceChecks: {
              doubleValidation: 'en_attente',
              escalade: 'en_attente',
              controleConformite: 'en_attente',
              autorisationFinale: 'en_attente',
            },
          };
        }
        return tr;
      })
    );

    const log: AdminActivityLog = {
      id: uniqueId('log'),
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      description: `Virement ${transferId} rejeté par le service conformité. Les fonds ont été restitués au client.`,
      type: 'alert',
    };
    setActivityLogs((prev) => [log, ...prev]);
  };

  const markNotificationAsRead = (notifId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
    );
  };

  const sendOtpEmail = (email: string) => {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpEmail = createOtpVerificationEmail(email, otpCode);
    setEmails((prev) => [otpEmail, ...prev]);
    return otpCode;
  };

  const addKYCApplication = (appData: Omit<KYCApplication, 'id' | 'submittedAt' | 'status'>) => {
    const newId = uniqueId('kyc');
    const nowFormatted = new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newApp: KYCApplication = {
      ...appData,
      id: newId,
      submittedAt: nowFormatted,
      status: 'en_attente',
    };

    setKycApplications((prev) => [newApp, ...prev]);

    // Email 2: Dossier Reçu
    const ackEmail = createKycSubmittedEmail(
      `${appData.firstName} ${appData.lastName}`,
      appData.email,
      newId.toUpperCase()
    );
    setEmails((prev) => [ackEmail, ...prev]);

    // System notification
    const notif: SystemNotification = {
      id: uniqueId('n'),
      title: 'Dossier KYC Soumis',
      message: `Nouveau dossier d'ouverture de compte reçu pour ${appData.firstName} ${appData.lastName}. Traitement sous 24h.`,
      timestamp: 'À l\'instant',
      read: false,
      type: 'info',
    };
    setNotifications((prev) => [notif, ...prev]);

    // Admin activity log
    const log: AdminActivityLog = {
      id: uniqueId('log'),
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      description: `Nouveau dossier d'onboarding soumis : ${appData.firstName} ${appData.lastName} (${appData.email})`,
      type: 'info',
    };
    setActivityLogs((prev) => [log, ...prev]);

    return newId;
  };

  const approveKYCApplication = (kycId: string) => {
    let approvedApp: KYCApplication | null = null;
    const newIban = generateIBAN();

    setKycApplications((prev) =>
      prev.map((app) => {
        if (app.id === kycId) {
          approvedApp = { ...app, status: 'valide', iban: newIban };
          return approvedApp;
        }
        return app;
      })
    );

    if (approvedApp) {
      const app = approvedApp as KYCApplication;
      const userCurrency = getDefaultCurrencyByCountry(app.address.country);
      const newAcc: BankAccount = {
        id: uniqueId('acc'),
        name: `Compte courant - ${app.firstName} ${app.lastName}`,
        iban: newIban,
        balance: 1000.0,
        currency: userCurrency,
        type: 'courant',
      };
      setAccounts((prev) => [...prev, newAcc]);
      setCurrency(userCurrency);

      // Email 3: Compte Validé
      const email = createAccountApprovedEmail(
        `${app.firstName} ${app.lastName}`,
        app.email,
        newIban
      );
      setEmails((prev) => [email, ...prev]);

      const notif: SystemNotification = {
        id: uniqueId('n'),
        title: 'Compte Bancaire Validé !',
        message: `Félicitations ${app.firstName}, votre dossier KYC a été approuvé. IBAN généré : ${newIban}`,
        timestamp: 'À l\'instant',
        read: false,
        type: 'success',
      };
      setNotifications((prev) => [notif, ...prev]);

      const log: AdminActivityLog = {
        id: uniqueId('log'),
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        description: `Validation KYC + Génération IBAN (${newIban}) pour ${app.firstName} ${app.lastName}`,
        type: 'success',
      };
      setActivityLogs((prev) => [log, ...prev]);
    }
  };

  const rejectKYCApplication = (kycId: string, reason: string) => {
    let rejectedApp: KYCApplication | null = null;

    setKycApplications((prev) =>
      prev.map((app) => {
        if (app.id === kycId) {
          rejectedApp = { ...app, status: 'rejete', rejectionReason: reason };
          return rejectedApp;
        }
        return app;
      })
    );

    if (rejectedApp) {
      const app = rejectedApp as KYCApplication;
      // Email 4: Action Requise
      const email = createKycRejectedEmail(
        `${app.firstName} ${app.lastName}`,
        app.email,
        reason,
        '/register'
      );
      setEmails((prev) => [email, ...prev]);

      const notif: SystemNotification = {
        id: uniqueId('n'),
        title: 'Action requise sur votre dossier',
        message: `Votre dossier KYC a été refusé : ${reason}. Veuillez re-soumettre la pièce concernée.`,
        timestamp: 'À l\'instant',
        read: false,
        type: 'alert',
      };
      setNotifications((prev) => [notif, ...prev]);

      const log: AdminActivityLog = {
        id: uniqueId('log'),
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        description: `Rejet KYC dossier ${kycId} (${app.firstName} ${app.lastName}) - Motif : ${reason}`,
        type: 'alert',
      };
      setActivityLogs((prev) => [log, ...prev]);
    }
  };

  const updateAccountBalance = (accountId: string, newBalance: number) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === accountId ? { ...acc, balance: newBalance } : acc))
    );
  };

  const resetToDefaults = () => {
    setAccounts(INITIAL_ACCOUNTS);
    setTransactions(INITIAL_TRANSACTIONS);
    setPendingTransfers(INITIAL_PENDING_TRANSFERS);
    setLoans(INITIAL_LOANS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setEmails(INITIAL_EMAILS);
    setActivityLogs(INITIAL_ACTIVITY_LOGS);
    setKycApplications(INITIAL_KYC_APPLICATIONS);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        role,
        setRole,
        activeTab,
        setActiveTab,
        currency,
        setCurrency: setCurrencyAndConvert,
        rates,
        setRates,
        isMaskedBalance,
        toggleMaskBalance,
        accounts,
        transactions,
        pendingTransfers,
        loans,
        notifications,
        emails,
        activityLogs,
        kycApplications,
        isTransferModalOpen,
        setIsTransferModalOpen,
        isLoanModalOpen,
        setIsLoanModalOpen,
        isEmailDrawerOpen,
        setIsEmailDrawerOpen,
        isNotificationsDrawerOpen,
        setIsNotificationsDrawerOpen,
        isContactModalOpen,
        setIsContactModalOpen,
        isSupabaseModalOpen,
        setIsSupabaseModalOpen,
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
        markNotificationAsRead,
        sendOtpEmail,
        addKYCApplication,
        approveKYCApplication,
        rejectKYCApplication,
        updateAccountBalance,
        resetToDefaults,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
}
