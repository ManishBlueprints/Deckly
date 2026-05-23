const encoder = new TextEncoder();

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const deriveGuestQuotaKey = async (
  value: string,
  secret: string,
): Promise<string> => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Guest usage identity cannot be empty.");
  }

  const normalizedSecret = secret.trim();
  if (!normalizedSecret) {
    throw new Error("Guest quota secret cannot be empty.");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(normalizedSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(normalized));
  return toHex(new Uint8Array(signature));
};
