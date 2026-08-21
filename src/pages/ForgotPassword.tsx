import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Button } from "../components/ui/button";
import { FormInput } from "../components/ui/form-input";
import { toast } from "sonner";
import posthog from "posthog-js";
import {
  getPasswordErrorMessage,
  requestPasswordResetEmail,
} from "../services/passwordService";
import { getPrefilledPasswordResetEmail } from "../utils/passwordResetNavigation";
import { useTheme } from "../contexts/ThemeContext";

const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPassword() {
  const { theme } = useTheme();
  const location = useLocation();
  const captchaSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const captchaRequired = import.meta.env.PROD;
  const captchaConfigError =
    captchaRequired && !captchaSiteKey
      ? "CAPTCHA is required to request a password reset, but the Turnstile site key is missing."
      : null;
  const [email, setEmail] = useState(() =>
    getPrefilledPasswordResetEmail(location.state),
  );
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  useEffect(() => {
    document.title = "Reset Password | Deckly";
    posthog.capture("password_reset_requested_viewed");
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const sendResetEmail = async () => {
    if (captchaConfigError) {
      setError(captchaConfigError);
      toast.error(captchaConfigError);
      return;
    }
    if (captchaRequired && !captchaToken) {
      const message = "Please complete the CAPTCHA to continue.";
      setError(message);
      toast.error(message);
      return;
    }

    setSending(true);
    setError(null);
    try {
      const { error: requestError } = await requestPasswordResetEmail(
        email,
        captchaToken || undefined,
      );
      if (requestError) throw requestError;

      setSubmitted(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      posthog.capture("password_reset_email_requested");
      toast.success("Check your email for password reset instructions.");
    } catch (requestError: unknown) {
      const message = getPasswordErrorMessage(requestError);
      setError(message);
      posthog.capture("password_reset_email_failed", {
        error_code:
          requestError && typeof requestError === "object" && "code" in requestError
            ? String((requestError as { code?: unknown }).code || "unknown")
            : "unknown",
      });
      toast.error(message);
    } finally {
      setSending(false);
      setCaptchaToken(null);
      turnstileRef.current?.reset();
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendResetEmail();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-ui-canvas p-6 text-ui-text">
      <section className="w-full max-w-md space-y-6 rounded-card border border-ui-border bg-ui-surface p-6 shadow-surface md:p-8">
        <div className="space-y-2">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-xs font-semibold text-ui-muted transition-colors hover:text-ui-primary"
          >
            <ArrowLeft size={14} /> Back to sign in
          </Link>
          <h1 className="text-2xl font-bold text-ui-text">Reset your password</h1>
          <p className="text-sm text-ui-muted leading-relaxed">
            Enter your email and we&apos;ll send instructions to reset your password.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-5">
            <div className="flex gap-3 rounded-sm border border-ui-primary/30 bg-ui-primary/10 p-4">
              <CheckCircle2 className="shrink-0 text-ui-primary" size={20} />
              <p className="text-sm text-ui-text leading-relaxed">
                If an account exists for this email, password reset instructions are on their way.
              </p>
            </div>
            <Button
              type="button"
              fullWidth
              variant="secondary"
              disabled={
                cooldown > 0 ||
                sending ||
                Boolean(captchaConfigError) ||
                (captchaRequired && !captchaToken)
              }
              onClick={() => void sendResetEmail()}
            >
              {sending ? (
                <Loader2 className="animate-spin" size={16} />
              ) : cooldown > 0 ? (
                `Resend available in ${cooldown}s`
              ) : (
                "Resend instructions"
              )}
            </Button>
            {error && (
              <p className="text-sm text-deckly-accent" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormInput
              id="reset-email"
              label="Email address"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              icon={Mail}
              required
              error={error}
              placeholder="name@firm.com"
            />
            <Button
              type="submit"
              fullWidth
              loading={sending}
              disabled={
                sending ||
                Boolean(captchaConfigError) ||
                (captchaRequired && !captchaToken)
              }
            >
              Send reset instructions
            </Button>
          </form>
        )}

        {captchaSiteKey && (
          <div className="flex justify-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={captchaSiteKey}
              onSuccess={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
              options={{ theme }}
            />
          </div>
        )}
        {captchaConfigError && (
          <p className="text-sm text-deckly-accent" role="alert">
            {captchaConfigError}
          </p>
        )}
      </section>
    </main>
  );
}
