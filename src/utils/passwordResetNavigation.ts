export interface PasswordResetNavigationState {
  prefilledEmail: string;
  source: "login_forgot_password";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export function createPasswordResetNavigationState(
  email: string,
): PasswordResetNavigationState {
  return {
    prefilledEmail: email.trim(),
    source: "login_forgot_password",
  };
}

export function getPrefilledPasswordResetEmail(state: unknown): string {
  if (!state || typeof state !== "object") return "";

  const { prefilledEmail, source } = state as Partial<PasswordResetNavigationState>;
  if (source !== "login_forgot_password" || typeof prefilledEmail !== "string") {
    return "";
  }

  const email = prefilledEmail.trim();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email) ? email : "";
}
