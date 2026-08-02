import { applyBrand } from '@/lib/branding';

export type TransactionalEmailProvider = 'resend' | 'brevo';
export type TransactionalEmailLanguage = 'fr' | 'en' | 'de' | 'es';

export type TransactionalEmailTemplate =
  | 'transfer_submitted'
  | 'transfer_approved'
  | 'transfer_completed'
  | 'transfer_rejected'
  | 'transfer_failed'
  | 'loan_submitted'
  | 'loan_approved'
  | 'loan_disbursed'
  | 'loan_rejected'
  | 'loan_failed'
  | 'kyc_submitted'
  | 'kyc_information_requested'
  | 'kyc_resubmitted'
  | 'kyc_approved'
  | 'kyc_rejected';

export interface TransactionalEmailJob {
  id: string;
  claim_token: string;
  recipient_id: string;
  recipient_email: string;
  template_key: TransactionalEmailTemplate;
  payload: Record<string, unknown>;
}

export interface TransactionalEmailConfig {
  provider: TransactionalEmailProvider;
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  assetBaseUrl: string;
}

export interface TransactionalEmailBranding {
  bankName?: string;
  wordmarkUrl: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface BrandedEmailDelivery {
  recipientEmail: string;
  idempotencyKey: string;
  email: RenderedEmail;
  bankName: string;
  tags?: string[];
}

type FetchLike = typeof fetch;

const LANGUAGE_LOCALES: Record<TransactionalEmailLanguage, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
};

const SUPPORT_COPY: Record<
  TransactionalEmailLanguage,
  { text: string; html: string }
> = {
  fr: {
    text: 'Support : support@monalyz.com',
    html: 'Besoin d’aide ? Écrivez à support@monalyz.com.',
  },
  en: {
    text: 'Support: support@monalyz.com',
    html: 'Need help? Contact us at support@monalyz.com.',
  },
  de: {
    text: 'Support: support@monalyz.com',
    html: 'Brauchen Sie Hilfe? Schreiben Sie an support@monalyz.com.',
  },
  es: {
    text: 'Soporte: support@monalyz.com',
    html: '¿Necesita ayuda? Escriba a support@monalyz.com.',
  },
};

export function parseTransactionalEmailLanguage(
  value: unknown,
): TransactionalEmailLanguage {
  if (value === null || value === undefined || value === '') return 'fr';
  if (value === 'fr' || value === 'en' || value === 'de' || value === 'es') {
    return value;
  }
  throw new Error(`Préférence linguistique invalide : ${String(value)}.`);
}

export async function resolveTransactionalEmailLanguage(
  lookup: () => PromiseLike<{
    data: { preferred_language?: unknown } | null;
    error: { message: string } | null;
  }>,
): Promise<TransactionalEmailLanguage> {
  const { data, error } = await lookup();
  if (error) {
    throw new Error(
      `Lecture de la préférence linguistique impossible : ${error.message}`,
    );
  }
  return parseTransactionalEmailLanguage(data?.preferred_language);
}

function requiredValue(
  environment: NodeJS.ProcessEnv,
  key: string,
): string {
  const value = environment[key]?.trim();
  if (!value) throw new Error(`Configuration e-mail manquante : ${key}.`);
  return value;
}

function requiredSecret(
  environment: NodeJS.ProcessEnv,
  key: string,
): string {
  const value = requiredValue(environment, key);
  if (/replace|changeme|your[-_]/i.test(value)) {
    throw new Error(`Secret e-mail non configuré : ${key}.`);
  }
  return value;
}

function assertEmail(value: string, key: string): string {
  if (
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  ) {
    throw new Error(`Adresse e-mail invalide : ${key}.`);
  }
  return value;
}

function resolveAssetBaseUrl(environment: NodeJS.ProcessEnv): string {
  const key = environment.TRANSACTIONAL_EMAIL_ASSET_BASE_URL?.trim()
    ? 'TRANSACTIONAL_EMAIL_ASSET_BASE_URL'
    : environment.APP_ORIGIN?.trim()
      ? 'APP_ORIGIN'
      : 'NEXT_PUBLIC_APP_ORIGIN';
  const value = requiredValue(environment, key);
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`URL d’assets e-mail invalide : ${key}.`);
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`URL d’assets e-mail invalide : ${key}.`);
  }
  if (environment.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error(
      `URL d’assets e-mail non sécurisée en production : ${key} doit utiliser HTTPS.`,
    );
  }

  return url.toString().replace(/\/$/, '');
}

