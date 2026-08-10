import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildDemoProvisioningConfig,
  DEMO_ADMIN_EMAIL,
  DEMO_CLIENT_EMAIL,
  provisionDemoAccounts,
  safeDemoProvisioningSummary,
  type DemoProvisioningGateway,
  type DemoUser,
  type DemoUserAttributes,
  type DemoVerification,
} from "../scripts/lib/demo-provisioning";

const strongEnvironment = {
  DEMO_ADMIN_PASSWORD: "Admin!Demo-2026-Strong",
  DEMO_CLIENT_PASSWORD: "Client!Demo-2026-Strong",
};

class FakeDemoGateway implements DemoProvisioningGateway {
  readonly users = new Map<string, DemoUser>();
  readonly profiles = new Set<string>();
  readonly staff = new Set<string>();
  readonly positions = new Set<string>();
  readonly kycs = new Set<string>();
  readonly kycEvents = new Set<string>();
  readonly audits = new Set<string>();
  createCalls = 0;
  updateCalls = 0;
  passwordUpdateRoles: DemoUserAttributes['demoRole'][] = [];

  async findUserByDemoRole(
    demoRole: DemoUserAttributes['demoRole'],
  ): Promise<DemoUser | null> {
    const matches = [...this.users.values()].filter(
      (user) =>
        user.appMetadata.monalyz_demo === true &&
        user.appMetadata.demo_role === demoRole,
    );
    if (matches.length > 1) {
      throw new Error(`Plusieurs identités de démonstration portent le rôle ${demoRole}.`);
    }
    return matches[0] ?? null;
  }

  async findUserByEmail(email: string): Promise<DemoUser | null> {
    return this.users.get(email) ?? null;
  }

  async createUser(attributes: DemoUserAttributes): Promise<DemoUser> {
    this.createCalls += 1;
    const user: DemoUser = {
      id: `user-${attributes.demoRole}`,
      email: attributes.email,
      userMetadata: {
        display_name: attributes.displayName,
        preferred_language: "fr",
        base_currency: "EUR",
        preferred_currency: "EUR",
      },
      appMetadata: {
        monalyz_demo: true,
        demo_role: attributes.demoRole,
      },
    };
    this.users.set(attributes.email, user);
    return user;
  }

  async updateUser(
    userId: string,
    attributes: DemoUserAttributes,
    updatePassword: boolean,
  ): Promise<DemoUser> {
    this.updateCalls += 1;
    if (updatePassword) this.passwordUpdateRoles.push(attributes.demoRole);
    const currentEntry = [...this.users.entries()].find(
      ([, candidate]) => candidate.id === userId,
    );
    const currentEmail = currentEntry?.[1].email ?? attributes.email;
    if (currentEntry) this.users.delete(currentEntry[0]);
    const user = {
      id: userId,
      email: currentEmail,
      userMetadata: {
        display_name: attributes.displayName,
        preferred_language: "fr",
        base_currency: "EUR",
        preferred_currency: "EUR",
      },
      appMetadata: {
        monalyz_demo: true,
        demo_role: attributes.demoRole,
      },
    };
    this.users.set(currentEmail, user);
    return user;
  }

  async provisionFixtures(
    adminId: string,
    clientId: string,
  ): Promise<DemoVerification> {
    this.profiles.add(adminId);
    this.profiles.add(clientId);
    this.staff.add(adminId);
    this.staff.delete(clientId);
    this.positions.add(clientId);
    this.kycs.add(clientId);
    this.kycEvents.add(clientId);
    this.audits.add(`admin:${adminId}`);
    this.audits.add(`client:${clientId}`);
    this.audits.add(`kyc:${clientId}`);
    this.audits.add(`position:${clientId}`);

    return {
      demoUsers: this.users.size,
      activeAdmins: Number(this.staff.has(adminId)),
      clientStaffMemberships: Number(this.staff.has(clientId)),
      approvedKycApplications: Number(this.kycs.has(clientId)),
      currentPositions: Number(this.positions.has(clientId)),
      auditEvents: this.audits.size,
      transfers: 0,
      loans: 0,
      externalExecutions: 0,
      adminClientFixtures: 0,
    };
  }
}

