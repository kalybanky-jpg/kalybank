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
  | 'loan_failed';

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
  wordmarkUrl: string;
}

interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
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
          message: `Your request to transfer ${amount} to ${recipientName} has been recorded. The checks are performed outside Monalyz before the branch manager makes a decision.`,
        };
      case 'transfer_approved':
        return {
          subject: 'Your transfer request has been approved',
          heading: 'Transfer approved',
          message:
            'The branch manager has approved your request. The transfer must now be executed outside Monalyz.',
        };
      case 'transfer_completed':
        return {
          subject: 'Your transfer has been completed',
          heading: 'Transfer completed successfully',
          message: `The branch manager has confirmed that your transfer of ${amount} to ${recipientName} is complete.`,
        };
      case 'transfer_rejected':
        return {
          subject: 'Your transfer request has been rejected',
          heading: 'Transfer rejected',
          message:
            'Your transfer request has been rejected. No final debit has been recorded.',
        };
      case 'transfer_failed':
        return {
          subject: 'Your transfer could not be completed',
          heading: 'Transfer not completed',
          message:
            'The external transfer could not be completed. The corresponding internal hold has been released.',
        };
      case 'loan_submitted':
        return {
          subject: 'Your loan application has been received',
          heading: 'Loan application recorded',
          message: `Your application ${reference} for ${amount} has been recorded with its supporting documents.`,
        };
      case 'loan_approved':
        return {
          subject: 'Your loan application has been approved',
          heading: 'Loan approved',
          message:
            'The branch manager has approved your application. The authorised staff must now disburse the funds internally.',
        };
      case 'loan_disbursed':
        return {
          subject: 'Your loan has been disbursed',
          heading: 'Loan disbursed successfully',
          message: `The branch manager has confirmed the disbursement of ${amount}. Your Monalyz current position has been credited.`,
        };
      case 'loan_rejected':
        return {
          subject: 'Your loan application has been rejected',
          heading: 'Loan rejected',
          message: `Your application ${reference} has been rejected. No disbursement has been recorded.`,
        };
      case 'loan_failed':
        return {
          subject: 'Your loan disbursement has failed',
          heading: 'Loan not disbursed',
          message: `The disbursement associated with ${reference} could not be completed.`,
        };
    }
  }

  if (language === 'de') {
    switch (template) {
      case 'transfer_submitted':
        return {
          subject: 'Ihr Überweisungsauftrag ist eingegangen',
          heading: 'Überweisungsauftrag erfasst',
          message: `Ihr Auftrag über ${amount} an ${recipientName} wurde erfasst. Die Prüfungen werden außerhalb von Monalyz durchgeführt, bevor die Filialleitung entscheidet.`,
        };
      case 'transfer_approved':
        return {
          subject: 'Ihr Überweisungsauftrag wurde genehmigt',
          heading: 'Überweisung genehmigt',
          message:
            'Die Filialleitung hat Ihren Auftrag genehmigt. Die Überweisung muss nun außerhalb von Monalyz ausgeführt werden.',
        };
      case 'transfer_completed':
        return {
          subject: 'Ihre Überweisung wurde ausgeführt',
          heading: 'Überweisung erfolgreich ausgeführt',
          message: `Die Filialleitung hat bestätigt, dass Ihre Überweisung über ${amount} an ${recipientName} ausgeführt wurde.`,
        };
      case 'transfer_rejected':
        return {
          subject: 'Ihr Überweisungsauftrag wurde abgelehnt',
          heading: 'Überweisung abgelehnt',
          message:
            'Ihr Überweisungsauftrag wurde abgelehnt. Es wurde keine endgültige Belastung verbucht.',
        };
      case 'transfer_failed':
        return {
          subject: 'Ihre Überweisung konnte nicht ausgeführt werden',
          heading: 'Überweisung nicht ausgeführt',
          message:
            'Die externe Überweisung konnte nicht abgeschlossen werden. Die entsprechende interne Reservierung wurde aufgehoben.',
        };
      case 'loan_submitted':
        return {
          subject: 'Ihr Kreditantrag ist eingegangen',
          heading: 'Kreditantrag erfasst',
          message: `Ihr Antrag ${reference} über ${amount} wurde mit den erforderlichen Nachweisen erfasst.`,
        };
      case 'loan_approved':
        return {
          subject: 'Ihr Kreditantrag wurde genehmigt',
          heading: 'Kredit genehmigt',
          message:
            'Die Filialleitung hat Ihren Antrag genehmigt. Das zuständige Personal muss die Auszahlung nun intern vornehmen.',
        };
      case 'loan_disbursed':
        return {
          subject: 'Ihr Kredit wurde ausgezahlt',
          heading: 'Kredit erfolgreich ausgezahlt',
          message: `Die Filialleitung hat die Auszahlung von ${amount} bestätigt. Ihre laufende Monalyz-Position wurde gutgeschrieben.`,
        };
      case 'loan_rejected':
        return {
          subject: 'Ihr Kreditantrag wurde abgelehnt',
          heading: 'Kredit abgelehnt',
          message: `Ihr Antrag ${reference} wurde abgelehnt. Es wurde keine Auszahlung verbucht.`,
        };
      case 'loan_failed':
        return {
          subject: 'Die Auszahlung Ihres Kredits ist fehlgeschlagen',
          heading: 'Kredit nicht ausgezahlt',
          message: `Die mit ${reference} verbundene Auszahlung konnte nicht abgeschlossen werden.`,
        };
    }
  }

  if (language === 'es') {
    switch (template) {
      case 'transfer_submitted':
        return {
          subject: 'Hemos recibido su solicitud de transferencia',
          heading: 'Solicitud de transferencia registrada',
          message: `Su solicitud de ${amount} para ${recipientName} se ha registrado correctamente. Las comprobaciones se realizan fuera de Monalyz antes de la decisión del jefe de sucursal.`,
        };
      case 'transfer_approved':
        return {
          subject: 'Su solicitud de transferencia ha sido aprobada',
          heading: 'Transferencia aprobada',
          message:
            'El jefe de sucursal ha aprobado su solicitud. La transferencia debe ejecutarse ahora fuera de Monalyz.',
        };
      case 'transfer_completed':
        return {
          subject: 'Su transferencia se ha realizado',
          heading: 'Transferencia realizada correctamente',
          message: `El jefe de sucursal ha confirmado que su transferencia de ${amount} para ${recipientName} se ha completado.`,
        };
      case 'transfer_rejected':
        return {
          subject: 'Su solicitud de transferencia ha sido rechazada',
          heading: 'Transferencia rechazada',
          message:
            'Su solicitud de transferencia ha sido rechazada. No se ha registrado ningún débito definitivo.',
        };
      case 'transfer_failed':
        return {
          subject: 'No se pudo realizar su transferencia',
          heading: 'Transferencia no realizada',
          message:
            'No se pudo completar la transferencia externa. Se ha liberado la retención interna correspondiente.',
        };
      case 'loan_submitted':
        return {
          subject: 'Hemos recibido su solicitud de préstamo',
          heading: 'Solicitud de préstamo registrada',
          message: `Su solicitud ${reference} por un importe de ${amount} se ha registrado con sus justificantes.`,
        };
      case 'loan_approved':
        return {
          subject: 'Su solicitud de préstamo ha sido aprobada',
          heading: 'Préstamo aprobado',
          message:
            'El jefe de sucursal ha aprobado su solicitud. El personal autorizado debe realizar ahora el desembolso internamente.',
        };
      case 'loan_disbursed':
        return {
          subject: 'Su préstamo ha sido desembolsado',
          heading: 'Préstamo desembolsado correctamente',
          message: `El jefe de sucursal ha confirmado el desembolso de ${amount}. Se ha abonado su posición corriente en Monalyz.`,
        };
      case 'loan_rejected':
        return {
          subject: 'Su solicitud de préstamo ha sido rechazada',
          heading: 'Préstamo rechazado',
          message: `Su solicitud ${reference} ha sido rechazada. No se ha registrado ningún desembolso.`,
        };
      case 'loan_failed':
        return {
          subject: 'El desembolso de su préstamo ha fallado',
          heading: 'Préstamo no desembolsado',
          message: `No se pudo completar el desembolso asociado a ${reference}.`,
        };
    }
  }

  switch (template) {
    case 'transfer_submitted':
      return {
        subject: 'Votre demande de virement a été reçue',
        heading: 'Demande de virement enregistrée',
        message: `Votre demande de ${amount} vers ${recipientName} a bien été enregistrée. Les contrôles sont réalisés hors de Monalyz avant la décision du chef d’agence.`,
      };
    case 'transfer_approved':
      return {
        subject: 'Votre demande de virement a été validée',
        heading: 'Virement validé',
        message:
          'Le chef d’agence a validé votre demande. Le virement doit maintenant être exécuté hors de Monalyz.',
      };
    case 'transfer_completed':
      return {
        subject: 'Votre virement a été effectué',
        heading: 'Virement effectué avec succès',
        message: `Le chef d’agence a confirmé que votre virement de ${amount} vers ${recipientName} est effectif.`,
      };
    case 'transfer_rejected':
      return {
        subject: 'Votre demande de virement a été refusée',
        heading: 'Virement refusé',
        message:
          'Votre demande de virement a été refusée. Aucun débit définitif n’a été enregistré.',
      };
    case 'transfer_failed':
      return {
        subject: 'Échec de l’exécution de votre virement',
        heading: 'Virement non exécuté',
        message:
          'Le virement externe n’a pas pu être finalisé. La réservation interne correspondante a été libérée.',
      };
    case 'loan_submitted':
      return {
        subject: 'Votre demande de prêt a été reçue',
        heading: 'Demande de prêt enregistrée',
        message: `Votre demande ${reference} d’un montant de ${amount} a bien été enregistrée avec ses justificatifs.`,
      };
    case 'loan_approved':
      return {
        subject: 'Votre demande de prêt a été validée',
        heading: 'Prêt validé',
        message:
          'Le chef d’agence a validé votre demande. Le personnel compétent doit maintenant effectuer le décaissement en interne.',
      };
    case 'loan_disbursed':
      return {
        subject: 'Votre prêt a été décaissé',
        heading: 'Prêt décaissé avec succès',
        message: `Le chef d’agence a confirmé le décaissement de ${amount}. Votre position courante Monalyz a été créditée.`,
      };
    case 'loan_rejected':
      return {
        subject: 'Votre demande de prêt a été refusée',
        heading: 'Prêt refusé',
        message: `Votre demande ${reference} a été refusée. Aucun décaissement n’a été enregistré.`,
      };
    case 'loan_failed':
      return {
        subject: 'Le décaissement de votre prêt a échoué',
        heading: 'Prêt non décaissé',
        message: `Le décaissement associé à ${reference} n’a pas pu être finalisé.`,
      };
  }
}

