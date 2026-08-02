'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ImageIcon, Save, UploadCloud } from 'lucide-react';
import { normalizeBankName } from '@/lib/branding';
import type { BrandSettings } from '@/lib/types';
import { useBrand } from './BrandProvider';

function useFilePreview(file: File | null, fallback: string) {
  const objectUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);
  return objectUrl ?? fallback;
}

function FilePicker({
  id,
  label,
  hint,
  file,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label htmlFor={id} className="block rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-xs">
      <span className="flex items-center gap-2 font-extrabold text-slate-900">
        <UploadCloud className="h-4 w-4 text-indigo-600" />
        {label}
      </span>
      <span className="mt-1 block text-[11px] leading-5 text-slate-500">{hint}</span>
      <span className="mt-3 block rounded-xl bg-slate-100 px-3 py-2 font-semibold text-slate-700">
        {file?.name ?? 'Conserver le fichier publié'}
      </span>
      <input
        id={id}
        type="file"
        accept="image/svg+xml,image/png,image/webp"
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

export default function BrandSettingsEditor() {
  const { brand, setBrand } = useBrand();
  const [bankName, setBankName] = useState(brand.bankName);
  const [primaryLogo, setPrimaryLogo] = useState<File | null>(null);
  const [reversedLogo, setReversedLogo] = useState<File | null>(null);
  const [favicon, setFavicon] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const primaryPreview = useFilePreview(primaryLogo, brand.primaryLogoUrl);
  const reversedPreview = useFilePreview(reversedLogo, brand.reversedLogoUrl);
  const faviconPreview = useFilePreview(favicon, brand.appIcon512Url);
  const hasChanges =
    bankName.trim() !== brand.bankName || Boolean(primaryLogo || reversedLogo || favicon);
  const validationError = useMemo(() => {
    try {
      normalizeBankName(bankName);
      for (const file of [primaryLogo, reversedLogo, favicon]) {
        if (file && file.size > 5 * 1024 * 1024) return 'Chaque image doit peser au maximum 5 Mo.';
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Nom de banque invalide.';
    }
  }, [bankName, favicon, primaryLogo, reversedLogo]);

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (validationError) {
      setFeedback({ type: 'error', message: validationError });
      return;
    }
    setIsSaving(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.set('bankName', normalizeBankName(bankName));
      formData.set('expectedRevision', String(brand.revision));
      if (primaryLogo) formData.set('primaryLogo', primaryLogo);
      if (reversedLogo) formData.set('reversedLogo', reversedLogo);
      if (favicon) formData.set('favicon', favicon);
      const response = await fetch('/api/admin/branding', { method: 'PUT', body: formData });
      const payload = (await response.json()) as { brand?: BrandSettings; error?: string };
      if (!response.ok || !payload.brand) {
        throw new Error(payload.error ?? 'Publication de la marque impossible.');
      }
      setBrand(payload.brand);
      setBankName(payload.brand.bankName);
      setPrimaryLogo(null);
      setReversedLogo(null);
      setFavicon(null);
      setFeedback({
        type: 'success',
        message: 'Identité publiée. Les autres sessions la verront au prochain rechargement.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Publication impossible.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={publish} className="rounded-3xl border border-slate-200 bg-white p-6 md:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <ImageIcon className="h-8 w-8 text-violet-600" />
          <h2 className="mt-4 font-extrabold text-slate-900">Identité de la banque</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            Publiez le nom, les deux signatures et le favicon dans une version unique. Les formats SVG, PNG et WebP sont acceptés.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">
          Révision {brand.revision}
        </span>
      </div>

      <label className="mt-6 block text-xs font-bold text-slate-800">
        Nom public de la banque
        <input
          value={bankName}
          minLength={2}
          maxLength={80}
          onChange={(event) => {
            setBankName(event.target.value);
            setFeedback(null);
          }}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
        />
      </label>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="space-y-3">
          <div className="flex h-32 items-center justify-center rounded-2xl border border-slate-200 bg-[#FBFAF7] p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={primaryPreview} alt="Aperçu du logo principal" className="max-h-full max-w-full object-contain" />
          </div>
          <FilePicker id="brand-primary-logo" label="Logo principal" hint="Pour les fonds clairs et les e-mails." file={primaryLogo} onChange={setPrimaryLogo} />
        </div>
        <div className="space-y-3">
          <div className="flex h-32 items-center justify-center rounded-2xl bg-slate-950 p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={reversedPreview} alt="Aperçu du logo blanc" className="max-h-full max-w-full object-contain" />
          </div>
          <FilePicker id="brand-reversed-logo" label="Logo blanc" hint="Pour les fonds sombres et les PDF." file={reversedLogo} onChange={setReversedLogo} />
        </div>
        <div className="space-y-3">
          <div className="flex h-32 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={faviconPreview} alt="Aperçu du favicon" className="h-20 w-20 rounded-2xl object-contain shadow" />
          </div>
          <FilePicker id="brand-favicon" label="Favicon carré" hint="Minimum conseillé : 512 × 512 px." file={favicon} onChange={setFavicon} />
        </div>
      </div>

      {feedback && (
        <p className={`mt-4 rounded-xl p-3 text-xs font-medium ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
          {feedback.message}
        </p>
      )}
      {validationError && !feedback && <p className="mt-3 text-xs text-rose-700">{validationError}</p>}

      <button
        type="submit"
        disabled={!hasChanges || Boolean(validationError) || isSaving}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {isSaving ? 'Publication et génération des assets…' : 'Publier l’identité'}
      </button>
    </form>
  );
}
