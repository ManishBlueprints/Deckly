import { useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from "lucide-react";
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
import { ProfileActionCard, ProfileSectionHeader } from "./ProfileSectionPrimitives";

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
    <div className="space-y-8">
      <ProfileSectionHeader
        icon={ShieldCheck}
        eyebrow="Account security"
        title="Protect your sign-in"
        description="Set a strong password and verify sensitive changes without leaving your workspace."
      />

      <ProfileActionCard
        icon={KeyRound}
        title="Change password"
        description={`${PASSWORD_REQUIREMENTS_MESSAGE} Older sessions may require a verification code sent to your email.`}
        tone="primary"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
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
          </div>

          {needsNonce && (
            <div className="space-y-4 rounded-[10px] border border-ui-primary/25 bg-ui-primary/5 p-4">
              <div className="flex gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-ui-primary/10 text-ui-primary">
                  <Mail size={17} />
                </div>
                <p className="pt-1 text-xs leading-relaxed text-ui-muted">
                  Enter the verification code sent to your email before changing your password.
                </p>
              </div>
              <div className="max-w-sm">
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
              </div>
              <button
                type="button"
                onClick={() => void sendVerificationCode()}
                disabled={sendingCode}
                className="text-xs font-semibold text-ui-primary transition-colors hover:brightness-90 disabled:opacity-50"
              >
                {sendingCode ? "Sending a new code…" : "Send a new code"}
              </button>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-ui-border pt-5 sm:flex-row sm:justify-end">
            {(password || confirmation || needsNonce) && (
              <Button type="button" variant="secondary" onClick={resetForm} disabled={saving} className="rounded-[8px] text-sm font-semibold normal-case tracking-normal">
                Cancel
              </Button>
            )}
            <Button type="submit" loading={saving} disabled={saving} className="rounded-[8px] text-sm font-semibold normal-case tracking-normal">
              Update password
            </Button>
          </div>
        </form>
      </ProfileActionCard>
    </div>
  );
}
