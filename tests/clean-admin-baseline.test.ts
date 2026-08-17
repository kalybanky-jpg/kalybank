import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const seed = readFileSync("supabase/seed.sql", "utf8");
const bootstrap = readFileSync("scripts/provision-clean-admin-baseline.ts", "utf8");
const databaseGuard = readFileSync(
  "supabase/bootstrap/clean-admin-baseline.sql",
  "utf8",
);
const documentation = readFileSync("docs/clean-admin-baseline.md", "utf8");
const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

const ADMIN_EMAIL = "admin.demo.local@monalyz.test";
const ADMIN_PASSWORD = "Monalyz-Demo-Local-2026!";

test("the clean baseline documents the exact local demo credentials", () => {
  for (const value of [ADMIN_EMAIL, ADMIN_PASSWORD]) {
    assert.match(
      bootstrap,
      new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    assert.match(
      documentation,
      new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }

  assert.match(documentation, /locaux et GitHub CI/i);
  assert.match(documentation, /## Interdiction de production/);
  assert.match(documentation, /N’adaptez jamais le bootstrap/);
  assert.match(documentation, /--linked/);
});

test("the seed remains empty and the bootstrap is forced to local Supabase", () => {
  assert.doesNotMatch(seed, /insert\s+into\s+(?:auth\.)?(?:users|identities)/i);
  assert.doesNotMatch(seed, /insert\s+into\s+public\.(?:profiles|staff_members)/i);
  assert.doesNotMatch(seed, new RegExp(ADMIN_EMAIL, "i"));
  assert.doesNotMatch(seed, new RegExp(ADMIN_PASSWORD.replace(/!/g, "\\!")));

  assert.match(bootstrap, /LOCAL_SUPABASE_ORIGIN = "http:\/\/127\.0\.0\.1:54321"/);
  assert.match(bootstrap, /assert\.equal\(\s*parsedUrl\.href,\s*`\$\{LOCAL_SUPABASE_ORIGIN\}\/`/);
  assert.match(bootstrap, /auth\.admin\.createUser/);
  assert.match(bootstrap, /auth\.admin\.updateUserById/);
  assert.match(bootstrap, /AUTH_READ_MAX_ATTEMPTS = 16/);
  assert.match(bootstrap, /AUTH_READ_RETRY_BASE_DELAY_MS = 250/);
  assert.match(bootstrap, /AUTH_READ_RETRY_MAX_DELAY_MS = 2_000/);
  assert.match(
    bootstrap,
    /attempt <= AUTH_READ_MAX_ATTEMPTS[\s\S]*?auth\.admin\.listUsers/,
  );
  assert.match(
    bootstrap,
    /isRetryableAuthReadError\(error\)[\s\S]*?attempt < AUTH_READ_MAX_ATTEMPTS[\s\S]*?Math\.min\([\s\S]*?AUTH_READ_RETRY_BASE_DELAY_MS \* 2 \*\* \(attempt - 1\)[\s\S]*?AUTH_READ_RETRY_MAX_DELAY_MS[\s\S]*?setTimeout/,
  );
  assert.match(
    bootstrap,
    /isAuthRetryableFetchError\(error\)[\s\S]*?status === 0 \|\| \(status >= 500 && status <= 599\)/,
  );
  assert.match(
    bootstrap,
    /Lecture Auth impossible après \$\{attempts\}\/\$\{AUTH_READ_MAX_ATTEMPTS\} tentatives/,
  );
  assert.match(
    bootstrap,
    /name:[\s\S]*?message:[\s\S]*?status:[\s\S]*?code:/,
  );
  assert.match(bootstrap, /rpc\(\s*"current_app_role"/);
  assert.match(bootstrap, /async function main\(\): Promise<void>/);
  assert.match(bootstrap, /void main\(\)\.catch/);
  assert.doesNotMatch(bootstrap, /demo_role/);
  assert.match(bootstrap, /"db", "query", "--local", "--file"/);
  assert.doesNotMatch(bootstrap, /--linked/);
  assert.doesNotMatch(bootstrap, /\.supabase\.co/i);
  assert.doesNotMatch(databaseGuard, /insert\s+into\s+auth\./i);
  assert.match(databaseGuard, /insert into public\.staff_members/);
  assert.match(databaseGuard, /CLEAN_ADMIN_BASELINE_BUSINESS_DATA_PRESENT/);
  assert.match(databaseGuard, /from public\.kyc_review_checklists/);
  assert.match(databaseGuard, /from public\.support_user_identities/);
});

test("GitHub validates a real local Auth login for the baseline", () => {
  assert.match(workflow, /Reset database for clean admin baseline/);
  assert.match(workflow, /Provision and test clean admin baseline/);
  assert.match(workflow, /bun run demo:clean-admin/);
  assert.match(workflow, /SUPABASE_URL="\$\{API_URL\}"/);
  assert.match(workflow, /SUPABASE_ANON_KEY="\$\{ANON_KEY\}"/);
  assert.match(workflow, /SUPABASE_SERVICE_ROLE_KEY="\$\{SERVICE_ROLE_KEY\}"/);
  assert.equal((workflow.match(/bun run demo:clean-admin/g) ?? []).length, 2);
});