export function getTransactionalEmailConfig(
  environment: NodeJS.ProcessEnv = process.env,
): TransactionalEmailConfig {
  const provider = requiredValue(
    environment,
    'TRANSACTIONAL_EMAIL_PROVIDER',
  ).toLowerCase();

  if (provider !== 'resend' && provider !== 'brevo') {
    throw new Error(
      'TRANSACTIONAL_EMAIL_PROVIDER doit valoir « resend » ou « brevo ».',
    );
  }

  const fromEmail = assertEmail(
    requiredValue(environment, 'TRANSACTIONAL_EMAIL_FROM_EMAIL'),
    'TRANSACTIONAL_EMAIL_FROM_EMAIL',
  );
  const replyTo = assertEmail(
    environment.TRANSACTIONAL_EMAIL_REPLY_TO?.trim() || fromEmail,
    'TRANSACTIONAL_EMAIL_REPLY_TO',
  );
  const fromName =
    environment.TRANSACTIONAL_EMAIL_FROM_NAME?.trim() || 'Monalyz';
  if (
    fromName.length > 100 ||
    /[\r\n\u0000-\u001f\u007f]/.test(fromName)
  ) {
    throw new Error('TRANSACTIONAL_EMAIL_FROM_NAME est invalide.');
  }

  return {
    provider,
    apiKey:
      provider === 'resend'
        ? requiredSecret(environment, 'RESEND_API_KEY')
        : requiredSecret(environment, 'BREVO_API_KEY'),
    fromEmail,
    fromName,
    replyTo,
    assetBaseUrl: resolveAssetBaseUrl(environment),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function payloadText(
  payload: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function formatMinorAmount(
  payload: Record<string, unknown>,
  language: TransactionalEmailLanguage,
): string {
  const amountMinor = payload.amountMinor;
  const currency = payloadText(payload, 'currency', 'EUR').toUpperCase();
  const numericAmount =
    typeof amountMinor === 'number'
      ? amountMinor
      : typeof amountMinor === 'string'
        ? Number(amountMinor)
        : Number.NaN;
  const exponent = ['XOF', 'XAF'].includes(currency) ? 0 : 2;
  const amount = Number.isFinite(numericAmount)
    ? numericAmount / 10 ** exponent
    : 0;

  try {
    return new Intl.NumberFormat(LANGUAGE_LOCALES[language], {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    const formattedAmount = new Intl.NumberFormat(LANGUAGE_LOCALES[language], {
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(amount);
    return `${formattedAmount} ${currency}`;
  }
}

function messageForTemplate(
  template: TransactionalEmailTemplate,
  payload: Record<string, unknown>,
  language: TransactionalEmailLanguage,
): { subject: string; heading: string; message: string } {
  const amount = formatMinorAmount(payload, language);
  const recipientFallback: Record<TransactionalEmailLanguage, string> = {
    fr: 'le bénéficiaire indiqué',
    en: 'the specified beneficiary',
    de: 'den angegebenen Begünstigten',
    es: 'el beneficiario indicado',
  };
  const referenceFallback: Record<TransactionalEmailLanguage, string> = {
    fr: 'votre dossier',
    en: 'your application',
    de: 'Ihren Antrag',
    es: 'su solicitud',
  };
  const recipientName = payloadText(
    payload,
    'recipientName',
    recipientFallback[language],
  );
  const reference = payloadText(
    payload,
    'reference',
    referenceFallback[language],
  );

  if (language === 'en') {
    switch (template) {
      case 'transfer_submitted':
        return {
          subject: 'Your transfer request has been received',
          heading: 'Transfer request recorded',
          message: `We have received your request to transfer ${amount} to ${recipientName}. We are now reviewing the information provided and will let you know when a decision has been made.`,
        };
      case 'transfer_approved':
        return {
          subject: 'Your transfer request has been approved',
          heading: 'Transfer approved',
          message:
            'Your request has been approved. We are now processing the transfer.',
        };
      case 'transfer_completed':
        return {
          subject: 'Your transfer has been completed',
          heading: 'Transfer completed successfully',
          message: `Your transfer of ${amount} to ${recipientName} has been completed successfully.`,
        };
      case 'transfer_rejected':
        return {
          subject: 'Your transfer request has been rejected',
          heading: 'Transfer rejected',
          message:
            'We were unable to approve your transfer request. No money has been taken from your {bankName} account.',
        };
      case 'transfer_failed':
        return {
          subject: 'Your transfer could not be completed',
          heading: 'Transfer not completed',
          message:
            'Your transfer could not be completed. Any money set aside for it is available again in your {bankName} account.',
        };
      case 'loan_submitted':
        return {
          subject: 'Your loan application has been received',
          heading: 'Loan application recorded',
          message: `We have received your application ${reference} for ${amount}. We are reviewing it and will let you know when a decision has been made.`,
        };
      case 'loan_approved':
        return {
          subject: 'Your loan application has been approved',
          heading: 'Loan approved',
          message:
            'Your application has been approved. We are now preparing the payment of your funds.',
        };
      case 'loan_disbursed':
        return {
          subject: 'Your loan has been paid',
          heading: 'Loan paid successfully',
          message: `${amount} has been paid into your {bankName} account.`,
        };
      case 'loan_rejected':
        return {
          subject: 'Your loan application has been rejected',
          heading: 'Loan rejected',
          message: `We were unable to approve your application ${reference}. No funds have been paid.`,
        };
      case 'loan_failed':
        return {
          subject: 'Your loan payment could not be completed',
          heading: 'Loan payment not completed',
          message: `The funds for your application ${reference} could not be paid. Please contact our support team if you need help.`,
        };
      case 'kyc_submitted': return { subject: 'Your identity file has been received', heading: 'Identity file received', message: 'Your file is waiting for human review. No action is required for now.' };
      case 'kyc_information_requested': return { subject: 'Action required on your identity file', heading: 'More information required', message: 'Open your file and correct only the requested items.' };
      case 'kyc_resubmitted': return { subject: 'Your identity file has been resubmitted', heading: 'Corrections received', message: 'We have received your corrections and will review them.' };
      case 'kyc_approved': return { subject: 'Your identity has been approved', heading: 'Identity approved', message: 'Your identity is confirmed and your {bankName} internal account has been created.' };
      case 'kyc_rejected': return { subject: 'Your identity file has been rejected', heading: 'Corrections are possible', message: 'Open the same file to view the structured reason, correct the requested items and resubmit it.' };
    }
  }

  if (language === 'de') {
    switch (template) {
      case 'transfer_submitted':
        return {
          subject: 'Ihr Überweisungsauftrag ist eingegangen',
          heading: 'Überweisungsauftrag erfasst',
          message: `Wir haben Ihren Auftrag über ${amount} an ${recipientName} erhalten. Wir prüfen jetzt Ihre Angaben und informieren Sie, sobald eine Entscheidung getroffen wurde.`,
        };
      case 'transfer_approved':
        return {
          subject: 'Ihr Überweisungsauftrag wurde genehmigt',
          heading: 'Überweisung genehmigt',
          message:
            'Ihr Auftrag wurde genehmigt. Wir bearbeiten jetzt die Überweisung.',
        };
      case 'transfer_completed':
        return {
          subject: 'Ihre Überweisung wurde ausgeführt',
          heading: 'Überweisung erfolgreich ausgeführt',
          message: `Ihre Überweisung über ${amount} an ${recipientName} wurde erfolgreich ausgeführt.`,
        };
      case 'transfer_rejected':
        return {
          subject: 'Ihr Überweisungsauftrag wurde abgelehnt',
          heading: 'Überweisung abgelehnt',
          message:
            'Wir konnten Ihren Überweisungsauftrag nicht genehmigen. Ihr {bankName}-Konto wurde nicht belastet.',
        };
      case 'transfer_failed':
        return {
          subject: 'Ihre Überweisung konnte nicht ausgeführt werden',
          heading: 'Überweisung nicht ausgeführt',
          message:
            'Ihre Überweisung konnte nicht ausgeführt werden. Der dafür vorgesehene Betrag ist auf Ihrem {bankName}-Konto wieder verfügbar.',
        };
      case 'loan_submitted':
        return {
          subject: 'Ihr Kreditantrag ist eingegangen',
          heading: 'Kreditantrag erfasst',
          message: `Wir haben Ihren Antrag ${reference} über ${amount} erhalten. Wir prüfen ihn und informieren Sie, sobald eine Entscheidung getroffen wurde.`,
        };
      case 'loan_approved':
        return {
          subject: 'Ihr Kreditantrag wurde genehmigt',
          heading: 'Kredit genehmigt',
          message:
            'Ihr Antrag wurde genehmigt. Wir bereiten jetzt die Auszahlung vor.',
        };
      case 'loan_disbursed':
        return {
          subject: 'Ihr Kredit wurde ausgezahlt',
          heading: 'Kredit erfolgreich ausgezahlt',
          message: `${amount} wurden Ihrem {bankName}-Konto gutgeschrieben.`,
        };
      case 'loan_rejected':
        return {
          subject: 'Ihr Kreditantrag wurde abgelehnt',
          heading: 'Kredit abgelehnt',
          message: `Wir konnten Ihren Antrag ${reference} nicht genehmigen. Es wurden keine Gelder ausgezahlt.`,
        };
      case 'loan_failed':
        return {
          subject: 'Die Auszahlung Ihres Kredits ist fehlgeschlagen',
          heading: 'Kredit nicht ausgezahlt',
          message: `Die Gelder für Ihren Antrag ${reference} konnten nicht ausgezahlt werden. Bitte wenden Sie sich an unseren Support, wenn Sie Hilfe benötigen.`,
        };
      case 'kyc_submitted': return { subject: 'Ihre Identitätsunterlagen sind eingegangen', heading: 'Unterlagen erhalten', message: 'Ihre Unterlagen warten auf die manuelle Prüfung. Derzeit ist keine Aktion erforderlich.' };
      case 'kyc_information_requested': return { subject: 'Aktion für Ihre Identitätsprüfung erforderlich', heading: 'Ergänzung erforderlich', message: 'Öffnen Sie Ihre Unterlagen und korrigieren Sie nur die angeforderten Elemente.' };
      case 'kyc_resubmitted': return { subject: 'Ihre Identitätsunterlagen wurden erneut eingereicht', heading: 'Korrekturen erhalten', message: 'Wir haben Ihre Korrekturen erhalten und prüfen sie.' };
      case 'kyc_approved': return { subject: 'Ihre Identität wurde bestätigt', heading: 'Identität bestätigt', message: 'Ihre Identität wurde bestätigt und Ihr internes {bankName}-Konto wurde erstellt.' };
      case 'kyc_rejected': return { subject: 'Ihre Identitätsunterlagen wurden abgelehnt', heading: 'Korrekturen sind möglich', message: 'Öffnen Sie denselben Vorgang, prüfen Sie den strukturierten Grund und reichen Sie die angeforderten Korrekturen ein.' };
    }
  }

  if (language === 'es') {
    switch (template) {
      case 'transfer_submitted':
        return {
          subject: 'Hemos recibido su solicitud de transferencia',
          heading: 'Solicitud de transferencia registrada',
          message: `Hemos recibido su solicitud de ${amount} para ${recipientName}. Ahora revisaremos la información y le avisaremos cuando se haya tomado una decisión.`,
        };
      case 'transfer_approved':
        return {
          subject: 'Su solicitud de transferencia ha sido aprobada',
          heading: 'Transferencia aprobada',
          message:
            'Su solicitud ha sido aprobada. Ahora estamos procesando la transferencia.',
        };
      case 'transfer_completed':
        return {
          subject: 'Su transferencia se ha realizado',
          heading: 'Transferencia realizada correctamente',
          message: `Su transferencia de ${amount} para ${recipientName} se ha realizado correctamente.`,
        };
      case 'transfer_rejected':
        return {
          subject: 'Su solicitud de transferencia ha sido rechazada',
          heading: 'Transferencia rechazada',
          message:
            'No hemos podido aprobar su solicitud de transferencia. No se ha retirado dinero de su cuenta {bankName}.',
        };
      case 'transfer_failed':
        return {
          subject: 'No se pudo realizar su transferencia',
          heading: 'Transferencia no realizada',
          message:
            'No se pudo realizar su transferencia. El importe reservado para ella vuelve a estar disponible en su cuenta {bankName}.',
        };
      case 'loan_submitted':
        return {
          subject: 'Hemos recibido su solicitud de préstamo',
          heading: 'Solicitud de préstamo registrada',
          message: `Hemos recibido su solicitud ${reference} por un importe de ${amount}. Ahora la revisaremos y le avisaremos cuando se haya tomado una decisión.`,
        };
      case 'loan_approved':
        return {
          subject: 'Su solicitud de préstamo ha sido aprobada',
          heading: 'Préstamo aprobado',
          message:
            'Su solicitud ha sido aprobada. Ahora estamos preparando el pago de los fondos.',
        };
      case 'loan_disbursed':
        return {
          subject: 'Su préstamo ha sido abonado',
          heading: 'Préstamo abonado correctamente',
          message: `Se han abonado ${amount} en su cuenta {bankName}.`,
        };
      case 'loan_rejected':
        return {
          subject: 'Su solicitud de préstamo ha sido rechazada',
          heading: 'Préstamo rechazado',
          message: `No hemos podido aprobar su solicitud ${reference}. No se ha abonado ningún fondo.`,
        };
      case 'loan_failed':
        return {
          subject: 'No se pudo abonar su préstamo',
          heading: 'Pago del préstamo no realizado',
          message: `No se pudieron abonar los fondos de su solicitud ${reference}. Póngase en contacto con nuestro servicio de asistencia si necesita ayuda.`,
        };
      case 'kyc_submitted': return { subject: 'Hemos recibido su expediente de identidad', heading: 'Expediente recibido', message: 'Su expediente espera una revisión humana. Por ahora no debe hacer nada.' };
      case 'kyc_information_requested': return { subject: 'Acción necesaria en su expediente de identidad', heading: 'Información adicional requerida', message: 'Abra su expediente y corrija únicamente los elementos solicitados.' };
      case 'kyc_resubmitted': return { subject: 'Su expediente de identidad ha sido reenviado', heading: 'Correcciones recibidas', message: 'Hemos recibido sus correcciones y las revisaremos.' };
      case 'kyc_approved': return { subject: 'Su identidad ha sido aprobada', heading: 'Identidad aprobada', message: 'Su identidad está confirmada y se ha creado su cuenta interna {bankName}.' };
      case 'kyc_rejected': return { subject: 'Su expediente de identidad ha sido rechazado', heading: 'Puede corregirlo', message: 'Abra el mismo expediente, consulte el motivo estructurado, corrija los elementos solicitados y vuelva a enviarlo.' };
    }
  }

  switch (template) {
    case 'transfer_submitted':
      return {
        subject: 'Votre demande de virement a été reçue',
        heading: 'Demande de virement enregistrée',
        message: `Nous avons reçu votre demande de ${amount} vers ${recipientName}. Nous vérifions maintenant les informations fournies et vous informerons dès qu’une décision aura été prise.`,
      };
    case 'transfer_approved':
      return {
        subject: 'Votre demande de virement a été validée',
        heading: 'Virement validé',
        message:
          'Votre demande a été validée. Nous procédons maintenant au virement.',
      };
    case 'transfer_completed':
      return {
        subject: 'Votre virement a été effectué',
        heading: 'Virement effectué avec succès',
        message: `Votre virement de ${amount} vers ${recipientName} a été effectué avec succès.`,
      };
    case 'transfer_rejected':
      return {
        subject: 'Votre demande de virement a été refusée',
        heading: 'Virement refusé',
        message:
          'Nous n’avons pas pu valider votre demande de virement. Aucun montant n’a été débité de votre compte {bankName}.',
      };
    case 'transfer_failed':
      return {
        subject: 'Échec de l’exécution de votre virement',
        heading: 'Virement non exécuté',
        message:
          'Votre virement n’a pas pu être effectué. Le montant mis de côté pour ce virement est de nouveau disponible sur votre compte {bankName}.',
      };
    case 'loan_submitted':
      return {
        subject: 'Votre demande de prêt a été reçue',
        heading: 'Demande de prêt enregistrée',
        message: `Nous avons reçu votre demande ${reference} d’un montant de ${amount}. Nous l’examinons maintenant et vous informerons dès qu’une décision aura été prise.`,
      };
    case 'loan_approved':
      return {
        subject: 'Votre demande de prêt a été validée',
        heading: 'Prêt validé',
        message:
          'Votre demande a été validée. Nous préparons maintenant le versement des fonds.',
      };
    case 'loan_disbursed':
      return {
        subject: 'Votre prêt a été versé',
        heading: 'Prêt versé avec succès',
        message: `Le montant de ${amount} a été versé sur votre compte {bankName}.`,
      };
    case 'loan_rejected':
      return {
        subject: 'Votre demande de prêt a été refusée',
        heading: 'Prêt refusé',
        message: `Nous n’avons pas pu valider votre demande ${reference}. Aucun fonds n’a été versé.`,
      };
    case 'loan_failed':
      return {
        subject: 'Le versement de votre prêt n’a pas abouti',
        heading: 'Versement du prêt non effectué',
        message: `Les fonds liés à votre demande ${reference} n’ont pas pu être versés. Contactez notre assistance si vous avez besoin d’aide.`,
      };
    case 'kyc_submitted': return { subject: 'Votre dossier d’identité a été reçu', heading: 'Dossier d’identité reçu', message: 'Votre dossier attend un contrôle humain. Aucune action n’est requise pour le moment.' };
    case 'kyc_information_requested': return { subject: 'Action requise sur votre dossier d’identité', heading: 'Complément requis', message: 'Ouvrez votre dossier et corrigez uniquement les éléments demandés.' };
    case 'kyc_resubmitted': return { subject: 'Votre dossier d’identité a été resoumis', heading: 'Corrections reçues', message: 'Vos corrections ont bien été reçues et vont être examinées.' };
    case 'kyc_approved': return { subject: 'Votre identité a été approuvée', heading: 'Identité approuvée', message: 'Votre identité est confirmée et votre compte interne {bankName} a été créé.' };
    case 'kyc_rejected': return { subject: 'Votre dossier d’identité a été rejeté', heading: 'Vous pouvez le corriger', message: 'Ouvrez le même dossier, consultez le motif structuré, corrigez les éléments demandés puis resoumettez-le.' };
  }
}

export function renderTransactionalEmail(
  template: TransactionalEmailTemplate,
  payload: Record<string, unknown>,
  branding: TransactionalEmailBranding,
  language: TransactionalEmailLanguage = 'fr',
): RenderedEmail {
  const bankName = branding.bankName?.trim() || 'Monalyz';
  const content = applyBrand(
    messageForTemplate(template, payload, language),
    bankName,
  );
  const support = SUPPORT_COPY[language];
  const safeHeading = escapeHtml(content.heading);
  const safeMessage = escapeHtml(content.message);
  const safeSupport = escapeHtml(support.html);
  let wordmarkUrl: URL;

  try {
    wordmarkUrl = new URL(branding.wordmarkUrl);
  } catch {
    throw new Error('URL du wordmark e-mail invalide.');
  }
  if (!['http:', 'https:'].includes(wordmarkUrl.protocol)) {
    throw new Error('URL du wordmark e-mail invalide.');
  }
  const safeWordmarkUrl = escapeHtml(wordmarkUrl.toString());
  const actionPath = payloadText(payload, 'actionPath', '');
  const actionUrl = actionPath.startsWith('/')
    ? new URL(actionPath, wordmarkUrl.origin).toString()
    : '';
  const actionLabel: Record<TransactionalEmailLanguage, string> = {
    fr: 'Ouvrir mon dossier',
    en: 'Open my file',
    de: 'Unterlagen öffnen',
    es: 'Abrir mi expediente',
  };
  const actionText = actionUrl ? `\n\n${actionLabel[language]}: ${actionUrl}` : '';
  const actionHtml = actionUrl
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#315cf4;color:#fff;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">${escapeHtml(actionLabel[language])}</a></p>`
    : '';

  return {
    subject: content.subject,
    text: `${content.heading}\n\n${content.message}${actionText}\n\n${support.text}`,
    html: `<!doctype html>
<html lang="${language}">
  <body style="margin:0;background:#f4f6fa;font-family:Arial,sans-serif;color:#0f172a">
    <div style="max-width:600px;margin:0 auto;padding:32px 16px">
      <div style="background:#FBFAF7;padding:18px 24px;border:1px solid #e8e2eb;border-bottom:0;border-radius:18px 18px 0 0">
        <img src="${safeWordmarkUrl}" width="180" alt="${escapeHtml(bankName)}" style="display:block;width:180px;max-width:100%;height:auto;border:0">
      </div>
      <div style="background:#fff;padding:28px 24px;border:1px solid #e2e8f0;border-radius:0 0 18px 18px">
        <h1 style="font-size:22px;margin:0 0 16px">${safeHeading}</h1>
        <p style="font-size:15px;line-height:1.6;margin:0">${safeMessage}</p>${actionHtml}
        <p style="font-size:12px;color:#64748b;margin:28px 0 0">${safeSupport}</p>
      </div>
    </div>
  </body>
</html>`,
  };
}

async function responseError(response: Response): Promise<string> {
  const body = await response.text();
  return `Le fournisseur e-mail a répondu ${response.status}: ${body.slice(0, 300)}`;
}

function buildEmailWordmarkUrl(assetBaseUrl: string): string {
  const wordmarkUrl = new URL(assetBaseUrl);
  wordmarkUrl.pathname = `${wordmarkUrl.pathname.replace(/\/$/, '')}/brand/monalyz/monalyz-wordmark-email-360.png`;
  wordmarkUrl.hash = '';
  return wordmarkUrl.toString();
}

export async function sendTransactionalEmail(
  job: TransactionalEmailJob,
  config: TransactionalEmailConfig,
  language: TransactionalEmailLanguage,
  fetchImpl: FetchLike = fetch,
  branding?: TransactionalEmailBranding,
): Promise<string> {
  const resolvedBranding = branding ?? {
    bankName: config.fromName,
    wordmarkUrl: buildEmailWordmarkUrl(config.assetBaseUrl),
  };
  const senderName = resolvedBranding.bankName?.trim() || config.fromName;
  const email = renderTransactionalEmail(
    job.template_key,
    job.payload,
    resolvedBranding,
    language,
  );

  return sendBrandedEmail(
    {
      recipientEmail: job.recipient_email,
      idempotencyKey: `monalyz-${job.id}`,
      email,
      bankName: senderName,
      tags: ['monalyz-transactional'],
    },
    config,
    fetchImpl,
  );
}

export async function sendBrandedEmail(
  delivery: BrandedEmailDelivery,
  config: TransactionalEmailConfig,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  if (config.provider === 'resend') {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': delivery.idempotencyKey,
      },
      body: JSON.stringify({
        from: `${delivery.bankName} <${config.fromEmail}>`,
        to: [delivery.recipientEmail],
        subject: delivery.email.subject,
        html: delivery.email.html,
        text: delivery.email.text,
        reply_to: config.replyTo,
      }),
    });
    if (!response.ok) throw new Error(await responseError(response));
    const data = (await response.json()) as { id?: unknown };
    if (typeof data.id !== 'string') {
      throw new Error('Réponse Resend invalide : identifiant absent.');
    }
    return data.id;
  }

  const response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': config.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: delivery.bankName, email: config.fromEmail },
      to: [{ email: delivery.recipientEmail }],
      replyTo: { email: config.replyTo },
      subject: delivery.email.subject,
      htmlContent: delivery.email.html,
      textContent: delivery.email.text,
      headers: { 'Idempotency-Key': delivery.idempotencyKey },
      tags: delivery.tags ?? ['transactional'],
    }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  const data = (await response.json()) as { messageId?: unknown };
  if (typeof data.messageId !== 'string') {
    throw new Error('Réponse Brevo invalide : identifiant absent.');
  }
  return data.messageId;
}
