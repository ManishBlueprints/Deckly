export interface SignupNavigationState {
  prefilledEmail: string;
  source: "login_invalid_credentials";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export function createSignupNavigationState(email: string): SignupNavigationState {
  return {
    prefilledEmail: email.trim(),
    source: "login_invalid_credentials",
  };
}

/**
 * Route state is client-controlled, so only accept a short, valid email from
 * the explicit login handoff. Invalid or direct navigation starts blank.
 */
export function getPrefilledSignupEmail(state: unknown): string {
  if (!state || typeof state !== "object") return "";

  const { prefilledEmail, source } = state as Partial<SignupNavigationState>;
  if (source !== "login_invalid_credentials" || typeof prefilledEmail !== "string") {
    return "";
  }

  const email = prefilledEmail.trim();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email) ? email : "";
}
