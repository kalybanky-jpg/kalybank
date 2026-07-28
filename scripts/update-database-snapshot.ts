import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_REF = "qljqldhvbakornnpalua";

function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

async function migrationManifest(repositoryRoot: string): Promise<{
  hash: string;
  migrations: string[];
}> {
  const migrationsRoot = path.join(repositoryRoot, "supabase", "migrations");
  const migrations = (await readdir(migrationsRoot))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  if (migrations.length === 0) {
    throw new Error("Aucune migration SQL n’est disponible pour le snapshot.");
  }

  const entries = await Promise.all(
    migrations.map(async (fileName) => {
      const content = await readFile(path.join(migrationsRoot, fileName));
      return `${fileName}:${sha256(content)}`;
    }),
  );

  return {
    hash: sha256(entries.join("\n")),
    migrations,
  };
}

function supabaseExecutable(repositoryRoot: string): string {
  const executableName =
    process.platform === "win32" ? "supabase.exe" : "supabase";
  return path.join(repositoryRoot, "node_modules", ".bin", executableName);
}

async function updateSnapshot(): Promise<void> {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "kaly-schema-snapshot-"),
  );
  const rawDumpPath = path.join(temporaryRoot, "schema.sql");
  const snapshotPath = path.join(repositoryRoot, "supabase", "schema.sql");
  const manifest = await migrationManifest(repositoryRoot);

  try {
    const result = spawnSync(
      supabaseExecutable(repositoryRoot),
      [
        "db",
        "dump",
        "--local",
        "--schema",
        "public,private",
        "--file",
        rawDumpPath,
      ],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: "inherit",
      },
    );

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      throw new Error(
        `supabase db dump a échoué avec le code ${result.status ?? "inconnu"}.`,
      );
    }

    const rawDump = (await readFile(rawDumpPath, "utf8"))
      .replace(/\r\n/g, "\n")
      .trimEnd();
    const header = [
      "-- KALY DATABASE SCHEMA SNAPSHOT",
      "-- GENERATED FILE: run `npx bun run db:snapshot`; do not edit manually.",
      `-- remote-project-ref: ${PROJECT_REF}`,
      `-- migration-manifest-sha256: ${manifest.hash}`,
      `-- migrations: ${manifest.migrations.join(", ")}`,
      "-- schema-only: true",
      "-- production-data-included: false",
      "-- schemas: public, private",
      "",
    ].join("\n");

    await writeFile(snapshotPath, `${header}${rawDump}\n`, "utf8");
    console.log(
      `Snapshot structurel mis à jour : ${path.relative(
        repositoryRoot,
        snapshotPath,
      )}`,
    );
  } finally {
    const resolvedTemporaryRoot = path.resolve(temporaryRoot);
    const resolvedOsTemporaryRoot = path.resolve(os.tmpdir());

    if (
      resolvedTemporaryRoot.startsWith(
        `${resolvedOsTemporaryRoot}${path.sep}`,
      ) &&
      path.basename(resolvedTemporaryRoot).startsWith("kaly-schema-snapshot-")
    ) {
      await rm(resolvedTemporaryRoot, { recursive: true, force: true });
    }
  }
}

updateSnapshot().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Erreur de snapshot inconnue.";
  console.error(`Snapshot interrompu : ${message}`);
  process.exitCode = 1;
});
