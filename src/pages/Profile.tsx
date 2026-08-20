import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { useNavigate, useSearchParams } from "react-router-dom";
import {
  User,
  Crown,
  Users,
  Trash2,
  Upload,
  Camera,
  Loader2,
  Check,
  AlertTriangle,
  Sparkles,
  X,
  AlertCircle,
  Zap,
  CheckCircle2,
  ShieldCheck,
  ReceiptText,
  Lock,
  Clock3,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { useTourState } from "../contexts/TourContext";
import { deckService } from "../services/deckService";
import { userService } from "../services/userService";
import { normalizeSlug } from "../utils/slug";
import { TIER_CONFIG, Tier } from "../constants/tiers";
import penguinMascot from "../assets/penguine.png";
import { cn } from "../utils/cn";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getOnboardingStage, isOnboardingComplete } from "../utils/onboarding";
import { ProfileOnboardingFlow } from "../components/onboarding/ProfileOnboardingFlow";
import { PasswordSecuritySection } from "../components/profile/PasswordSecuritySection";
import { BillingSection } from "../components/profile/BillingSection";
import { UpgradeConfirmationDialog } from "../components/profile/UpgradeConfirmationDialog";
import { isEmailPasswordSession } from "../services/passwordService";
import { subscriptionService, type BillingInterval, type Subscription } from "../services/subscriptionService";
import { useSubscriptionState } from "../hooks/useSubscriptionState";
import { formatBillingAmount } from "../utils/billingPresentation";
import { analyticsFailureCode, productAnalytics, type UpgradeSource } from "../services/productAnalytics";
import { parseUpgradeSource } from "../services/upgradeAttribution";
import { usePricingCatalog, useTierFeatureAccess } from "../hooks/useTierEntitlements";
import type { PricingCatalog, PricingTier } from "../services/tierEntitlementService";

const TIER_ORDER: Record<Tier, number> = {
  FREE: 0,
  PRO: 1,
  PRO_PLUS: 2,
  RAISE: 3,
};

const PLAN_PRESENTATION: Record<Tier, { description: string }> = {
  FREE: {
    description: "Create one focused room and see how people engage.",
  },
  PRO: {
    description: "Share polished materials with more context and control.",
  },
  PRO_PLUS: {
    description: "Give your active raise a professional, trackable home.",
  },
  RAISE: {
    description: "Run high-stakes investor diligence with deeper controls.",
  },
};

function formatCount(value: number, unit: string) {
  if (value === -1) return "Unlimited";
  if (value === 0) return "0";
  return `${value} ${value === 1 ? unit : `${unit}s`}`;
}

function formatStorageBytes(value: number) {
  const gigabyte = 1024 * 1024 * 1024;
  const megabyte = 1024 * 1024;
  return value >= gigabyte ? `${value / gigabyte} GB` : `${value / megabyte} MB`;
}

function ComingSoonLabel() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-400">
      <Clock3 size={11} aria-hidden="true" />
      Coming soon
    </span>
  );
}

const FOUNDER_COMING_SOON_FEATURES = new Set([
  "white_label_domain",
  "diligence_controls",
]);

