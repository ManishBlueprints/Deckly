import { supabase } from "./supabase";

export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Use at least 8 characters with uppercase, lowercase, a number, and a symbol.";

type AuthErrorLike = {
  code?: unknown;
  message?: unknown;
};

function getErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const code = (error as AuthErrorLike).code;
  return typeof code === "string" ? code.toLowerCase() : "";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const message = (error as AuthErrorLike).message;
    if (typeof message === "string") return message;
  }
  return String(error);
}

export function validatePassword(
  password: string,
  confirmation: string,
): string | null {
  if (password !== confirmation) return "Passwords do not match.";
  if (password.length < 8) return PASSWORD_REQUIREMENTS_MESSAGE;
  if (!/[a-z]/.test(password)) return PASSWORD_REQUIREMENTS_MESSAGE;
  if (!/[A-Z]/.test(password)) return PASSWORD_REQUIREMENTS_MESSAGE;
  if (!/\d/.test(password)) return PASSWORD_REQUIREMENTS_MESSAGE;
  if (!/[^A-Za-z0-9\s]/.test(password)) return PASSWORD_REQUIREMENTS_MESSAGE;
  return null;
}

export function isReauthenticationRequired(error: unknown): boolean {
  return getErrorCode(error) === "reauthentication_needed";
}

export function getPasswordErrorMessage(error: unknown): string {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

  if (code === "weak_password" || normalized.includes("password should")) {
    return PASSWORD_REQUIREMENTS_MESSAGE;
  }
  if (code === "reauthentication_not_valid") {
    return "That verification code is incorrect or expired. Please request a new one.";
  }
  if (code.includes("rate_limit") || normalized.includes("rate limit")) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (normalized.includes("captcha") || normalized.includes("turnstile")) {
    return "CAPTCHA verification failed. Please complete the challenge and try again.";
  }
  return message || "We couldn't complete that password request. Please try again.";
}

export function isEmailPasswordSession(user: {
  app_metadata?: { provider?: unknown } | null;
} | null | undefined): boolean {
  return user?.app_metadata?.provider === "email";
}

/**
 * Password recovery must return to the same application origin that requested
 * it. This supports local development and preview deployments; each origin
 * must still be explicitly allowed in Supabase Auth URL Configuration.
 */
export function getPasswordResetRedirectUrl(origin = window.location.origin): string {
  return new URL("/reset-password", origin).toString();
}

export async function requestPasswordResetEmail(
  email: string,
  captchaToken?: string,
) {
  return supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: getPasswordResetRedirectUrl(),
    captchaToken: captchaToken || undefined,
  });
}

export async function updateAccountPassword(password: string, nonce?: string) {
  return supabase.auth.updateUser({
    password,
    ...(nonce ? { nonce } : {}),
  });
}

export async function requestPasswordReauthentication() {
  return supabase.auth.reauthenticate();
}
