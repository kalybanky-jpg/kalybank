import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSupabaseAuthEmailConfig,
  safeAuthEmailSummary,
  type AuthEmailEnvironment,
} from "../scripts/lib/supabase-auth-email";

const commonEnvironment: AuthEmailEnvironment = {
  SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
  AUTH_SMTP_FROM_EMAIL: "support@monalyz.com",
  AUTH_SMTP_SENDER_NAME: "Monalyz",
  AUTH_EMAIL_RATE_LIMIT_PER_HOUR: "45",
  AUTH_SMTP_MAX_FREQUENCY_SECONDS: "90",
};

const templates = {
  confirmation:
    '<img src="{{ .SiteURL }}/brand/monalyz/monalyz-wordmark-email-360.png"><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">confirmation</a>',
  recovery:
    '<img src="{{ .SiteURL }}/brand/monalyz/monalyz-wordmark-email-360.png"><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">recovery</a>',
  passwordChanged:
    '<img src="{{ .SiteURL }}/brand/monalyz/monalyz-wordmark-email-360.png"><p>Password changed for {{ .Email }}</p>',
};

test("la configuration Resend utilise le profil SMTP officiel", () => {
  const config = buildSupabaseAuthEmailConfig(
    "resend",
    {
      ...commonEnvironment,
      RESEND_API_KEY: "re_a_secret_value",
    },
    templates,
  );

  assert.equal(config.payload.smtp_host, "smtp.resend.com");
  assert.equal(config.payload.smtp_port, "587");
  assert.equal(config.payload.smtp_user, "resend");
  assert.equal(config.payload.smtp_pass, "re_a_secret_value");
  assert.equal(config.payload.smtp_admin_email, "support@monalyz.com");
  assert.equal(config.payload.smtp_sender_name, "Monalyz");
  assert.equal(config.payload.rate_limit_email_sent, 45);
  assert.equal(config.payload.smtp_max_frequency, 90);
});

test("la configuration Brevo exige des identifiants SMTP distincts", () => {
  const config = buildSupabaseAuthEmailConfig(
    "brevo",
    {
      ...commonEnvironment,
      BREVO_SMTP_LOGIN: "smtp-user@monalyz.test",
      BREVO_SMTP_KEY: "xsmtpsib-a-secret-value",
    },
    templates,
  );

  assert.equal(config.payload.smtp_host, "smtp-relay.brevo.com");
  assert.equal(config.payload.smtp_port, "587");
  assert.equal(config.payload.smtp_user, "smtp-user@monalyz.test");
  assert.equal(config.payload.smtp_pass, "xsmtpsib-a-secret-value");
});

test("les deux profils conservent les protections Auth et les modèles Monalyz", () => {
  const config = buildSupabaseAuthEmailConfig(
    "resend",
    {
      ...commonEnvironment,
      RESEND_API_KEY: "re_a_secret_value",
    },
    templates,
  );

  assert.equal(config.payload.mailer_autoconfirm, false);
  assert.equal(config.payload.mailer_secure_email_change_enabled, true);
  assert.equal(
    config.payload.security_update_password_require_reauthentication,
    true,
  );
  assert.equal(
    config.payload.mailer_notifications_password_changed_enabled,
    true,
  );
  assert.equal(
    config.payload.mailer_templates_confirmation_content,
    templates.confirmation,
  );
  assert.equal(
    config.payload.mailer_templates_recovery_content,
    templates.recovery,
  );
  assert.equal(
    config.payload.mailer_templates_password_changed_notification_content,
    templates.passwordChanged,
  );
});

test("le résumé ne divulgue jamais le secret SMTP", () => {
  const secret = "re_never_print_this_value";
  const config = buildSupabaseAuthEmailConfig(
    "resend",
    {
      ...commonEnvironment,
      RESEND_API_KEY: secret,
    },
    templates,
  );

  const serialized = JSON.stringify(safeAuthEmailSummary(config));
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("[MASQUÉ]"), true);
});

test("une valeur d’exemple ou une limite incohérente est refusée", () => {
  assert.throws(
    () =>
      buildSupabaseAuthEmailConfig(
        "resend",
        {
          ...commonEnvironment,
          SUPABASE_PROJECT_REF: "your-project-ref",
          RESEND_API_KEY: "re_a_secret_value",
        },
        templates,
      ),
    /valeur d’exemple/,
  );

  assert.throws(
    () =>
      buildSupabaseAuthEmailConfig(
        "resend",
        {
          ...commonEnvironment,
          AUTH_EMAIL_RATE_LIMIT_PER_HOUR: "0",
          RESEND_API_KEY: "re_a_secret_value",
        },
        templates,
      ),
    /entier compris/,
  );
});

test("un modèle qui casserait un parcours Auth est refusé avant le PATCH", () => {
  assert.throws(
    () =>
      buildSupabaseAuthEmailConfig(
        "resend",
        {
          ...commonEnvironment,
          RESEND_API_KEY: "re_a_secret_value",
        },
        {
          ...templates,
          recovery: "<p>Lien de récupération absent</p>",
        },
      ),
    /modèle recovery ne contient pas/,
  );
});
