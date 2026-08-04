import { createHash } from 'node:crypto';
import { Webhook } from 'standardwebhooks';
import type { BrandSettings } from '@/lib/types';
import { EMAIL_OTP_LENGTH, isValidEmailOtp } from '@/lib/auth-email-otp';
import {
  parseTransactionalEmailLanguage,
  sendBrandedEmail,
  type RenderedEmail,
  type TransactionalEmailConfig,
  type TransactionalEmailLanguage,
} from '@/lib/server/transactional-email';

export interface SupabaseAuthEmailPayload {
  user?: {
    id?: unknown;
    email?: unknown;
    new_email?: unknown;
    user_metadata?: Record<string, unknown> | null;
  };
  email_data?: {
    token?: unknown;
    token_hash?: unknown;
    redirect_to?: unknown;
    email_action_type?: unknown;
    site_url?: unknown;
    token_new?: unknown;
    token_hash_new?: unknown;
    old_email?: unknown;
    provider?: unknown;
    factor_type?: unknown;
  };
}

export interface AuthEmailMessage {
  recipientEmail: string;
  email: RenderedEmail;
}

export interface StandardWebhookHeaders {
  'webhook-id': string;
  'webhook-timestamp': string;
  'webhook-signature': string;
}

interface AuthCopy {
  subject: string;
  heading: string;
  message: string;
  action: string;
  code: string;
}

