'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  FileCheck2,
  FileText,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  UploadCloud,
} from 'lucide-react';
import BrandLogo from '@/components/brand/BrandLogo';
import {
  kycAddressToJson,
  kycChangesToJson,
  kycProfileToJson,
  parseKycAddress,
  parseKycDocumentPaths,
  parseKycDraft,
  serializeKycDocumentPaths,
  serializeKycDraft,
  type KycDraftForm,
  type KycEvidenceKey,
} from '@/lib/domain/kyc';
import { uploadEvidence } from '@/lib/evidence';
import { appErrorCode, localizedAppError } from '@/lib/user-i18n';
import { splitFullName } from '@/lib/identity';
import { kycTranslations } from '@/lib/kyc-i18n';
import { isSupportedLanguage } from '@/lib/language';
import { createClient } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/database.types';
import type { Language } from '@/lib/types';
import {
  MAX_COMPRESSIBLE_IMAGE_SOURCE_BYTES,
  isCompressibleRasterType,
} from '@/lib/upload-preparation';

type EvidenceKey = KycEvidenceKey;
type UploadPhase = 'idle' | 'preparing' | 'uploading' | 'success' | 'error';
type EvidenceUploadState = {
  phase: UploadPhase;
  original?: File;
  fileName?: string;
  fileType?: string;
  message?: string;
};
type SectionKey =
  | 'identity'
  | 'birth'
  | 'address'
  | 'profile'
  | 'document_metadata'
  | EvidenceKey;

type KycForm = KycDraftForm;

const EMPTY_FORM: KycForm = {
  firstName: '', lastName: '', placeOfBirth: '', nationality: '', dateOfBirth: '',
  street: '', postalCode: '', city: '', country: '', occupation: '', incomeRange: '',
  fatca: false, pep: false, documentType: '', documentNumber: '', issuingCountry: '',
  documentExpiresOn: '',
};

const ALL_STEPS: SectionKey[] = [
  'identity', 'birth', 'address', 'profile', 'document_metadata',
  'id_front', 'id_back', 'proof_of_address', 'selfie',
];
const STEP_TITLE_KEYS: Record<SectionKey, keyof ReturnType<typeof getCopy>> = {
  identity: 'identity',
  birth: 'birth',
  address: 'address',
  profile: 'profile',
  document_metadata: 'documentMetadata',
  id_front: 'idFront',
  id_back: 'idBack',
  proof_of_address: 'proofOfAddress',
  selfie: 'selfie',
};
const STEP_HINT_KEYS: Record<SectionKey, keyof ReturnType<typeof getCopy>> = {
  identity: 'identityHint',
  birth: 'birthHint',
  address: 'addressHint',
  profile: 'profileHint',
  document_metadata: 'documentMetadataHint',
  id_front: 'idFrontHint',
  id_back: 'idBackHint',
  proof_of_address: 'proofOfAddressHint',
  selfie: 'selfieHint',
};
const FILE_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const fieldClass =
  'mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10';
const labelClass = 'block text-sm font-semibold text-slate-800';

const EVIDENCE_KEYS: EvidenceKey[] = ['id_front', 'id_back', 'proof_of_address', 'selfie'];

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fallback = window.setTimeout(finish, 150);
    if (document.visibilityState === 'visible') {
      window.requestAnimationFrame(() => {
        // The browser paints between these two frames, so the local preview is
        // visible before image preparation starts.
        window.requestAnimationFrame(() => {
          window.clearTimeout(fallback);
          finish();
        });
      });
    }
  });
}

async function prepareImage(file: File, square = false): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  const bitmap = await createImageBitmap(file);
  const sourceSize = square ? Math.min(bitmap.width, bitmap.height) : null;
  const sourceX = square ? (bitmap.width - sourceSize!) / 2 : 0;
  const sourceY = square ? (bitmap.height - sourceSize!) / 2 : 0;
  const sourceWidth = sourceSize ?? bitmap.width;
  const sourceHeight = sourceSize ?? bitmap.height;
  const ratio = Math.min(1, 1800 / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * ratio));
  canvas.height = Math.max(1, Math.round(sourceHeight * ratio));
  canvas.getContext('2d')?.drawImage(
    bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height,
  );
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('IMAGE_COMPRESSION_FAILED')), 'image/jpeg', 0.86),
  );
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

