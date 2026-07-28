import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const migrationsRoot = path.join(repositoryRoot, "supabase", "migrations");
const snapshotPath = path.join(repositoryRoot, "supabase", "schema.sql");

function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

async function expectedMigrationManifest(): Promise<string> {
  const migrations = (await readdir(migrationsRoot))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
  const entries = await Promise.all(
    migrations.map(async (fileName) => {
      const content = await readFile(path.join(migrationsRoot, fileName));
      return `${fileName}:${sha256(content)}`;
    }),
  );

  return sha256(entries.join("\n"));
}

test("le snapshot SQL correspond exactement aux migrations versionnées", async () => {
  const snapshot = await readFile(snapshotPath, "utf8");
  const manifestMatch = snapshot.match(
    /^-- migration-manifest-sha256: ([a-f0-9]{64})$/m,
  );

  assert.ok(
    manifestMatch,
    "Le snapshot ne contient pas de manifeste de migrations valide.",
  );
  assert.equal(manifestMatch[1], await expectedMigrationManifest());
  assert.match(snapshot, /^-- schema-only: true$/m);
  assert.match(snapshot, /^-- production-data-included: false$/m);
  assert.doesNotMatch(snapshot, /^COPY\s+/m);
  assert.doesNotMatch(snapshot, /^INSERT INTO\s+/m);
});

test("le snapshot contient le cœur du schéma KALY", async () => {
  const snapshot = await readFile(snapshotPath, "utf8");

  assert.match(snapshot, /CREATE TABLE IF NOT EXISTS "public"\."profiles"/i);
  assert.match(
    snapshot,
    /CREATE TABLE IF NOT EXISTS "public"\."transfer_intents"/i,
  );
  assert.match(
    snapshot,
    /CREATE TABLE IF NOT EXISTS "public"\."loan_applications"/i,
  );
  assert.match(
    snapshot,
    /CREATE(?: OR REPLACE)? FUNCTION "private"\."is_active_staff"/i,
  );
  assert.match(snapshot, /ENABLE ROW LEVEL SECURITY/i);
});
