import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const ADMIN_EMAIL = "admin.demo.local@monalyz.test";
const ADMIN_PASSWORD = "Monalyz-Demo-Local-2026!";
const LOCAL_SUPABASE_ORIGIN = "http://127.0.0.1:54321";
const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SQL_FILE = "supabase/bootstrap/clean-admin-baseline.sql";
const AUTH_READ_MAX_ATTEMPTS = 5;
const AUTH_READ_RETRY_BASE_DELAY_MS = 200;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} est obligatoire.`);
  if (/\r|\n/.test(value)) throw new Error(`${name} contient un caractère interdit.`);
  return value;
}

function isExpectedDemoAdmin(user: User): boolean {
  return (
    user.email?.toLowerCase() === ADMIN_EMAIL &&
    user.app_metadata?.monalyz_demo === true &&
    user.app_metadata?.demo_scope === "local_clean_baseline"
  );
}

function describeAuthReadError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  try {
    return JSON.stringify(error) || String(error);
  } catch {
    return String(error);
  }
}

async function listUsersPageWithRetry(
  client: SupabaseClient,
  page: number,
): Promise<User[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= AUTH_READ_MAX_ATTEMPTS; attempt += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1_000,
    });

    if (!error) return data.users;

    lastError = error;
    if (attempt < AUTH_READ_MAX_ATTEMPTS) {
      const delayMs = AUTH_READ_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    `Lecture Auth impossible après ${AUTH_READ_MAX_ATTEMPTS} tentatives : ${describeAuthReadError(lastError)}`,
  );
}

async function listAllUsers(client: SupabaseClient): Promise<User[]> {
  const users: User[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const pageUsers = await listUsersPageWithRetry(client, page);
    users.push(...pageUsers);
    if (pageUsers.length < 1_000) return users;
  }

  throw new Error("La pagination Auth a dépassé la limite de sécurité.");
}

function runLocalDatabaseGuard(): void {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";

  try {
    execFileSync(
      executable,
      ["supabase", "db", "query", "--local", "--file", SQL_FILE],
      {
        cwd: ROOT_DIRECTORY,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30_000,
      },
    );
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error
        ? String(error.stderr).slice(0, 2_000)
        : "";
    throw new Error(
      `Validation SQL locale impossible.${stderr ? ` ${stderr}` : ""}`,
    );
  }
}

async function main(): Promise<void> {
const supabaseUrl = requiredEnvironment("SUPABASE_URL");
const parsedUrl = new URL(supabaseUrl);

assert.equal(
  parsedUrl.href,
  `${LOCAL_SUPABASE_ORIGIN}/`,
  "Le bootstrap refuse toute cible autre que Supabase local.",
);

const secretKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = requiredEnvironment("SUPABASE_ANON_KEY");

const adminClient = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const existingUsers = await listAllUsers(adminClient);
if (existingUsers.length > 1) {
  throw new Error("Le modèle exige une base Auth vide ou son unique admin démo.");
}

const existingUser = existingUsers[0];
let admin: User;

if (!existingUser) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    app_metadata: {
      monalyz_demo: true,
      demo_scope: "local_clean_baseline",
    },
    user_metadata: {
      display_name: "Administrateur Démo Local",
      preferred_language: "fr",
      base_currency: "CAD",
      preferred_currency: "CAD",
    },
  });
  if (error || !data.user) {
    throw new Error(`Création Auth impossible : ${error?.message ?? "utilisateur absent"}`);
  }
  admin = data.user;
} else {
  if (!isExpectedDemoAdmin(existingUser)) {
    throw new Error("L’unique identité Auth existante n’est pas l’admin démo attendu.");
  }

  const { data, error } = await adminClient.auth.admin.updateUserById(
    existingUser.id,
    {
      password: ADMIN_PASSWORD,
      email_confirm: true,
      app_metadata: {
        monalyz_demo: true,
        demo_scope: "local_clean_baseline",
      },
      user_metadata: {
        display_name: "Administrateur Démo Local",
        preferred_language: "fr",
        base_currency: "CAD",
        preferred_currency: "CAD",
      },
    },
  );
  if (error || !data.user) {
    throw new Error(`Mise à jour Auth impossible : ${error?.message ?? "utilisateur absent"}`);
  }
  admin = data.user;
}

assert.ok(isExpectedDemoAdmin(admin));
runLocalDatabaseGuard();

const publicClient = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
const { data: authData, error: authError } = await publicClient.auth.signInWithPassword({
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});

assert.ifError(authError);
assert.equal(authData.user?.id, admin.id);
assert.equal(authData.user?.email, ADMIN_EMAIL);

const { data: profile, error: profileError } = await publicClient
  .from("profiles")
  .select("user_id,email,display_name,preferred_language,base_currency,access_status")
  .eq("user_id", admin.id)
  .single();
assert.ifError(profileError);
assert.deepEqual(profile, {
  user_id: admin.id,
  email: ADMIN_EMAIL,
  display_name: "Administrateur Démo Local",
  preferred_language: "fr",
  base_currency: "CAD",
  access_status: "active",
});

const { data: staff, error: staffError } = await publicClient
  .from("staff_members")
  .select("user_id,role,active")
  .eq("user_id", admin.id)
  .single();
assert.ifError(staffError);
assert.deepEqual(staff, { user_id: admin.id, role: "admin", active: true });

const { data: currentRole, error: roleError } = await publicClient.rpc(
  "current_app_role",
);
assert.ifError(roleError);
assert.equal(currentRole, "admin");

const { error: signOutError } = await publicClient.auth.signOut();
assert.ifError(signOutError);

console.log(
  JSON.stringify({
    status: "ok",
    target: parsedUrl.origin,
    adminId: admin.id,
    adminEmail: ADMIN_EMAIL,
    password: "[PUBLIC DEMO CREDENTIAL IN docs/clean-admin-baseline.md]",
  }),
);
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Bootstrap local impossible.",
  );
  process.exitCode = 1;
});
