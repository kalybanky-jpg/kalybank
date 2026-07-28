import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTransactionalEmailConfig,
  renderTransactionalEmail,
  sendTransactionalEmail,
  type TransactionalEmailJob,
  type TransactionalEmailTemplate,
} from '../lib/server/transactional-email';

const baseEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  TRANSACTIONAL_EMAIL_FROM_EMAIL: 'support@monalyz.com',
  TRANSACTIONAL_EMAIL_FROM_NAME: 'Monalyz',
  TRANSACTIONAL_EMAIL_REPLY_TO: 'support@monalyz.com',
};

const job: TransactionalEmailJob = {
  id: '11111111-2222-4333-8444-555555555555',
  claim_token: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  recipient_email: 'client@example.com',
  template_key: 'transfer_completed',
  payload: {
    amountMinor: 125050,
    currency: 'EUR',
    recipientName: 'Marie Dupont',
  },
};

test('la configuration métier Resend exige RESEND_API_KEY', () => {
  const config = getTransactionalEmailConfig({
    ...baseEnvironment,
    TRANSACTIONAL_EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_transactional_secret',
  });

  assert.deepEqual(config, {
    provider: 'resend',
    apiKey: 're_transactional_secret',
    fromEmail: 'support@monalyz.com',
    fromName: 'Monalyz',
    replyTo: 'support@monalyz.com',
  });
  assert.throws(
    () =>
      getTransactionalEmailConfig({
        ...baseEnvironment,
        TRANSACTIONAL_EMAIL_PROVIDER: 'resend',
        BREVO_API_KEY: 'xkeysib-not-a-resend-key',
      }),
    /RESEND_API_KEY/,
  );
});

test('la configuration métier Brevo utilise BREVO_API_KEY, pas le secret SMTP', () => {
  const config = getTransactionalEmailConfig({
    ...baseEnvironment,
    TRANSACTIONAL_EMAIL_PROVIDER: 'brevo',
    BREVO_API_KEY: 'xkeysib-transactional-secret',
    BREVO_SMTP_LOGIN: 'smtp-user@example.com',
    BREVO_SMTP_KEY: 'xsmtpsib-auth-only',
  });

  assert.equal(config.provider, 'brevo');
  assert.equal(config.apiKey, 'xkeysib-transactional-secret');
  assert.throws(
    () =>
      getTransactionalEmailConfig({
        ...baseEnvironment,
        TRANSACTIONAL_EMAIL_PROVIDER: 'brevo',
        BREVO_SMTP_LOGIN: 'smtp-user@example.com',
        BREVO_SMTP_KEY: 'xsmtpsib-auth-only',
      }),
    /BREVO_API_KEY/,
  );
});

test('les valeurs de secret d’exemple sont refusées', () => {
  assert.throws(
    () =>
      getTransactionalEmailConfig({
        ...baseEnvironment,
        TRANSACTIONAL_EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_replace_me',
      }),
    /Secret e-mail non configuré : RESEND_API_KEY/,
  );
  assert.throws(
    () =>
      getTransactionalEmailConfig({
        ...baseEnvironment,
        TRANSACTIONAL_EMAIL_PROVIDER: 'brevo',
        BREVO_API_KEY: 'your-brevo-api-key',
      }),
    /Secret e-mail non configuré : BREVO_API_KEY/,
  );
});

const expectedCopy: Record<
  TransactionalEmailTemplate,
  { subject: RegExp; body: RegExp }
> = {
  transfer_submitted: {
    subject: /demande de virement.*reçue/i,
    body: /contrôles sont réalisés hors de Monalyz/i,
  },
  transfer_approved: {
    subject: /demande de virement.*validée/i,
    body: /chef d’agence a validé/i,
  },
  transfer_completed: {
    subject: /virement.*effectué/i,
    body: /effectif/i,
  },
  transfer_rejected: {
    subject: /demande de virement.*refusée/i,
    body: /aucun débit définitif/i,
  },
  transfer_failed: {
    subject: /échec.*virement/i,
    body: /réservation interne.*libérée/i,
  },
  loan_submitted: {
    subject: /demande de prêt.*reçue/i,
    body: /justificatifs/i,
  },
  loan_approved: {
    subject: /demande de prêt.*validée/i,
    body: /chef d’agence a validé/i,
  },
  loan_disbursed: {
    subject: /prêt.*décaissé/i,
    body: /position courante Monalyz.*créditée/i,
  },
  loan_rejected: {
    subject: /demande de prêt.*refusée/i,
    body: /aucun décaissement/i,
  },
  loan_failed: {
    subject: /décaissement.*échoué/i,
    body: /n’a pas pu être finalisé/i,
  },
};

