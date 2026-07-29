export type AuthEmailProvider = "resend" | "brevo";

export type AuthEmailEnvironment = Record<string, string | undefined>;

export interface AuthEmailTemplates {
  confirmation: string;
  recovery: string;
  passwordChanged: string;
}

export interface SupabaseAuthEmailPayload {
  external_email_enabled: true;
  mailer_autoconfirm: false;
  mailer_secure_email_change_enabled: true;
  security_update_password_require_reauthentication: true;
  smtp_admin_email: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_sender_name: string;
  smtp_max_frequency: number;
  rate_limit_email_sent: number;
  mailer_subjects_confirmation: string;
  mailer_templates_confirmation_content: string;
  mailer_subjects_recovery: string;
  mailer_templates_recovery_content: string;
  mailer_notifications_password_changed_enabled: true;
  mailer_subjects_password_changed_notification: string;
  mailer_templates_password_changed_notification_content: string;
}

export interface SupabaseAuthEmailConfig {
  provider: AuthEmailProvider;
  projectRef: string;
  payload: SupabaseAuthEmailPayload;
}

const PLACEHOLDER_PATTERN =
  /(?:replace[-_ ]?me|your[-_ ]|your-domain|votre[-_ ]|example\.(?:com|net|org)|<[^>]+>)/i;
const WORDMARK_MARKER =
  "{{ .SiteURL }}/brand/monalyz/monalyz-wordmark-email-360.png";

function requiredValue(
  environment: AuthEmailEnvironment,
  name: string,
): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`La variable ${name} est obligatoire.`);
  }

  if (/[\r\n]/.test(value)) {
    throw new Error(`La variable ${name} contient un caractère interdit.`);
  }

  if (PLACEHOLDER_PATTERN.test(value)) {
    throw new Error(`La variable ${name} contient encore une valeur d’exemple.`);
  }

  return value;
}

function positiveInteger(
  environment: AuthEmailEnvironment,
  name: string,
  fallback: number,
  maximum: number,
): number {
  const rawValue = environment[name]?.trim();
  const value = rawValue ? Number(rawValue) : fallback;

  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(
      `La variable ${name} doit être un entier compris entre 1 et ${maximum}.`,
    );
  }

  return value;
}

function assertProjectRef(projectRef: string): void {
  if (!/^[a-z0-9]{15,30}$/.test(projectRef)) {
    throw new Error("SUPABASE_PROJECT_REF n’est pas une référence de projet valide.");
  }
}

function assertSenderEmail(senderEmail: string): void {
  if (
    senderEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)
  ) {
    throw new Error("AUTH_SMTP_FROM_EMAIL n’est pas une adresse e-mail valide.");
  }
}

function assertSenderName(senderName: string): void {
  if (senderName.length > 70) {
    throw new Error("AUTH_SMTP_SENDER_NAME ne doit pas dépasser 70 caractères.");
  }
}

function assertTemplate(
  name: string,
  content: string,
  requiredMarkers: readonly string[],
): void {
  if (!content.trim()) {
    throw new Error(`Le modèle ${name} est vide.`);
  }

  if (Buffer.byteLength(content, "utf8") > 512_000) {
    throw new Error(`Le modèle ${name} dépasse la limite de sécurité de 512 Ko.`);
  }

  const missingMarkers = requiredMarkers.filter(
    (marker) => !content.includes(marker),
  );

  if (missingMarkers.length > 0) {
    throw new Error(
      `Le modèle ${name} ne contient pas : ${missingMarkers.join(", ")}.`,
    );
  }
}

export function buildSupabaseAuthEmailConfig(
  provider: AuthEmailProvider,
  environment: AuthEmailEnvironment,
  templates: AuthEmailTemplates,
): SupabaseAuthEmailConfig {
  const projectRef = requiredValue(environment, "SUPABASE_PROJECT_REF");
  const senderEmail = requiredValue(environment, "AUTH_SMTP_FROM_EMAIL");
  const senderName = requiredValue(environment, "AUTH_SMTP_SENDER_NAME");
  const rateLimit = positiveInteger(
    environment,
    "AUTH_EMAIL_RATE_LIMIT_PER_HOUR",
    30,
    10_000,
  );
  const maxFrequency = positiveInteger(
    environment,
    "AUTH_SMTP_MAX_FREQUENCY_SECONDS",
    60,
    86_400,
  );

  assertProjectRef(projectRef);
  assertSenderEmail(senderEmail);
  assertSenderName(senderName);
  assertTemplate("confirmation", templates.confirmation, [
    "{{ .SiteURL }}",
    WORDMARK_MARKER,
    "{{ .TokenHash }}",
    "type=email",
  ]);
  assertTemplate("recovery", templates.recovery, [
    "{{ .SiteURL }}",
    WORDMARK_MARKER,
    "{{ .TokenHash }}",
    "type=recovery",
  ]);
  assertTemplate("password_changed_notification", templates.passwordChanged, [
    "{{ .SiteURL }}",
    WORDMARK_MARKER,
    "{{ .Email }}",
  ]);

  const smtp =
    provider === "resend"
      ? {
          host: "smtp.resend.com",
          port: "587",
          user: "resend",
          pass: requiredValue(environment, "RESEND_API_KEY"),
        }
      : {
          host: "smtp-relay.brevo.com",
          port: "587",
          user: requiredValue(environment, "BREVO_SMTP_LOGIN"),
          pass: requiredValue(environment, "BREVO_SMTP_KEY"),
        };

  return {
    provider,
    projectRef,
    payload: {
      external_email_enabled: true,
      mailer_autoconfirm: false,
      mailer_secure_email_change_enabled: true,
      security_update_password_require_reauthentication: true,
      smtp_admin_email: senderEmail,
      smtp_host: smtp.host,
      smtp_port: smtp.port,
      smtp_user: smtp.user,
      smtp_pass: smtp.pass,
      smtp_sender_name: senderName,
      smtp_max_frequency: maxFrequency,
      rate_limit_email_sent: rateLimit,
      mailer_subjects_confirmation: "Confirmez votre compte Monalyz",
      mailer_templates_confirmation_content: templates.confirmation,
      mailer_subjects_recovery: "Réinitialisez votre mot de passe Monalyz",
      mailer_templates_recovery_content: templates.recovery,
      mailer_notifications_password_changed_enabled: true,
      mailer_subjects_password_changed_notification:
        "Votre mot de passe Monalyz a été modifié",
      mailer_templates_password_changed_notification_content:
        templates.passwordChanged,
    },
  };
}

export function safeAuthEmailSummary(config: SupabaseAuthEmailConfig) {
  return {
    provider: config.provider,
    projectRef: config.projectRef,
    endpoint: `https://api.supabase.com/v1/projects/${config.projectRef}/config/auth`,
    smtp: {
      from: config.payload.smtp_admin_email,
      senderName: config.payload.smtp_sender_name,
      host: config.payload.smtp_host,
      port: config.payload.smtp_port,
      user: config.payload.smtp_user,
      password: "[MASQUÉ]",
    },
    protections: {
      emailConfirmationRequired: !config.payload.mailer_autoconfirm,
      secureEmailChange: config.payload.mailer_secure_email_change_enabled,
      passwordChangeReauthentication:
        config.payload.security_update_password_require_reauthentication,
      passwordChangeNotification:
        config.payload.mailer_notifications_password_changed_enabled,
      hourlyRateLimit: config.payload.rate_limit_email_sent,
      minimumDelaySeconds: config.payload.smtp_max_frequency,
    },
    templates: ["confirmation", "recovery", "password_changed_notification"],
  };
}
