export const EMAIL_OTP_LENGTH = 6 as const;

const EMAIL_OTP_PATTERN = new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`);

export function normalizeEmailOtp(value: string) {
  return value.replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH);
}

export function isValidEmailOtp(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_OTP_PATTERN.test(value);
}

export interface PendingRegistration {
  email: string;
  displayName?: string;
  baseCurrency?: string;
  resendCooldownUntil: number;
  submittedAt: number;
}

export const PENDING_REGISTRATION_STORAGE_KEY = 'monalyz_pending_registration_v1';
export const PENDING_REGISTRATION_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export function savePendingRegistration(state: {
  email: string;
  displayName?: string;
  baseCurrency?: string;
  resendCooldownUntil: number;
  submittedAt?: number;
}): void {
  if (typeof window === 'undefined') return;
  const payload: PendingRegistration = {
    email: state.email.trim().toLowerCase(),
    displayName: state.displayName?.trim() || undefined,
    baseCurrency: state.baseCurrency || undefined,
    resendCooldownUntil: state.resendCooldownUntil,
    submittedAt: state.submittedAt ?? Date.now(),
  };
  const serialized = JSON.stringify(payload);
  try {
    window.sessionStorage.setItem(PENDING_REGISTRATION_STORAGE_KEY, serialized);
  } catch {}
  try {
    window.localStorage.setItem(PENDING_REGISTRATION_STORAGE_KEY, serialized);
  } catch {}
}

export function getPendingRegistration(): PendingRegistration | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(PENDING_REGISTRATION_STORAGE_KEY);
  } catch {}
  if (!raw) {
    try {
      raw = window.localStorage.getItem(PENDING_REGISTRATION_STORAGE_KEY);
    } catch {}
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PendingRegistration>;
    if (
      !parsed ||
      typeof parsed.email !== 'string' ||
      !parsed.email.includes('@') ||
      typeof parsed.submittedAt !== 'number'
    ) {
      clearPendingRegistration();
      return null;
    }
    if (Date.now() - parsed.submittedAt > PENDING_REGISTRATION_MAX_AGE_MS) {
      clearPendingRegistration();
      return null;
    }
    return {
      email: parsed.email,
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : undefined,
      baseCurrency: typeof parsed.baseCurrency === 'string' ? parsed.baseCurrency : undefined,
      resendCooldownUntil:
        typeof parsed.resendCooldownUntil === 'number' ? parsed.resendCooldownUntil : 0,
      submittedAt: parsed.submittedAt,
    };
  } catch {
    clearPendingRegistration();
    return null;
  }
}

export function clearPendingRegistration(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_REGISTRATION_STORAGE_KEY);
  } catch {}
  try {
    window.localStorage.removeItem(PENDING_REGISTRATION_STORAGE_KEY);
  } catch {}
}
