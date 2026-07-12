export const PASSWORD_RECOVERY_MARKER_TTL_MS = 60 * 60 * 1000;

interface PasswordRecoveryMarker {
  startedAt: number;
}

export function createPasswordRecoveryMarker(now = Date.now()): string {
  return JSON.stringify({ startedAt: now } satisfies PasswordRecoveryMarker);
}

export function isPasswordRecoveryMarkerActive(
  value: string | null,
  now = Date.now(),
): boolean {
  if (!value) return false;

  try {
    const marker = JSON.parse(value) as Partial<PasswordRecoveryMarker>;
    return typeof marker.startedAt === "number"
      && Number.isFinite(marker.startedAt)
      && marker.startedAt <= now
      && now - marker.startedAt <= PASSWORD_RECOVERY_MARKER_TTL_MS;
  } catch {
    return false;
  }
}
