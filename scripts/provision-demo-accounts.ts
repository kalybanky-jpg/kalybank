import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

import {
  buildDemoProvisioningConfig,
  provisionDemoAccounts,
  safeDemoProvisioningSummary,
  type DemoProvisioningGateway,
  type DemoUser,
  type DemoUserAttributes,
  type DemoVerification,
} from "./lib/demo-provisioning";
import { renderOfficialDocumentPdf } from "../lib/server/official-document-pdf";

const USER_PAGE_SIZE = 1_000;

function userFromSupabase(user: User): DemoUser {
  return {
    id: user.id,
    email: user.email ?? "",
    userMetadata: user.user_metadata ?? {},
    appMetadata: user.app_metadata ?? {},
  };
}

class SupabaseDemoGateway implements DemoProvisioningGateway {
  constructor(
    private readonly client: SupabaseClient,
    private readonly target: "local" | "remote",
  ) {}

  private userMetadata(attributes: DemoUserAttributes) {
    return {
      display_name: attributes.displayName,
      preferred_language: "fr",
      base_currency: "EUR",
      preferred_currency: "EUR",
    };
  }

  private appMetadata(attributes: DemoUserAttributes) {
    return {
      monalyz_demo: true,
      demo_role: attributes.demoRole,
    };
  }

  async findUserByEmail(email: string): Promise<DemoUser | null> {
    const normalizedEmail = email.toLowerCase();

    for (let page = 1; page <= 10_000; page += 1) {
      const { data, error } = await this.client.auth.admin.listUsers({
        page,
        perPage: USER_PAGE_SIZE,
      });

      if (error) {
        throw new Error(`Lecture des utilisateurs Auth impossible : ${error.message}`);
      }

      const user = data.users.find(
        (candidate) => candidate.email?.toLowerCase() === normalizedEmail,
      );

      if (user) {
        return userFromSupabase(user);
      }

      if (data.users.length < USER_PAGE_SIZE) {
        return null;
      }
    }

    throw new Error("La pagination Auth a dépassé la limite de sécurité.");
  }

  async createUser(attributes: DemoUserAttributes): Promise<DemoUser> {
    const { data, error } = await this.client.auth.admin.createUser({
      email: attributes.email,
      password: attributes.password,
      email_confirm: true,
      user_metadata: this.userMetadata(attributes),
      app_metadata: this.appMetadata(attributes),
    });

    if (error || !data.user) {
      throw new Error(
        `Création de ${attributes.email} impossible : ${error?.message ?? "utilisateur absent"}`,
      );
    }

    return userFromSupabase(data.user);
  }

  async updateUser(
    userId: string,
    attributes: DemoUserAttributes,
  ): Promise<DemoUser> {
    const { data, error } = await this.client.auth.admin.updateUserById(userId, {
      password: attributes.password,
      email_confirm: true,
      user_metadata: this.userMetadata(attributes),
      app_metadata: this.appMetadata(attributes),
    });

    if (error || !data.user) {
      throw new Error(
        `Mise à jour de ${attributes.email} impossible : ${error?.message ?? "utilisateur absent"}`,
      );
    }

    return userFromSupabase(data.user);
  }

  async provisionFixtures(
    adminId: string,
    clientId: string,
  ): Promise<DemoVerification> {
    const { data, error } = await this.client.rpc("provision_demo_accounts", {
      p_admin_user_id: adminId,
      p_client_user_id: clientId,
      p_environment: this.target,
    });

    const expected: DemoVerification = {
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
    };

    if (error) {
      throw new Error(`RPC de provisionnement démo impossible : ${error.message}`);
    }

    const verification = data as DemoVerification | null;
    const invalid =
      !verification ||
      Object.entries(expected).some(
        ([key, value]) =>
          verification[key as keyof DemoVerification] !== value,
      );

    if (invalid) {
      throw new Error(
        `La vérification finale est incohérente : ${JSON.stringify(verification)}.`,
      );
    }

    return verification;
  }

  async publishPendingDemoDocuments(): Promise<number> {
    const { data, error } = await this.client
      .from("official_documents")
      .select(
        "id,owner_id,document_number,document_type,title,language,version,is_demo,snapshot,content_hash",
      )
      .eq("is_demo", true)
      .eq("status", "pending");
    if (error) {
      throw new Error(
        `Lecture des documents démo en attente impossible : ${error.message}`,
      );
    }

    let published = 0;
    for (const document of data ?? []) {
      const storagePath = `${document.owner_id}/${document.id}/v${document.version}.pdf`;
      try {
        const bytes = Buffer.from(
          await renderOfficialDocumentPdf({
            documentNumber: document.document_number,
            documentType: document.document_type,
            title: document.title,
            language: document.language,
            version: document.version,
            issuedAt: new Date().toISOString(),
            isDemo: true,
            contentHash: document.content_hash,
            snapshot: document.snapshot as Record<string, unknown>,
          }),
        );
        const contentHash = createHash("sha256").update(bytes).digest("hex");
        const { error: uploadError } = await this.client.storage
          .from("official-documents")
          .upload(storagePath, bytes, {
            contentType: "application/pdf",
            cacheControl: "3600",
            upsert: false,
          });
        if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) {
          throw uploadError;
        }

        const { error: completeError } = await this.client.rpc(
          "complete_official_document",
          {
            p_document_id: document.id,
            p_storage_path: storagePath,
            p_content_hash: contentHash,
            p_succeeded: true,
            p_error: null,
          },
        );
        if (completeError) throw completeError;
        published += 1;
      } catch (caughtError) {
        await this.client.storage.from("official-documents").remove([storagePath]);
        await this.client.rpc("complete_official_document", {
          p_document_id: document.id,
          p_storage_path: null,
          p_content_hash: null,
          p_succeeded: false,
          p_error:
            caughtError instanceof Error
              ? caughtError.message.slice(0, 1000)
              : "Échec de publication du document démo.",
        });
        throw caughtError;
      }
    }

    return published;
  }
}

async function main(): Promise<void> {
  const config = buildDemoProvisioningConfig(process.argv.slice(2), process.env);
  console.log(JSON.stringify(safeDemoProvisioningSummary(config), null, 2));

  if (config.dryRun) {
    console.log(
      "Validation locale des paramètres terminée : aucune connexion à Supabase et aucune modification.",
    );
    return;
  }

  const client = createClient(config.supabaseUrl, config.secretKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const gateway = new SupabaseDemoGateway(client, config.target);
  const result = await provisionDemoAccounts(gateway, config);
  const publishedDemoDocuments = await gateway.publishPendingDemoDocuments();

  console.log(
    JSON.stringify(
      {
        status: "provisioned-and-verified",
        createdUsers: result.createdUsers,
        updatedUsers: result.updatedUsers,
        publishedDemoDocuments,
        verification: result.verification,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Erreur de provisionnement inconnue.";
  console.error(`Provisionnement interrompu : ${message}`);
  process.exitCode = 1;
});