test("la cible est obligatoire et seules les deux URL approuvées sont acceptées", () => {
  assert.throws(
    () => buildDemoProvisioningConfig(["--dry-run"], strongEnvironment),
    /exactement une cible/,
  );
  assert.throws(
    () =>
      buildDemoProvisioningConfig(["--target=staging", "--dry-run"], strongEnvironment),
    /local.*remote/,
  );
  assert.throws(
    () =>
      buildDemoProvisioningConfig(
        ["--target=remote", "--dry-run"],
        {
          ...strongEnvironment,
          DEMO_SUPABASE_URL: "https://autre-projet.supabase.co",
        },
      ),
    /accepte uniquement/,
  );

  const local = buildDemoProvisioningConfig(
    ["--target=local", "--dry-run"],
    strongEnvironment,
  );
  const remote = buildDemoProvisioningConfig(
    ["--target=remote", "--dry-run"],
    strongEnvironment,
  );
  assert.equal(local.supabaseUrl, "http://127.0.0.1:54321");
  assert.equal(remote.supabaseUrl, "https://qljqldhvbakornnpalua.supabase.co");
});

test("les mots de passe doivent être forts et distincts", () => {
  assert.throws(
    () =>
      buildDemoProvisioningConfig(
        ["--target=local", "--dry-run"],
        {
          ...strongEnvironment,
          DEMO_CLIENT_PASSWORD: "Aa1!abcd",
        },
      ),
    /entre 16 et 72 caractères/,
  );
  assert.throws(
    () =>
      buildDemoProvisioningConfig(
        ["--target=local", "--dry-run"],
        {
          ...strongEnvironment,
          DEMO_CLIENT_PASSWORD: "motdepassefaible",
        },
      ),
    /minuscule.*majuscule.*chiffre.*symbole/,
  );
  assert.throws(
    () =>
      buildDemoProvisioningConfig(
        ["--target=local", "--dry-run"],
        {
          ...strongEnvironment,
          DEMO_CLIENT_PASSWORD: strongEnvironment.DEMO_ADMIN_PASSWORD,
        },
      ),
    /distincts/,
  );
});

test("la clé serveur est obligatoire en écriture mais facultative en simulation", () => {
  assert.doesNotThrow(() =>
    buildDemoProvisioningConfig(
      ["--target=local", "--dry-run"],
      strongEnvironment,
    ),
  );
  assert.throws(
    () => buildDemoProvisioningConfig(["--target=local"], strongEnvironment),
    /DEMO_SUPABASE_SECRET_KEY/,
  );
});

test("le résumé de simulation ne divulgue aucun mot de passe ni secret", () => {
  const config = buildDemoProvisioningConfig(
    ["--target=remote", "--dry-run"],
    {
      ...strongEnvironment,
      DEMO_SUPABASE_SECRET_KEY: "sb_secret_never_print",
    },
  );
  const serialized = JSON.stringify(safeDemoProvisioningSummary(config));

  assert.equal(serialized.includes(strongEnvironment.DEMO_ADMIN_PASSWORD), false);
  assert.equal(serialized.includes(strongEnvironment.DEMO_CLIENT_PASSWORD), false);
  assert.equal(serialized.includes("sb_secret_never_print"), false);
  assert.equal(serialized.includes(DEMO_ADMIN_EMAIL), true);
  assert.equal(serialized.includes(DEMO_CLIENT_EMAIL), true);
});

test("deux exécutions réutilisent les identités et ne dupliquent aucun artefact", async () => {
  const gateway = new FakeDemoGateway();
  const config = buildDemoProvisioningConfig(
    ["--target=local"],
    {
      ...strongEnvironment,
      DEMO_SUPABASE_SECRET_KEY: "sb_secret_fake_for_test",
    },
  );

  const first = await provisionDemoAccounts(gateway, config);
  const second = await provisionDemoAccounts(gateway, config);

  assert.equal(first.createdUsers, 2);
  assert.equal(first.updatedUsers, 0);
  assert.equal(second.createdUsers, 0);
  assert.equal(second.updatedUsers, 2);
  assert.deepEqual(gateway.passwordUpdateRoles, ['client']);
  assert.equal(gateway.createCalls, 2);
  assert.equal(gateway.updateCalls, 2);
  assert.equal(gateway.users.size, 2);
  assert.equal(gateway.profiles.size, 2);
  assert.equal(gateway.staff.size, 1);
  assert.equal(gateway.positions.size, 1);
  assert.equal(gateway.kycs.size, 1);
  assert.equal(gateway.kycEvents.size, 1);
  assert.equal(gateway.audits.size, 4);
  assert.deepEqual(second.verification, {
    demoUsers: 2,
    activeAdmins: 1,
    clientStaffMemberships: 0,
    approvedKycApplications: 1,
    currentPositions: 1,
    auditEvents: 4,
    transfers: 0,
    loans: 0,
    externalExecutions: 0,
    adminClientFixtures: 0,
  });
});

