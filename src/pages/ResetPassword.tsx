import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock } from "lucide-react";
import { Button } from "../components/ui/button";
import { FormInput } from "../components/ui/form-input";
import { useAuth } from "../contexts/AuthContext";
import {
  getPasswordErrorMessage,
  isReauthenticationRequired,
  PASSWORD_REQUIREMENTS_MESSAGE,
  updateAccountPassword,
  validatePassword,
} from "../services/passwordService";
import { toast } from "sonner";
import posthog from "posthog-js";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { session, loading, passwordRecovery, clearPasswordRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [requiresNewRecoveryLink, setRequiresNewRecoveryLink] = useState(false);

  useEffect(() => {
    document.title = "Choose a New Password | Deckly";
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validatePassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await updateAccountPassword(password);
      if (updateError) throw updateError;

      clearPasswordRecovery();
      setComplete(true);
      posthog.capture("password_reset_completed");
      toast.success("Your password has been updated.");
    } catch (updateError: unknown) {
      if (isReauthenticationRequired(updateError)) {
        clearPasswordRecovery();
        setRequiresNewRecoveryLink(true);
        setError(null);
        posthog.capture("password_reset_reauthentication_required");
        return;
      }

      const message = getPasswordErrorMessage(updateError);
      setError(message);
      posthog.capture("password_reset_failed", {
        error_code:
          updateError && typeof updateError === "object" && "code" in updateError
            ? String((updateError as { code?: unknown }).code || "unknown")
            : "unknown",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ui-canvas">
        <Loader2 className="animate-spin text-ui-primary" size={24} />
      </main>
    );
  }

  if (!session || (!passwordRecovery && !complete && !requiresNewRecoveryLink)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ui-canvas p-6 text-ui-text">
        <section className="w-full max-w-md space-y-5 rounded-card border border-ui-border bg-ui-surface p-6 text-center shadow-surface md:p-8">
          <KeyRound className="mx-auto text-ui-primary" size={28} />
          <h1 className="text-xl font-bold text-ui-text">This reset link is invalid or expired</h1>
          <p className="text-sm text-ui-muted leading-relaxed">
            Request a new password reset email and use the most recent link.
          </p>
          <Button fullWidth onClick={() => navigate("/forgot-password")}>
            Request a new link
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ui-canvas p-6 text-ui-text">
      <section className="w-full max-w-md space-y-6 rounded-card border border-ui-border bg-ui-surface p-6 shadow-surface md:p-8">
        {complete ? (
          <div className="space-y-5 text-center">
            <CheckCircle2 className="mx-auto text-ui-primary" size={32} />
            <h1 className="text-xl font-bold text-ui-text">Password updated</h1>
            <p className="text-sm text-ui-muted leading-relaxed">
              We&apos;ve sent a confirmation email to your account.
            </p>
            <Button fullWidth onClick={() => navigate("/", { replace: true })}>
              Continue to Deckly
            </Button>
          </div>
        ) : requiresNewRecoveryLink ? (
          <div className="space-y-5 text-center">
            <KeyRound className="mx-auto text-ui-primary" size={32} />
            <h1 className="text-xl font-bold text-ui-text">Request a new reset link</h1>
            <p className="text-sm text-ui-muted leading-relaxed">
              This reset session is no longer valid. Request a new link and use it right away.
            </p>
            <Button fullWidth onClick={() => navigate("/forgot-password", { replace: true })}>
              Request a new link
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-ui-text">Choose a new password</h1>
              <p className="text-sm text-ui-muted leading-relaxed">
                {PASSWORD_REQUIREMENTS_MESSAGE}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <FormInput
                id="new-password"
                label="New password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                icon={Lock}
                required
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="text-ui-muted transition-colors hover:text-ui-text"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
              <FormInput
                id="confirm-password"
                label="Confirm new password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                icon={Lock}
                required
                error={error}
              />
              <Button type="submit" fullWidth loading={saving} disabled={saving}>
                Update password
              </Button>
            </form>
          </>
        )}
        {!complete && (
          <Link to="/login" className="block text-center text-xs font-semibold text-ui-muted transition-colors hover:text-ui-primary">
            Back to sign in
          </Link>
        )}
      </section>
    </main>
  );
}
