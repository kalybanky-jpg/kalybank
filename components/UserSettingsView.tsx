'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { Currency, Language } from '@/lib/types';
import {
  Settings,
  User,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Globe,
  Database,
  Bell,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export default function UserSettingsView() {
  const {
    language,
    setLanguage,
    currency,
    setCurrency,
    isMaskedBalance,
    toggleMaskBalance,
    setIsSupabaseModalOpen,
  } = useAppStore();

  const t = translations[language] || translations.fr;

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [profile, setProfile] = useState({
    firstName: 'Thomas',
    lastName: 'Laurent',
    email: 'thomas.laurent@example.com',
    phone: '+33 6 12 34 56 78',
    address: '12 Avenue des Champs-Élysées, 75008 Paris',
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 text-white shadow-xl border border-blue-900/40">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Settings className="w-4 h-4" />
            <span>{t.settings}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Paramètres du Compte & Sécurité
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Gérez vos informations personnelles, la sécurité de vos accès bancaires et vos préférences d&apos;affichage.
          </p>
        </div>

        <button
          onClick={() => setIsSupabaseModalOpen(true)}
          id="user-settings-database-btn"
          className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center space-x-2 backdrop-blur-md transition border border-white/10 shadow-sm shrink-0"
        >
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Statut Synchronisation BDD</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>Vos modifications de profil ont été enregistrées avec succès.</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (lg:col-span-7): Profile Settings Form */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Informations Personnelles</h2>
              <p className="text-xs text-slate-500">Mettez à jour vos coordonnées client</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prénom</label>
                <input
                  type="text"
                  value={profile.firstName}
                  onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nom</label>
                <input
                  type="text"
                  value={profile.lastName}
                  onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Adresse Email</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone Portable</label>
              <input
                type="text"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Adresse Postale</label>
              <input
                type="text"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
              >
                Sauvegarder mon profil
              </button>
            </div>
          </form>
        </div>

        {/* Right Column (lg:col-span-5): Preferences & Security Cards */}
        <div className="lg:col-span-5 space-y-6">
          {/* Currency & Language Preferences Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
              <Globe className="w-5 h-5 text-indigo-600" />
              <h3 className="font-extrabold text-sm text-slate-900">Langue & Devise</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Devise d&apos;affichage principale</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['EUR', 'USD', 'GBP', 'CHF', 'CAD'] as Currency[]).map((cur) => (
                    <button
                      key={cur}
                      onClick={() => setCurrency(cur)}
                      className={`py-2 rounded-xl text-xs font-extrabold border transition ${
                        currency === cur
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cur}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Langue de l&apos;interface</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { code: 'fr', name: 'Français 🇫🇷' },
                    { code: 'en', name: 'English 🇬🇧' },
                    { code: 'es', name: 'Español 🇪🇸' },
                    { code: 'de', name: 'Deutsch 🇩🇪' },
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setLanguage(lang.code as Language)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                        language === lang.code
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Security & PIN Code Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
              <Shield className="w-5 h-5 text-emerald-600" />
              <h3 className="font-extrabold text-sm text-slate-900">Sécurité & Masquage</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <p className="text-xs font-bold text-slate-800">Masquer automatiquement le solde</p>
                  <p className="text-[10px] text-slate-500">Mode confidentiel pour endroits publics</p>
                </div>
                <button
                  onClick={toggleMaskBalance}
                  className={`p-2 rounded-xl transition ${
                    isMaskedBalance ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isMaskedBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <a
                href="/reset-pin"
                className="w-full py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center space-x-2 transition shadow-xs"
              >
                <KeyRound className="w-4 h-4 text-blue-600" />
                <span>Réinitialiser mon code PIN secret</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
