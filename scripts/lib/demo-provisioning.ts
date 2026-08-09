import { isStrongPassword } from "../../lib/password-policy";

export type DemoTarget = "local" | "remote";

export type DemoProvisioningEnvironment = Record<string, string | undefined>;

export interface DemoProvisioningArguments {
  target: DemoTarget;
  dryRun: boolean;
}

export interface DemoProvisioningConfig extends DemoProvisioningArguments {
  supabaseUrl: string;
  secretKey?: string;
  adminPassword: string;
  clientPassword: string;
}

export interface DemoUser {
  id: string;
  email: string;
  userMetadata: Record<string, unknown>;
  appMetadata: Record<string, unknown>;
}

export interface DemoUserAttributes {
  email: string;
  password: string;
  displayName: string;
  demoRole: "admin" | "client";
}

export interface DemoVerification {
  demoUsers: number;
  activeAdmins: number;
  clientStaffMemberships: number;
  approvedKycApplications: number;
  currentPositions: number;
  auditEvents: number;
  transfers: number;
  loans: number;
  externalExecutions: number;
  adminClientFixtures: number;
}

export interface DemoProvisioningResult {
  createdUsers: number;
  updatedUsers: number;
  verification: DemoVerification;
}

export interface DemoProvisioningGateway {
  findUserByDemoRole(
    demoRole: DemoUserAttributes['demoRole'],
  ): Promise<DemoUser | null>;
  findUserByEmail(email: string): Promise<DemoUser | null>;
  createUser(attributes: DemoUserAttributes): Promise<DemoUser>;
  updateUser(
    userId: string,
    attributes: DemoUserAttributes,
    updatePassword: boolean,
  ): Promise<DemoUser>;
  provisionFixtures(
    adminId: string,
    clientId: string,
  ): Promise<DemoVerification>;
}

export const DEMO_ADMIN_EMAIL = "admin.demo@monalyz.com";
export const DEMO_CLIENT_EMAIL = "client.demo@monalyz.com";
export const DEMO_ADMIN_DISPLAY_NAME = "Administrateur Démo Monalyz";
export const DEMO_CLIENT_DISPLAY_NAME = "Client Démo Monalyz";

export const DEMO_KYC_ID = "d3000000-0000-4000-8000-000000000001";
export const DEMO_KYC_IDEMPOTENCY_KEY =
  "d3000000-0000-4000-8000-000000000002";
export const DEMO_POSITION_ID = "d3000000-0000-4000-8000-000000000003";

export const DEMO_POSITION_LABEL = "Compte courant démo";
export const DEMO_POSITION_AMOUNT_MINOR = 2_500_000;
export const DEMO_AUDIT_ACTIONS = [
  "demo_admin_account_provisioned",
  "demo_client_account_provisioned",
  "demo_kyc_provisioned",
  "demo_financial_position_provisioned",
] as const;

const TARGET_URLS: Record<DemoTarget, string> = {
  local: "http://127.0.0.1:54321",
  remote: "https://qljqldhvbakornnpalua.supabase.co",
};

const PLACEHOLDER_PATTERN =
  /(?:replace[-_ ]?me|your[-_ ]|votre[-_ ]|example\.(?:com|net|org)|<[^>]+>)/i;

function requiredValue(
  environment: DemoProvisioningEnvironment,
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

function validatePassword(name: string, password: string): void {
  if (!isStrongPassword(password)) {
    throw new Error(
      `${name} doit contenir entre 16 et 72 caractères, avec une minuscule, une majuscule, un chiffre et un symbole, sans espace.`,
    );
  }
}

function validatedTargetUrl(target: DemoTarget, suppliedUrl?: string): string {
  const expectedUrl = TARGET_URLS[target];
  const candidate = suppliedUrl?.trim() || expectedUrl;
  let parsed: URL;

  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("DEMO_SUPABASE_URL n’est pas une URL valide.");
  }

  const hasUnexpectedComponents =
    parsed.username !== "" ||
    parsed.password !== "" ||
    (parsed.pathname !== "" && parsed.pathname !== "/") ||
    parsed.search !== "" ||
    parsed.hash !== "";

  if (hasUnexpectedComponents || parsed.origin !== expectedUrl) {
    throw new Error(
      `La cible ${target} accepte uniquement ${expectedUrl}.`,
    );
  }

  return expectedUrl;
}

export function parseDemoProvisioningArguments(
  argumentsList: readonly string[],
): DemoProvisioningArguments {
  const targetArguments = argumentsList.filter((argument) =>
    argument.startsWith("--target="),
  );
  const unknownArguments = argumentsList.filter(
    (argument) =>
      argument !== "--dry-run" && !argument.startsWith("--target="),
  );

  if (unknownArguments.length > 0) {
    throw new Error(`Option inconnue : ${unknownArguments.join(", ")}.`);
  }

  if (targetArguments.length !== 1) {
    throw new Error(
      "Indiquez exactement une cible avec --target=local ou --target=remote.",
    );
  }

  const target = targetArguments[0].slice("--target=".length);

  if (target !== "local" && target !== "remote") {
    throw new Error("La cible doit être « local » ou « remote ».");
  }

  return {
    target,
    dryRun: argumentsList.includes("--dry-run"),
  };
}

