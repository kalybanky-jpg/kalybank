import {
  computeTawkIdentityTag,
  verifyTawkIdentityMarker,
} from "./tawk-identity.ts";

const secret = "test-webhook-identity-secret-32-chars";
const userId = "550e8400-e29b-41d4-a716-446655440000";
const expectedTag = "6587a8709b1386f458b21af9caab242d";

Deno.test("tawk identity marker matches the shared Next.js vector", async () => {
  const tag = await computeTawkIdentityTag(userId, secret);
  if (tag !== expectedTag) {
    throw new Error(`unexpected tag: ${tag}`);
  }
  const resolved = await verifyTawkIdentityMarker(
    `Monalyz user [mz1:${userId}:${tag}]`,
    secret,
  );
  if (resolved !== userId) throw new Error("marker did not resolve");
});

Deno.test("tawk identity marker rejects tampering and non-suffix data", async () => {
  const invalidTag = `${expectedTag.slice(0, -1)}0`;
  const tampered = await verifyTawkIdentityMarker(
    `Monalyz user [mz1:${userId}:${invalidTag}]`,
    secret,
  );
  const nonSuffix = await verifyTawkIdentityMarker(
    `Monalyz user [mz1:${userId}:${expectedTag}] trailing`,
    secret,
  );
  if (tampered !== null || nonSuffix !== null) {
    throw new Error("invalid marker was accepted");
  }
});

Deno.test("tawk identity marker rejects an unsafe short secret", async () => {
  let rejected = false;
  try {
    await computeTawkIdentityTag(userId, "short\nsecret");
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("unsafe identity secret was accepted");
});