function formatPrice(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

type ProfileSection = "identity" | "security" | "tier" | "billing" | "collaboration" | "danger";

const isProfileSection = (value: string | null): value is ProfileSection =>
  value === "identity" ||
  value === "security" ||
  value === "tier" ||
  value === "billing" ||
  value === "collaboration" ||
  value === "danger";

function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const upgradeSource = parseUpgradeSource(searchParams.get("upgrade_source"));
  const queryClient = useQueryClient();
  const { profile, branding, session, signOutAllDevices, deleteAccount } = useAuth();
  const { markTourComplete } = useTourState();
  const [activeSection, setActiveSection] = useState<ProfileSection>(() => {
    const requestedSection = searchParams.get("section");
    return isProfileSection(requestedSection) ? requestedSection : "identity";
  });
  const [isFinishingOnboarding, setIsFinishingOnboarding] = useState(false);

  useEffect(() => {
    document.title = "Profile | Deckly";
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const requestedSection = searchParams.get("section");
    if (isProfileSection(requestedSection)) setActiveSection(requestedSection);
  }, [searchParams]);

  const isValidTier = (t: string | undefined | null): t is Tier =>
    ["FREE", "PRO", "PRO_PLUS", "RAISE"].includes(t as string);
  const tier: Tier = isValidTier(profile?.tier) ? profile.tier : "FREE";
  const onboardingStage = getOnboardingStage(profile, branding);
  const onboardingMode = onboardingStage !== "complete";
  const setupComplete = onboardingStage !== "workspace";
  const billing = useSubscriptionState();
  const pricingCatalog = usePricingCatalog(Boolean(session?.user));
  const tierLabel = pricingCatalog.data?.tiers.find((entry) => entry.tier === tier)?.label ?? TIER_CONFIG[tier].planLabel;

  useEffect(() => {
    if (
      isOnboardingComplete(profile, branding) &&
      profile?.id &&
      !profile?.tutorial_state?.onboarding_completed
    ) {
      markTourComplete("onboarding_completed");
    }
  }, [
    branding,
    markTourComplete,
    profile,
    profile?.id,
    profile?.tutorial_state?.onboarding_completed,
  ]);

  if (onboardingMode || isFinishingOnboarding) {
    return (
      <ProfileOnboardingFlow
        onCompletionStart={() => setIsFinishingOnboarding(true)}
        onCompletionFailed={() => setIsFinishingOnboarding(false)}
      />
    );
  }

  const canChangePassword = isEmailPasswordSession(session?.user);
  const sections: {
    id: ProfileSection;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: "identity", label: "Identity", icon: User },
    ...(canChangePassword
      ? [{ id: "security" as const, label: "Security", icon: ShieldCheck }]
      : []),
    { id: "tier", label: "Plan", icon: Crown },
    { id: "billing", label: "Billing", icon: ReceiptText },
    { id: "collaboration", label: "Team", icon: Users },
    { id: "danger", label: "Delete", icon: Trash2 },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => navigate(-1)}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-[min(96vw,1600px)] h-[95vh] md:h-[90vh] bg-surface-lowest border border-border overflow-hidden shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] flex flex-col md:flex-row"
      >
        {/* Left Sidebar */}
        <div className="w-full md:w-64 bg-surface-low border-b md:border-b-0 md:border-r border-border flex flex-col shrink-0">
          {/* User Header */}
          <div className="p-4 md:p-6 border-b border-border relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-surface-container border border-border overflow-hidden flex items-center justify-center">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground font-bold text-base md:text-lg">
                      {profile?.full_name?.charAt(0) || "U"}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-bold text-white truncate">
                    {profile?.full_name?.split(" ")[0] || "User"}
                  </p>
                  <span
                    className={cn(
                      "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border inline-block mt-0.5 md:mt-1",
                      tier === "FREE"
                        ? "bg-slate-800/50 text-slate-500 border-white/5"
                        : tier === "PRO"
                          ? "bg-amber-400 text-slate-950 border-amber-500/50"
                          : tier === "PRO_PLUS"
                            ? "bg-purple-600 text-white border-purple-500/50"
                            : "bg-amber-400 text-slate-950 border-amber-300/60",
                    )}
                  >
                    {tierLabel}
                  </span>
                </div>
              </div>

              <button
                onClick={() => navigate(-1)}
                className="md:hidden p-2 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            {profile?.handle && (
              <p className="text-[10px] text-muted-foreground truncate opacity-60 mt-2 md:mt-0">
                @{profile.handle}
              </p>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex md:flex-col overflow-x-auto md:overflow-x-visible no-scrollbar p-2 md:p-3 gap-1">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={cn(
                  "flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium transition-all group shrink-0",
                  activeSection === id
                    ? "bg-deckly-primary/10 text-deckly-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-high",
                )}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          {/* Sticky Header */}
          <div className="sticky top-0 z-40 bg-surface-lowest/80 backdrop-blur-md border-b border-border px-4 md:px-8 py-4 md:py-5 flex items-center justify-between shrink-0">
            <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
              {sections.find((s) => s.id === activeSection)?.label ||
                activeSection}
            </h2>
            <button
              onClick={() => navigate(-1)}
              className="hidden md:block p-1.5 text-slate-500 hover:text-slate-950 hover:bg-deckly-primary transition-all duration-300"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-4 md:p-8 pt-4 md:pt-6 max-w-4xl mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                {activeSection === "identity" && (
                  <IdentitySection
                    onboardingMode={onboardingMode}
                    setupComplete={setupComplete}
                    queryClient={queryClient}
                  />
                )}
                {activeSection === "tier" && <TierSection currentTier={tier} upgradeSource={upgradeSource} subscription={billing.subscription} refreshBilling={billing.refreshBilling} onManageBilling={() => setActiveSection("billing")} catalog={pricingCatalog.data} catalogLoading={pricingCatalog.isLoading} catalogError={pricingCatalog.error instanceof Error ? pricingCatalog.error.message : null} />}
                {activeSection === "billing" && <BillingSection currentTier={tier} profileId={billing.profileId} subscription={billing.subscription} subscriptionLoading={billing.subscriptionLoading} refreshBilling={billing.refreshBilling} onManagePlan={() => setActiveSection("tier")} />}
                {activeSection === "security" && canChangePassword && (
                  <PasswordSecuritySection />
                )}
                {activeSection === "collaboration" && <CollaborationSection />}
                {activeSection === "danger" && (
                  <DangerSection
                    onSignOut={signOutAllDevices}
                    onDeleteAccount={deleteAccount}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Identity Section ── */
function IdentitySection({
  onboardingMode,
  setupComplete,
  queryClient,
}: {
  onboardingMode: boolean;
  setupComplete: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const navigate = useNavigate();
  const { profile, branding, setBranding, refreshProfile } = useAuth();
  const customLogo = useTierFeatureAccess(
    profile?.tier,
    "custom_logo",
    Boolean(profile),
  );
  const { markTourComplete } = useTourState();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileHydratedRef = useRef(false);

  const [roomName, setRoomName] = useState(branding?.room_name || "");
  const [userName, setUserName] = useState(profile?.full_name || "");
  const [workspaceSlug, setWorkspaceSlug] = useState(profile?.handle || "");
  const [debouncedSlug, setDebouncedSlug] = useState(workspaceSlug);

  useEffect(() => {
    if (profileHydratedRef.current) return;
    if (
      !branding?.room_name &&
      !profile?.handle &&
      profile?.full_name === undefined
    )
      return;

    if (branding?.room_name) setRoomName(branding.room_name);
    if (profile?.full_name !== undefined) setUserName(profile.full_name || "");
    if (profile?.handle) {
      setWorkspaceSlug(profile.handle);
      setDebouncedSlug(profile.handle);
    }

    profileHydratedRef.current = true;
  }, [branding?.room_name, profile?.handle, profile?.full_name]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSlug(workspaceSlug), 500);
    return () => clearTimeout(timer);
  }, [workspaceSlug]);

  const needsCheck =
    debouncedSlug.length >= 3 && debouncedSlug !== profile?.handle;

  const { data: slugData, isFetching: isCheckingSlug } = useQuery({
    queryKey: ["handle-available", debouncedSlug],
    queryFn: () => userService.isHandleAvailable(debouncedSlug),
    enabled: needsCheck,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const isSlugAvailable = needsCheck ? slugData : null;
  const hasWorkspaceSetup =
    setupComplete ||
    Boolean(
      profile?.handle &&
      branding?.room_name &&
      branding.room_name !== "Deckly Data Room",
    );

  const currentLogo = branding?.logo_url || penguinMascot;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!customLogo.isLoading && customLogo.access.state !== "available") {
      toast.info("Custom logos are available on Founder.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image size must be less than 2MB");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const publicUrl = await deckService.uploadLogo(file);
      const updated = await deckService.updateBrandingSettings({
        logo_url: publicUrl,
      });
      setBranding(updated);
      toast.success("Logo updated successfully");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to upload image.");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleResetLogo = async () => {
    setUploading(true);
    try {
      const updated = await deckService.updateBrandingSettings({
        logo_url: null,
      });
      setBranding(updated);
      toast.success("Logo reset to default");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to reset logo.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (roomName !== branding?.room_name) {
        const updated = await deckService.updateBrandingSettings({
          room_name: roomName,
        });
        setBranding(updated);
      }

      const trimmedUserName = userName.trim();
      const updates: { full_name?: string | null; handle?: string } = {};

      if (trimmedUserName !== (profile?.full_name || "")) {
        updates.full_name = trimmedUserName || null;
      }

      if (debouncedSlug !== profile?.handle && isSlugAvailable) {
        updates.handle = debouncedSlug;
      }

      if (profile?.id && Object.keys(updates).length > 0) {
        const updatedProfile = await userService.updateProfile(
          profile.id,
          updates,
        );
        queryClient.setQueryData(["profile", profile.id], updatedProfile);
      }

      if (profile?.id) {
        if (!profile.tutorial_state?.onboarding_completed) {
          await markTourComplete("onboarding_completed");
        }
        await refreshProfile();
      }

      toast.success("Workspace settings saved");

      if (onboardingMode) {
        navigate("/", { replace: true });
        return;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to save workspace settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {onboardingMode && !hasWorkspaceSetup && (
        <div className="bg-deckly-primary/10 border border-deckly-primary/20 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-deckly-primary">
            Complete workspace setup to unlock the dashboard
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Add your workspace name and public handle here. Once saved, we will
            send you into the dashboard automatically.
          </p>
        </div>
      )}

      {/* Logo Upload */}
      <div className="bg-surface-low border border-border p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative group/mascot">
            <div className="w-24 h-24 bg-surface-lowest border border-border flex items-center justify-center p-3">
              <img
                src={currentLogo}
                alt="Mascot"
                className="w-full h-full object-contain"
              />
              {uploading && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-xs flex items-center justify-center">
                  <Loader2
                    size={20}
                    className="text-deckly-primary animate-spin"
                  />
                </div>
              )}
            </div>
            {!uploading && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!customLogo.isLoading && customLogo.access.state !== "available"}
                className="absolute -top-2 -right-2 w-8 h-8 bg-deckly-primary text-primary-foreground flex items-center justify-center hover:scale-105 active:scale-95 transition-all border-4 border-surface-low shadow-lg"
                title={customLogo.access.state === "available" ? "Upload new logo" : "Custom logos are available on Founder"}
              >
                <Camera size={14} />
              </button>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <h3 className="text-sm font-bold text-white">Brand Mascot</h3>
            <p className="text-xs text-slate-500">
              {customLogo.isLoading || customLogo.access.state === "available"
                ? "Appears in the sidebar and shared deck pages. PNGs work best. Max 2MB."
                : "Custom logos are available on Founder. Your existing logo remains visible."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || (!customLogo.isLoading && customLogo.access.state !== "available")}
                className="flex items-center gap-2 px-4 py-2 bg-surface-container hover:bg-surface-high text-foreground text-[10px] font-bold uppercase tracking-widest border border-border transition-all disabled:opacity-50"
              >
                <Upload size={12} className="text-deckly-primary" />
                Upload
              </button>
              {branding?.logo_url && (
                <button
                  onClick={handleResetLogo}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 transition-all disabled:opacity-50 text-[10px] font-bold uppercase tracking-widest"
                >
                  <Trash2 size={12} />
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
        <input
          id="profile-logo-upload"
          name="profile-logo-upload"
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />
      </div>

      {/* Workspace Name & Slug */}
      <div className="bg-surface-low border border-border p-6 space-y-6">
        <div>
          <label
            htmlFor="tour-workspace-name"
            className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3"
          >
            Workspace Name
          </label>
          <input
            id="tour-workspace-name"
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="w-full px-4 py-3 bg-surface-lowest border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-deckly-primary/30 focus:border-deckly-primary transition-all placeholder:text-muted-foreground/30"
            placeholder="e.g. Acme Corp"
          />
        </div>

        <div>
          <label
            htmlFor="tour-user-name"
            className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3"
          >
            User Name
          </label>
          <input
            id="tour-user-name"
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full px-4 py-3 bg-surface-lowest border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-deckly-primary/30 focus:border-deckly-primary transition-all placeholder:text-muted-foreground/30"
            placeholder="e.g. Your Name"
          />
        </div>

        <div>
          <label
            htmlFor="tour-workspace-slug"
            className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3"
          >
            Public URL Handle
          </label>
          <div className="flex items-center bg-surface-lowest border border-border overflow-hidden focus-within:ring-1 focus-within:ring-deckly-primary/30 focus-within:border-deckly-primary transition-all">
            <span className="pl-4 pr-1 text-xs text-muted-foreground select-none">
              /
            </span>
            <input
              id="tour-workspace-slug"
              type="text"
              value={workspaceSlug}
              onChange={(e) => setWorkspaceSlug(normalizeSlug(e.target.value))}
              className="flex-1 py-3 pr-4 bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground/30"
              placeholder="workspace-slug"
            />
            <div className="pr-4">
              {isCheckingSlug ? (
                <Loader2
                  size={14}
                  className="text-muted-foreground animate-spin"
                />
              ) : isSlugAvailable === true ? (
                <Check size={14} className="text-deckly-primary" />
              ) : isSlugAvailable === false ? (
                <X size={14} className="text-destructive" />
              ) : null}
            </div>
          </div>

          {workspaceSlug !== profile?.handle && isSlugAvailable === false && (
            <div className="mt-2 flex items-center gap-2 text-red-500">
              <AlertCircle size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Handle already taken
              </span>
            </div>
          )}

          {workspaceSlug !== profile?.handle &&
            workspaceSlug.length > 0 &&
            workspaceSlug.length < 3 && (
              <div className="mt-2 flex items-center gap-2 text-slate-500">
                <AlertCircle size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Too short (min 3 chars)
                </span>
              </div>
            )}

          {workspaceSlug !== profile?.handle && isSlugAvailable === true && (
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 flex gap-3">
              <AlertCircle
                size={16}
                className="text-destructive shrink-0 mt-0.5"
              />
              <p className="text-[10px] text-destructive font-bold uppercase tracking-[0.15em] leading-relaxed">
                Warning: Changing this breaks all shared links.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={
            saving ||
            isCheckingSlug ||
            workspaceSlug !== debouncedSlug ||
            (debouncedSlug !== profile?.handle && !isSlugAvailable)
          }
          className="w-full py-4 bg-deckly-primary text-primary-foreground font-bold uppercase tracking-[0.2em] text-[10px] hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              Confirm & Save <Check size={14} />
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-[10px] font-bold uppercase tracking-widest text-destructive text-center">
          {error}
        </div>
      )}
    </div>
  );
}

/* ── Tier Section ── */
function TierSection({ currentTier, upgradeSource, onManageBilling, refreshBilling, subscription, catalog, catalogLoading, catalogError }: { currentTier: Tier; upgradeSource: UpgradeSource; onManageBilling: () => void; refreshBilling: () => Promise<void>; subscription: Subscription | null | undefined; catalog: PricingCatalog | undefined; catalogLoading: boolean; catalogError: string | null }) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "yearly",
  );
  const [upgradeTarget, setUpgradeTarget] = useState<Exclude<Tier, "FREE"> | null>(null);
  const { session } = useAuth();
  const pricingSessionIdRef = useRef(crypto.randomUUID());
  const [billingBusy, setBillingBusy] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const tierKeys: Tier[] = ["FREE", "PRO", "PRO_PLUS", "RAISE"];
  const tierIcons = {
    FREE: CheckCircle2,
    PRO: Zap,
    PRO_PLUS: Sparkles,
    RAISE: Crown,
  };

  const tierRecord = (tierKey: Tier): PricingTier | undefined => catalog?.tiers.find((entry) => entry.tier === tierKey);
  const labelFor = (tierKey: Tier) => tierRecord(tierKey)?.label ?? TIER_CONFIG[tierKey].planLabel;
  const getPricePerMonth = (tierKey: Tier) => {
    const pricing = tierRecord(tierKey)?.prices;
    if (!pricing) return 0;
    return billingCycle === "monthly" ? pricing.monthly : Number((pricing.yearly / 12).toFixed(2));
  };
  const billingCycleLabel = billingCycle === "yearly" ? "annual" : "monthly";

  useEffect(() => {
    if (!session?.user?.id) return;
    const pricingSessionId = crypto.randomUUID();
    pricingSessionIdRef.current = pricingSessionId;
    productAnalytics.capture("pricing_viewed", {
      workspace_id: session.user.id,
      source_surface: "profile_pricing",
      plan: currentTier,
      upgrade_source: upgradeSource,
      pricing_session_id: pricingSessionId,
      event_id: `pricing:${pricingSessionId}:viewed`,
    });
    const engagementTimers = ([30, 60] as const).map((engagementSeconds) => window.setTimeout(() => {
      productAnalytics.capture("pricing_engaged", {
        workspace_id: session.user.id,
        source_surface: "profile_pricing",
        plan: currentTier,
        upgrade_source: upgradeSource,
        pricing_session_id: pricingSessionId,
        engagement_seconds: engagementSeconds,
        event_id: `pricing:${pricingSessionId}:engaged:${engagementSeconds}`,
      });
    }, engagementSeconds * 1000));
    return () => engagementTimers.forEach(window.clearTimeout);
  }, [currentTier, session?.user?.id, upgradeSource]);

  const beginCheckout = async (tier: Exclude<Tier, "FREE">) => {
    if (!session?.user) return toast.error("Please sign in again before subscribing.");
    productAnalytics.capture("upgrade_clicked", {
      workspace_id: session.user.id,
      source_surface: "profile_pricing",
      plan: currentTier,
      target_plan: tier,
      billing_interval: billingCycle,
      upgrade_source: upgradeSource,
      pricing_session_id: pricingSessionIdRef.current,
    });
    setBillingBusy(true);
    let checkoutOpened = false;
    let checkoutCompleted = false;
    try {
      if (subscription) {
        if (["authenticated", "active"].includes(subscription.provider_status)) {
          const isSameTier = subscription.entitlement_tier === tier;
          const isIntervalChange = isSameTier && subscription.billing_interval !== billingCycle;
          if (isSameTier && !isIntervalChange) {
            toast.message(`${labelFor(tier)} on ${billingCycleLabel} billing is already active.`);
            return;
          }

          const change = await subscriptionService.change(tier, billingCycle as BillingInterval);
          productAnalytics.capture("plan_changed", {
            workspace_id: session.user.id,
            source_surface: "profile_pricing",
            plan: currentTier,
            target_plan: tier,
            billing_interval: billingCycle,
            upgrade_source: upgradeSource,
            pricing_session_id: pricingSessionIdRef.current,
          });
          if (change.applied_immediately) {
            const charge = change.immediate_charge;
            toast.success(
              charge?.status === "paid"
                ? `${labelFor(tier)} on ${billingCycleLabel} billing is active. Razorpay charged ${formatBillingAmount(charge.amount, charge.currency)} to your saved payment method.`
                : `${labelFor(tier)} on ${billingCycleLabel} billing is active. Razorpay is finalising the prorated charge; the receipt will appear in Billing shortly.`,
            );
          } else if (isIntervalChange) {
            toast.success(`${labelFor(tier)} will switch to ${billingCycleLabel} billing at your next renewal.`);
          } else {
            toast.success(`${labelFor(tier)} will become active at your next renewal.`);
          }
          await refreshBilling();
          return;
        }

        if (["pending", "halted", "paused"].includes(subscription.provider_status)) {
          toast.error("Your current subscription needs attention before its plan can be changed.");
          return;
        }
      }
      const checkout = await subscriptionService.create(tier, billingCycle as BillingInterval);
      productAnalytics.capture("checkout_started", {
        workspace_id: session.user.id,
        source_surface: "profile_pricing",
        plan: currentTier,
        target_plan: tier,
        billing_interval: billingCycle,
        upgrade_source: upgradeSource,
        pricing_session_id: pricingSessionIdRef.current,
        checkout_id: checkout.subscription_id,
        event_id: `checkout:${checkout.subscription_id}:started`,
      });
      const Razorpay = await subscriptionService.loadCheckout();
      new Razorpay({
        key: checkout.key_id,
        subscription_id: checkout.subscription_id,
        name: "Deckly",
        description: `${labelFor(tier)} subscription`,
        prefill: { email: session.user.email },
        handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
          checkoutCompleted = true;
          try {
            await subscriptionService.verify(checkout.subscription_id, response.razorpay_payment_id, response.razorpay_signature);
            productAnalytics.capture("checkout_completed", {
              workspace_id: session.user.id,
              source_surface: "profile_pricing",
              plan: currentTier,
              target_plan: tier,
              billing_interval: billingCycle,
              upgrade_source: upgradeSource,
              pricing_session_id: pricingSessionIdRef.current,
              checkout_id: checkout.subscription_id,
              event_id: `checkout:${checkout.subscription_id}:completed`,
            });
            toast.success("Payment verified. Your plan will activate shortly.");
            await refreshBilling();
          } catch (error) {
            productAnalytics.capture("checkout_failed", {
              workspace_id: session.user.id,
              source_surface: "profile_pricing",
              plan: currentTier,
              target_plan: tier,
              billing_interval: billingCycle,
              upgrade_source: upgradeSource,
              pricing_session_id: pricingSessionIdRef.current,
              checkout_id: checkout.subscription_id,
              failure_code: analyticsFailureCode(error, "verification_failed"),
            });
            toast.error(error instanceof Error ? error.message : "Payment verification failed.");
          }
          finally { setBillingBusy(false); }
        },
        modal: {
          ondismiss: () => {
            if (checkoutCompleted) {
              setBillingBusy(false);
              return;
            }
            void (async () => {
              productAnalytics.capture("checkout_abandoned", {
                workspace_id: session.user.id,
                source_surface: "profile_pricing",
                plan: currentTier,
                target_plan: tier,
                billing_interval: billingCycle,
                upgrade_source: upgradeSource,
                pricing_session_id: pricingSessionIdRef.current,
                checkout_id: checkout.subscription_id,
                event_id: `checkout:${checkout.subscription_id}:abandoned`,
              });
              try {
                await subscriptionService.abandon(checkout.subscription_id);
                toast.message("Checkout cancelled — no payment was taken.");
                await refreshBilling();
              } catch {
                toast.message("Checkout closed. We will expire the unfinished authorisation automatically.");
              } finally {
                setBillingBusy(false);
              }
            })();
          },
        },
      }).open();
      checkoutOpened = true;
    } catch (error) {
      productAnalytics.capture("checkout_failed", {
        workspace_id: session.user.id,
        source_surface: "profile_pricing",
        plan: currentTier,
        target_plan: tier,
        billing_interval: billingCycle,
        upgrade_source: upgradeSource,
        pricing_session_id: pricingSessionIdRef.current,
        failure_code: analyticsFailureCode(error, "checkout_start_failed"),
      });
      toast.error(error instanceof Error ? error.message : "Unable to start checkout.");
    } finally {
      // Checkout's handler/dismiss callback retains the busy state while it is open.
      if (!checkoutOpened) setBillingBusy(false);
    }
  };

  const confirmImmediateUpgrade = () => {
    const target = upgradeTarget;
    setUpgradeTarget(null);
    if (target) void beginCheckout(target);
  };

  return (
    <div className="space-y-8">
      <UpgradeConfirmationDialog
        targetTier={upgradeTarget}
        billingCycle={billingCycle}
        onClose={() => setUpgradeTarget(null)}
        onConfirm={confirmImmediateUpgrade}
      />

      {catalogLoading && (
        <div className="border border-border bg-surface-low px-4 py-3 text-xs text-muted-foreground" role="status">
          Loading current plan capabilities…
        </div>
      )}
      {catalogError && (
        <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive" role="alert">
          Plan capabilities could not be loaded. Please refresh before making a billing decision.
        </div>
      )}

      {subscription && (
        <div className="border border-border bg-surface-low px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-foreground">Manage your subscription, payment status, and billing history in Billing.</p>
            {subscription.current_period_end && <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{subscription.cancel_at_period_end ? "Access ends" : "Renews"} {new Date(subscription.current_period_end).toLocaleDateString()}</p>}
          </div>
          <button type="button" onClick={onManageBilling} className="shrink-0 border border-deckly-primary/40 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-deckly-primary hover:bg-deckly-primary/10">
            Manage billing
          </button>
        </div>
      )}

      {/* Billing Toggle - Pill Style */}
      <div className="flex justify-center">
        <div className="relative flex p-1 bg-surface-low border border-border" role="group" aria-label="Billing frequency">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={cn(
              "relative z-10 flex-1 md:flex-none px-4 md:px-8 py-2 md:py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors",
              billingCycle === "monthly"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {billingCycle === "monthly" && (
              <motion.span
                layoutId="billing-cycle-indicator"
                transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 z-0 bg-surface-highest shadow-sm"
              />
            )}
            <span className="relative z-10">Monthly</span>
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={cn(
              "relative z-10 flex-1 md:flex-none px-4 md:px-8 py-2 md:py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2",
              billingCycle === "yearly"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {billingCycle === "yearly" && (
              <motion.span
                layoutId="billing-cycle-indicator"
                transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 z-0 bg-surface-highest shadow-sm"
              />
            )}
            <span className="relative z-10">Yearly</span>
            <span className="relative z-10 hidden sm:inline-block text-[8px] bg-deckly-primary/20 text-deckly-primary px-1.5 py-0.5 font-bold tracking-normal uppercase">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {catalog && <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {tierKeys.map((tierKey) => {
          const pricing = tierRecord(tierKey)?.prices;
          const limits = tierRecord(tierKey)?.limits;
          if (!pricing || !limits) return null;
          const liveSubscription = subscription && ["authenticated", "active"].includes(subscription.provider_status)
            ? subscription
            : null;
          const hasLiveSubscription = liveSubscription !== null;
          const comparisonTier = liveSubscription?.entitlement_tier ?? currentTier;
          const isCurrent = currentTier === tierKey && (
            tierKey === "FREE" || !liveSubscription || liveSubscription.billing_interval === billingCycle
          );
          const isTopTier = tierKey === "RAISE";
          const TierIcon = tierIcons[tierKey];
          const price = getPricePerMonth(tierKey);
          const isImmediateUpgrade = hasLiveSubscription && TIER_ORDER[tierKey] > TIER_ORDER[comparisonTier];
          const isUpgrade = TIER_ORDER[tierKey] > TIER_ORDER[comparisonTier];
          const isIntervalChange = liveSubscription !== null
            && tierKey === liveSubscription.entitlement_tier
            && liveSubscription.billing_interval !== billingCycle;

          return (
            <motion.div
              key={tierKey}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.24, delay: shouldReduceMotion ? 0 : TIER_ORDER[tierKey] * 0.04, ease: [0.22, 1, 0.36, 1] }}
              whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              className={cn(
                "relative min-h-[470px] p-5 flex flex-col transition-[border-color,background-color] duration-200 group border",
                isCurrent
                  ? "bg-surface-low border-deckly-primary/45"
                  : tierKey === "PRO_PLUS"
                    ? "bg-deckly-primary/[0.035] border-deckly-primary/60 hover:bg-deckly-primary/[0.06]"
                    : "bg-surface-low/30 border-border hover:bg-surface-low hover:border-surface-highest",
              )}
            >
              <div>
                <div className="mb-3 h-6 flex items-center">
                  {tierKey === "PRO_PLUS" && (
                    <motion.span
                      initial={shouldReduceMotion ? false : { opacity: 0, y: -3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.18, delay: shouldReduceMotion ? 0 : 0.12 }}
                      className="inline-flex h-6 items-center bg-deckly-primary px-2.5 text-[9px] font-bold uppercase tracking-[0.14em] text-primary-foreground"
                    >
                      Most popular
                    </motion.span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className={cn(
                      tierKey === "FREE"
                        ? "text-slate-500"
                        : tierKey === "PRO"
                          ? "text-deckly-primary"
                        : tierKey === "PRO_PLUS" ? "text-deckly-primary" : "text-amber-400",
                    )}
                  >
                    <TierIcon size={20} />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-foreground">
                    {labelFor(tierKey)}
                  </h3>
                </div>
                <p className="min-h-10 text-xs leading-relaxed text-muted-foreground">
                  {PLAN_PRESENTATION[tierKey].description}
                </p>

                <div className="mt-5 border-y border-border/70 py-4">
                  <div className="flex items-baseline gap-1">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={`${tierKey}-${billingCycle}`}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? undefined : { opacity: 0, y: 3 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="text-4xl font-bold tracking-tighter text-white"
                    >
                    ${formatPrice(price)}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-sm text-muted-foreground opacity-60">
                    /month
                  </span>
                  </div>
                  {tierKey === "FREE" ? (
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">No card required</p>
                  ) : billingCycle === "yearly" ? (
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-deckly-primary">
                      ${formatPrice(pricing.yearly)} billed yearly · save 20%
                    </p>
                  ) : (
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Billed monthly · cancel anytime</p>
                  )}
                </div>
              </div>

              <dl className="mt-4 flex-1 divide-y divide-border/70">
                {[
                  ["Documents", formatCount(limits.maxDocuments, "document")],
                  ["Analytics retention", limits.analyticsRetentionDays === -1 ? "Full history" : formatCount(limits.analyticsRetentionDays, "day")],
                  ["Data rooms", formatCount(limits.maxDataRooms, "room")],
                  ["Storage", formatStorageBytes(limits.storageLimitBytes)],
                  ["AI credits", `${limits.aiCreditsPerDay} / day`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
                    <dd className="text-right text-xs font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>

              {/* Action Button */}
              <button
                disabled={isCurrent || tierKey === "FREE" || billingBusy}
                onClick={() => {
                  if (isCurrent || tierKey === "FREE") return;
                  if (isImmediateUpgrade) {
                    setUpgradeTarget(tierKey);
                    return;
                  }
                  void beginCheckout(tierKey);
                }}
                className={cn(
                  "mt-6 w-full py-3.5 text-[10px] font-bold uppercase tracking-[0.2em] transition-all",
                  isCurrent
                    ? "bg-white/5 text-muted-foreground cursor-not-allowed border border-white/5"
                    : TIER_ORDER[tierKey] < TIER_ORDER[comparisonTier]
                      ? "bg-white/5 text-foreground hover:bg-white/10 border border-border"
                    : isTopTier
                        ? "bg-amber-400 text-slate-950 hover:brightness-110"
                        : "bg-deckly-primary text-primary-foreground hover:brightness-110",
                )}
              >
                {isCurrent
                  ? "Active Plan"
                  : billingBusy
                    ? "Working..."
                    : isImmediateUpgrade || isUpgrade
                        ? `Upgrade to ${labelFor(tierKey)}`
                        : isIntervalChange
                            ? `Switch to ${billingCycleLabel} at renewal`
                        : subscription
                            ? "Change at Renewal"
                            : `Get ${labelFor(tierKey)}`}
              </button>
            </motion.div>
          );
        })}
      </div>}

      {catalog && <section className="border border-border bg-surface-low/30" aria-labelledby="plan-comparison-title">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
            <div>
              <h3 id="plan-comparison-title" className="text-sm font-semibold text-foreground">Complete feature comparison</h3>
              <p className="mt-1 text-xs text-muted-foreground">Review every limit and capability only when you need the detail.</p>
            </div>
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-deckly-primary group-open:hidden">Show details</span>
            <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-widest text-deckly-primary group-open:inline">Hide details</span>
          </summary>

          <div className="border-t border-border px-5 py-5">
            <h4 className="text-xs font-semibold text-foreground">Everything included</h4>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {tierKeys.map((tierKey) => (
                <article key={tierKey} className="border border-border/70 bg-surface-lowest/40 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground">{labelFor(tierKey)}</p>

                  <dl className="mt-3 divide-y divide-border/70 border-y border-border/70">
                    {[
                      { label: "Active data rooms", value: formatCount(tierRecord(tierKey)?.limits.maxDataRooms ?? 0, "room") },
                      { label: "Documents", value: formatCount(tierRecord(tierKey)?.limits.maxDocuments ?? 0, "document") },
                      { label: "Storage", value: formatStorageBytes(tierRecord(tierKey)?.limits.storageLimitBytes ?? 0) },
                      { label: "Seats", value: String(tierRecord(tierKey)?.limits.plannedTeamMembers ?? 1) },
                      { label: "Analytics retention", value: (tierRecord(tierKey)?.limits.analyticsRetentionDays ?? 0) === -1 ? "Full history" : formatCount(tierRecord(tierKey)?.limits.analyticsRetentionDays ?? 0, "day") },
                      { label: "AI credits", value: `${tierRecord(tierKey)?.limits.aiCreditsPerDay ?? 0} / day` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between gap-3 py-2">
                        <dt className="text-[10px] text-muted-foreground">{label}</dt>
                        <dd className="flex items-center gap-1.5 text-right text-[10px] font-semibold text-foreground">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <ul className="mt-4 space-y-2">
                    {tierRecord(tierKey)?.features.map((feature) => {
                      const isComingSoon = feature.availability === "coming_soon" && (
                        feature.included || (
                          tierKey === "PRO_PLUS" && FOUNDER_COMING_SOON_FEATURES.has(feature.key)
                        )
                      );

                      return (
                      <li key={feature.key} className="flex gap-2 text-xs leading-snug text-muted-foreground">
                        {feature.included && feature.availability === "live" ? (
                          <Check size={12} className="mt-0.5 shrink-0 text-deckly-primary" aria-label="Included" />
                        ) : isComingSoon ? null : (
                          <Lock size={12} className="mt-0.5 shrink-0 text-muted-foreground" aria-label={`Available on ${labelFor(feature.requiredTier)}`} />
                        )}
                        <span>
                          {feature.label}
                          {isComingSoon && <span className="ml-1"><ComingSoonLabel /></span>}
                        </span>
                      </li>
                      );
                    })}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </details>
      </section>}
    </div>
  );
}

/* ── Collaboration Section ── */
function CollaborationSection() {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      {/* Coming Soon Badge */}
      <div className="relative bg-surface-low border border-border p-12 flex flex-col items-center justify-center text-center">
        <div className="absolute top-4 right-4 px-3 py-1 bg-amber-400/10 border border-amber-400/20">
          <ComingSoonLabel />
        </div>
        <div className="w-16 h-16 bg-surface-container flex items-center justify-center mb-6">
          <Users size={32} className="text-muted-foreground/40" />
        </div>
        <h3 className="text-lg font-bold text-foreground uppercase tracking-widest mb-3">
          Multiplayer Mode
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
          Invite stakeholders and co-founders to manage decks, review analytics,
          and collaborate on data rooms in real-time.
        </p>
      </div>

      {/* Current Members */}
      <div className="bg-surface-low border border-border p-6">
        <h3 className="text-[10px] font-bold text-foreground uppercase tracking-[0.2em] mb-4">
          Active Members
        </h3>
        <div className="flex items-center gap-4 px-4 py-3 bg-surface-lowest border border-border">
          <div className="w-10 h-10 bg-deckly-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
            {profile?.full_name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground font-bold truncate">
              {profile?.full_name || "You"}
            </p>
            <p className="text-[9px] text-deckly-primary font-bold uppercase tracking-widest">
              Workspace Owner
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-deckly-primary/10 border border-deckly-primary/20">
            <div className="w-1 h-1 bg-deckly-primary animate-pulse" />
            <span className="text-[8px] text-deckly-primary font-bold uppercase tracking-widest">
              Online
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Danger Section ── */
function DangerSection({
  onSignOut,
  onDeleteAccount,
}: {
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canDelete = confirmText === "DELETE";

  const handleSignOutAll = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
      // onSignOut (global scope) will trigger SIGNED_OUT event,
      // AuthContext clears cache and navigate handles redirect via App router
    } catch {
      toast.error("Failed to revoke sessions. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteAccount();
      navigate("/", { replace: true });
      toast.success("Your account has been permanently deleted.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Account deletion failed.";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sign Out Everywhere */}
      <div className="bg-surface-low border border-border p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-amber-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-[0.2em] mb-1.5">
              Security: Sign Out Everywhere
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Revoke all active sessions and sign out of all devices currently
              logged into this account.
            </p>
            <button
              onClick={handleSignOutAll}
              disabled={signingOut}
              className="px-6 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[10px] font-bold uppercase tracking-widest border border-amber-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {signingOut ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              {signingOut ? "Revoking..." : "Revoke All Sessions"}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account */}
      <div className="bg-destructive/5 border border-destructive/20 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-destructive/10 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="text-[10px] font-bold text-destructive uppercase tracking-[0.2em] mb-1.5">
              Delete Account
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Permanently destroy your workspace. This action is atomic and
              irreversible. All decks and analytics will be purged.
            </p>

            <button
              onClick={() => setShowConfirm(true)}
              className="px-6 py-2.5 bg-destructive/10 hover:bg-destructive/20 text-destructive text-[10px] font-bold uppercase tracking-widest border border-destructive/20 transition-all"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Popup */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-surface-low border border-destructive/30 p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-destructive/10 flex items-center justify-center mb-6">
                <Trash2 size={32} className="text-destructive" />
              </div>
              <h2 className="text-sm font-bold text-white uppercase tracking-[0.3em] mb-3">
                Confirm Deletion
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You are about to permanently delete your Deckly account. This
                cannot be undone.
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[10px] text-destructive font-bold uppercase tracking-widest text-center">
                  Type <span className="text-foreground">DELETE</span> below to
                  confirm
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-lowest border border-destructive/20 text-sm text-foreground focus:outline-none focus:border-destructive transition-all placeholder:text-muted-foreground/10 text-center"
                  placeholder="DELETE"
                  autoFocus
                />
              </div>

              {deleteError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-[10px] text-destructive font-bold uppercase tracking-widest text-center">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting || !canDelete}
                  className="flex-1 py-4 bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 disabled:grayscale"
                >
                  {deleting ? (
                    <Loader2 size={16} className="animate-spin mx-auto" />
                  ) : (
                    "Permanently Delete"
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowConfirm(false);
                    setConfirmText("");
                  }}
                  className="px-8 py-4 bg-surface-container hover:bg-surface-high text-foreground text-[10px] font-bold uppercase tracking-widest border border-border transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
