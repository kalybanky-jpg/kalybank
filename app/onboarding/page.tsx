'use client';

import React, { useState } from 'react';
import { FileCheck2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { deleteEvidence, uploadEvidence } from '@/lib/evidence';
import BrandLogo from '@/components/brand/BrandLogo';

type EvidenceKey = 'id_front' | 'id_back' | 'selfie';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

export default function OnboardingPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [placeOfBirth, setPlaceOfBirth] = useState('');
  const [nationality, setNationality] = useState('');
  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [occupation, setOccupation] = useState('');
  const [incomeRange, setIncomeRange] = useState('');
  const [fatca, setFatca] = useState(false);
  const [pep, setPep] = useState(false);
  const [files, setFiles] = useState<Partial<Record<EvidenceKey, File>>>({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const setEvidence = (key: EvidenceKey, file?: File) => {
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES) {
      setError('Chaque justificatif doit être un PDF, PNG ou JPEG de 10 Mo maximum.');
      return;
    }
    setError('');
    setFiles((current) => ({ ...current, [key]: file }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!files.id_front || !files.id_back || !files.selfie) {
      setError('Les trois justificatifs sont obligatoires.');
      return;
    }

    const birthDate = new Date(`${dateOfBirth}T00:00:00Z`);
    const adultThreshold = new Date();
    adultThreshold.setUTCFullYear(adultThreshold.getUTCFullYear() - 18);
    if (Number.isNaN(birthDate.getTime()) || birthDate > adultThreshold) {
      setError('Le demandeur doit avoir au moins 18 ans.');
      return;
    }

    setIsLoading(true);
    const uploadedPaths: string[] = [];
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Session expirée.');

      const idempotencyKey = crypto.randomUUID();
      const documentObjectPaths: Record<string, string> = {};

      for (const [kind, file] of Object.entries(files) as [EvidenceKey, File][]) {
        const path = await uploadEvidence(
          'kyc-evidence',
          `${idempotencyKey}-${kind}`,
          file,
        );
        uploadedPaths.push(path);
        documentObjectPaths[kind] = path;
      }

      const { error: submissionError } = await supabase.rpc('submit_kyc_application', {
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_date_of_birth: dateOfBirth,
        p_place_of_birth: placeOfBirth.trim(),
        p_nationality: nationality.trim(),
        p_address: {
          street: street.trim(),
          postalCode: postalCode.trim(),
          city: city.trim(),
          country: country.trim(),
        },
        p_occupation: occupation.trim(),
        p_income_range: incomeRange.trim(),
        p_fatca: fatca,
        p_pep: pep,
        p_document_object_paths: documentObjectPaths,
        p_idempotency_key: idempotencyKey,
      });
      if (submissionError) throw submissionError;

      window.location.replace('/myaccount');
    } catch (caughtError) {
      if (uploadedPaths.length) {
        try {
          await deleteEvidence('kyc-evidence', uploadedPaths);
        } catch {
          // Best-effort cleanup; private orphaned objects remain inaccessible.
        }
      }
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Le dossier n’a pas pu être transmis.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6"
      >
        <header>
          <BrandLogo
            tone="reversed-white"
            priority
            className="mb-4 h-auto w-[180px]"
          />
          <div>
            <h1 className="text-xl font-extrabold">Dossier de vérification d&apos;identité</h1>
            <p className="text-xs text-slate-400">
              Contrôle humain interne. Une approbation ne crée ni compte bancaire ni IBAN.
            </p>
          </div>
        </header>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <legend className="sr-only">Identité</legend>
          {[
            ['Prénom', firstName, setFirstName],
            ['Nom', lastName, setLastName],
            ['Lieu de naissance', placeOfBirth, setPlaceOfBirth],
            ['Nationalité', nationality, setNationality],
          ].map(([label, value, setter]) => (
            <label key={label as string} className="text-xs font-bold text-slate-300">
              {label as string}
              <input
                type="text"
                required
                value={value as string}
                onChange={(event) => (setter as React.Dispatch<React.SetStateAction<string>>)(event.target.value)}
                className="mt-1.5 w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white"
              />
            </label>
          ))}
          <label className="text-xs font-bold text-slate-300 sm:col-span-2">
            Date de naissance
            <input
              type="date"
              required
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
              className="mt-1.5 w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white"
            />
          </label>
        </fieldset>

        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <legend className="text-sm font-extrabold mb-3">Adresse déclarée</legend>
          <label className="text-xs font-bold text-slate-300 sm:col-span-2">
            Rue et numéro
            <input required value={street} onChange={(event) => setStreet(event.target.value)} className="mt-1.5 w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl" />
          </label>
          <label className="text-xs font-bold text-slate-300">
            Code postal
            <input required value={postalCode} onChange={(event) => setPostalCode(event.target.value)} className="mt-1.5 w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl" />
          </label>
          <label className="text-xs font-bold text-slate-300">
            Ville
            <input required value={city} onChange={(event) => setCity(event.target.value)} className="mt-1.5 w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl" />
          </label>
          <label className="text-xs font-bold text-slate-300 sm:col-span-2">
            Pays
            <input required value={country} onChange={(event) => setCountry(event.target.value)} className="mt-1.5 w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl" />
          </label>
        </fieldset>

        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <legend className="text-sm font-extrabold mb-3">Profil réglementaire déclaré</legend>
          <label className="text-xs font-bold text-slate-300">
            Profession
            <input required value={occupation} onChange={(event) => setOccupation(event.target.value)} className="mt-1.5 w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl" />
          </label>
          <label className="text-xs font-bold text-slate-300">
            Tranche de revenus
            <select required value={incomeRange} onChange={(event) => setIncomeRange(event.target.value)} className="mt-1.5 w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl">
              <option value="">Sélectionner</option>
              <option value="under_1500">Moins de 1 500</option>
              <option value="1500_3000">1 500 à 3 000</option>
              <option value="over_3000">Plus de 3 000</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={fatca} onChange={(event) => setFatca(event.target.checked)} />
            Résidence ou contribuabilité fiscale américaine (FATCA)
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={pep} onChange={(event) => setPep(event.target.checked)} />
            Personne politiquement exposée ou proche
          </label>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-extrabold mb-3">Justificatifs privés</legend>
          {[
            ['id_front', 'Pièce d’identité — recto'],
            ['id_back', 'Pièce d’identité — verso'],
            ['selfie', 'Selfie de contrôle'],
          ].map(([key, label]) => (
            <label key={key} className="block text-xs font-bold text-slate-300">
              {label}
              <input
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(event) => setEvidence(key as EvidenceKey, event.target.files?.[0])}
                className="mt-1.5 block w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3"
              />
            </label>
          ))}
          <p className="text-[11px] text-slate-500">
            PDF, PNG ou JPEG, 10 Mo maximum par fichier. Stockage privé avec accès RLS.
          </p>
        </fieldset>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-extrabold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <FileCheck2 className="w-4 h-4" />
          {isLoading ? 'Transmission chiffrée…' : 'Transmettre le dossier pour contrôle'}
        </button>
      </form>
    </main>
  );
}
