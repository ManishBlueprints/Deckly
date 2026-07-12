import posthog from "posthog-js";

export type OAuthSignupMethod = "google" | "github";

const PENDING_OAUTH_SIGNUP_KEY = "deckly.pending_oauth_signup";
const PENDING_OAUTH_SIGNUP_MAX_AGE_MS = 15 * 60 * 1000;

interface PendingOAuthSignup {
  method: OAuthSignupMethod;
  startedAt: number;
}

export const markPendingOAuthSignup = (method: OAuthSignupMethod) => {
  try {
    const pendingSignup: PendingOAuthSignup = {
      method,
      startedAt: Date.now(),
    };
    window.sessionStorage.setItem(
      PENDING_OAUTH_SIGNUP_KEY,
      JSON.stringify(pendingSignup),
    );
  } catch {
    // Analytics must never prevent an OAuth signup from starting.
  }
};

export const clearPendingOAuthSignup = () => {
  try {
    window.sessionStorage.removeItem(PENDING_OAUTH_SIGNUP_KEY);
  } catch {
    // Ignore storage failures; analytics must remain non-blocking.
  }
};

/**
 * Consumes a signup intent once, preventing duplicate completion events after
 * Supabase emits more than one auth-state notification during OAuth hydration.
 */
export const consumePendingOAuthSignup = (): OAuthSignupMethod | null => {
  try {
    const rawValue = window.sessionStorage.getItem(PENDING_OAUTH_SIGNUP_KEY);
    if (!rawValue) return null;

    window.sessionStorage.removeItem(PENDING_OAUTH_SIGNUP_KEY);

    const pendingSignup = JSON.parse(rawValue) as Partial<PendingOAuthSignup>;
    const isValidMethod =
      pendingSignup.method === "google" || pendingSignup.method === "github";
    const isRecent =
      typeof pendingSignup.startedAt === "number" &&
      Date.now() - pendingSignup.startedAt <= PENDING_OAUTH_SIGNUP_MAX_AGE_MS;

    return isValidMethod && isRecent
      ? (pendingSignup.method as OAuthSignupMethod)
      : null;
  } catch {
    clearPendingOAuthSignup();
    return null;
  }
};

export const captureSignupCompleted = (
  user: { id: string; email?: string | null },
  method: "email" | OAuthSignupMethod,
) => {
  posthog.identify(user.id, { email: user.email });
  posthog.capture("user_signup_completed", { method });
};
