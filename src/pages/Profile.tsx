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
  Activity,
  LogOut,
  UserPlus,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { useTourState } from "../contexts/TourContext";
import { deckService } from "../services/deckService";
import { userService } from "../services/userService";
import { normalizeSlug } from "../utils/slug";
import { TIER_CONFIG, Tier } from "../constants/tiers";
import penguinMascot from "../assets/penguine.png";
import { cn } from "../lib/utils";
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
import { buildUpgradeUrl, parseUpgradeSource } from "../services/upgradeAttribution";
import { usePricingCatalog, useTierFeatureAccess } from "../hooks/useTierEntitlements";
import type { PricingCatalog, PricingTier } from "../services/tierEntitlementService";
import { ProfileActionCard, ProfileSectionHeader } from "../components/profile/ProfileSectionPrimitives";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

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
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-ui-warning">
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
  const shouldReduceMotion = useReducedMotion();
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
    <div className="min-h-[calc(100dvh-88px)] bg-ui-canvas p-3 sm:p-5 lg:p-7">
      <motion.div
        initial={false}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
        className="relative mx-auto flex min-h-[calc(100dvh-140px)] w-full max-w-[1480px] flex-col overflow-hidden rounded-[16px] border border-ui-border bg-ui-elevated shadow-[var(--ui-shadow-overlay)] md:flex-row"
      >
        {/* Left Sidebar */}
        <div className="flex w-full shrink-0 flex-col border-b border-ui-border bg-ui-subtle md:w-[272px] md:border-b-0 md:border-r">
          {/* User Header */}
          <div className="relative border-b border-ui-border bg-ui-surface p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-ui-border bg-ui-surface md:h-12 md:w-12">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-base font-bold text-ui-text md:text-lg">
                      {profile?.full_name?.charAt(0) || "U"}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ui-text md:text-sm">
                    {profile?.full_name?.split(" ")[0] || "User"}
                  </p>
                  <span
                    className={cn(
                      "mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider md:mt-1",
                      tier === "FREE"
                        ? "border-ui-border bg-ui-surface text-ui-muted"
                        : tier === "PRO"
                          ? "border-ui-info/30 bg-ui-info/10 text-ui-info"
                          : tier === "PRO_PLUS"
                            ? "border-ui-primary/30 bg-ui-primary/10 text-ui-primary"
                            : "border-ui-warning/35 bg-ui-warning/10 text-ui-warning",
                    )}
                  >
                    {tierLabel}
                  </span>
                </div>
              </div>

              <button
                onClick={() => navigate(-1)}
                className="rounded-md p-2 text-ui-muted transition-all hover:bg-ui-subtle hover:text-ui-text active:scale-95 md:hidden"
                aria-label="Close profile"
              >
                <X size={20} />
              </button>
            </div>
            {profile?.handle && (
              <p className="mt-2 truncate text-[10px] text-ui-muted md:mt-0">
                @{profile.handle}
              </p>
            )}
          </div>

          {/* Navigation */}
          <nav className="no-scrollbar flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-x-visible md:p-3">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={cn(
                  "group flex shrink-0 items-center gap-2 rounded-[10px] border px-3 py-2.5 text-xs font-medium transition-colors md:gap-3 md:px-4 md:py-3 md:text-sm",
                  activeSection === id
                    ? "border-ui-primary/20 bg-ui-primary/10 text-ui-primary"
                    : "border-transparent text-ui-muted hover:border-ui-border hover:bg-ui-surface hover:text-ui-text",
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
          <div className="sticky top-0 z-[var(--ui-layer-sticky)] flex shrink-0 items-center justify-between border-b border-ui-border bg-ui-elevated/95 px-4 py-4 backdrop-blur-md md:px-8 md:py-5">
            <h1 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ui-muted">
              {sections.find((s) => s.id === activeSection)?.label ||
                activeSection}
            </h1>
            <button
              onClick={() => navigate(-1)}
              className="hidden rounded-md p-2 text-ui-muted transition-colors hover:bg-ui-subtle hover:text-ui-text md:block"
              aria-label="Close profile"
            >
              <X size={18} />
            </button>
          </div>

          <div className={cn("mx-auto w-full p-4 pt-4 md:p-8 md:pt-6", activeSection === "tier" ? "max-w-[1240px]" : "max-w-4xl")}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={false}
                animate={{ opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, x: -10 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
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
  const canUploadLogo = customLogo.access.state === "available";

  const handleLogoUpgrade = () => {
    toast.info("Upgrade to Founder to use a custom workspace logo.");
    navigate(buildUpgradeUrl("unknown_feature_gate"));
  };

  const handleLogoAction = () => {
    if (customLogo.isLoading || uploading) return;
    if (!canUploadLogo) {
      handleLogoUpgrade();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!canUploadLogo) {
      handleLogoUpgrade();
      e.target.value = "";
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
        <div className="rounded-[12px] border border-ui-primary/20 bg-ui-primary/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ui-primary">
            Complete workspace setup to unlock the dashboard
          </p>
          <p className="mt-2 text-xs text-ui-muted">
            Add your workspace name and public handle here. Once saved, we will
            send you into the dashboard automatically.
          </p>
        </div>
      )}

      {/* Logo Upload */}
      <div className="rounded-[14px] border border-ui-border bg-ui-surface p-4 shadow-[var(--ui-shadow-control)] md:p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative group/mascot">
            <div className="flex h-24 w-24 items-center justify-center rounded-[10px] border border-ui-border bg-ui-subtle p-3">
              <img
                src={currentLogo}
                alt="Mascot"
                className="w-full h-full object-contain"
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-ui-surface/70 backdrop-blur-xs">
                  <Loader2
                    size={20}
                    className="animate-spin text-ui-primary"
                  />
                </div>
              )}
            </div>
            {!uploading && (
              <button
                onClick={handleLogoAction}
                disabled={customLogo.isLoading}
                className={cn(
                  "absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-[8px] border-2 border-ui-surface shadow-[var(--ui-shadow-control)] transition-all hover:scale-105 active:scale-95 disabled:cursor-wait disabled:opacity-60",
                  canUploadLogo
                    ? "bg-ui-primary text-ui-primary-text"
                    : "bg-ui-warning/15 text-ui-warning",
                )}
                title={canUploadLogo ? "Upload new logo" : "Upgrade to Founder to upload a custom logo"}
              >
                {canUploadLogo ? <Camera size={14} /> : <Crown size={14} />}
              </button>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <h3 className="text-sm font-semibold text-ui-text">Brand Mascot</h3>
            <p className="text-xs text-ui-muted">
              {customLogo.isLoading || customLogo.access.state === "available"
                ? "Appears in the sidebar and shared deck pages. PNGs work best. Max 2MB."
                : "Custom logos are available on Founder. Your existing logo remains visible."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleLogoAction}
                disabled={uploading || customLogo.isLoading}
                className={cn(
                  "flex items-center gap-2 rounded-[8px] border px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all disabled:cursor-wait disabled:opacity-60",
                  canUploadLogo
                    ? "border-ui-border bg-ui-subtle text-ui-text hover:bg-ui-elevated"
                    : "border-ui-warning/30 bg-ui-warning/10 text-ui-warning hover:bg-ui-warning/15",
                )}
              >
                {canUploadLogo ? <Upload size={12} className="text-ui-primary" /> : <Crown size={12} />}
                {canUploadLogo ? "Upload" : "Upgrade to Founder"}
              </button>
              {branding?.logo_url && (
                <button
                  onClick={handleResetLogo}
                  disabled={uploading}
                  className="flex items-center gap-2 rounded-[8px] border border-ui-destructive/20 bg-ui-destructive/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-ui-destructive transition-all hover:bg-ui-destructive/15 disabled:opacity-50"
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
      <div className="space-y-6 rounded-[14px] border border-ui-border bg-ui-surface p-6 shadow-[var(--ui-shadow-control)]">
        <div>
          <label
            htmlFor="tour-workspace-name"
            className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-ui-muted"
          >
            Workspace Name
          </label>
          <input
            id="tour-workspace-name"
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="w-full rounded-[8px] border border-ui-border bg-ui-subtle px-4 py-3 text-sm text-ui-text transition-all placeholder:text-ui-muted/60 focus:border-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-focus/30"
            placeholder="e.g. Acme Corp"
          />
        </div>

        <div>
          <label
            htmlFor="tour-user-name"
            className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-ui-muted"
          >
            User Name
          </label>
          <input
            id="tour-user-name"
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full rounded-[8px] border border-ui-border bg-ui-subtle px-4 py-3 text-sm text-ui-text transition-all placeholder:text-ui-muted/60 focus:border-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-focus/30"
            placeholder="e.g. Your Name"
          />
        </div>

        <div>
          <label
            htmlFor="tour-workspace-slug"
            className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-ui-muted"
          >
            Public URL Handle
          </label>
          <div className="flex items-center overflow-hidden rounded-[8px] border border-ui-border bg-ui-subtle transition-all focus-within:border-ui-primary focus-within:ring-2 focus-within:ring-ui-focus/30">
            <span className="select-none pl-4 pr-1 text-xs text-ui-muted">
              /
            </span>
            <input
              id="tour-workspace-slug"
              type="text"
              value={workspaceSlug}
              onChange={(e) => setWorkspaceSlug(normalizeSlug(e.target.value))}
              className="flex-1 bg-transparent py-3 pr-4 text-sm text-ui-text placeholder:text-ui-muted/60 focus:outline-none"
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
            <div className="mt-2 flex items-center gap-2 text-ui-destructive">
              <AlertCircle size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Handle already taken
              </span>
            </div>
          )}

          {workspaceSlug !== profile?.handle &&
            workspaceSlug.length > 0 &&
            workspaceSlug.length < 3 && (
              <div className="mt-2 flex items-center gap-2 text-ui-muted">
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
          className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-ui-primary py-3.5 text-xs font-semibold text-ui-primary-text shadow-[var(--ui-shadow-control)] transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-30"
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
  const pricingSessionIdRef = useRef("pending");
  const pricingTierRef = useRef(currentTier);
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
      plan: pricingTierRef.current,
      upgrade_source: upgradeSource,
      pricing_session_id: pricingSessionId,
      event_id: `pricing:${pricingSessionId}:viewed`,
    });
    const engagementTimers = ([30, 60] as const).map((engagementSeconds) => window.setTimeout(() => {
      productAnalytics.capture("pricing_engaged", {
        workspace_id: session.user.id,
        source_surface: "profile_pricing",
        plan: pricingTierRef.current,
        upgrade_source: upgradeSource,
        pricing_session_id: pricingSessionId,
        engagement_seconds: engagementSeconds,
        event_id: `pricing:${pricingSessionId}:engaged:${engagementSeconds}`,
      });
    }, engagementSeconds * 1000));
    return () => engagementTimers.forEach(window.clearTimeout);
  }, [session?.user?.id, upgradeSource]);

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
    <div className="space-y-6 pb-4">
      <UpgradeConfirmationDialog
        targetTier={upgradeTarget}
        billingCycle={billingCycle}
        onClose={() => setUpgradeTarget(null)}
        onConfirm={confirmImmediateUpgrade}
      />

      {catalogLoading && (
        <div className="rounded-lg border border-ui-border bg-ui-subtle px-4 py-3 text-xs text-ui-muted" role="status">
          Loading current plan capabilities…
        </div>
      )}
      {catalogError && (
        <div className="rounded-lg border border-ui-destructive/30 bg-ui-destructive/10 px-4 py-3 text-xs text-ui-destructive" role="alert">
          Plan capabilities could not be loaded. Please refresh before making a billing decision.
        </div>
      )}

      <section className="relative overflow-hidden rounded-[14px] border border-ui-primary/25 bg-ui-subtle p-5 shadow-[var(--ui-shadow-control)] sm:p-6" aria-labelledby="current-plan-title">
        <div className="absolute inset-y-0 left-0 w-1 bg-ui-primary" aria-hidden="true" />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-ui-primary/25 bg-ui-primary/10 text-ui-primary">
              <Crown size={21} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ui-primary">Your current plan</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 id="current-plan-title" className="text-xl font-semibold tracking-tight text-ui-text">{labelFor(currentTier)}</h2>
                <span className="rounded-full border border-ui-primary/25 bg-ui-primary/10 px-2 py-0.5 text-[10px] font-semibold text-ui-primary">Active</span>
              </div>
              <p className="mt-1.5 text-sm text-ui-muted">
                {subscription?.current_period_end
                  ? `${subscription.cancel_at_period_end ? "Access ends" : "Renews"} ${new Date(subscription.current_period_end).toLocaleDateString()}`
                  : "Upgrade whenever you need more rooms, storage, and analytics."}
              </p>
            </div>
          </div>
          {subscription && (
            <button type="button" onClick={onManageBilling} className="inline-flex h-10 shrink-0 items-center justify-center rounded-[10px] border border-ui-border bg-ui-surface px-4 text-xs font-semibold text-ui-text shadow-[var(--ui-shadow-control)] transition-colors hover:border-ui-primary/35 hover:bg-ui-elevated">
              Manage billing
            </button>
          )}
        </div>
      </section>

      <div className="flex flex-col items-center gap-2">
        <p className="text-xs font-medium text-ui-muted">Choose how you would like to be billed</p>
        <div className="relative flex rounded-[12px] border border-ui-border bg-ui-subtle p-1 shadow-[var(--ui-shadow-control)]" role="group" aria-label="Billing frequency">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={cn(
              "relative z-10 flex-1 rounded-[8px] px-5 py-2 text-xs font-semibold transition-colors md:flex-none md:px-8 md:py-2.5",
              billingCycle === "monthly"
                ? "text-ui-text"
                : "text-ui-muted hover:text-ui-text",
            )}
          >
            {billingCycle === "monthly" && (
              <motion.span
                layoutId="billing-cycle-indicator"
                transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 z-0 rounded-[8px] border border-ui-border bg-ui-surface shadow-[var(--ui-shadow-control)]"
              />
            )}
            <span className="relative z-10">Monthly</span>
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={cn(
              "relative z-10 flex flex-1 items-center justify-center gap-2 rounded-[8px] px-5 py-2 text-xs font-semibold transition-colors md:flex-none md:px-8 md:py-2.5",
              billingCycle === "yearly"
                ? "text-ui-text"
                : "text-ui-muted hover:text-ui-text",
            )}
          >
            {billingCycle === "yearly" && (
              <motion.span
                layoutId="billing-cycle-indicator"
                transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 z-0 rounded-[8px] border border-ui-border bg-ui-surface shadow-[var(--ui-shadow-control)]"
              />
            )}
            <span className="relative z-10">Yearly</span>
            <span className="relative z-10 hidden rounded-full bg-ui-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-normal text-ui-primary sm:inline-block">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {catalog && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                "group relative flex min-h-[510px] flex-col overflow-hidden rounded-[14px] border p-5 shadow-[var(--ui-shadow-control)] transition-[border-color,background-color,box-shadow] duration-200",
                isCurrent
                  ? "border-ui-primary/50 bg-ui-primary/[0.06] shadow-[var(--ui-shadow-surface)]"
                  : tierKey === "PRO_PLUS"
                    ? "border-ui-primary/35 bg-ui-surface hover:border-ui-primary/55"
                    : tierKey === "PRO"
                      ? "border-ui-info/25 bg-ui-surface hover:border-ui-info/45"
                      : tierKey === "RAISE"
                        ? "border-ui-warning/30 bg-ui-surface hover:border-ui-warning/50"
                        : "border-ui-border bg-ui-surface hover:border-ui-primary/25",
              )}
            >
              <div>
                <div className="mb-4 flex h-6 items-center justify-between">
                  {tierKey === "PRO_PLUS" && (
                    <motion.span
                      initial={shouldReduceMotion ? false : { opacity: 0, y: -3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.18, delay: shouldReduceMotion ? 0 : 0.12 }}
                      className="inline-flex h-6 items-center rounded-full bg-ui-primary px-2.5 text-[9px] font-bold uppercase tracking-[0.14em] text-ui-primary-text"
                    >
                      Most popular
                    </motion.span>
                  )}
                  {isCurrent && <span className="rounded-full border border-ui-primary/25 bg-ui-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ui-primary">Current</span>}
                </div>
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-[9px] border",
                      tierKey === "FREE"
                        ? "border-ui-border bg-ui-subtle text-ui-muted"
                        : tierKey === "PRO"
                          ? "border-ui-info/25 bg-ui-info/10 text-ui-info"
                        : tierKey === "PRO_PLUS" ? "border-ui-primary/25 bg-ui-primary/10 text-ui-primary" : "border-ui-warning/30 bg-ui-warning/10 text-ui-warning",
                    )}
                  >
                    <TierIcon size={20} />
                  </div>
                  <h3 className="text-base font-semibold text-ui-text">
                    {labelFor(tierKey)}
                  </h3>
                </div>
                <p className="min-h-10 text-sm leading-relaxed text-ui-muted">
                  {PLAN_PRESENTATION[tierKey].description}
                </p>

                <div className="mt-5 border-y border-ui-border py-4">
                  <div className="flex items-baseline gap-1">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={`${tierKey}-${billingCycle}`}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? undefined : { opacity: 0, y: 3 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="text-4xl font-bold tracking-tighter text-ui-text"
                    >
                    ${formatPrice(price)}
                    </motion.span>
                  </AnimatePresence>
                   <span className="text-sm text-ui-muted">
                    /month
                  </span>
                  </div>
                  {tierKey === "FREE" ? (
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-ui-muted">No card required</p>
                  ) : billingCycle === "yearly" ? (
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-ui-primary">
                      ${formatPrice(pricing.yearly)} billed yearly · save 20%
                    </p>
                  ) : (
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-ui-muted">Billed monthly · cancel anytime</p>
                  )}
                </div>
              </div>

              <dl className="mt-4 flex-1 divide-y divide-ui-border/70">
                {[
                  ["Documents", formatCount(limits.maxDocuments, "document")],
                  ["Analytics retention", limits.analyticsRetentionDays === -1 ? "Full history" : formatCount(limits.analyticsRetentionDays, "day")],
                  ["Data rooms", formatCount(limits.maxDataRooms, "room")],
                  ["Storage", formatStorageBytes(limits.storageLimitBytes)],
                  ["AI credits", `${limits.aiCreditsPerDay} / day`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-ui-muted">{label}</dt>
                    <dd className="text-right text-xs font-semibold text-ui-text">{value}</dd>
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
                  "mt-6 w-full rounded-[10px] border px-3 py-3 text-xs font-semibold transition-all",
                  isCurrent
                    ? "cursor-not-allowed border-ui-primary/20 bg-ui-primary/10 text-ui-primary"
                    : TIER_ORDER[tierKey] < TIER_ORDER[comparisonTier]
                      ? "border-ui-border bg-ui-subtle text-ui-text hover:bg-ui-elevated"
                    : isTopTier
                        ? "border-ui-warning bg-ui-warning text-ui-canvas hover:brightness-95"
                        : "border-ui-primary bg-ui-primary text-ui-primary-text hover:brightness-95",
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

      {catalog && <section className="overflow-hidden rounded-[14px] border border-ui-border bg-ui-surface shadow-[var(--ui-shadow-control)]" aria-labelledby="plan-comparison-title">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 transition-colors hover:bg-ui-subtle [&::-webkit-details-marker]:hidden">
            <div>
              <h3 id="plan-comparison-title" className="text-sm font-semibold text-ui-text">Complete feature comparison</h3>
              <p className="mt-1 text-xs text-ui-muted">Review every limit and capability only when you need the detail.</p>
            </div>
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-ui-primary group-open:hidden">Show details</span>
            <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-widest text-ui-primary group-open:inline">Hide details</span>
          </summary>

          <div className="border-t border-ui-border bg-ui-subtle/50 px-5 py-5">
            <h4 className="text-xs font-semibold text-ui-text">Everything included</h4>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {tierKeys.map((tierKey) => (
                <article key={tierKey} className="rounded-[10px] border border-ui-border bg-ui-surface p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ui-text">{labelFor(tierKey)}</p>

                  <dl className="mt-3 divide-y divide-ui-border/70 border-y border-ui-border/70">
                    {[
                      { label: "Active data rooms", value: formatCount(tierRecord(tierKey)?.limits.maxDataRooms ?? 0, "room") },
                      { label: "Documents", value: formatCount(tierRecord(tierKey)?.limits.maxDocuments ?? 0, "document") },
                      { label: "Storage", value: formatStorageBytes(tierRecord(tierKey)?.limits.storageLimitBytes ?? 0) },
                      { label: "Seats", value: String(tierRecord(tierKey)?.limits.plannedTeamMembers ?? 1) },
                      { label: "Analytics retention", value: (tierRecord(tierKey)?.limits.analyticsRetentionDays ?? 0) === -1 ? "Full history" : formatCount(tierRecord(tierKey)?.limits.analyticsRetentionDays ?? 0, "day") },
                      { label: "AI credits", value: `${tierRecord(tierKey)?.limits.aiCreditsPerDay ?? 0} / day` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between gap-3 py-2">
                        <dt className="text-[10px] text-ui-muted">{label}</dt>
                        <dd className="flex items-center gap-1.5 text-right text-[10px] font-semibold text-ui-text">
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
                      <li key={feature.key} className="flex gap-2 text-xs leading-snug text-ui-muted">
                        {feature.included && feature.availability === "live" ? (
                          <Check size={12} className="mt-0.5 shrink-0 text-ui-primary" aria-label="Included" />
                        ) : isComingSoon ? null : (
                          <Lock size={12} className="mt-0.5 shrink-0 text-ui-muted" aria-label={`Available on ${labelFor(feature.requiredTier)}`} />
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
    <div className="space-y-8">
      <ProfileSectionHeader
        icon={Users}
        eyebrow="Team workspace"
        title="Build together"
        description="Invite collaborators, assign responsibilities, and keep every investor-facing asset coordinated from one workspace."
        badge={<span className="inline-flex rounded-full border border-ui-warning/25 bg-ui-warning/10 px-3 py-1.5"><ComingSoonLabel /></span>}
      />

      <ProfileActionCard
        icon={Sparkles}
        title="Collaboration is on the way"
        description="The first release will focus on clear ownership and secure access without making the workspace feel complex."
        tone="primary"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: UserPlus, title: "Invite teammates", text: "Bring founders and advisers into the workspace." },
            { icon: ShieldCheck, title: "Control access", text: "Give each member only the permissions they need." },
            { icon: Activity, title: "Track activity", text: "See important workspace changes in one timeline." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-[10px] border border-ui-border bg-ui-subtle/70 p-4">
              <Icon size={17} className="text-ui-primary" aria-hidden="true" />
              <p className="mt-3 text-xs font-semibold text-ui-text">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ui-muted">{text}</p>
            </div>
          ))}
        </div>
      </ProfileActionCard>

      <ProfileActionCard
        icon={Users}
        title="Current workspace member"
        description="Your account owns this workspace and currently has full administrative access."
      >
        <div className="flex flex-col gap-3 rounded-[10px] border border-ui-border bg-ui-subtle/70 p-3 sm:flex-row sm:items-center">
          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ui-border bg-ui-surface text-sm font-semibold text-ui-text">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : profile?.full_name?.charAt(0) || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ui-text">{profile?.full_name || "You"}</p>
            <p className="mt-0.5 text-xs text-ui-muted">Workspace owner · Full access</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-ui-primary/25 bg-ui-primary/10 px-3 py-1.5 text-[10px] font-semibold text-ui-primary">
            <span className="size-1.5 rounded-full bg-ui-primary" /> Active
          </span>
        </div>
      </ProfileActionCard>
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
    <div className="space-y-8">
      <ProfileSectionHeader
        icon={Trash2}
        eyebrow="Account controls"
        title="Sessions and deletion"
        description="Manage access across your devices or permanently remove the workspace when you no longer need it."
        tone="danger"
      />

      <ProfileActionCard
        icon={LogOut}
        title="Sign out everywhere"
        description="Revoke every active session, including this device. You will need to sign in again before returning to the workspace."
        tone="warning"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-lg text-xs leading-relaxed text-ui-muted">Use this if you signed in on a shared device or suspect that another session is still active.</p>
          <button
            onClick={handleSignOutAll}
            disabled={signingOut}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[8px] border border-ui-warning bg-ui-warning px-4 text-sm font-semibold text-ui-canvas shadow-[var(--ui-shadow-control)] transition-all hover:brightness-95 disabled:opacity-50"
          >
            {signingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
            {signingOut ? "Signing out…" : "Revoke all sessions"}
          </button>
        </div>
      </ProfileActionCard>

      <ProfileActionCard
        icon={Trash2}
        title="Delete account"
        description="Permanently delete your workspace, decks, links, rooms, and analytics. This cannot be reversed."
        tone="danger"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 rounded-[8px] border border-ui-destructive/40 bg-ui-destructive/10 px-3 py-2.5 text-xs font-medium text-ui-destructive">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>Export anything you need before continuing.</span>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[8px] border border-ui-destructive bg-ui-destructive px-4 text-sm font-semibold text-ui-canvas shadow-[var(--ui-shadow-control)] transition-all hover:brightness-95"
          >
            <Trash2 size={15} /> Delete account
          </button>
        </div>
      </ProfileActionCard>

      <AlertDialog
        open={showConfirm}
        onOpenChange={(open) => {
          if (deleting) return;
          setShowConfirm(open);
          if (!open) setConfirmText("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-md bg-ui-destructive/10 text-ui-destructive">
              <Trash2 size={20} aria-hidden="true" />
            </div>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              Your workspace, decks, links, and analytics will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="delete-account-confirmation" className="text-xs font-medium text-ui-muted">
              Type <span className="font-semibold text-ui-text">DELETE</span> to confirm
            </label>
            <input
              id="delete-account-confirmation"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              disabled={deleting}
              autoComplete="off"
              className="h-11 w-full rounded-md border border-ui-border bg-ui-surface px-3.5 text-sm text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-destructive focus:ring-2 focus:ring-ui-destructive/15 disabled:opacity-60"
              placeholder="DELETE"
            />
            {deleteError ? <p role="alert" className="rounded-md border border-ui-destructive/20 bg-ui-destructive/10 px-3 py-2 text-sm text-ui-destructive">{deleteError}</p> : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting || !canDelete}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="bg-ui-destructive text-ui-canvas hover:brightness-95"
            >
              {deleting ? <><Loader2 size={15} className="animate-spin" />Deleting…</> : "Permanently delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default Profile;
