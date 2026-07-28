import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSupabaseAuthEmailConfig,
  safeAuthEmailSummary,
  type AuthEmailProvider,
  type SupabaseAuthEmailPayload,
} from "./lib/supabase-auth-email";

const MANAGEMENT_API = "https://api.supabase.com/v1";
const REQUEST_TIMEOUT_MS = 20_000;

function parseArguments(): {
  provider: AuthEmailProvider;
  dryRun: boolean;
} {
  const provider = process.argv[2];

  if (provider !== "resend" && provider !== "brevo") {
    throw new Error(
      "Fournisseur invalide. Utilisez explicitement « resend » ou « brevo ».",
    );
  }

  const unknownFlags = process.argv
    .slice(3)
    .filter((argument) => argument !== "--dry-run");

  if (unknownFlags.length > 0) {
    throw new Error(`Option inconnue : ${unknownFlags.join(", ")}.`);
  }

  return {
    provider,
    dryRun: process.argv.includes("--dry-run"),
  };
}

function requiredManagementToken(dryRun: boolean): string | undefined {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();

  if (dryRun) {
    return undefined;
  }

  if (!token) {
    throw new Error("La variable SUPABASE_ACCESS_TOKEN est obligatoire.");
  }

  if (/[\r\n]/.test(token)) {
    throw new Error(
      "La variable SUPABASE_ACCESS_TOKEN contient un caractère interdit.",
    );
  }

  return token;
}

async function loadTemplates() {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const templatesRoot = path.join(repositoryRoot, "supabase", "templates");

  const [confirmation, recovery, passwordChanged] = await Promise.all([
    readFile(path.join(templatesRoot, "confirmation.html"), "utf8"),
    readFile(path.join(templatesRoot, "recovery.html"), "utf8"),
    readFile(
      path.join(templatesRoot, "password_changed_notification.html"),
      "utf8",
    ),
  ]);

  return { confirmation, recovery, passwordChanged };
}

async function managementRequest(
  endpoint: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Supabase Management API a répondu ${response.status} ${response.statusText}.`,
    );
  }

  return response;
}

function verifyRemoteConfig(
  expected: SupabaseAuthEmailPayload,
  actual: Record<string, unknown>,
): void {
  const fields = Object.keys(expected).filter((field) => field !== "smtp_pass");
  const differences = fields.filter(
    (field) => String(actual[field]) !== String(expected[field as keyof typeof expected]),
  );

  if (differences.length > 0) {
    throw new Error(
      `La vérification distante a échoué pour : ${differences.join(", ")}.`,
    );
  }
}

async function configure(): Promise<void> {
  const { provider, dryRun } = parseArguments();
  const templates = await loadTemplates();
  const config = buildSupabaseAuthEmailConfig(provider, process.env, templates);
  const summary = safeAuthEmailSummary(config);
  const token = requiredManagementToken(dryRun);

  console.log(JSON.stringify(summary, null, 2));

  if (dryRun) {
    console.log("Prévalidation terminée : aucun projet Supabase n’a été modifié.");
    return;
  }

  const endpoint = `${MANAGEMENT_API}/projects/${encodeURIComponent(
    config.projectRef,
  )}/config/auth`;

  await managementRequest(endpoint, token!, {
    method: "PATCH",
    body: JSON.stringify(config.payload),
  });

  const remoteResponse = await managementRequest(endpoint, token!);
  const remoteConfig = (await remoteResponse.json()) as Record<string, unknown>;
  verifyRemoteConfig(config.payload, remoteConfig);

  console.log(
    `Configuration ${provider} appliquée et vérifiée sur ${config.projectRef}.`,
  );
}

configure().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Erreur de configuration inconnue.";
  console.error(`Configuration interrompue : ${message}`);
  process.exitCode = 1;
});