export function buildDemoProvisioningConfig(
  argumentsList: readonly string[],
  environment: DemoProvisioningEnvironment,
): DemoProvisioningConfig {
  const argumentsConfig = parseDemoProvisioningArguments(argumentsList);
  const adminPassword = requiredValue(environment, "DEMO_ADMIN_PASSWORD");
  const clientPassword = requiredValue(environment, "DEMO_CLIENT_PASSWORD");
  const supabaseUrl = validatedTargetUrl(
    argumentsConfig.target,
    environment.DEMO_SUPABASE_URL,
  );

  validatePassword("DEMO_ADMIN_PASSWORD", adminPassword);
  validatePassword("DEMO_CLIENT_PASSWORD", clientPassword);

  if (adminPassword === clientPassword) {
    throw new Error("Les deux comptes de démonstration doivent avoir des mots de passe distincts.");
  }

  const secretKey = argumentsConfig.dryRun
    ? environment.DEMO_SUPABASE_SECRET_KEY?.trim()
    : requiredValue(environment, "DEMO_SUPABASE_SECRET_KEY");

  if (secretKey && /[\r\n]/.test(secretKey)) {
    throw new Error(
      "La variable DEMO_SUPABASE_SECRET_KEY contient un caractère interdit.",
    );
  }

  return {
    ...argumentsConfig,
    supabaseUrl,
    secretKey,
    adminPassword,
    clientPassword,
  };
}

export function safeDemoProvisioningSummary(
  config: DemoProvisioningConfig,
): Record<string, unknown> {
  return {
    target: config.target,
    dryRun: config.dryRun,
    supabaseUrl: config.supabaseUrl,
    accounts: [
      { email: DEMO_ADMIN_EMAIL, role: "admin" },
      { email: DEMO_CLIENT_EMAIL, role: "client" },
    ],
    clientFixture: {
      displayName: DEMO_CLIENT_DISPLAY_NAME,
      language: "fr",
      currency: "EUR",
      kyc: "approved, synthetic",
      currentPosition: "25 000 EUR, synthetic",
      bankConnection: false,
    },
    secrets: "[MASQUÉS]",
  };
}

function assertExistingDemoIdentity(
  user: DemoUser,
  expectedRole: DemoUserAttributes["demoRole"],
): void {
  if (
    user.appMetadata?.monalyz_demo !== true ||
    user.appMetadata?.demo_role !== expectedRole
  ) {
    throw new Error(
      `Le compte ${user.email} existe déjà sans marqueur de démonstration Monalyz compatible. Provisionnement interrompu.`,
    );
  }
}

async function ensureDemoUser(
  gateway: DemoProvisioningGateway,
  attributes: DemoUserAttributes,
  updateExistingPassword: boolean,
): Promise<{ user: DemoUser; created: boolean }> {
  const existingByRole = await gateway.findUserByDemoRole(attributes.demoRole);
  const existing =
    existingByRole ?? (await gateway.findUserByEmail(attributes.email));

  if (!existing) {
    return {
      user: await gateway.createUser(attributes),
      created: true,
    };
  }

  assertExistingDemoIdentity(existing, attributes.demoRole);

  return {
    user: await gateway.updateUser(
      existing.id,
      attributes,
      updateExistingPassword,
    ),
    created: false,
  };
}

export async function provisionDemoAccounts(
  gateway: DemoProvisioningGateway,
  config: DemoProvisioningConfig,
): Promise<DemoProvisioningResult> {
  if (config.dryRun) {
    throw new Error(
      "Le provisionnement ne doit pas être appelé avec une configuration --dry-run.",
    );
  }

  const admin = await ensureDemoUser(
    gateway,
    {
      email: DEMO_ADMIN_EMAIL,
      password: config.adminPassword,
      displayName: DEMO_ADMIN_DISPLAY_NAME,
      demoRole: "admin",
    },
    false,
  );
  const client = await ensureDemoUser(
    gateway,
    {
      email: DEMO_CLIENT_EMAIL,
      password: config.clientPassword,
      displayName: DEMO_CLIENT_DISPLAY_NAME,
      demoRole: "client",
    },
    true,
  );

  const verification = await gateway.provisionFixtures(
    admin.user.id,
    client.user.id,
  );

  return {
    createdUsers: Number(admin.created) + Number(client.created),
    updatedUsers: Number(!admin.created) + Number(!client.created),
    verification,
  };
}
