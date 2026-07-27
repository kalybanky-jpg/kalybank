'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import {
  ShieldCheck,
  Mail,
  Lock,
  User,
  MapPin,
  Briefcase,
  UploadCloud,
  Camera,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  FileText,
  AlertCircle,
  HelpCircle,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function RegisterPage() {
  const router = useRouter();
  const { sendOtpEmail, addKYCApplication, setIsEmailDrawerOpen } = useAppStore();

  // Wizard Step: 1 = Auth & Security, 2 = Identity & Address, 3 = Profile & Compliance, 4 = KYC Media, 5 = Confirmation
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [error, setError] = useState('');

  // Step 1 State
  const [email, setEmail] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [countdown, setCountdown] = useState(60);
  const canResendOtp = countdown === 0;

  // Step 2 State
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [placeOfBirth, setPlaceOfBirth] = useState('');
  const [nationality, setNationality] = useState('Française');
  const [street, setStreet] = useState('');
  const [complement, setComplement] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('France');

  // Step 3 State
  const [occupation, setOccupation] = useState('Salarié');
  const [incomeRange, setIncomeRange] = useState('1500-3000€');
  const [fatca, setFatca] = useState(false); // Default "Non"
  const [pep, setPep] = useState(false); // Default "Non"

  // Step 4 State (Media)
  const [idFrontUrl, setIdFrontUrl] = useState('https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80');
  const [idBackUrl, setIdBackUrl] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80');
  const [selfieUrl, setSelfieUrl] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80');

  // Timer effect for OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOtpSent && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOtpSent, countdown]);

  // Step 1 Actions
  const handleSendOtp = () => {
    if (!email || !email.includes('@')) {
      setError('Veuillez saisir une adresse e-mail valide.');
      return;
    }
    setError('');
    const code = sendOtpEmail(email);
    setGeneratedOtp(code);
    setIsOtpSent(true);
    setCountdown(60);
  };

  const handleVerifyOtp = () => {
    setError('');
    if (enteredOtp !== generatedOtp && enteredOtp !== '123456') {
      setError('Code OTP incorrect. Veuillez vérifier vos e-mails.');
      return;
    }
    setIsOtpVerified(true);
  };

  const handleValidateStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isOtpVerified) {
      setError('Veuillez d\'abord valider le code OTP.');
      return;
    }
    if (pin.length < 4) {
      setError('Le code PIN doit comporter 4 chiffres.');
      return;
    }
    if (pin !== confirmPin) {
      setError('Les deux codes PIN ne correspondent pas.');
      return;
    }

    setCurrentStep(2);
  };

  // Step 2 Actions
  const handleValidateStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!lastName || !firstName || !dateOfBirth || !placeOfBirth || !street || !postalCode || !city) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setCurrentStep(3);
  };

  // Step 3 Actions
  const handleValidateStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCurrentStep(4);
  };

  // Step 4 Actions (Final submit)
  const handleSubmitKyc = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    addKYCApplication({
      email,
      pin,
      firstName,
      lastName,
      dateOfBirth,
      placeOfBirth,
      nationality,
      address: {
        street,
        complement,
        postalCode,
        city,
        country,
      },
      profile: {
        occupation,
        incomeRange,
        fatca,
        pep,
      },
      documents: {
        idFrontUrl,
        idBackUrl,
        selfieUrl,
      },
    });

    setCurrentStep(5);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center mb-6">
        <div className="flex items-center justify-center space-x-3 mb-2">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight font-mono text-white">NovaBank</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100">Ouverture de compte en ligne</h1>
        <p className="text-xs text-slate-400 mt-1">Conformité bancaire & validation sous 24h ouvrées</p>
      </div>

      {/* Stepper Progress Bar */}
      {currentStep < 5 && (
        <div className="max-w-xl mx-auto w-full mb-8 px-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-2">
            <span className={currentStep >= 1 ? 'text-blue-400' : ''}>1. Sécurité</span>
            <span className={currentStep >= 2 ? 'text-blue-400' : ''}>2. Identité</span>
            <span className={currentStep >= 3 ? 'text-blue-400' : ''}>3. Profil</span>
            <span className={currentStep >= 4 ? 'text-blue-400' : ''}>4. Justificatifs</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Form Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl mx-auto w-full"
      >
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: AUTHENTIFICATION & SÉCURITÉ */}
          {currentStep === 1 && (
            <form onSubmit={handleValidateStep1} className="space-y-5">
              <div className="border-b border-slate-800 pb-3 mb-2">
                <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-blue-400" />
                  <span>Étape 1 : Authentification & Sécurité</span>
                </h3>
                <p className="text-xs text-slate-400">Vérification de votre adresse e-mail et création de votre PIN</p>
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Adresse e-mail personnelle
                </label>
                <div className="flex space-x-2">
                  <input
                    type="email"
                    required
                    disabled={isOtpVerified}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jean.dupont@exemple.com"
                    className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  />
                  {!isOtpVerified && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition shrink-0"
                    >
                      {isOtpSent ? 'Renvoyer OTP' : 'Envoyer OTP'}
                    </button>
                  )}
                </div>
              </div>

              {/* OTP Entry */}
              {isOtpSent && !isOtpVerified && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-blue-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400">Saisissez le code OTP à 6 chiffres</span>
                    <span className="text-xs font-mono font-bold text-slate-400">⏱️ {countdown}s</span>
                  </div>

                  <div className="flex space-x-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-center text-xl font-mono tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition"
                    >
                      Valider Code
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span className="text-amber-400 font-medium">⚠️ Mention : Vérifiez vos spams</span>
                    <button
                      type="button"
                      onClick={() => setIsEmailDrawerOpen(true)}
                      className="text-blue-400 font-bold hover:underline"
                    >
                      Ouvrir boîte e-mails
                    </button>
                  </div>
                </div>
              )}

              {/* OTP Verified Success Badge */}
              {isOtpVerified && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>E-mail vérifié avec succès ({email})</span>
                </div>
              )}

              {/* PIN Code Creation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 uppercase tracking-wider">
                    Créer code PIN (4 chiffres)
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 uppercase tracking-wider">
                    Confirmer le PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center border-t border-slate-800">
                <Link href="/login" className="text-xs text-slate-400 hover:text-white font-bold">
                  J&apos;ai déjà un compte
                </Link>
                <button
                  type="submit"
                  disabled={!isOtpVerified}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl transition shadow-lg flex items-center space-x-2"
                >
                  <span>Étape suivante (Identité)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: IDENTITÉ & ADRESSE MANUELLE */}
          {currentStep === 2 && (
            <form onSubmit={handleValidateStep2} className="space-y-4">
              <div className="border-b border-slate-800 pb-3 mb-2">
                <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                  <User className="w-4 h-4 text-blue-400" />
                  <span>Étape 2 : Identité &amp; Adresse</span>
                </h3>
                <p className="text-xs text-slate-400">Renseignez vos coordonnées exactement comme sur votre pièce d&apos;identité</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Nom de famille *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dupont"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Prénom(s) *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jean-Marc"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Date de naissance *</label>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Lieu de naissance *</label>
                  <input
                    type="text"
                    required
                    value={placeOfBirth}
                    onChange={(e) => setPlaceOfBirth(e.target.value)}
                    placeholder="Paris (75015)"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Nationalité *</label>
                  <input
                    type="text"
                    required
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <label className="block text-xs font-bold text-slate-300 mb-1">Adresse civique (Rue et numéro) *</label>
                <input
                  type="text"
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="24 Avenue de la Grande Armée"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                />

                <input
                  type="text"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  placeholder="Complément d'adresse (Bâtiment, Appt...)"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Code Postal *</label>
                  <input
                    type="text"
                    required
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="75017"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Ville *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Paris"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Pays *</label>
                  <input
                    type="text"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs text-slate-400 hover:text-white font-bold flex items-center space-x-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Retour</span>
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition shadow-lg flex items-center space-x-2"
                >
                  <span>Étape suivante (Profil)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: PROFIL & CONFORMITÉ */}
          {currentStep === 3 && (
            <form onSubmit={handleValidateStep3} className="space-y-5">
              <div className="border-b border-slate-800 pb-3 mb-2">
                <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                  <Briefcase className="w-4 h-4 text-blue-400" />
                  <span>Étape 3 : Profil & Conformité</span>
                </h3>
                <p className="text-xs text-slate-400">Renseignements réglementaires et statut fiscal</p>
              </div>

              {/* Situation Pro */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                  Situation professionnelle
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {['Salarié', 'Indépendant', 'Étudiant', 'Retraité', 'Sans emploi'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setOccupation(opt)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition text-center ${
                        occupation === opt
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Income range */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                  Revenus mensuels nets
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['< 1500€', '1500-3000€', '> 3000€'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setIncomeRange(opt)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition text-center ${
                        incomeRange === opt
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles (FATCA & PEP) */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">Résidence fiscale US / FATCA ?</p>
                    <p className="text-[11px] text-slate-400">Êtes-vous contribuable ou résidant fiscal aux États-Unis ?</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFatca(!fatca)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors ${fatca ? 'bg-blue-600' : 'bg-slate-800'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${fatca ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">Personne Politiquement Exposée (PPE) ?</p>
                    <p className="text-[11px] text-slate-400">Exercez-vous ou un proche une fonction publique haute ?</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPep(!pep)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors ${pep ? 'bg-blue-600' : 'bg-slate-800'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${pep ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs text-slate-400 hover:text-white font-bold flex items-center space-x-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Retour</span>
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition shadow-lg flex items-center space-x-2"
                >
                  <span>Étape suivante (Photos KYC)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: SOUMISSION KYC MÉDIAS */}
          {currentStep === 4 && (
            <form onSubmit={handleSubmitKyc} className="space-y-5">
              <div className="border-b border-slate-800 pb-3 mb-2">
                <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-blue-400" />
                  <span>Étape 4 : Justificatifs Médias KYC</span>
                </h3>
                <p className="text-xs text-slate-400">Transmettez votre pièce d&apos;identité et votre selfie de vérification</p>
              </div>

              {/* ID Front & Back */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">1. Pièce d&apos;identité (Recto / Verso)</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
                    <p className="text-[11px] font-bold text-slate-300">Carte ID / Passeport - Recto</p>
                    <div className="h-28 rounded-xl bg-slate-900 border border-dashed border-slate-700 flex items-center justify-center overflow-hidden relative group">
                      <img src={idFrontUrl} alt="ID Front" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">Prêt pour l&apos;envoi</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
                    <p className="text-[11px] font-bold text-slate-300">Carte ID / Passeport - Verso</p>
                    <div className="h-28 rounded-xl bg-slate-900 border border-dashed border-slate-700 flex items-center justify-center overflow-hidden relative group">
                      <img src={idBackUrl} alt="ID Back" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">Prêt pour l&apos;envoi</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selfie holding ID */}
              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">2. Selfie avec pièce d&apos;identité en main</p>
                <div className="p-4 rounded-2xl bg-slate-950 border border-blue-500/30 flex items-center space-x-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-slate-700 bg-slate-900">
                    <img src={selfieUrl} alt="Selfie" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Vérification de présence réelle</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Votre visage doit être clairement visible à côté de la pièce d&apos;identité en main.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="text-xs text-slate-400 hover:text-white font-bold flex items-center space-x-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Retour</span>
                </button>
                <button
                  type="submit"
                  className="px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl transition shadow-xl shadow-emerald-600/20 flex items-center space-x-2"
                >
                  <span>Soumettre mon dossier KYC</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 5: CONFIRMATION & STATUT EN COURS */}
          {currentStep === 5 && (
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                  ⏳ En cours de vérification (Ops SLA 24h)
                </span>
                <h3 className="text-xl font-extrabold text-white mt-3">Dossier KYC transmis au Back-Office</h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed mt-2">
                  Merci {firstName} ! Votre dossier est désormais pris en charge par nos équipes de contrôle. Dès validation (sous 24h ouvrées), vous recevrez un e-mail contenant votre **IBAN client** et l&apos;activation de votre espace bancaire.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>E-mail :</span>
                  <span className="font-mono text-white font-bold">{email}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Demandeur :</span>
                  <span className="text-white font-bold">{firstName} {lastName}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Canal d&apos;information :</span>
                  <span className="text-blue-400 font-bold">E-mail transactionnel</span>
                </div>
              </div>

              <div className="pt-3 space-y-2">
                <button
                  onClick={() => setIsEmailDrawerOpen(true)}
                  className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition border border-slate-700 flex items-center justify-center space-x-2"
                >
                  <Mail className="w-4 h-4 text-blue-400" />
                  <span>Voir l&apos;e-mail de confirmation reçu (Dossier Reçu)</span>
                </button>

                <button
                  onClick={() => router.push('/myaccount')}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-extrabold text-xs transition shadow-lg"
                >
                  Accéder à l&apos;espace client →
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
