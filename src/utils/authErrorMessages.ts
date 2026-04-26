export function getFriendlyAuthErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes("validate_signup_throttle") ||
    normalized.includes("signup_throttle") ||
    normalized.includes("hook uri") ||
    normalized.includes("before_user_created")
  ) {
    return "You're moving a bit too fast. Please wait about an hour and try again.";
  }

  if (normalized.includes("captcha") || normalized.includes("turnstile")) {
    return "CAPTCHA verification failed. Please complete the challenge and try again.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "Email or password is incorrect. Please check your details and try again.";
  }

  return rawMessage;
}
