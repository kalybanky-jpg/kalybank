import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

function loadEnv(filePath: string) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnv(".env.local");
loadEnv(".env");

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qljqldhvbakornnpalua.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

if (!serviceRoleKey) {
  console.error("Erreur: SUPABASE_SECRET_KEY manquant dans .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const args = process.argv.slice(2);
  const emailArg = args.find((a) => a.startsWith("--email="))?.split("=")[1];
  const passwordArg = args.find((a) => a.startsWith("--password="))?.split("=")[1];
  const nameArg = args.find((a) => a.startsWith("--name="))?.split("=")[1];

  const email = emailArg || "test.nokyc@monalyz.com";
  const password = passwordArg || "MonalyzTest2026!#NoKyc";
  const displayName = nameArg || "Test Utilisateur Sans KYC";

  console.log(`[1/4] Vérification de l'utilisateur ${email}...`);

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Erreur listUsers: ${listError.message}`);
  }

  let user = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (user) {
    console.log(`Utilisateur existant trouvé (${user.id}). Réinitialisation du mot de passe et confirmation...`);
    const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        preferred_language: "fr",
        base_currency: "EUR",
        preferred_currency: "EUR",
      },
    });
    if (updateError || !updated.user) {
      throw new Error(`Erreur mise à jour utilisateur: ${updateError?.message}`);
    }
    user = updated.user;
  } else {
    console.log(`[2/4] Création du compte dans Supabase Auth...`);
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        preferred_language: "fr",
        base_currency: "EUR",
        preferred_currency: "EUR",
      },
      app_metadata: {
        monalyz_test: true,
      },
    });
    if (createError || !created.user) {
      throw new Error(`Erreur création utilisateur: ${createError?.message}`);
    }
    user = created.user;
    console.log(`Compte créé avec succès (${user.id}).`);
  }

  console.log(`[3/4] Vérification du profil et purge des KYC...`);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, email, display_name, access_status, preferred_currency, base_currency")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.warn(`Avertissement profil: ${profileError.message}`);
  } else if (profile) {
    console.log(`Profil vérifié: ${profile.display_name} (${profile.email}), statut: ${profile.access_status}`);
  } else {
    console.warn(`Aucun profil trouvé pour ${user.id}.`);
  }

  // Delete any existing KYC applications to ensure user has NO validated KYC
  const { data: deletedKyc, error: deleteKycError } = await supabase
    .from("kyc_applications")
    .delete()
    .eq("owner_id", user.id)
    .select("id");

  if (deleteKycError) {
    console.warn(`Avertissement suppression KYC: ${deleteKycError.message}`);
  } else if (deletedKyc && deletedKyc.length > 0) {
    console.log(`${deletedKyc.length} dossier(s) KYC existant(s) supprimé(s).`);
  }

  // Also clean up kyc_drafts so they start with a clean slate
  const { error: deleteDraftError } = await supabase
    .from("kyc_drafts")
    .delete()
    .eq("owner_id", user.id);

  if (deleteDraftError) {
    console.warn(`Avertissement suppression brouillon KYC: ${deleteDraftError.message}`);
  }

  console.log(`[4/4] Test de connexion en mode client...`);
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_LTBlNfQ7Fptk1vwutv6ANw_GZwcr29Q";
  const clientSupabase = createClient(supabaseUrl, anonKey);
  const { data: signInData, error: signInError } =
    await clientSupabase.auth.signInWithPassword({
      email,
      password,
    });

  if (signInError) {
    throw new Error(`Échec de la connexion client : ${signInError.message}`);
  }
  console.log(`Connexion client réussie pour ${signInData.user.email} !`);

  // Verify KYC applications count
  const { data: clientKycs, error: clientKycError } = await clientSupabase
    .from("kyc_applications")
    .select("id, status");

  if (clientKycError) {
    console.warn(`Vérification KYC client: ${clientKycError.message}`);
  } else {
    console.log(`Dossiers KYC visibles pour ce client : ${clientKycs?.length ?? 0}`);
  }

  console.log(`\n=============================================`);
  console.log(`UTILISATEUR TEST PRÊT :`);
  console.log(`E-mail        : ${email}`);
  console.log(`Mot de passe  : ${password}`);
  console.log(`Nom affiché   : ${displayName}`);
  console.log(`Statut KYC    : NON VALIDÉ (0 dossier approuvé)`);
  console.log(`Redirection   : /onboarding (dès la connexion)`);
  console.log(`URL locale    : http://localhost:3000/login`);
  console.log(`=============================================`);
}

main().catch((err) => {
  console.error("Erreur d'exécution :", err);
  process.exit(1);
});
