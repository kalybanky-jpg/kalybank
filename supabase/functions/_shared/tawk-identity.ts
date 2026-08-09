const textEncoder = new TextEncoder();
const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IDENTITY_MARKER =
  /\[mz1:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([0-9a-f]{32})\]$/;

function validateSecret(secret: string) {
  if (secret.length < 32 || /[\r\n\u0000]/.test(secret)) {
    throw new Error("INVALID_TAWK_WEBHOOK_IDENTITY_SECRET");
  }
}

function constantTimeEqual(expected: Uint8Array, supplied: Uint8Array) {
  let difference = expected.length ^ supplied.length;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected[index] ^ (supplied[index] ?? 0);
  }
  return difference === 0;
}

async function identityMac(userId: string, secret: string) {
  if (!CANONICAL_UUID.test(userId)) throw new Error("INVALID_TAWK_USER_ID");
  validateSecret(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      textEncoder.encode(`mz1:${userId}`),
    ),
  );
}

export async function computeTawkIdentityTag(userId: string, secret: string) {
  const mac = await identityMac(userId, secret);
  return Array.from(
    mac.subarray(0, 16),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function verifyTawkIdentityMarker(
  visitorName: unknown,
  secret: string,
) {
  validateSecret(secret);
  if (typeof visitorName !== "string" || visitorName.length > 500) return null;
  const match = IDENTITY_MARKER.exec(visitorName);
  if (!match) return null;

  const userId = match[1];
  const suppliedMac = new Uint8Array(16);
  for (let index = 0; index < suppliedMac.length; index += 1) {
    suppliedMac[index] = Number.parseInt(
      match[2].slice(index * 2, index * 2 + 2),
      16,
    );
  }
  const expectedMac = (await identityMac(userId, secret)).subarray(0, 16);
  return constantTimeEqual(expectedMac, suppliedMac) ? userId : null;
}