function CameraCapture({
  copy,
  disabled,
  onPreparingChange,
  onCapture,
  previewUrl,
}: {
  copy: ReturnType<typeof getCopy>;
  disabled: boolean;
  onPreparingChange: (preparing: boolean) => void;
  onCapture: (file: File) => Promise<void>;
  previewUrl?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const startingRef = useRef(false);
  const capturingRef = useRef(false);
  const cameraMountedRef = useRef(true);
  const startRequestIdRef = useRef(0);

  const releaseCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    releaseCamera();
    setOpen(false);
  }, [releaseCamera]);

  useEffect(() => {
    cameraMountedRef.current = true;
    return () => {
      cameraMountedRef.current = false;
      startRequestIdRef.current += 1;
      releaseCamera();
    };
  }, [releaseCamera]);

  const start = async () => {
    if (disabled || startingRef.current) return;
    startingRef.current = true;
    const requestId = startRequestIdRef.current + 1;
    startRequestIdRef.current = requestId;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      if (!cameraMountedRef.current || startRequestIdRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      if (cameraMountedRef.current && startRequestIdRef.current === requestId) {
        setError(copy.cameraUnavailable);
      }
    } finally {
      if (startRequestIdRef.current === requestId) startingRef.current = false;
    }
  };

  const capture = async () => {
    if (disabled || capturingRef.current) return;
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    capturingRef.current = true;
    setCapturing(true);
    onPreparingChange(true);
    try {
      const size = Math.min(video.videoWidth, video.videoHeight);
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1080;
      canvas.getContext('2d')?.drawImage(
        video,
        (video.videoWidth - size) / 2,
        (video.videoHeight - size) / 2,
        size,
        size,
        0,
        0,
        1080,
        1080,
      );
      // The pixels are already copied to the canvas: release the camera before
      // encoding or uploading so the user gets immediate visual confirmation.
      stop();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error('CAPTURE_FAILED')), 'image/jpeg', 0.88),
      );
      await onCapture(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));
    } catch {
      releaseCamera();
      if (cameraMountedRef.current) setError(copy.uploadFailed);
    } finally {
      capturingRef.current = false;
      onPreparingChange(false);
      if (cameraMountedRef.current) setCapturing(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">{copy.cameraOnly}</p>
      {/* Blob previews are local and cannot be handled by next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {previewUrl && !open && <img src={previewUrl} alt={copy.selfiePreview} className="mx-auto max-h-72 rounded-2xl object-contain" />}
      {open && <video ref={videoRef} playsInline muted className="mx-auto aspect-square max-h-80 rounded-2xl bg-black object-cover" />}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <button disabled={disabled || capturing} type="button" onClick={open ? capture : start} className="mx-auto flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
        <Camera className="h-4 w-4" /> {capturing ? copy.preparingFile : open ? copy.takePhoto : previewUrl ? copy.retake : copy.openCamera}
      </button>
    </div>
  );
}

function EvidenceUploadFeedback({
  copy,
  state,
  onRetry,
}: {
  copy: ReturnType<typeof getCopy>;
  state?: EvidenceUploadState;
  onRetry: () => void;
}) {
  const phase = state?.phase ?? 'idle';
  if (phase === 'idle') return null;

  const pending = phase === 'preparing' || phase === 'uploading';
  const message = phase === 'preparing'
    ? copy.preparingFile
    : phase === 'uploading'
      ? copy.uploadingFile
      : phase === 'success'
        ? copy.uploadSuccess
        : state?.message ?? copy.uploadFailed;

  return (
    <div
      role={phase === 'error' ? 'alert' : 'status'}
      aria-live={phase === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      aria-busy={pending}
      className={`mt-3 rounded-xl border p-3 text-left text-sm ${
        phase === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : phase === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-blue-200 bg-blue-50 text-blue-900'
      }`}
    >
      <div className="flex items-center gap-2">
        {pending && <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />}
        {phase === 'success' && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
        <span className="font-semibold">{message}</span>
      </div>
      {pending && (
        <span aria-hidden="true" className="mt-2 block h-1.5 overflow-hidden rounded-full bg-blue-100">
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-blue-600" />
        </span>
      )}
      {phase === 'error' && state?.original && (
        <button type="button" onClick={onRetry} className="mt-3 flex min-h-11 items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 font-bold text-rose-800">
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          {copy.retryUpload}
        </button>
      )}
    </div>
  );
}

function getCopy(language: Language) {
  return kycTranslations[language];
}

export default function OnboardingPage() {
  const [language, setLanguage] = useState<Language>('fr');
  const copy = getCopy(language);
  const [form, setForm] = useState<KycForm>(EMPTY_FORM);
  const [paths, setPaths] = useState<Partial<Record<EvidenceKey, string>>>({});
  const [previews, setPreviews] = useState<Partial<Record<EvidenceKey, string>>>({});
  const [uploadStates, setUploadStates] = useState<Partial<Record<EvidenceKey, EvidenceUploadState>>>({});
  const [uploadedNow, setUploadedNow] = useState<Set<EvidenceKey>>(new Set());
  const [requestedItems, setRequestedItems] = useState<SectionKey[]>([]);
  const [kycId, setKycId] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cameraPreparing, setCameraPreparing] = useState(false);
  const [error, setError] = useState('');
  const stepTitleRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<SectionKey | null>(null);
  const mountedRef = useRef(true);
  const activeUploadRef = useRef(false);
  const cameraPreparingRef = useRef(false);
  const previewUrlsRef = useRef<Partial<Record<EvidenceKey, string>>>({});
  const uploadRequestIdsRef = useRef<Record<EvidenceKey, number>>({
    id_front: 0,
    id_back: 0,
    proof_of_address: 0,
    selfie: 0,
  });

  const correctionMode = Boolean(kycId);
  const steps = useMemo(() => {
    const selected = correctionMode ? ALL_STEPS.filter((step) => requestedItems.includes(step)) : ALL_STEPS;
    return selected.filter((step) => step !== 'id_back' || form.documentType !== 'passport');
  }, [correctionMode, requestedItems, form.documentType]);
  const step = steps[Math.min(stepIndex, Math.max(0, steps.length - 1))] ?? 'identity';
  const uploadPending = cameraPreparing || EVIDENCE_KEYS.some((key) => {
    const phase = uploadStates[key]?.phase;
    return phase === 'preparing' || phase === 'uploading';
  });

  useEffect(() => {
    const requestIds = uploadRequestIdsRef.current;
    const previewUrls = previewUrlsRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeUploadRef.current = false;
      cameraPreparingRef.current = false;
      for (const key of EVIDENCE_KEYS) {
        requestIds[key] += 1;
        const previewUrl = previewUrls[key];
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      }
      previewUrlsRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (previousStepRef.current === null) {
      previousStepRef.current = step;
      return;
    }
    if (previousStepRef.current !== step) {
      previousStepRef.current = step;
      stepTitleRef.current?.focus();
    }
  }, [ready, step]);

  const update = <K extends keyof KycForm>(key: K, value: KycForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      const [{ data: profile }, { data: application }, { data: draft }] = await Promise.all([
        supabase.from('profiles').select('display_name,preferred_language').eq('user_id', user.id).single(),
        supabase.from('kyc_applications').select('*').eq('owner_id', user.id).order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('kyc_drafts').select('*').eq('owner_id', user.id).maybeSingle(),
      ]);
      const preferred = isSupportedLanguage(profile?.preferred_language) ? profile.preferred_language : 'fr';
      setLanguage(preferred);
      if (application && ['needs_information', 'rejected'].includes(application.status)) {
        const address = parseKycAddress(application.address);
        setKycId(application.id);
        setRequestedItems(
          application.requested_items.filter((item): item is SectionKey =>
            ALL_STEPS.includes(item as SectionKey),
          ),
        );
        setForm({
          firstName: application.first_name, lastName: application.last_name,
          placeOfBirth: application.place_of_birth, nationality: application.nationality,
          dateOfBirth: application.date_of_birth, street: address.street,
          postalCode: address.postalCode, city: address.city,
          country: address.country, occupation: application.occupation,
          incomeRange: application.income_range, fatca: application.fatca, pep: application.pep,
          documentType: application.document_type ?? '', documentNumber: application.document_number ?? '',
          issuingCountry: application.issuing_country ?? '', documentExpiresOn: application.document_expires_on ?? '',
        });
        setPaths(parseKycDocumentPaths(application.document_object_paths));
      } else if (application) {
        window.location.replace('/myaccount?tab=kyc');
        return;
      } else if (draft) {
        setForm({ ...EMPTY_FORM, ...parseKycDraft(draft.payload) });
        setPaths(parseKycDocumentPaths(draft.document_object_paths));
        setStepIndex(draft.current_step ?? 0);
        setSaved(true);
      } else {
        const parsed = splitFullName(
          profile?.display_name ??
          (typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name : ''),
        );
        if (parsed) setForm((current) => ({ ...current, firstName: parsed.firstName, lastName: parsed.lastName }));
      }
      setReady(true);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready || correctionMode) return;
    const timeout = window.setTimeout(async () => {
      setSaving(true);
      const { error: saveError } = await createClient().rpc('save_kyc_draft', {
        p_current_step: stepIndex,
        p_payload: serializeKycDraft(form),
        p_document_object_paths: serializeKycDocumentPaths(paths),
        p_preferred_language: language,
      });
      setSaving(false);
      setSaved(!saveError);
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [correctionMode, form, language, paths, ready, stepIndex]);

  const upload = async (key: EvidenceKey, original: File, reusePreview = false) => {
    if (activeUploadRef.current) return;
    const maximumSourceBytes = isCompressibleRasterType(original.type)
      ? MAX_COMPRESSIBLE_IMAGE_SOURCE_BYTES
      : 10 * 1024 * 1024;
    if (!FILE_TYPES.has(original.type) || original.size > maximumSourceBytes) {
      setUploadStates((current) => ({
        ...current,
        [key]: { phase: 'error', fileName: original.name, fileType: original.type, message: copy.invalidFile },
      }));
      return;
    }

    activeUploadRef.current = true;
    const requestId = uploadRequestIdsRef.current[key] + 1;
    uploadRequestIdsRef.current[key] = requestId;
    const isCurrentRequest = () => mountedRef.current && uploadRequestIdsRef.current[key] === requestId;

    setError('');
    if (!reusePreview) {
      const previewUrl = URL.createObjectURL(original);
      const previousPreviewUrl = previewUrlsRef.current[key];
      previewUrlsRef.current[key] = previewUrl;
      setPreviews((current) => ({ ...current, [key]: previewUrl }));
      if (previousPreviewUrl) URL.revokeObjectURL(previousPreviewUrl);
    }
    setUploadStates((current) => ({
      ...current,
      [key]: {
        phase: 'preparing',
        original,
        fileName: original.name,
        fileType: original.type,
      },
    }));

    try {
      // Yield after publishing the local preview so it paints before image
      // decoding/compression and the signed upload request begin.
      await waitForNextPaint();
      if (!isCurrentRequest()) return;
      const file = await prepareImage(original, key === 'selfie');
      if (!isCurrentRequest()) return;
      if (file.size > 10 * 1024 * 1024) {
        setUploadStates((current) => ({
          ...current,
          [key]: { phase: 'error', fileName: original.name, fileType: original.type, message: copy.invalidFile },
        }));
        return;
      }
      setUploadStates((current) => ({
        ...current,
        [key]: {
          phase: 'uploading',
          original,
          fileName: original.name,
          fileType: original.type,
        },
      }));
      const path = await uploadEvidence('kyc-evidence', key, file);
      if (!isCurrentRequest()) return;
      setPaths((current) => ({ ...current, [key]: path }));
      setUploadedNow((current) => new Set(current).add(key));
      setUploadStates((current) => ({
        ...current,
        [key]: {
          phase: 'success',
          fileName: original.name,
          fileType: original.type,
        },
      }));
    } catch (caught) {
      if (!isCurrentRequest()) return;
      setUploadStates((current) => ({
        ...current,
        [key]: {
          phase: 'error',
          original,
          fileName: original.name,
          fileType: original.type,
          message: localizedAppError(language, appErrorCode(caught)),
        },
      }));
    } finally {
      if (uploadRequestIdsRef.current[key] === requestId) activeUploadRef.current = false;
    }
  };

  const validate = () => {
    if (step === 'identity' && (!form.firstName.trim() || !form.lastName.trim() || !form.placeOfBirth.trim() || !form.nationality.trim())) return copy.required;
    if (step === 'birth') {
      if (!form.dateOfBirth) return copy.invalidBirth;
      const threshold = new Date();
      threshold.setFullYear(threshold.getFullYear() - 18);
      if (new Date(form.dateOfBirth) > threshold) return copy.minor;
    }
    if (step === 'address' && (!form.street.trim() || !form.postalCode.trim() || !form.city.trim() || !form.country.trim())) return copy.required;
    if (step === 'profile' && (!form.occupation.trim() || !form.incomeRange)) return copy.required;
    if (step === 'document_metadata') {
      if (!form.documentType || !form.documentNumber.trim() || !form.issuingCountry.trim() || !form.documentExpiresOn) return copy.required;
      if (new Date(form.documentExpiresOn) < new Date(new Date().toDateString())) return copy.invalidExpiry;
    }
    if (['id_front', 'id_back', 'proof_of_address', 'selfie'].includes(step)) {
      const key = step as EvidenceKey;
      if (uploadStates[key]?.phase === 'error') return copy.uploadFailed;
      if (uploadStates[key]?.phase === 'preparing' || uploadStates[key]?.phase === 'uploading') return copy.uploadingFile;
      if (!paths[key] || (correctionMode && requestedItems.includes(key) && !uploadedNow.has(key))) return copy.required;
    }
    return '';
  };

  const submit = async () => {
    if (activeUploadRef.current || cameraPreparingRef.current) return;
    setSubmitting(true);
    setError('');
    try {
      const supabase = createClient();
      if (correctionMode) {
        const changes: Record<string, Json | undefined> = {};
        if (requestedItems.includes('identity')) changes.identity = {
          firstName: form.firstName, lastName: form.lastName,
          placeOfBirth: form.placeOfBirth, nationality: form.nationality,
        };
        if (requestedItems.includes('birth')) changes.birth = form.dateOfBirth;
        if (requestedItems.includes('address')) changes.address = kycAddressToJson(form);
        if (requestedItems.includes('profile')) changes.profile = kycProfileToJson(form);
        if (requestedItems.includes('document_metadata')) changes.document_metadata = {
          documentType: form.documentType, documentNumber: form.documentNumber,
          issuingCountry: form.issuingCountry, documentExpiresOn: form.documentExpiresOn,
        };
        const correctedPaths = Object.fromEntries(
          [...uploadedNow].filter((key) => requestedItems.includes(key)).map((key) => [key, paths[key]]),
        );
        const { error: submitError } = await supabase.rpc('resubmit_kyc_application', {
          p_kyc_id: kycId,
          p_changes: kycChangesToJson(changes),
          p_document_object_paths: serializeKycDocumentPaths(correctedPaths),
        });
        if (submitError) throw submitError;
      } else {
        const { error: submitError } = await supabase.rpc('submit_kyc_application', {
          p_first_name: form.firstName.trim(), p_last_name: form.lastName.trim(),
          p_date_of_birth: form.dateOfBirth, p_place_of_birth: form.placeOfBirth.trim(),
          p_nationality: form.nationality.trim(),
          p_address: kycAddressToJson(form),
          p_occupation: form.occupation.trim(), p_income_range: form.incomeRange,
          p_fatca: form.fatca, p_pep: form.pep, p_document_type: form.documentType,
          p_document_number: form.documentNumber.trim(), p_issuing_country: form.issuingCountry.trim(),
          p_document_expires_on: form.documentExpiresOn,
          p_document_object_paths: serializeKycDocumentPaths(paths),
          p_idempotency_key: crypto.randomUUID(),
        });
        if (submitError) throw submitError;
      }
      window.location.replace('/myaccount?tab=kyc');
    } catch {
      setError(localizedAppError(language, 'SAVE_FAILED'));
      setSubmitting(false);
    }
  };

  const next = async (event: React.FormEvent) => {
    event.preventDefault();
    if (activeUploadRef.current || cameraPreparingRef.current) return;
    const validation = validate();
    if (validation) { setError(validation); return; }
    if (stepIndex < steps.length - 1) setStepIndex((value) => value + 1);
    else await submit();
  };

  if (!ready) return <main className="min-h-screen bg-slate-950" />;

  const title = copy[STEP_TITLE_KEYS[step]];
  const hint = copy[STEP_HINT_KEYS[step]];
  const stepTitleId = `kyc-step-title-${step}`;
  const stepHintId = `kyc-step-hint-${step}`;
  return (
    <main className="min-h-[100dvh] bg-slate-950 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-7 text-center text-white">
          <BrandLogo tone="reversed-white" priority className="mx-auto mb-4 h-auto w-[180px]" />
          <h1 className="text-2xl font-extrabold">{copy.title}</h1>
          <p className="mt-2 text-sm text-slate-400">{copy.privacy}</p>
        </header>
        <form onSubmit={next} className="rounded-3xl bg-white p-5 shadow-2xl sm:p-8">
          {correctionMode && <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{copy.correction}</p>}
          <div className="mb-7 flex items-center gap-2">
            {steps.map((item, index) => <span key={item} className={`h-1.5 flex-1 rounded-full ${index <= stepIndex ? 'bg-blue-600' : 'bg-slate-200'}`} />)}
            <span className="ml-2 text-xs font-bold text-slate-500">{stepIndex + 1}/{steps.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <h2 ref={stepTitleRef} id={stepTitleId} tabIndex={-1} className="text-2xl font-extrabold text-slate-950">{title}</h2>
            {!correctionMode && <span className="text-[11px] font-semibold text-emerald-700">{saving ? '…' : saved ? copy.draftSaved : ''}</span>}
          </div>
          <p id={stepHintId} className="mt-2 text-sm leading-6 text-slate-600">{hint}</p>

          <section aria-labelledby={stepTitleId} aria-describedby={stepHintId} className="mt-7 min-h-[290px]">
            {step === 'identity' && <div className="grid gap-5 sm:grid-cols-2">
              {([
                ['firstName', copy.firstName, copy.firstNamePlaceholder],
                ['lastName', copy.lastName, copy.lastNamePlaceholder],
                ['placeOfBirth', copy.placeOfBirth, copy.placeOfBirthPlaceholder],
                ['nationality', copy.nationality, copy.nationalityPlaceholder],
              ] as const).map(([key, label, placeholder]) => <label key={key} className={labelClass}>{label}<input required value={form[key]} placeholder={placeholder} onChange={(e) => update(key, e.target.value)} className={fieldClass} /></label>)}
            </div>}
            {step === 'birth' && <label className={labelClass}>{copy.dateOfBirth}<input type="date" required value={form.dateOfBirth} onChange={(e) => update('dateOfBirth', e.target.value)} className={fieldClass} /></label>}
            {step === 'address' && <div className="grid gap-5 sm:grid-cols-2">
              {([
                ['street', copy.street, copy.streetPlaceholder],
                ['postalCode', copy.postalCode, copy.postalCodePlaceholder],
                ['city', copy.city, copy.cityPlaceholder],
                ['country', copy.country, copy.countryPlaceholder],
              ] as const).map(([key, label, placeholder]) => <label key={key} className={labelClass}>{label}<input required value={form[key]} placeholder={placeholder} onChange={(e) => update(key, e.target.value)} className={fieldClass} /></label>)}
            </div>}
            {step === 'profile' && <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className={labelClass}>{copy.occupation}<input required value={form.occupation} placeholder={copy.occupationPlaceholder} onChange={(e) => update('occupation', e.target.value)} className={fieldClass} /></label>
                <label className={labelClass}>{copy.incomeRange}<select required value={form.incomeRange} onChange={(e) => update('incomeRange', e.target.value)} className={fieldClass}><option value="">{copy.incomePlaceholder}</option><option value="under_1500">{copy.incomeLow}</option><option value="1500_3000">{copy.incomeMedium}</option><option value="over_3000">{copy.incomeHigh}</option></select></label>
              </div>
              <label className="flex gap-3 rounded-xl border p-4 text-sm"><input type="checkbox" checked={form.fatca} onChange={(e) => update('fatca', e.target.checked)} />{copy.fatca}</label>
              <label className="flex gap-3 rounded-xl border p-4 text-sm"><input type="checkbox" checked={form.pep} onChange={(e) => update('pep', e.target.checked)} />{copy.pep}</label>
            </div>}
            {step === 'document_metadata' && <div className="grid gap-5 sm:grid-cols-2">
              <label className={labelClass}>{copy.documentType}<select required value={form.documentType} onChange={(e) => update('documentType', e.target.value)} className={fieldClass}><option value="">{copy.documentTypePlaceholder}</option><option value="national_identity_card">{copy.nationalId}</option><option value="passport">{copy.passport}</option><option value="residence_permit">{copy.residencePermit}</option></select></label>
              <label className={labelClass}>{copy.documentNumber}<input required value={form.documentNumber} placeholder={copy.documentNumberPlaceholder} onChange={(e) => update('documentNumber', e.target.value)} className={fieldClass} /></label>
              <label className={labelClass}>{copy.issuingCountry}<input required value={form.issuingCountry} placeholder={copy.issuingCountryPlaceholder} onChange={(e) => update('issuingCountry', e.target.value)} className={fieldClass} /></label>
              <label className={labelClass}>{copy.expiryDate}<input type="date" required value={form.documentExpiresOn} onChange={(e) => update('documentExpiresOn', e.target.value)} className={fieldClass} /></label>
            </div>}
            {(['id_front', 'id_back', 'proof_of_address'] as EvidenceKey[]).includes(step as EvidenceKey) && (() => {
              const evidenceKey = step as EvidenceKey;
              const uploadState = uploadStates[evidenceKey];
              const isPdf = uploadState?.fileType === 'application/pdf';
              return (
                <div aria-busy={uploadState?.phase === 'preparing' || uploadState?.phase === 'uploading'}>
                  <label className={`block rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-7 text-center ${uploadPending || submitting ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                    <input
                      disabled={uploadPending || submitting}
                      type="file"
                      className="sr-only"
                      accept="image/jpeg,image/png,application/pdf"
                      capture="environment"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = '';
                        if (file) void upload(evidenceKey, file);
                      }}
                    />
                    {/* Blob previews are local and cannot be handled by next/image. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {previews[evidenceKey] && !isPdf && <img src={previews[evidenceKey]} alt={title} className="mx-auto mb-4 max-h-52 rounded-xl object-contain" />}
                    {isPdf && (
                      <div className="mx-auto mb-4 flex max-w-sm items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left">
                        <FileText aria-hidden="true" className="h-9 w-9 shrink-0 text-rose-600" />
                        <span className="min-w-0">
                          <span className="block break-all text-sm font-bold text-slate-900">{uploadState.fileName}</span>
                          <span className="mt-1 block text-xs text-slate-500">{copy.pdfSelected}</span>
                        </span>
                      </div>
                    )}
                    <UploadCloud aria-hidden="true" className="mx-auto h-7 w-7 text-blue-600" />
                    <span className="mt-3 block text-sm font-bold">{paths[evidenceKey] ? copy.replaceFile : copy.chooseFile}</span>
                    <span className="mt-1 block text-xs text-slate-500">{copy.fileHint}</span>
                    {paths[evidenceKey] && uploadState?.phase !== 'error' && <Check aria-hidden="true" className="mx-auto mt-3 h-5 w-5 text-emerald-600" />}
                  </label>
                  <EvidenceUploadFeedback
                    copy={copy}
                    state={uploadState}
                    onRetry={() => {
                      if (uploadState?.original) void upload(evidenceKey, uploadState.original, true);
                    }}
                  />
                </div>
              );
            })()}
            {step === 'selfie' && (
              <div aria-busy={uploadStates.selfie?.phase === 'preparing' || uploadStates.selfie?.phase === 'uploading'}>
                <CameraCapture
                  copy={copy}
                  disabled={uploadPending || submitting}
                  onPreparingChange={(preparing) => {
                    cameraPreparingRef.current = preparing;
                    if (mountedRef.current) setCameraPreparing(preparing);
                  }}
                  previewUrl={previews.selfie}
                  onCapture={(file) => upload('selfie', file)}
                />
                <EvidenceUploadFeedback
                  copy={copy}
                  state={uploadStates.selfie}
                  onRetry={() => {
                    if (uploadStates.selfie?.original) void upload('selfie', uploadStates.selfie.original, true);
                  }}
                />
              </div>
            )}
          </section>

          {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <div className="mt-7 flex items-center gap-3 border-t pt-5">
            {stepIndex > 0 && <button disabled={uploadPending || submitting} type="button" onClick={() => { setError(''); setStepIndex((value) => value - 1); }} className="flex h-12 items-center gap-2 rounded-xl border px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"><ArrowLeft className="h-4 w-4" />{copy.back}</button>}
            <button disabled={uploadPending || submitting} type="submit" className="ml-auto flex h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {stepIndex === steps.length - 1 ? <><FileCheck2 className="h-4 w-4" />{submitting ? copy.sending : correctionMode ? copy.resubmit : copy.submit}</> : <>{copy.next}<ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-500"><LockKeyhole className="h-3.5 w-3.5" />{copy.privacy}</p>
        </form>
      </div>
    </main>
  );
}
