export type TransactionalEmailProvider = 'resend' | 'brevo';

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
}

interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

type FetchLike = typeof fetch;

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

function formatMinorAmount(payload: Record<string, unknown>): string {
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
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(exponent)} ${currency}`;
  }
}

function messageForTemplate(
  template: TransactionalEmailTemplate,
  payload: Record<string, unknown>,
): { subject: string; heading: string; message: string } {
  const amount = formatMinorAmount(payload);
  const recipientName = payloadText(
    payload,
    'recipientName',
    'le bénéficiaire indiqué',
  );
  const reference = payloadText(payload, 'reference', 'votre dossier');

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
): RenderedEmail {
  const content = messageForTemplate(template, payload);
  const safeHeading = escapeHtml(content.heading);
  const safeMessage = escapeHtml(content.message);

  return {
    subject: content.subject,
    text: `${content.heading}\n\n${content.message}\n\nSupport : support@monalyz.com`,
    html: `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f4f6fa;font-family:Arial,sans-serif;color:#0f172a">
    <div style="max-width:600px;margin:0 auto;padding:32px 16px">
      <div style="background:#0f172a;color:#fff;padding:18px 24px;border-radius:18px 18px 0 0;font-weight:700">Monalyz</div>
      <div style="background:#fff;padding:28px 24px;border:1px solid #e2e8f0;border-radius:0 0 18px 18px">
        <h1 style="font-size:22px;margin:0 0 16px">${safeHeading}</h1>
        <p style="font-size:15px;line-height:1.6;margin:0">${safeMessage}</p>
        <p style="font-size:12px;color:#64748b;margin:28px 0 0">Besoin d’aide ? Écrivez à support@monalyz.com.</p>
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

export async function sendTransactionalEmail(
  job: TransactionalEmailJob,
  config: TransactionalEmailConfig,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const email = renderTransactionalEmail(job.template_key, job.payload);

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
