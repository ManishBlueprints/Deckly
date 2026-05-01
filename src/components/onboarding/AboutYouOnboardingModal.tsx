import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { useTourState } from "../../contexts/TourContext";
import { userService } from "../../services/userService";
import { UserProfile } from "../../types";
import { cn } from "../../utils/cn";

const ONBOARDING_ROLE_OPTIONS = [
  "Founder",
  "Sales",
  "Investor",
  "Consultant",
  "Operator",
  "Other",
];

const ONBOARDING_TEAM_OPTIONS = [
  "Solo",
  "2-10",
  "11-50",
  "51-200",
  "200+",
];

const ONBOARDING_USE_CASE_OPTIONS = [
  "Fundraising",
  "Sales",
  "Internal sharing",
  "Due diligence",
  "Investor updates",
  "Other",
];

interface AboutYouOnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onClose?: () => void;
}

export function AboutYouOnboardingModal({
  isOpen,
  onComplete,
  onClose,
}: AboutYouOnboardingModalProps) {
  const { profile, session, refreshProfile } = useAuth();
  const { markTourComplete } = useTourState();

  const initialUsername = useMemo(
    () =>
      profile?.full_name?.trim() ||
      session?.user?.email?.split("@")[0] ||
      "",
    [profile?.full_name, session?.user?.email],
  );

  const [username, setUsername] = useState(initialUsername);
  const [role, setRole] = useState(profile?.onboarding_profile?.role || "");
  const [companySize, setCompanySize] = useState(
    profile?.onboarding_profile?.company_size || "",
  );
  const [primaryUseCase, setPrimaryUseCase] = useState(
    profile?.onboarding_profile?.primary_use_case || "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsUsername = !(profile?.full_name?.trim() || "").length;
  const canDismiss = !needsUsername;

  useEffect(() => {
    setUsername(initialUsername);
    setRole(profile?.onboarding_profile?.role || "");
    setCompanySize(profile?.onboarding_profile?.company_size || "");
    setPrimaryUseCase(profile?.onboarding_profile?.primary_use_case || "");
  }, [
    initialUsername,
    profile?.onboarding_profile?.company_size,
    profile?.onboarding_profile?.primary_use_case,
    profile?.onboarding_profile?.role,
  ]);

  const handleComplete = async () => {
    if (!profile?.id) return;

    const nextName = username.trim();
    if (needsUsername && !nextName) {
      setError("Please set your username to continue.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updates: Partial<UserProfile> = {
        onboarding_profile: {
          role: role || null,
          company_size: companySize || null,
          primary_use_case: primaryUseCase || null,
        },
      };

      if (nextName && nextName !== profile.full_name) {
        updates.full_name = nextName;
      }

      await userService.updateProfile(profile.id, updates);
      await markTourComplete("profile_onboarding_completed");
      await markTourComplete("onboarding_completed");
      await refreshProfile();
      onComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to save onboarding details.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (!canDismiss || !profile?.id) return;

    setSaving(true);
    setError(null);
    try {
      await markTourComplete("profile_onboarding_completed");
      await markTourComplete("onboarding_completed");
      await refreshProfile();
      onComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to finish onboarding.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={canDismiss ? onClose : undefined}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-4xl bg-surface-lowest border border-border overflow-hidden shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)]"
          >
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-surface-low">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
                  About You
                </p>
                <h2 className="text-lg font-bold text-white">
                  Help us personalize your workspace
                </h2>
              </div>
              {canDismiss && onClose && (
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  disabled={saving}
                >
                  <X size={20} />
                </button>
              )}
            </div>

            <div className="p-4 md:p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="bg-deckly-primary/10 border border-deckly-primary/20 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-deckly-primary">
                  Optional. Helps us tailor analytics and product guidance.
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  {needsUsername
                    ? "We couldn't auto-pick a username from signup, so please set one before continuing."
                    : "If you'd rather skip the optional fields, you can do that now and edit them later."}
                </p>
              </div>

              <div className="space-y-3">
                <label htmlFor="onboarding-username" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Username
                </label>
                <input
                  id="onboarding-username"
                  name="onboarding-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 bg-surface-lowest border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-deckly-primary/30 focus:border-deckly-primary transition-all",
                    needsUsername ? "border-deckly-primary/30" : "border-border",
                  )}
                  placeholder="Enter your display name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label htmlFor="onboarding-role" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Role / Profession
                  </label>
                  <select
                    id="onboarding-role"
                    name="onboarding-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-lowest border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-deckly-primary/30 focus:border-deckly-primary transition-all"
                  >
                    <option value="">Select role</option>
                    {ONBOARDING_ROLE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="onboarding-team-size" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Team Size
                  </label>
                  <select
                    id="onboarding-team-size"
                    name="onboarding-team-size"
                    value={companySize}
                    onChange={(e) => setCompanySize(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-lowest border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-deckly-primary/30 focus:border-deckly-primary transition-all"
                  >
                    <option value="">Select size</option>
                    {ONBOARDING_TEAM_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="onboarding-primary-use-case" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Primary Use Case
                  </label>
                  <select
                    id="onboarding-primary-use-case"
                    name="onboarding-primary-use-case"
                    value={primaryUseCase}
                    onChange={(e) => setPrimaryUseCase(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-lowest border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-deckly-primary/30 focus:border-deckly-primary transition-all"
                  >
                    <option value="">Select use case</option>
                    {ONBOARDING_USE_CASE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleComplete}
                  disabled={saving || (needsUsername && !username.trim())}
                  className="flex-1 py-3 bg-deckly-primary text-slate-950 font-bold uppercase tracking-[0.2em] text-[10px] hover:brightness-110 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      Save Details <Check size={14} />
                    </>
                  )}
                </button>
                {canDismiss && (
                  <button
                    onClick={handleSkip}
                    disabled={saving}
                    className="flex-1 py-3 bg-transparent hover:bg-white/5 text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px] border border-border transition-all disabled:opacity-50"
                  >
                    Skip for now
                  </button>
                )}
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-[10px] font-bold uppercase tracking-widest text-destructive text-center">
                  {error}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