const ACTION_TYPES: Record<string, string> = {
  signup: 'email',
  recovery: 'recovery',
  email_change: 'email_change',
  invite: 'invite',
  magiclink: 'magiclink',
  reauthentication: 'reauthentication',
};

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function verifySupabaseAuthWebhook(
  payload: string,
  headers: StandardWebhookHeaders,
  configuredSecret: string,
): SupabaseAuthEmailPayload {
  const secret = configuredSecret.trim().replace(/^v1,whsec_/, '');
  if (!secret) throw new Error('Secret Auth Hook invalide.');
  return new Webhook(secret).verify(payload, headers) as SupabaseAuthEmailPayload;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function authEmailLanguage(value: unknown): TransactionalEmailLanguage {
  try {
    return parseTransactionalEmailLanguage(value);
  } catch {
    return 'fr';
  }
}

function copyFor(
  action: string,
  language: TransactionalEmailLanguage,
  bankName: string,
): AuthCopy {
  const dictionaries: Record<TransactionalEmailLanguage, Record<string, AuthCopy>> = {
    fr: {
      signup: { subject: `Votre code de confirmation ${bankName}`, heading: 'Votre code de confirmation', message: `Votre compte ${bankName} est presque prêt. Saisissez ce code à ${EMAIL_OTP_LENGTH} chiffres sur l’écran d’inscription pour confirmer votre adresse e-mail.`, action: 'Confirmer mon inscription', code: 'Code de confirmation' },
      recovery: { subject: `Réinitialisez votre accès ${bankName}`, heading: 'Réinitialisation de votre accès', message: `Une demande de réinitialisation a été reçue pour votre espace ${bankName}.`, action: 'Réinitialiser mon accès', code: 'Code de récupération' },
      email_change: { subject: `Confirmez le changement d’adresse — ${bankName}`, heading: 'Confirmez votre nouvelle adresse', message: 'Confirmez ce changement pour protéger l’accès à votre espace bancaire.', action: 'Confirmer le changement', code: 'Code de confirmation' },
      invite: { subject: `Votre invitation ${bankName}`, heading: `Vous êtes invité chez ${bankName}`, message: 'Acceptez cette invitation pour activer votre accès sécurisé.', action: 'Accepter l’invitation', code: 'Code d’invitation' },
      magiclink: { subject: `Votre lien de connexion ${bankName}`, heading: 'Connexion sécurisée', message: 'Utilisez ce lien à usage unique pour vous connecter.', action: 'Me connecter', code: 'Code de connexion' },
      reauthentication: { subject: `Confirmez votre identité — ${bankName}`, heading: 'Confirmation de sécurité', message: 'Cette confirmation est nécessaire pour poursuivre votre opération sensible.', action: 'Confirmer mon identité', code: 'Code de sécurité' },
      security: { subject: `Notification de sécurité — ${bankName}`, heading: 'Activité de sécurité sur votre compte', message: 'Un changement de sécurité vient d’être enregistré sur votre compte. Si vous ne le reconnaissez pas, contactez immédiatement le support.', action: 'Ouvrir mon espace', code: 'Code de sécurité' },
    },
    en: {
      signup: { subject: `Your ${bankName} confirmation code`, heading: 'Your confirmation code', message: `Your ${bankName} account is almost ready. Enter this ${EMAIL_OTP_LENGTH}-digit code on the registration screen to confirm your email address.`, action: 'Confirm registration', code: 'Confirmation code' },
      recovery: { subject: `Reset your ${bankName} access`, heading: 'Reset your access', message: `A reset request was received for your ${bankName} space.`, action: 'Reset my access', code: 'Recovery code' },
      email_change: { subject: `Confirm your email change — ${bankName}`, heading: 'Confirm your new address', message: 'Confirm this change to protect access to your banking space.', action: 'Confirm change', code: 'Confirmation code' },
      invite: { subject: `Your ${bankName} invitation`, heading: `You are invited to ${bankName}`, message: 'Accept this invitation to activate your secure access.', action: 'Accept invitation', code: 'Invitation code' },
      magiclink: { subject: `Your ${bankName} sign-in link`, heading: 'Secure sign-in', message: 'Use this one-time link to sign in.', action: 'Sign in', code: 'Sign-in code' },
      reauthentication: { subject: `Confirm your identity — ${bankName}`, heading: 'Security confirmation', message: 'This confirmation is required to continue your sensitive operation.', action: 'Confirm my identity', code: 'Security code' },
      security: { subject: `Security notification — ${bankName}`, heading: 'Security activity on your account', message: 'A security change was recorded on your account. If you do not recognize it, contact support immediately.', action: 'Open my space', code: 'Security code' },
    },
    de: {
      signup: { subject: `Ihr ${bankName}-Bestätigungscode`, heading: 'Ihr Bestätigungscode', message: `Ihr ${bankName}-Konto ist fast bereit. Geben Sie diesen ${EMAIL_OTP_LENGTH}-stelligen Code im Registrierungsfenster ein, um Ihre E-Mail-Adresse zu bestätigen.`, action: 'Registrierung bestätigen', code: 'Bestätigungscode' },
      recovery: { subject: `${bankName}-Zugang zurücksetzen`, heading: 'Zugang zurücksetzen', message: `Für Ihren ${bankName}-Zugang wurde eine Zurücksetzung angefordert.`, action: 'Zugang zurücksetzen', code: 'Wiederherstellungscode' },
      email_change: { subject: `E-Mail-Änderung bestätigen — ${bankName}`, heading: 'Neue Adresse bestätigen', message: 'Bestätigen Sie diese Änderung, um Ihren Bankzugang zu schützen.', action: 'Änderung bestätigen', code: 'Bestätigungscode' },
      invite: { subject: `Ihre Einladung zu ${bankName}`, heading: `Einladung zu ${bankName}`, message: 'Nehmen Sie die Einladung an, um Ihren sicheren Zugang zu aktivieren.', action: 'Einladung annehmen', code: 'Einladungscode' },
      magiclink: { subject: `Ihr Anmeldelink für ${bankName}`, heading: 'Sichere Anmeldung', message: 'Verwenden Sie diesen einmaligen Link zur Anmeldung.', action: 'Anmelden', code: 'Anmeldecode' },
      reauthentication: { subject: `Identität bestätigen — ${bankName}`, heading: 'Sicherheitsbestätigung', message: 'Diese Bestätigung ist für die Fortsetzung des sensiblen Vorgangs erforderlich.', action: 'Identität bestätigen', code: 'Sicherheitscode' },
      security: { subject: `Sicherheitshinweis — ${bankName}`, heading: 'Sicherheitsaktivität auf Ihrem Konto', message: 'Auf Ihrem Konto wurde eine Sicherheitsänderung registriert. Wenn sie Ihnen unbekannt ist, kontaktieren Sie sofort den Support.', action: 'Zugang öffnen', code: 'Sicherheitscode' },
    },
    es: {
      signup: { subject: `Su código de confirmación de ${bankName}`, heading: 'Su código de confirmación', message: `Su cuenta de ${bankName} está casi lista. Introduzca este código de ${EMAIL_OTP_LENGTH} dígitos en la pantalla de registro para confirmar su correo electrónico.`, action: 'Confirmar registro', code: 'Código de confirmación' },
      recovery: { subject: `Restablezca su acceso a ${bankName}`, heading: 'Restablecimiento del acceso', message: `Se ha solicitado restablecer su espacio ${bankName}.`, action: 'Restablecer mi acceso', code: 'Código de recuperación' },
      email_change: { subject: `Confirme el cambio de correo — ${bankName}`, heading: 'Confirme su nueva dirección', message: 'Confirme este cambio para proteger el acceso a su espacio bancario.', action: 'Confirmar cambio', code: 'Código de confirmación' },
      invite: { subject: `Su invitación a ${bankName}`, heading: `Ha sido invitado a ${bankName}`, message: 'Acepte esta invitación para activar su acceso seguro.', action: 'Aceptar invitación', code: 'Código de invitación' },
      magiclink: { subject: `Su enlace de acceso a ${bankName}`, heading: 'Acceso seguro', message: 'Utilice este enlace de un solo uso para iniciar sesión.', action: 'Iniciar sesión', code: 'Código de acceso' },
      reauthentication: { subject: `Confirme su identidad — ${bankName}`, heading: 'Confirmación de seguridad', message: 'Esta confirmación es necesaria para continuar con la operación sensible.', action: 'Confirmar mi identidad', code: 'Código de seguridad' },
      security: { subject: `Aviso de seguridad — ${bankName}`, heading: 'Actividad de seguridad en su cuenta', message: 'Se ha registrado un cambio de seguridad en su cuenta. Si no lo reconoce, contacte inmediatamente con soporte.', action: 'Abrir mi espacio', code: 'Código de seguridad' },
    },
  };
  return dictionaries[language][action] ?? dictionaries[language].security;
}

function safeNextPath(redirectTo: string, applicationOrigin: string) {
  try {
    const redirect = new URL(redirectTo);
    const origin = new URL(applicationOrigin);
    return redirect.origin === origin.origin
      ? `${redirect.pathname}${redirect.search}${redirect.hash}`
      : '/';
  } catch {
    return '/';
  }
}

function confirmationUrl(
  applicationOrigin: string,
  redirectTo: string,
  tokenHash: string,
  action: string,
) {
  if (!tokenHash || !ACTION_TYPES[action]) return '';
  const url = new URL('/auth/confirm', applicationOrigin);
  url.searchParams.set('token_hash', tokenHash);
  url.searchParams.set('type', ACTION_TYPES[action]);
  url.searchParams.set('next', safeNextPath(redirectTo, applicationOrigin));
  return url.toString();
}

function render(
  copy: AuthCopy,
  language: TransactionalEmailLanguage,
  brand: BrandSettings,
  actionUrl: string,
  token: string,
  displayName: string,
  otpOnly = false,
): RenderedEmail {
  const safeBankName = escapeHtml(brand.bankName);
  const greetings: Record<TransactionalEmailLanguage, string> = {
    fr: 'Bonjour',
    en: 'Hello',
    de: 'Guten Tag',
    es: 'Hola',
  };
  const message = displayName
    ? `${greetings[language]} ${displayName}, ${copy.message}`
    : copy.message;
  const actionHtml = actionUrl && !otpOnly
    ? `<p style="margin:24px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#315cf4;color:#fff;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">${escapeHtml(copy.action)}</a></p>`
    : '';
  const tokenHtml = token
    ? otpOnly
      ? `<div style="margin:24px 0;padding:18px 20px;border:1px solid #cbd5e1;border-radius:14px;background:#f8fafc;text-align:center"><p style="margin:0 0 8px;color:#64748b;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.08em">${escapeHtml(copy.code)}</p><p style="margin:0;color:#0f172a;font-family:Consolas,Monaco,monospace;font-size:32px;font-weight:800;letter-spacing:.28em">${escapeHtml(token)}</p></div>`
      : `<p style="font-size:13px;color:#64748b;margin:24px 0 0">${escapeHtml(copy.code)} : <strong style="color:#0f172a;letter-spacing:2px">${escapeHtml(token)}</strong></p>`
    : '';
  return {
    subject: copy.subject,
    text: `${copy.heading}\n\n${message}${actionUrl && !otpOnly ? `\n\n${copy.action}: ${actionUrl}` : ''}${token ? `\n\n${copy.code}: ${token}` : ''}`,
    html: `<!doctype html><html lang="${language}"><body style="margin:0;background:#f4f6fa;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:600px;margin:0 auto;padding:32px 16px"><div style="background:#FBFAF7;padding:18px 24px;border:1px solid #e8e2eb;border-bottom:0;border-radius:18px 18px 0 0"><img src="${escapeHtml(brand.emailLogoUrl)}" width="180" alt="${safeBankName}" style="display:block;width:180px;max-width:100%;height:auto;border:0"></div><div style="background:#fff;padding:28px 24px;border:1px solid #e2e8f0;border-radius:0 0 18px 18px"><h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(copy.heading)}</h1><p style="font-size:15px;line-height:1.6;margin:0">${escapeHtml(message)}</p>${actionHtml}${tokenHtml}</div></div></body></html>`,
  };
}

export function renderSupabaseAuthEmails(
  payload: SupabaseAuthEmailPayload,
  brand: BrandSettings,
  applicationOrigin: string,
  preferredLanguage?: unknown,
): AuthEmailMessage[] {
  const user = payload.user ?? {};
  const data = payload.email_data ?? {};
  const language = authEmailLanguage(
    preferredLanguage ?? user.user_metadata?.preferred_language,
  );
  const action = stringValue(data.email_action_type) || 'security';
  const redirectTo = stringValue(data.redirect_to) || applicationOrigin;
  const currentEmail = stringValue(user.email);
  const newEmail = stringValue(user.new_email);
  const token = stringValue(data.token);
  const tokenNew = stringValue(data.token_new);
  const tokenHash = stringValue(data.token_hash);
  const tokenHashNew = stringValue(data.token_hash_new);
  const displayName = stringValue(
    user.user_metadata?.display_name ?? user.user_metadata?.full_name,
  ).slice(0, 120);
  const copy = copyFor(action, language, brand.bankName);

  if (action === 'email_change') {
    const recipients: AuthEmailMessage[] = [];
    if (currentEmail && tokenHashNew) {
      recipients.push({
        recipientEmail: currentEmail,
        email: render(copy, language, brand, confirmationUrl(applicationOrigin, redirectTo, tokenHashNew, action), token, displayName),
      });
    }
    if (newEmail && tokenHash) {
      recipients.push({
        recipientEmail: newEmail,
        email: render(copy, language, brand, confirmationUrl(applicationOrigin, redirectTo, tokenHash, action), tokenNew || token, displayName),
      });
    }
    if (!recipients.length && newEmail && tokenHash) {
      recipients.push({ recipientEmail: newEmail, email: render(copy, language, brand, confirmationUrl(applicationOrigin, redirectTo, tokenHash, action), tokenNew || token, displayName) });
    }
    if (!recipients.length) throw new Error('Destinataire ou jeton de changement d’e-mail absent.');
    return recipients;
  }

  if (!currentEmail) throw new Error('Destinataire Auth absent.');
  const otpOnly = action === 'signup';
  if (otpOnly && !isValidEmailOtp(token)) {
    throw new Error('Code OTP d’inscription absent ou invalide.');
  }
  const url = otpOnly
    ? ''
    : confirmationUrl(applicationOrigin, redirectTo, tokenHash, action);
  return [{
    recipientEmail: currentEmail,
    email: render(copy, language, brand, url, token, displayName, otpOnly),
  }];
}

export async function sendSupabaseAuthEmails(
  messages: AuthEmailMessage[],
  config: TransactionalEmailConfig,
  brand: BrandSettings,
  webhookId: string,
) {
  for (const [index, message] of messages.entries()) {
    const recipientHash = createHash('sha256')
      .update(message.recipientEmail)
      .digest('hex')
      .slice(0, 16);
    await sendBrandedEmail(
      {
        recipientEmail: message.recipientEmail,
        idempotencyKey: `auth-${webhookId}-${index}-${recipientHash}`,
        email: message.email,
        bankName: brand.bankName,
        tags: ['auth'],
      },
      config,
    );
  }
}
