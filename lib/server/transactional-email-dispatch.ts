import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import {
  DEFAULT_BRAND_ROW,
  mapBrandSettings,
  type BrandSettingsRow,
} from '@/lib/branding';
import type { Database } from '@/lib/supabase/database.types';
import {
  getTransactionalEmailConfig,
  parseTransactionalEmailJob,
  resolveTransactionalEmailLanguage,
  sendTransactionalEmail,
  type TransactionalEmailBranding,
  type TransactionalEmailConfig,
  type TransactionalEmailJob,
} from '@/lib/server/transactional-email';

export const TRANSACTIONAL_EMAIL_BROWSER_BATCH_SIZE = 10;
export const TRANSACTIONAL_EMAIL_SCHEDULED_BATCH_SIZE = 5;
export const TRANSACTIONAL_EMAIL_PROVIDER_TIMEOUT_MS = 3_000;
export const TRANSACTIONAL_EMAIL_DISPATCH_CONCURRENCY = 2;

type PrivilegedClient = SupabaseClient<Database>;
type FetchLike = typeof fetch;
type Environment = Readonly<Record<string, string | undefined>>;

export interface TransactionalEmailDispatchResult {
  claimed: number;
  sent: number;
  failed: number;
  completionFailed: number;
}

interface ProcessTransactionalEmailJobsOptions {
  client: PrivilegedClient;
  jobs: TransactionalEmailJob[];
  config: TransactionalEmailConfig;
  branding: TransactionalEmailBranding;
  providerTimeoutMs?: number;
  concurrency?: number;
  fetchImpl?: FetchLike;
}

interface DispatchTransactionalEmailBatchOptions {
  client: PrivilegedClient;
  config?: TransactionalEmailConfig;
  supabaseUrl?: string;
  recipientId?: string;
  limit: number;
  providerTimeoutMs?: number;
  concurrency?: number;
  fetchImpl?: FetchLike;
}

function requiredServiceKey(environment: Environment) {
  const value =
    environment.SUPABASE_SECRET_KEY?.trim() ||
    environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!value || /replace|changeme|your[-_]/i.test(value)) {
    throw new Error('Configuration e-mail manquante : SUPABASE_SECRET_KEY.');
  }
  return value;
}

function requiredSupabaseUrl(environment: Environment) {
  const value = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) {
    throw new Error(
      'Configuration e-mail manquante : NEXT_PUBLIC_SUPABASE_URL.',
    );
  }

  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new Error('invalid');
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error(
      'Configuration e-mail invalide : NEXT_PUBLIC_SUPABASE_URL.',
    );
  }
}

/**
 * Creates the only client accepted by the global outbox worker. The browser
 * session is never consulted and the service key is never returned to callers.
 */
export function createTransactionalEmailPrivilegedClient(
  environment: Environment = process.env,
): PrivilegedClient {
  return createSupabaseClient<Database>(
    requiredSupabaseUrl(environment),
    requiredServiceKey(environment),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}

function normalizedBatchLimit(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 20) {
    throw new Error('Taille de lot e-mail invalide.');
  }
  return value;
}

export async function claimTransactionalEmailJobs(
  client: PrivilegedClient,
  options: { limit: number; recipientId?: string },
): Promise<TransactionalEmailJob[]> {
  const limit = normalizedBatchLimit(options.limit);
  const result = options.recipientId
    ? await client.rpc('claim_transactional_emails_for_recipient', {
        p_recipient_id: options.recipientId,
        p_limit: limit,
      })
    : await client.rpc('claim_transactional_emails', { p_limit: limit });

  if (result.error) {
    throw new Error(
      `Réclamation des e-mails impossible : ${result.error.message}`,
    );
  }
  return (result.data ?? []).map(parseTransactionalEmailJob);
}

function absoluteWordmarkUrl(value: string, assetBaseUrl: string) {
  try {
    return new URL(value, `${assetBaseUrl.replace(/\/$/, '')}/`).toString();
  } catch {
    throw new Error('URL du wordmark e-mail invalide.');
  }
}

export async function resolveTransactionalEmailBranding(
  client: PrivilegedClient,
  assetBaseUrl: string,
  supabaseUrl = requiredSupabaseUrl(process.env),
): Promise<TransactionalEmailBranding> {
  const { data, error } = await client
    .from('brand_settings')
    .select('*')
    .eq('singleton', true)
    .maybeSingle();
  const row = !error && data ? (data as BrandSettingsRow) : DEFAULT_BRAND_ROW;
  const settings = mapBrandSettings(row, requiredSupabaseUrl({
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  }));

  return {
    bankName: settings.bankName,
    wordmarkUrl: absoluteWordmarkUrl(settings.emailLogoUrl, assetBaseUrl),
  };
}

function errorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : 'Échec d’envoi non détaillé.';
  return message.slice(0, 1_000);
}

async function completeTransactionalEmail(
  client: PrivilegedClient,
  job: TransactionalEmailJob,
  succeeded: boolean,
  providerMessageId?: string,
  error?: string,
) {
  const result = await client.rpc('complete_transactional_email', {
    p_email_id: job.id,
    p_claim_token: job.claim_token,
    p_succeeded: succeeded,
    p_provider_message_id: providerMessageId,
    p_error: error,
  });
  if (result.error) {
    throw new Error(
      `Finalisation de l’e-mail impossible : ${result.error.message}`,
    );
  }
}

export async function sendTransactionalEmailWithTimeout(
  job: TransactionalEmailJob,
  config: TransactionalEmailConfig,
  language: Parameters<typeof sendTransactionalEmail>[2],
  branding: TransactionalEmailBranding,
  options: { timeoutMs: number; fetchImpl?: FetchLike },
) {
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1) {
    throw new Error('Délai fournisseur e-mail invalide.');
  }

  const controller = new AbortController();
  const fetchImpl = options.fetchImpl ?? fetch;
  const timedFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    fetchImpl(input, { ...init, signal: controller.signal })) as FetchLike;
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    return await sendTransactionalEmail(
      job,
      config,
      language,
      timedFetch,
      branding,
    );
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        `Délai fournisseur e-mail dépassé (${options.timeoutMs} ms).`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function processTransactionalEmailJobs(
  options: ProcessTransactionalEmailJobsOptions,
): Promise<Omit<TransactionalEmailDispatchResult, 'claimed'>> {
  const providerTimeoutMs =
    options.providerTimeoutMs ?? TRANSACTIONAL_EMAIL_PROVIDER_TIMEOUT_MS;
  const concurrency =
    options.concurrency ?? TRANSACTIONAL_EMAIL_DISPATCH_CONCURRENCY;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 5) {
    throw new Error('Concurrence du worker e-mail invalide.');
  }
  let sent = 0;
  let failed = 0;
  let completionFailed = 0;

  let nextJobIndex = 0;
  const processNextJob = async (): Promise<void> => {
    const jobIndex = nextJobIndex;
    nextJobIndex += 1;
    const job = options.jobs[jobIndex];
    if (!job) return;

    try {
      const language = await resolveTransactionalEmailLanguage(() =>
        options.client
          .from('profiles')
          .select('preferred_language')
          .eq('user_id', job.recipient_id)
          .maybeSingle(),
      );
      const providerMessageId = await sendTransactionalEmailWithTimeout(
        job,
        options.config,
        language,
        options.branding,
        { timeoutMs: providerTimeoutMs, fetchImpl: options.fetchImpl },
      );
      await completeTransactionalEmail(
        options.client,
        job,
        true,
        providerMessageId,
      );
      sent += 1;
    } catch (error) {
      failed += 1;
      try {
        await completeTransactionalEmail(
          options.client,
          job,
          false,
          undefined,
          errorMessage(error),
        );
      } catch {
        completionFailed += 1;
      }
    }
    await processNextJob();
  };

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, options.jobs.length) },
      () => processNextJob(),
    ),
  );

  return { sent, failed, completionFailed };
}

export async function dispatchTransactionalEmailBatch(
  options: DispatchTransactionalEmailBatchOptions,
): Promise<TransactionalEmailDispatchResult> {
  const config = options.config ?? getTransactionalEmailConfig();
  const jobs = await claimTransactionalEmailJobs(options.client, {
    limit: options.limit,
    recipientId: options.recipientId,
  });
  if (jobs.length === 0) {
    return { claimed: 0, sent: 0, failed: 0, completionFailed: 0 };
  }

  const branding = await resolveTransactionalEmailBranding(
    options.client,
    config.assetBaseUrl,
    options.supabaseUrl,
  );
  const result = await processTransactionalEmailJobs({
    client: options.client,
    jobs,
    config,
    branding,
    providerTimeoutMs: options.providerTimeoutMs,
    concurrency: options.concurrency,
    fetchImpl: options.fetchImpl,
  });
  return { claimed: jobs.length, ...result };
}