test("un compte existant non marqué comme démo n’est jamais repris", async () => {
  const gateway = new FakeDemoGateway();
  gateway.users.set(DEMO_ADMIN_EMAIL, {
    id: "unrelated-user",
    email: DEMO_ADMIN_EMAIL,
    userMetadata: {
      monalyz_demo: true,
      demo_role: "admin",
    },
    appMetadata: {},
  });
  const config = buildDemoProvisioningConfig(
    ["--target=local"],
    {
      ...strongEnvironment,
      DEMO_SUPABASE_SECRET_KEY: "sb_secret_fake_for_test",
    },
  );

  await assert.rejects(
    () => provisionDemoAccounts(gateway, config),
    /sans marqueur de démonstration/,
  );
  assert.equal(gateway.updateCalls, 0);
});

test("le reprovisionnement conserve l’UUID et l’adresse modifiée de l’admin démo", async () => {
  const gateway = new FakeDemoGateway();
  const config = buildDemoProvisioningConfig(
    ["--target=local"],
    {
      ...strongEnvironment,
      DEMO_SUPABASE_SECRET_KEY: "sb_secret_fake_for_test",
    },
  );

  await provisionDemoAccounts(gateway, config);
  const originalAdmin = gateway.users.get(DEMO_ADMIN_EMAIL);
  assert.ok(originalAdmin);
  const changedEmail = "responsable.agence@monalyz.test";
  gateway.users.delete(DEMO_ADMIN_EMAIL);
  gateway.users.set(changedEmail, { ...originalAdmin, email: changedEmail });

  const result = await provisionDemoAccounts(gateway, config);

  assert.equal(result.createdUsers, 0);
  assert.equal(result.updatedUsers, 2);
  assert.equal(gateway.users.size, 2);
  assert.equal(gateway.users.has(DEMO_ADMIN_EMAIL), false);
  assert.equal(gateway.users.get(changedEmail)?.id, originalAdmin.id);
  assert.equal(result.verification.activeAdmins, 1);
  assert.deepEqual(gateway.passwordUpdateRoles, ['client']);
});

test("le provisionneur réel ne remplace jamais implicitement le mot de passe admin", async () => {
  const source = await readFile(
    new URL("../scripts/provision-demo-accounts.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /updateUserById\(userId, \{[\s\S]*?\.\.\.\(updatePassword \? \{ password: attributes\.password \} : \{\}\)/,
  );
  assert.match(
    await readFile(
      new URL("../scripts/lib/demo-provisioning.ts", import.meta.url),
      "utf8",
    ),
    /demoRole: "admin",[\s\S]*?\},\s*false,\s*\);/,
  );
});

test("la RPC démo concentre les écritures et reste réservée au service_role", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260728173319_provision_demo_accounts.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /security definer/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(
    migration,
    /revoke execute on function public\.provision_demo_accounts[\s\S]+from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.provision_demo_accounts[\s\S]+to service_role/i,
  );
  assert.match(migration, /raw_app_meta_data[\s\S]+monalyz_demo/i);
  assert.match(migration, /'street'[\s\S]+'postalCode'[\s\S]+'city'[\s\S]+'country'/i);
  assert.match(migration, /DEMO_CLIENT_FINANCIAL_WORKFLOW_MUST_BE_EMPTY/);
  assert.match(migration, /DEMO_ADMIN_MUST_NOT_HAVE_CLIENT_FIXTURES/);
});
