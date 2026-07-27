'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { KYCApplication } from '@/lib/types';
import {
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  UserCheck,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  X,
  FileText,
  User,
  MapPin,
  Building,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminKycManagement() {
  const { kycApplications, approveKYCApplication, rejectKYCApplication, setIsEmailDrawerOpen } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'tous' | 'en_attente' | 'valide' | 'rejete'>('tous');
  const [selectedApp, setSelectedApp] = useState<KYCApplication | null>(null);

  // Rejection Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('Photo floue / Document illisible');
  const [customReason, setCustomReason] = useState('');

  // Image Viewer Controls
  const [selectedDoc, setSelectedDoc] = useState<'idFront' | 'idBack' | 'selfie'>('idFront');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  const resetImageControls = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  const filteredApps = kycApplications.filter((app) => {
    const matchesSearch =
      app.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'tous' || app.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleApprove = (appId: string) => {
    approveKYCApplication(appId);
    if (selectedApp?.id === appId) {
      setSelectedApp((prev) => (prev ? { ...prev, status: 'valide' } : null));
    }
  };

  const handleRejectSubmit = () => {
    if (!selectedApp) return;
    const finalReason = rejectionReason === 'Autre motif' ? customReason : rejectionReason;
    rejectKYCApplication(selectedApp.id, finalReason);
    setSelectedApp((prev) => (prev ? { ...prev, status: 'rejete', rejectionReason: finalReason } : null));
    setIsRejectModalOpen(false);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Back-Office Operations — Dossiers KYC</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Traitement manuel sous SLA 24h ouvrées &amp; génération d&apos;IBAN automatique
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center space-x-2 text-xs font-bold">
          <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>En attente : {kycApplications.filter((a) => a.status === 'en_attente').length}</span>
          </span>
          <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Validés : {kycApplications.filter((a) => a.status === 'valide').length}</span>
          </span>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher nom, e-mail, ID..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'tous', label: 'Tous' },
            { id: 'en_attente', label: 'En attente' },
            { id: 'valide', label: 'Validés' },
            { id: 'rejete', label: 'Rejetés' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Applications Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-3.5">Réf / Date</th>
              <th className="p-3.5">Client & Email</th>
              <th className="p-3.5">Statut KYC</th>
              <th className="p-3.5">IBAN Généré</th>
              <th className="p-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {filteredApps.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  Aucun dossier KYC ne correspond à vos critères.
                </td>
              </tr>
            ) : (
              filteredApps.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3.5">
                    <span className="font-mono font-bold text-slate-900">{app.id.toUpperCase()}</span>
                    <p className="text-[11px] text-slate-400">{app.submittedAt}</p>
                  </td>
                  <td className="p-3.5">
                    <p className="font-bold text-slate-900">{app.firstName} {app.lastName}</p>
                    <p className="text-[11px] text-slate-500">{app.email}</p>
                  </td>
                  <td className="p-3.5">
                    {app.status === 'en_attente' && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[11px] inline-flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>En attente</span>
                      </span>
                    )}
                    {app.status === 'valide' && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px] inline-flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Validé</span>
                      </span>
                    )}
                    {app.status === 'rejete' && (
                      <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px] inline-flex items-center space-x-1">
                        <XCircle className="w-3 h-3" />
                        <span>Rejeté</span>
                      </span>
                    )}
                  </td>
                  <td className="p-3.5">
                    {app.iban ? (
                      <span className="font-mono font-bold text-slate-900 text-[11px]">{app.iban}</span>
                    ) : (
                      <span className="text-slate-400 italic">En attente de validation</span>
                    )}
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => {
                        setSelectedApp(app);
                        resetImageControls();
                      }}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition shadow-sm inline-flex items-center space-x-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Examiner</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* INSPECTION MODAL (FICHE DE TRAITEMENT KYC) */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-6 my-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 rounded-full bg-slate-900 text-white font-mono font-bold text-xs">
                      {selectedApp.id.toUpperCase()}
                    </span>
                    <h3 className="text-xl font-extrabold text-slate-900">
                      Examen KYC — {selectedApp.firstName} {selectedApp.lastName}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Soumis le {selectedApp.submittedAt} • E-mail : {selectedApp.email}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Visual Image Viewer & Biometric Match (7 Cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>Visionneuse d&apos;images &amp; Biométrie</span>
                    </h4>

                    {/* Image Document Selector */}
                    <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                      <button
                        onClick={() => {
                          setSelectedDoc('idFront');
                          resetImageControls();
                        }}
                        className={`px-2.5 py-1 rounded-lg transition ${
                          selectedDoc === 'idFront' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        ID Recto
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDoc('idBack');
                          resetImageControls();
                        }}
                        className={`px-2.5 py-1 rounded-lg transition ${
                          selectedDoc === 'idBack' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        ID Verso
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDoc('selfie');
                          resetImageControls();
                        }}
                        className={`px-2.5 py-1 rounded-lg transition ${
                          selectedDoc === 'selfie' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        Selfie
                      </button>
                    </div>
                  </div>

                  {/* Image Display Canvas with Zoom Controls */}
                  <div className="relative h-64 bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800">
                    <img
                      src={
                        selectedDoc === 'idFront'
                          ? selectedApp.documents.idFrontUrl
                          : selectedDoc === 'idBack'
                          ? selectedApp.documents.idBackUrl
                          : selectedApp.documents.selfieUrl
                      }
                      alt="Document KYC"
                      style={{
                        transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                        transition: 'transform 0.2s ease-out',
                      }}
                      className="max-h-full max-w-full object-contain"
                    />

                    {/* Zoom / Rotate Toolbar Overlay */}
                    <div className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 flex items-center space-x-2 text-white">
                      <button
                        onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                        title="Zoom avant"
                        className="p-1 hover:text-blue-400 transition"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.75))}
                        title="Zoom arrière"
                        className="p-1 hover:text-blue-400 transition"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setRotation((r) => (r + 90) % 360)}
                        title="Pivoter 90°"
                        className="p-1 hover:text-blue-400 transition"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={resetImageControls}
                        title="Réinitialiser"
                        className="p-1 hover:text-blue-400 transition text-xs font-bold"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Biometric Face Match Comparison Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <span>Comparaison Biométrique Visage vs Pièce d&apos;Identité</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                        98.4% Conforme
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="flex items-center space-x-2 bg-white p-2.5 rounded-xl border border-slate-200">
                        <img
                          src={selectedApp.documents.idFrontUrl}
                          className="w-12 h-12 rounded-lg object-cover border"
                          alt="Photo ID"
                        />
                        <div className="text-[11px]">
                          <p className="font-bold text-slate-900">Photo Pièce ID</p>
                          <p className="text-slate-500">Document Officiel</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 bg-white p-2.5 rounded-xl border border-slate-200">
                        <img
                          src={selectedApp.documents.selfieUrl}
                          className="w-12 h-12 rounded-lg object-cover border"
                          alt="Selfie Client"
                        />
                        <div className="text-[11px]">
                          <p className="font-bold text-slate-900">Selfie Live</p>
                          <p className="text-slate-500">Document en main</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Data Comparison Table (5 Cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>Contrôle des Données Saisies</span>
                  </h4>

                  <div className="rounded-2xl border border-slate-200 overflow-hidden text-xs">
                    <div className="bg-slate-50 p-3 font-bold text-slate-700 border-b border-slate-200 flex justify-between">
                      <span>Champ Saisi</span>
                      <span>Valeur Client</span>
                    </div>
                    <div className="divide-y divide-slate-100 bg-white">
                      <div className="p-3 flex justify-between">
                        <span className="text-slate-500">Nom & Prénom :</span>
                        <span className="font-bold text-slate-900">{selectedApp.firstName} {selectedApp.lastName}</span>
                      </div>
                      <div className="p-3 flex justify-between">
                        <span className="text-slate-500">Date de naissance :</span>
                        <span className="font-bold text-slate-900">{selectedApp.dateOfBirth}</span>
                      </div>
                      <div className="p-3 flex justify-between">
                        <span className="text-slate-500">Lieu de naissance :</span>
                        <span className="font-bold text-slate-900">{selectedApp.placeOfBirth}</span>
                      </div>
                      <div className="p-3 flex justify-between">
                        <span className="text-slate-500">Nationalité :</span>
                        <span className="font-bold text-slate-900">{selectedApp.nationality}</span>
                      </div>
                      <div className="p-3 flex justify-between">
                        <span className="text-slate-500">Adresse civique :</span>
                        <span className="font-bold text-slate-900 text-right">
                          {selectedApp.address.street}, {selectedApp.address.postalCode} {selectedApp.address.city}
                        </span>
                      </div>
                      <div className="p-3 flex justify-between">
                        <span className="text-slate-500">Profession & Revenus :</span>
                        <span className="font-bold text-slate-900">{selectedApp.profile.occupation} ({selectedApp.profile.incomeRange})</span>
                      </div>
                      <div className="p-3 flex justify-between">
                        <span className="text-slate-500">FATCA / PPE :</span>
                        <span className="font-bold text-slate-900">
                          FATCA: {selectedApp.profile.fatca ? 'Oui' : 'Non'} • PPE: {selectedApp.profile.pep ? 'Oui' : 'Non'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Decision Actions Panel */}
                  <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Décision Back-Office Operations</p>

                    {selectedApp.status === 'en_attente' && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                          onClick={() => handleApprove(selectedApp.id)}
                          className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-xs transition shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Valider & Générer IBAN</span>
                        </button>

                        <button
                          onClick={() => setIsRejectModalOpen(true)}
                          className="py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-extrabold text-xs transition shadow-lg shadow-rose-600/20 flex items-center justify-center space-x-1.5"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Rejeter / Motif</span>
                        </button>
                      </div>
                    )}

                    {selectedApp.status === 'valide' && (
                      <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold space-y-1">
                        <p className="flex items-center space-x-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Dossier KYC Approuvé</span>
                        </p>
                        <p className="font-mono text-white text-[11px]">IBAN : {selectedApp.iban}</p>
                      </div>
                    )}

                    {selectedApp.status === 'rejete' && (
                      <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold space-y-1">
                        <p className="flex items-center space-x-1.5">
                          <XCircle className="w-4 h-4 text-rose-400" />
                          <span>Dossier Rejeté</span>
                        </p>
                        <p className="text-white text-[11px]">Motif : {selectedApp.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REJECTION MOTIF SELECTION MODAL */}
      <AnimatePresence>
        {isRejectModalOpen && selectedApp && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <span>Motif de Rejet / Demande Correction</span>
                </h3>
                <button
                  onClick={() => setIsRejectModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Sélectionnez le motif de rejet qui sera notifié par e-mail automatique à <strong>{selectedApp.email}</strong> :
                </p>

                <div className="space-y-2">
                  {[
                    'Photo floue / Document illisible',
                    'Pièce d\'identité expirée',
                    'Selfie non conforme (document non visible en main)',
                    'Incohérence Nom/Prénom avec le justificatif',
                    'Autre motif',
                  ].map((motif) => (
                    <label
                      key={motif}
                      className={`flex items-center p-3 rounded-xl border text-xs font-bold cursor-pointer transition ${
                        rejectionReason === motif
                          ? 'bg-rose-50 border-rose-300 text-rose-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="motif"
                        value={motif}
                        checked={rejectionReason === motif}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="mr-3 text-rose-600 focus:ring-rose-500"
                      />
                      <span>{motif}</span>
                    </label>
                  ))}
                </div>

                {rejectionReason === 'Autre motif' && (
                  <textarea
                    rows={3}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Saisissez la raison détaillée du rejet..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                >
                  Annuler
                </button>
                <button
                  onClick={handleRejectSubmit}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold text-xs shadow-md"
                >
                  Confirmer Rejet & Envoyer E-mail
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
