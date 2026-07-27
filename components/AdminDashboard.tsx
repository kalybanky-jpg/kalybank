'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { formatCurrency } from '@/lib/currency';
import { LoanApplication } from '@/lib/types';
import {
  FileText,
  UserCheck,
  Wallet,
  ShieldAlert,
  ArrowUpRight,
  ChevronRight,
  CheckCircle2,
  Clock,
  ChevronLeft,
  Info,
  Check,
  ShieldCheck,
  Circle,
} from 'lucide-react';
import { motion } from 'motion/react';

import AdminKycManagement from './AdminKycManagement';
import AdminLoansView from './AdminLoansView';
import AdminTransfersView from './AdminTransfersView';
import AdminClientsView from './AdminClientsView';
import AdminAccountsView from './AdminAccountsView';
import AdminDocumentsView from './AdminDocumentsView';
import AdminReportsView from './AdminReportsView';
import AdminSettingsView from './AdminSettingsView';

export default function AdminDashboard() {
  const {
    language,
    currency,
    rates,
    activeTab,
    setActiveTab,
    pendingTransfers,
    loans,
    activityLogs,
    advanceLoanStep,
    updateLoanComplianceCheck,
    updateTransferComplianceCheck,
    approveTransfer,
    rejectTransfer,
    setSelectedLoanForReview,
  } = useAppStore();

  const [complianceMode, setComplianceMode] = React.useState<'transfer' | 'loan'>('transfer');
  const [selectedComplianceTransferId, setSelectedComplianceTransferId] = React.useState<string>(pendingTransfers[0]?.id || 'tr_1');
  const [selectedComplianceLoanId, setSelectedComplianceLoanId] = React.useState<string>(loans[0]?.id || 'loan_1');

  if (activeTab === 'loanRequests') return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminLoansView /></div>;
  if (activeTab === 'transfers') return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminTransfersView /></div>;
  if (activeTab === 'compliance') return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminKycManagement /></div>;
  if (activeTab === 'clients') return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminClientsView /></div>;
  if (activeTab === 'accounts') return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminAccountsView /></div>;
  if (activeTab === 'documents') return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminDocumentsView /></div>;
  if (activeTab === 'reports') return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminReportsView /></div>;
  if (activeTab === 'settings') return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminSettingsView /></div>;

  const activeTransfer = pendingTransfers.find((tr) => tr.id === selectedComplianceTransferId) || pendingTransfers[0];
  const activeLoan = loans.find((l) => l.id === selectedComplianceLoanId) || loans[0];

  const t = translations[language] || translations.fr;

  const handleAction = (loan: LoanApplication) => {
    if (loan.currentStep < 5) {
      advanceLoanStep(loan.id);
    } else {
      setSelectedLoanForReview(loan);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Metric Cards (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Demandes à traiter */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">{t.requestsToProcess}</p>
            <h3 className="text-2xl font-extrabold text-slate-900">28</h3>
            <p className="text-[11px] font-bold text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> 12 {t.vsYesterday}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Validations en attente */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">{t.pendingValidations}</p>
            <h3 className="text-2xl font-extrabold text-slate-900">14</h3>
            <p className="text-[11px] font-bold text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> 6 {t.vsYesterday}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Décaissements aujourd'hui */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">{t.disbursementsToday}</p>
            <h3 className="text-2xl font-extrabold text-slate-900">
              {formatCurrency(1850000, currency, rates, language)}
            </h3>
            <p className="text-[11px] font-bold text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> 18% {t.vsYesterday}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Alertes conformité */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">{t.complianceAlerts}</p>
            <h3 className="text-2xl font-extrabold text-slate-900">7</h3>
            <p className="text-[11px] font-bold text-rose-600 flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> 3 {t.vsYesterday}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Middle Grid: Pipeline des prêts & File de validation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pipeline des prêts (lg:col-span-8) */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900">{t.loanPipeline}</h3>
            <button
              onClick={() => alert(t.detailedPipeline)}
              id="admin-view-detailed-pipeline-btn"
              className="px-3 py-1.5 rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs font-bold transition"
            >
              {t.detailedPipeline}
            </button>
          </div>

          {/* Stepper Pipeline 1 to 6 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center py-2">
            {/* Step 1 */}
            <div className="flex flex-col items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-sm mb-2">
                1
              </div>
              <span className="text-[11px] font-bold text-slate-500 mb-1">{t.stepReceived}</span>
              <span className="text-base font-extrabold text-slate-900">56</span>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-sm mb-2">
                2
              </div>
              <span className="text-[11px] font-bold text-slate-500 mb-1">{t.stepAnalysis}</span>
              <span className="text-base font-extrabold text-slate-900">28</span>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-sm mb-2">
                3
              </div>
              <span className="text-[11px] font-bold text-slate-500 mb-1">{t.stepValidation}</span>
              <span className="text-base font-extrabold text-slate-900">14</span>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="w-9 h-9 rounded-full bg-amber-500 text-white font-bold text-sm flex items-center justify-center shadow-sm mb-2">
                4
              </div>
              <span className="text-[11px] font-bold text-slate-500 mb-1">{t.stepCompliance}</span>
              <span className="text-base font-extrabold text-slate-900">12</span>
            </div>

            {/* Step 5 */}
            <div className="flex flex-col items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="w-9 h-9 rounded-full bg-emerald-500 text-white font-bold text-sm flex items-center justify-center shadow-sm mb-2">
                5
              </div>
              <span className="text-[11px] font-bold text-slate-500 mb-1">{t.stepDisbursement}</span>
              <span className="text-base font-extrabold text-slate-900">8</span>
            </div>

            {/* Step 6 */}
            <div className="flex flex-col items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shadow-sm mb-2">
                6
              </div>
              <span className="text-[11px] font-bold text-slate-500 mb-1">{t.stepTransferred}</span>
              <span className="text-base font-extrabold text-slate-900">24</span>
            </div>
          </div>
        </div>

        {/* File de validation (lg:col-span-4) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">{t.validationQueue}</h3>
            <button
              onClick={() => alert(t.validationQueue)}
              id="admin-see-validation-queue-btn"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition"
            >
              {t.seeAll}
            </button>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Item 1 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-800">{t.makerChecker}</span>
                <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  8 en attente
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full w-[60%]" />
              </div>
            </div>

            {/* Item 2 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-800">{t.hierarchicalEscalation}</span>
                <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  3 en attente
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full w-[40%]" />
              </div>
            </div>

            {/* Item 3 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-800">{t.complianceCheck}</span>
                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  5 en cours
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full w-[75%]" />
              </div>
            </div>

            {/* Item 4 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-800">{t.finalAuthorization}</span>
                <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  2 en attente
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full w-[25%]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Bottom Section: Demandes prioritaires Table & Compliance / Décaissements / Activité */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Demandes prioritaires (lg:col-span-8) */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[600px]">
            <h3 className="text-base font-extrabold text-slate-900">{t.priorityRequests}</h3>
            <button
              onClick={() => setActiveTab('loanRequests')}
              id="admin-see-all-priority-requests-btn"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition"
            >
              {t.seeAllRequests}
            </button>
          </div>

          <table className="w-full text-left text-xs min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">{t.client}</th>
                <th className="py-2.5 px-3">{t.reference}</th>
                <th className="py-2.5 px-3">{t.amount}</th>
                <th className="py-2.5 px-3">{t.currentStep}</th>
                <th className="py-2.5 px-3">{t.complianceControl}</th>
                <th className="py-2.5 px-3 text-right">{t.decisionAction}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
              {loans.map((loan, index) => (
                <tr key={`${loan.id}_${index}`} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 font-bold flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-[10px]">
                      {loan.clientName.charAt(0)}
                    </div>
                    <span className="text-slate-900">{loan.clientName}</span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-500">{loan.reference}</td>
                  <td className="py-3 px-3 font-extrabold text-slate-900">
                    {formatCurrency(loan.requestedAmount, currency, rates, language)}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {loan.currentStep === 1
                        ? 'En analyse'
                        : loan.currentStep === 2
                        ? 'Validation manager'
                        : loan.currentStep === 3
                        ? 'Conformité en cours'
                        : loan.currentStep === 4
                        ? 'Prêt au décaissement'
                        : 'Prêt décaissé'}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        loan.complianceProgress >= 80
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {loan.complianceProgress >= 80 ? 'Validé' : 'En attente'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleAction(loan)}
                      id={`loan-action-btn-${loan.id}`}
                      className={`px-4 py-1.5 rounded-xl font-bold text-xs transition shadow-xs ${
                        loan.currentStep === 2 || loan.currentStep === 4
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                      }`}
                    >
                      {loan.currentStep === 2 ? t.validate : loan.currentStep === 4 ? t.authorize : t.view}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 min-w-[600px]">
            <span>{loans.length} résultats</span>
            <div className="flex items-center space-x-1">
              <button className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold">1</span>
              <button className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Contrôles de conformité et sécurité des virements (lg:col-span-4) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border-2 border-indigo-100 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
              <h3 className="text-sm font-extrabold text-slate-900">{t.securityCompliance}</h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
              Validation 1 à 1
            </span>
          </div>

          {/* Type Selector Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-extrabold">
            <button
              onClick={() => setComplianceMode('transfer')}
              className={`py-1.5 px-2 rounded-lg transition ${
                complianceMode === 'transfer' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Virements Clients ({pendingTransfers.length})
            </button>
            <button
              onClick={() => setComplianceMode('loan')}
              className={`py-1.5 px-2 rounded-lg transition ${
                complianceMode === 'loan' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dossiers Prêts ({loans.length})
            </button>
          </div>

          {complianceMode === 'transfer' ? (
            <>
              {/* Transfer Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Virement initié par le client :
                </label>
                <select
                  value={activeTransfer?.id || ''}
                  onChange={(e) => setSelectedComplianceTransferId(e.target.value)}
                  id="admin-select-compliance-transfer"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {pendingTransfers.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.recipientName} — {formatCurrency(tr.amount, tr.currency, rates, language)} ({tr.status === 'valide' ? '100% Executé' : `${tr.complianceProgress || 25}%`})
                    </option>
                  ))}
                </select>
              </div>

              {activeTransfer && (
                <>
                  {/* Progress Gauge */}
                  <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-200"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className={`${(activeTransfer.complianceProgress || 25) === 100 ? 'text-emerald-500' : 'text-indigo-600'} stroke-current transition-all duration-500`}
                          strokeWidth="3.5"
                          strokeDasharray={`${activeTransfer.complianceProgress || 25}, 100`}
                          strokeLinecap="round"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-xl font-extrabold text-slate-900">{activeTransfer.complianceProgress || 25}%</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{t.progress}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-700 text-center mt-2 font-bold">
                      Virement vers {activeTransfer.recipientName} ({formatCurrency(activeTransfer.amount, activeTransfer.currency, rates, language)})
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Compte : {activeTransfer.recipientAccount}
                    </p>

                    {activeTransfer.status === 'rejete' ? (
                      <div className="w-full mt-3 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-center rounded-xl font-bold text-[10px] uppercase tracking-wider">
                        ⚠️ VIREMENT REFUSÉ (FONDS RETOURNÉS)
                      </div>
                    ) : activeTransfer.status === 'valide' ? (
                      <div className="w-full mt-3 p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-center rounded-xl font-bold text-[10px] uppercase tracking-wider">
                        ✓ VIREMENT EFFECTUÉ
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (confirm(language === 'fr' ? 'Êtes-vous sûr de vouloir rejeter ce virement et recréditer le compte du client ?' : 'Are you sure you want to reject this transfer and refund the client?')) {
                            rejectTransfer(activeTransfer.id);
                          }
                        }}
                        className="mt-3 w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition flex items-center justify-center space-x-1"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        <span>Rejeter (Refuser & Rembourser)</span>
                      </button>
                    )}
                  </div>

                  {/* Step-by-step 1-by-1 Validation Buttons for Wire Transfer */}
                  <div className="space-y-3 pt-2">
                    <p className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Validation manuelle 1 par 1 (Service Conformité) :
                    </p>

                    {[
                      {
                        key: 'doubleValidation' as const,
                        label: t.doubleInternalValidation || 'Double validation interne',
                        status: activeTransfer.complianceChecks?.doubleValidation || 'en_attente',
                      },
                      {
                        key: 'escalade' as const,
                        label: t.hierarchicalEscalation || 'Escalade hiérarchique',
                        status: activeTransfer.complianceChecks?.escalade || 'en_attente',
                      },
                      {
                        key: 'controleConformite' as const,
                        label: t.complianceCheck || 'Contrôle conformité & sécurité',
                        status: activeTransfer.complianceChecks?.controleConformite || 'en_attente',
                      },
                      {
                        key: 'autorisationFinale' as const,
                        label: t.finalAuthorization || 'Autorisation finale de virement',
                        status: activeTransfer.complianceChecks?.autorisationFinale || 'en_attente',
                      },
                    ].map((step, index) => (
                      <div
                        key={step.key}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 hover:border-indigo-200 transition"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900">
                            {index + 1}. {step.label}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                              step.status === 'termine'
                                ? 'text-emerald-700 bg-emerald-100 border-emerald-300'
                                : step.status === 'en_cours'
                                ? 'text-indigo-700 bg-indigo-100 border-indigo-300'
                                : 'text-amber-700 bg-amber-100 border-amber-300'
                            }`}
                          >
                            {step.status === 'termine'
                              ? '✓ Validé'
                              : step.status === 'en_cours'
                              ? '⏳ En cours'
                              : '⏸ En attente'}
                          </span>
                        </div>

                        {/* Action buttons 1 by 1 */}
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <button
                            onClick={() => updateTransferComplianceCheck(activeTransfer.id, step.key, 'termine')}
                            id={`validate-tr-step-${step.key}-${activeTransfer.id}`}
                            className={`py-1.5 px-2 rounded-xl text-[10px] font-extrabold transition flex items-center justify-center space-x-1 ${
                              step.status === 'termine'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            <Check className="w-3 h-3 mr-0.5" />
                            <span>Valider</span>
                          </button>

                          <button
                            onClick={() => updateTransferComplianceCheck(activeTransfer.id, step.key, 'en_cours')}
                            id={`in-progress-tr-step-${step.key}-${activeTransfer.id}`}
                            className={`py-1.5 px-2 rounded-xl text-[10px] font-extrabold transition flex items-center justify-center space-x-1 ${
                              step.status === 'en_cours'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            <Clock className="w-3 h-3 mr-0.5" />
                            <span>En cours</span>
                          </button>

                          <button
                            onClick={() => updateTransferComplianceCheck(activeTransfer.id, step.key, 'en_attente')}
                            id={`pending-tr-step-${step.key}-${activeTransfer.id}`}
                            className={`py-1.5 px-2 rounded-xl text-[10px] font-extrabold transition flex items-center justify-center space-x-1 ${
                              step.status === 'en_attente'
                                ? 'bg-slate-700 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <Circle className="w-3 h-3 mr-0.5" />
                            <span>Attente</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {/* Dossier Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Dossier prêt à contrôler :
                </label>
                <select
                  value={activeLoan?.id || ''}
                  onChange={(e) => setSelectedComplianceLoanId(e.target.value)}
                  id="admin-select-compliance-loan"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {loans.map((loan) => (
                    <option key={loan.id} value={loan.id}>
                      {loan.clientName} ({loan.reference}) — {formatCurrency(loan.requestedAmount, currency, rates, language)}
                    </option>
                  ))}
                </select>
              </div>

              {activeLoan && (
                <>
                  {/* Progress Gauge */}
                  <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-200"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className={`${activeLoan.complianceProgress === 100 ? 'text-emerald-500' : 'text-indigo-600'} stroke-current transition-all duration-500`}
                          strokeWidth="3.5"
                          strokeDasharray={`${activeLoan.complianceProgress}, 100`}
                          strokeLinecap="round"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-xl font-extrabold text-slate-900">{activeLoan.complianceProgress}%</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{t.progress}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 text-center mt-2 font-medium">
                      Ref : <span className="font-mono font-bold text-slate-800">{activeLoan.reference}</span> • {activeLoan.clientName}
                    </p>
                  </div>

                  {/* Step-by-step 1-by-1 Validation Buttons */}
                  <div className="space-y-3 pt-2">
                    <p className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Validation manuelle étape par étape (Prêt Client) :
                    </p>

                    {[
                      {
                        key: 'doubleValidation' as const,
                        label: t.doubleInternalValidation || 'Double validation interne',
                        status: activeLoan.complianceChecks?.doubleValidation || 'en_attente',
                      },
                      {
                        key: 'escalade' as const,
                        label: t.hierarchicalEscalation || 'Escalade hiérarchique',
                        status: activeLoan.complianceChecks?.escalade || 'en_attente',
                      },
                      {
                        key: 'controleConformite' as const,
                        label: t.complianceCheck || 'Contrôle conformité & sécurité',
                        status: activeLoan.complianceChecks?.controleConformite || 'en_attente',
                      },
                      {
                        key: 'autorisationFinale' as const,
                        label: t.finalAuthorization || 'Autorisation finale de virement',
                        status: activeLoan.complianceChecks?.autorisationFinale || 'en_attente',
                      },
                    ].map((step, index) => (
                      <div
                        key={step.key}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 hover:border-indigo-200 transition"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900">
                            {index + 1}. {step.label}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                              step.status === 'termine'
                                ? 'text-emerald-700 bg-emerald-100 border-emerald-300'
                                : step.status === 'en_cours'
                                ? 'text-indigo-700 bg-indigo-100 border-indigo-300'
                                : 'text-amber-700 bg-amber-100 border-amber-300'
                            }`}
                          >
                            {step.status === 'termine'
                              ? '✓ Validé'
                              : step.status === 'en_cours'
                              ? '⏳ En cours'
                              : '⏸ En attente'}
                          </span>
                        </div>

                        {/* Action buttons 1 by 1 */}
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <button
                            onClick={() => updateLoanComplianceCheck(activeLoan.id, step.key, 'termine')}
                            id={`validate-step-${step.key}-${activeLoan.id}`}
                            className={`py-1.5 px-2 rounded-xl text-[10px] font-extrabold transition flex items-center justify-center space-x-1 ${
                              step.status === 'termine'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            <Check className="w-3 h-3 mr-0.5" />
                            <span>Valider</span>
                          </button>

                          <button
                            onClick={() => updateLoanComplianceCheck(activeLoan.id, step.key, 'en_cours')}
                            id={`in-progress-step-${step.key}-${activeLoan.id}`}
                            className={`py-1.5 px-2 rounded-xl text-[10px] font-extrabold transition flex items-center justify-center space-x-1 ${
                              step.status === 'en_cours'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            <Clock className="w-3 h-3 mr-0.5" />
                            <span>En cours</span>
                          </button>

                          <button
                            onClick={() => updateLoanComplianceCheck(activeLoan.id, step.key, 'en_attente')}
                            id={`pending-step-${step.key}-${activeLoan.id}`}
                            className={`py-1.5 px-2 rounded-xl text-[10px] font-extrabold transition flex items-center justify-center space-x-1 ${
                              step.status === 'en_attente'
                                ? 'bg-slate-700 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <Circle className="w-3 h-3 mr-0.5" />
                            <span>Attente</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom Row: Décaissements du jour & Activité récente */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Décaissements du jour (lg:col-span-8) */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[550px]">
            <h3 className="text-base font-extrabold text-slate-900">{t.disbursementsTodayTitle}</h3>
            <button
              onClick={() => alert(t.seeAllDisbursements)}
              id="admin-see-all-disbursements-btn"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition"
            >
              {t.seeAllDisbursements}
            </button>
          </div>

          <table className="w-full text-left text-xs min-w-[550px]">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">{t.client}</th>
                <th className="py-2.5 px-3">{t.approvedAmount}</th>
                <th className="py-2.5 px-3">{t.checkingAccount}</th>
                <th className="py-2.5 px-3">{t.progression}</th>
                <th className="py-2.5 px-3 text-right">{t.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
              <tr className="hover:bg-slate-50 transition">
                <td className="py-3 px-3 font-bold text-slate-900">Vers Claire Dupont</td>
                <td className="py-3 px-3 font-extrabold text-slate-900">{formatCurrency(8500, currency, rates, language)}</td>
                <td className="py-3 px-3 font-mono text-slate-500">FR76 1234 5678 9012 3456 789</td>
                <td className="py-3 px-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full w-full" />
                    </div>
                    <span className="font-extrabold text-[11px] text-slate-900">100%</span>
                  </div>
                </td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Transféré
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50 transition">
                <td className="py-3 px-3 font-bold text-slate-900">Vers SARL Design Plus</td>
                <td className="py-3 px-3 font-extrabold text-slate-900">{formatCurrency(12000, currency, rates, language)}</td>
                <td className="py-3 px-3 font-mono text-slate-500">FR76 9876 5432 1098 7654 321</td>
                <td className="py-3 px-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full w-[75%]" />
                    </div>
                    <span className="font-extrabold text-[11px] text-slate-900">75%</span>
                  </div>
                </td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    En cours
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50 transition">
                <td className="py-3 px-3 font-bold text-slate-900">Vers Emma Martin</td>
                <td className="py-3 px-3 font-extrabold text-slate-900">{formatCurrency(5200, currency, rates, language)}</td>
                <td className="py-3 px-3 font-mono text-slate-500">FR76 1111 2222 3333 4444 555</td>
                <td className="py-3 px-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full w-[40%]" />
                    </div>
                    <span className="font-extrabold text-[11px] text-slate-900">40%</span>
                  </div>
                </td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    En cours
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Activité récente (lg:col-span-4) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">{t.recentActivity}</h3>
            <button
              onClick={() => alert(t.recentActivity)}
              id="admin-see-all-activity-btn"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition"
            >
              {t.seeAllActivity}
            </button>
          </div>

          <div className="space-y-3 divide-y divide-slate-100 text-xs">
            {activityLogs.map((log, index) => (
              <div key={`${log.id}_${index}`} className="pt-2.5 flex items-start justify-between space-x-2">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-mono font-bold text-slate-400">{log.timestamp}</span>
                  <p className="text-slate-800 font-medium leading-snug">{log.description}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    log.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : log.type === 'alert'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {log.type === 'success' ? 'Succès' : log.type === 'alert' ? 'Alerte' : 'Info'}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => alert(t.showMoreActivities)}
            id="admin-show-more-activities-btn"
            className="w-full py-2 rounded-xl text-center text-xs font-bold text-blue-600 hover:bg-slate-50 transition"
          >
            {t.showMoreActivities}
          </button>
        </div>
      </div>
    </div>
  );
}
