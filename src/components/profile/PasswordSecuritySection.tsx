import { useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { FormInput } from "../ui/form-input";
import {
  getPasswordErrorMessage,
  isReauthenticationRequired,
  PASSWORD_REQUIREMENTS_MESSAGE,
  requestPasswordReauthentication,
  updateAccountPassword,
  validatePassword,
} from "../../services/passwordService";
import posthog from "posthog-js";

export function PasswordSecuritySection() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [nonce, setNonce] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [needsNonce, setNeedsNonce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonceError, setNonceError] = useState<string | null>(null);

  const resetForm = () => {
    setPassword("");
    setConfirmation("");
    setNonce("");
    setNeedsNonce(false);
    setError(null);
    setNonceError(null);
  };

  const sendVerificationCode = async () => {
    setSendingCode(true);
    setError(null);
    setNonceError(null);
    try {
      const { error: reauthError } = await requestPasswordReauthentication();
      if (reauthError) throw reauthError;
      setNeedsNonce(true);
      posthog.capture("profile_password_reauthentication_requested");
      toast.success("We sent a verification code to your email.");
    } catch (reauthError: unknown) {
      setError(getPasswordErrorMessage(reauthError));
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validatePassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      setNonceError(null);
      return;
    }
    if (needsNonce && nonce.trim().length === 0) {
      setNonceError("Enter the verification code sent to your email.");
      return;
    }

    setSaving(true);
    setError(null);
    setNonceError(null);
    posthog.capture("profile_password_update_started", {
      verification_required: needsNonce,
    });

    try {
      const { error: updateError } = await updateAccountPassword(
        password,
        needsNonce ? nonce.trim() : undefined,
      );
      if (updateError) {
        if (isReauthenticationRequired(updateError) && !needsNonce) {
          await sendVerificationCode();
          return;
        }
        throw updateError;
      }

      resetForm();
      posthog.capture("profile_password_update_completed");
      toast.success("Password updated. We sent a confirmation email to your account.");
    } catch (updateError: unknown) {
      const message = getPasswordErrorMessage(updateError);
      if (needsNonce) {
        setNonceError(message);
      } else {
        setError(message);
      }
      posthog.capture("profile_password_update_failed", {
        error_code:
          updateError && typeof updateError === "object" && "code" in updateError
            ? String((updateError as { code?: unknown }).code || "unknown")
            : "unknown",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-low border border-border p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-deckly-primary/10 text-deckly-primary flex items-center justify-center shrink-0">
            <KeyRound size={18} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-ui-text">Change password</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              {PASSWORD_REQUIREMENTS_MESSAGE} For older sessions, we&apos;ll verify the change with a code sent to your email.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
        <FormInput
          id="profile-new-password"
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
          id="profile-confirm-password"
          label="Confirm new password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          icon={Lock}
          required
          error={error}
        />

        {needsNonce && (
          <div className="border border-deckly-primary/20 bg-deckly-primary/5 p-4 space-y-4">
            <div className="flex gap-3">
              <Mail className="text-deckly-primary shrink-0" size={18} />
              <p className="text-xs leading-relaxed text-ui-muted">
                Enter the verification code we sent to your email before changing your password.
              </p>
            </div>
            <FormInput
              id="profile-password-nonce"
              label="Verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={nonce}
              onChange={(event) => {
                setNonce(event.target.value.replace(/\s/g, ""));
                setNonceError(null);
              }}
              error={nonceError}
              required
            />
            <button
              type="button"
              onClick={() => void sendVerificationCode()}
              disabled={sendingCode}
              className="text-xs font-semibold text-deckly-primary hover:text-deckly-primary/80 disabled:opacity-50 transition-colors"
            >
              {sendingCode ? "Sending a new code…" : "Send a new code"}
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          <Button type="submit" loading={saving} disabled={saving}>
            Update password
          </Button>
          {(password || confirmation || needsNonce) && (
            <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