for (const [template, expected] of Object.entries(expectedCopy) as Array<
  [TransactionalEmailTemplate, (typeof expectedCopy)[TransactionalEmailTemplate]]
>) {
  test(`le modèle ${template} rend un objet complet et cohérent`, () => {
    const rendered = renderTransactionalEmail(template, {
      amountMinor: 125050,
      currency: 'EUR',
      recipientName: 'Marie Dupont',
      reference: 'MONALYZ-LOAN-123',
    });

    assert.match(rendered.subject, expected.subject);
    assert.match(rendered.text, expected.body);
    assert.match(rendered.html, expected.body);
    assert.match(rendered.text, /support@monalyz\.com/);
    assert.match(rendered.html, /support@monalyz\.com/);
  });
}

test('le rendu HTML neutralise les valeurs non fiables du payload', () => {
  const rendered = renderTransactionalEmail('transfer_submitted', {
    amountMinor: 1000,
    currency: 'EUR',
    recipientName: '<script>alert("xss")</script>',
  });

  assert.doesNotMatch(rendered.html, /<script>/);
  assert.match(
    rendered.html,
    /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/,
  );
});

test('Resend reçoit le bon endpoint, le bon payload et une clé d’idempotence', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const fetchMock = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    capturedUrl = String(input);
    capturedInit = init;
    return Response.json({ id: 'resend-message-id' });
  }) as typeof fetch;

  const providerMessageId = await sendTransactionalEmail(
    job,
    {
      provider: 'resend',
      apiKey: 're_transactional_secret',
      fromEmail: 'support@monalyz.com',
      fromName: 'Monalyz',
      replyTo: 'support@monalyz.com',
    },
    fetchMock,
  );

  assert.equal(providerMessageId, 'resend-message-id');
  assert.equal(capturedUrl, 'https://api.resend.com/emails');
  assert.equal(capturedInit?.method, 'POST');
  assert.equal(
    new Headers(capturedInit?.headers).get('Authorization'),
    'Bearer re_transactional_secret',
  );
  assert.equal(
    new Headers(capturedInit?.headers).get('Idempotency-Key'),
    `monalyz-${job.id}`,
  );

  const payload = JSON.parse(String(capturedInit?.body)) as Record<
    string,
    unknown
  >;
  assert.equal(payload.from, 'Monalyz <support@monalyz.com>');
  assert.deepEqual(payload.to, ['client@example.com']);
  assert.equal(payload.reply_to, 'support@monalyz.com');
  assert.match(String(payload.subject), /virement.*effectué/i);
});

test('Brevo reçoit le bon endpoint, le bon payload et l’en-tête d’idempotence', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const fetchMock = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    capturedUrl = String(input);
    capturedInit = init;
    return Response.json({ messageId: 'brevo-message-id' });
  }) as typeof fetch;

  const providerMessageId = await sendTransactionalEmail(
    {
      ...job,
      template_key: 'loan_disbursed',
      payload: {
        amountMinor: 500000,
        currency: 'EUR',
        reference: 'MONALYZ-LOAN-123',
      },
    },
    {
      provider: 'brevo',
      apiKey: 'xkeysib-transactional-secret',
      fromEmail: 'support@monalyz.com',
      fromName: 'Monalyz',
      replyTo: 'support@monalyz.com',
    },
    fetchMock,
  );

  assert.equal(providerMessageId, 'brevo-message-id');
  assert.equal(capturedUrl, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(capturedInit?.method, 'POST');
  assert.equal(
    new Headers(capturedInit?.headers).get('api-key'),
    'xkeysib-transactional-secret',
  );

  const payload = JSON.parse(String(capturedInit?.body)) as {
    sender: { name: string; email: string };
    to: Array<{ email: string }>;
    replyTo: { email: string };
    subject: string;
    headers: Record<string, string>;
  };
  assert.deepEqual(payload.sender, {
    name: 'Monalyz',
    email: 'support@monalyz.com',
  });
  assert.deepEqual(payload.to, [{ email: 'client@example.com' }]);
  assert.equal(payload.replyTo.email, 'support@monalyz.com');
  assert.equal(payload.headers['Idempotency-Key'], `monalyz-${job.id}`);
  assert.match(payload.subject, /prêt.*décaissé/i);
});