export function renderTransactionalEmail(
  template: TransactionalEmailTemplate,
  payload: Record<string, unknown>,
  branding: TransactionalEmailBranding,
  language: TransactionalEmailLanguage = 'fr',
): RenderedEmail {
  const content = messageForTemplate(template, payload, language);
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

  return {
    subject: content.subject,
    text: `${content.heading}\n\n${content.message}\n\n${support.text}`,
    html: `<!doctype html>
<html lang="${language}">
  <body style="margin:0;background:#f4f6fa;font-family:Arial,sans-serif;color:#0f172a">
    <div style="max-width:600px;margin:0 auto;padding:32px 16px">
      <div style="background:#FBFAF7;padding:18px 24px;border:1px solid #e8e2eb;border-bottom:0;border-radius:18px 18px 0 0">
        <img src="${safeWordmarkUrl}" width="180" alt="Monalyz" style="display:block;width:180px;max-width:100%;height:auto;border:0">
      </div>
      <div style="background:#fff;padding:28px 24px;border:1px solid #e2e8f0;border-radius:0 0 18px 18px">
        <h1 style="font-size:22px;margin:0 0 16px">${safeHeading}</h1>
        <p style="font-size:15px;line-height:1.6;margin:0">${safeMessage}</p>
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
): Promise<string> {
  const email = renderTransactionalEmail(
    job.template_key,
    job.payload,
    {
      wordmarkUrl: buildEmailWordmarkUrl(config.assetBaseUrl),
    },
    language,
  );

  if (config.provider === 'resend') {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `monalyz-${job.id}`,
      },
      body: JSON.stringify({
        from: `${config.fromName} <${config.fromEmail}>`,
        to: [job.recipient_email],
        subject: email.subject,
        html: email.html,
        text: email.text,
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
      sender: { name: config.fromName, email: config.fromEmail },
      to: [{ email: job.recipient_email }],
      replyTo: { email: config.replyTo },
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
      headers: { 'Idempotency-Key': `monalyz-${job.id}` },
      tags: ['monalyz-transactional'],
    }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  const data = (await response.json()) as { messageId?: unknown };
  if (typeof data.messageId !== 'string') {
    throw new Error('Réponse Brevo invalide : identifiant absent.');
  }
  return data.messageId;
}
