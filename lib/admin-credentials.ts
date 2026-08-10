import {
  isStrongPassword,
  PASSWORD_MAX_LENGTH,
} from './password-policy';

export const ADMIN_PASSWORD_MIN_LENGTH = 16;
export const ADMIN_PASSWORD_MAX_LENGTH = PASSWORD_MAX_LENGTH;

export type AdminCredentialChange =
  | {
      kind: 'email';
      currentPassword: string;
      email: string;
    }
  | {
      kind: 'password';
      currentPassword: string;
      newPassword: string;
    };

export type AdminCredentialValidationCode =
  | 'INVALID_PAYLOAD'
  | 'CURRENT_PASSWORD_REQUIRED'
  | 'INVALID_EMAIL'
  | 'EMAIL_UNCHANGED'
  | 'PASSWORD_MISMATCH'
  | 'PASSWORD_REUSED'
  | 'WEAK_PASSWORD';

export class AdminCredentialValidationError extends Error {
  constructor(
    readonly code: AdminCredentialValidationCode,
    message: string,
  ) {
    super(message);
    this.name = 'AdminCredentialValidationError';
  }
}

export function normalizeAdminEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isStrongAdminPassword(value: string) {
  return value.length >= ADMIN_PASSWORD_MIN_LENGTH && isStrongPassword(value);
}

function currentPasswordFrom(payload: Record<string, unknown>) {
  const password =
    typeof payload.currentPassword === 'string' ? payload.currentPassword : '';
  if (!password || password.length > ADMIN_PASSWORD_MAX_LENGTH) {
    throw new AdminCredentialValidationError(
      'CURRENT_PASSWORD_REQUIRED',
      'Le mot de passe actuel est requis.',
    );
  }
  return password;
}

export function parseAdminCredentialChange(
  value: unknown,
  currentEmail: string,
): AdminCredentialChange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AdminCredentialValidationError(
      'INVALID_PAYLOAD',
      'La demande est invalide.',
    );
  }

  const payload = value as Record<string, unknown>;
  const currentPassword = currentPasswordFrom(payload);

  if (payload.kind === 'email') {
    const email = normalizeAdminEmail(payload.email);
    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new AdminCredentialValidationError(
        'INVALID_EMAIL',
        'Saisissez une adresse e-mail valide.',
      );
    }
    if (email === normalizeAdminEmail(currentEmail)) {
      throw new AdminCredentialValidationError(
        'EMAIL_UNCHANGED',
        'Cette adresse est déjà utilisée par le compte administrateur.',
      );
    }
    return { kind: 'email', currentPassword, email };
  }

  if (payload.kind === 'password') {
    const newPassword =
      typeof payload.newPassword === 'string' ? payload.newPassword : '';
    const confirmation =
      typeof payload.confirmPassword === 'string'
        ? payload.confirmPassword
        : '';
    if (newPassword !== confirmation) {
      throw new AdminCredentialValidationError(
        'PASSWORD_MISMATCH',
        'Les nouveaux mots de passe ne correspondent pas.',
      );
    }
    if (newPassword === currentPassword) {
      throw new AdminCredentialValidationError(
        'PASSWORD_REUSED',
        'Le nouveau mot de passe doit être différent du mot de passe actuel.',
      );
    }
    if (!isStrongAdminPassword(newPassword)) {
      throw new AdminCredentialValidationError(
        'WEAK_PASSWORD',
        'Utilisez 16 à 72 caractères avec une minuscule, une majuscule, un chiffre et un symbole, sans espace.',
      );
    }
    return { kind: 'password', currentPassword, newPassword };
  }

  throw new AdminCredentialValidationError(
    'INVALID_PAYLOAD',
    'La modification demandée est invalide.',
  );
}
