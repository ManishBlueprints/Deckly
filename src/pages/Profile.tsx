import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { useNavigate } from "react-router-dom";
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
  Mail,
  Copy,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
import { isEmailPasswordSession } from "../services/passwordService";

const TIER_PRICING: Record<
  Tier,
  { monthly: number; yearly: number; cta: string }
> = {
  FREE: { monthly: 0, yearly: 0, cta: "Switch to Free" },
  PRO: { monthly: 9, yearly: 86, cta: "Get Pro" },
  PRO_PLUS: { monthly: 24, yearly: 230, cta: "Get Pro+" },
};

const TIER_ORDER: Record<Tier, number> = {
  FREE: 0,
  PRO: 1,
  PRO_PLUS: 2,
};

type TierFeatureKey =
  | "maxDecks"
  | "days"
  | "maxDataRooms"
  | "maxFileSizeMB"
  | "aiSummariesPerDay"
  | "supportedFormats"
  | "allowOffice"
  | "allowInteractive"
  | "teamMembers"
  | "prioritySupport";

const TIER_FEATURES: Array<{
  key: TierFeatureKey;
  label: string;
  format?: (value: number | boolean | string[]) => string;
}> = [
  {
    key: "maxDecks",
    label: "Decks",
    format: (value) => formatCount(value as number, "deck"),
  },
  {
    key: "days",
    label: "Analytics Retention",
    format: (value) => formatCount(value as number, "day"),
  },
  {
    key: "maxDataRooms",
    label: "Data Rooms",
    format: (value) => formatCount(value as number, "room"),
  },
  {
    key: "maxFileSizeMB",
    label: "Max Upload Size",
    format: (value) => (value === -1 ? "Unlimited" : `${value} MB`),
  },
  {
    key: "aiSummariesPerDay",
    label: "AI Summaries/Day",
    format: (value) => formatCount(value as number, "summary"),
  },
  {
    key: "supportedFormats",
    label: "File Formats",
    format: (value) => (value as string[]).join(" / "),
  },
  {
    key: "allowOffice",
    label: "Office Files",
    format: (value) => (value ? "Yes" : "No"),
  },
  {
    key: "allowInteractive",
    label: "Interactive Mode",
    format: (value) => (value ? "Yes" : "No"),
  },
  {
    key: "teamMembers",
    label: "Team Members",
    format: (value) => formatCount(value as number, "member"),
  },
  {
    key: "prioritySupport",
    label: "Priority Support",
    format: (value) => (value ? "Yes" : "No"),
  },
];

function formatCount(value: number, unit: string) {
  if (value === -1) return "Unlimited";
  if (value === 0) return "0";
  return `${value} ${value === 1 ? unit : `${unit}s`}`;
}

type ProfileSection = "identity" | "security" | "tier" | "collaboration" | "danger";

function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, branding, session, signOutAllDevices, deleteAccount } = useAuth();
  const { markTourComplete } = useTourState();
  const [activeSection, setActiveSection] =
    useState<ProfileSection>("identity");

  useEffect(() => {
    document.title = "Profile | Deckly";
    window.scrollTo(0, 0);
  }, []);

  const isValidTier = (t: string | undefined | null): t is Tier =>
    ["FREE", "PRO", "PRO_PLUS"].includes(t as string);
  const tier: Tier = isValidTier(profile?.tier) ? profile.tier : "FREE";
  const onboardingStage = getOnboardingStage(profile, branding);
  const onboardingMode = onboardingStage !== "complete";
  const setupComplete = onboardingStage !== "workspace";

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

  if (onboardingMode) {
    return <ProfileOnboardingFlow />;
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
        className="relative w-full max-w-6xl h-[95vh] md:h-[85vh] bg-surface-lowest border border-border overflow-hidden shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] flex flex-col md:flex-row"
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
                          : "bg-purple-600 text-white border-purple-500/50",
                    )}
                  >
                    {TIER_CONFIG[tier].planLabel}
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
                {activeSection === "tier" && <TierSection currentTier={tier} />}
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
                className="absolute -top-2 -right-2 w-8 h-8 bg-deckly-primary text-primary-foreground flex items-center justify-center hover:scale-105 active:scale-95 transition-all border-4 border-surface-low shadow-lg"
                title="Upload New"
              >
                <Camera size={14} />
              </button>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <h3 className="text-sm font-bold text-white">Brand Mascot</h3>
            <p className="text-xs text-slate-500">
              Appears in the sidebar and shared deck pages. PNGs work best. Max
              2MB.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
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
function TierSection({ currentTier }: { currentTier: Tier }) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "yearly",
  );
  const [upgradeNoticeOpen, setUpgradeNoticeOpen] = useState(false);
  const { profile, session } = useAuth();
  const tierKeys: Tier[] = ["FREE", "PRO", "PRO_PLUS"];
  const userName =
    profile?.full_name?.trim() || profile?.handle || "your username";
  const userEmail = session?.user?.email || "your email address";

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  useEffect(() => {
    if (!upgradeNoticeOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUpgradeNoticeOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [upgradeNoticeOpen]);

  const tierIcons = {
    FREE: CheckCircle2,
    PRO: Zap,
    PRO_PLUS: Sparkles,
  };

  const getPricePerMonth = (tierKey: Tier) => {
    const pricing = TIER_PRICING[tierKey];
    return billingCycle === "monthly"
      ? pricing.monthly
      : Number((pricing.yearly / 12).toFixed(2));
  };

  return (
    <div className="space-y-8">
      <AnimatePresence>
        {upgradeNoticeOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setUpgradeNoticeOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="upgrade-notice-title"
              className="relative w-full max-w-lg overflow-hidden border border-border bg-surface-lowest shadow-[0_32px_120px_-24px_rgba(0,0,0,0.7)]"
            >
              <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-deckly-primary mb-2">
                    Alpha Notice
                  </p>
                  <h3
                    id="upgrade-notice-title"
                    className="text-xl font-bold text-white"
                  >
                    Billing is not live yet
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setUpgradeNoticeOpen(false)}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close upgrade notice"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-5">
                <div className="flex items-start gap-3 rounded-none border border-amber-500/20 bg-amber-500/10 p-4">
                  <AlertTriangle
                    size={18}
                    className="mt-0.5 shrink-0 text-amber-400"
                  />
                  <p className="text-sm text-slate-200 leading-relaxed">
                    This app is in alpha version. To upgrade, please email{" "}
                    <a
                      href="mailto:test@deckly.space"
                      className="font-semibold text-deckly-primary hover:underline"
                    >
                      test@deckly.space
                    </a>{" "}
                    with your User Name and Email Id.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="border border-border bg-surface-low p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
                          User Name
                        </p>
                        <p className="text-sm font-semibold text-white break-words">
                          {userName}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopy(userName, "Username")}
                        className="shrink-0 p-2 text-muted-foreground hover:text-deckly-primary hover:bg-white/5 transition-colors"
                        aria-label="Copy username"
                        title="Copy username"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="border border-border bg-surface-low p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
                          Email Id
                        </p>
                        <p className="text-sm font-semibold text-white break-words">
                          {userEmail}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopy(userEmail, "Email")}
                        className="shrink-0 p-2 text-muted-foreground hover:text-deckly-primary hover:bg-white/5 transition-colors"
                        aria-label="Copy email"
                        title="Copy email"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-border px-6 py-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setUpgradeNoticeOpen(false)}
                  className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </button>
                <a
                  href={`mailto:test@deckly.space?subject=${encodeURIComponent("Deckly upgrade request")}&body=${encodeURIComponent(`Hello Deckly team,\n\nI would like to upgrade my account.\n\nUser Name: ${userName}\nEmail Id: ${userEmail}\n\nThanks.`)}`}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-deckly-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.2em] hover:brightness-110 transition-all"
                >
                  <Mail size={14} />
                  Email Upgrade Request
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Billing Toggle - Pill Style */}
      <div className="flex justify-center">
        <div className="flex p-1 bg-surface-low border border-border">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={cn(
              "flex-1 md:flex-none px-4 md:px-8 py-2 md:py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] transition-all",
              billingCycle === "monthly"
                ? "bg-surface-highest text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={cn(
              "relative flex-1 md:flex-none px-4 md:px-8 py-2 md:py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2",
              billingCycle === "yearly"
                ? "bg-surface-highest text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Yearly
            <span className="hidden sm:inline-block text-[8px] bg-deckly-primary/20 text-deckly-primary px-1.5 py-0.5 font-bold tracking-normal uppercase">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tierKeys.map((tierKey, index) => {
          const pricing = TIER_PRICING[tierKey];
          const isCurrent = currentTier === tierKey;
          const isProPlus = tierKey === "PRO_PLUS";
          const TierIcon = tierIcons[tierKey];
          const price = getPricePerMonth(tierKey);

          const prevTier = index > 0 ? tierKeys[index - 1] : null;

          return (
            <div
              key={tierKey}
              className={cn(
                "relative p-6 flex flex-col transition-all duration-500 group border",
                isCurrent
                  ? "bg-surface-low border-deckly-primary/30"
                  : "bg-surface-low/30 border-border hover:bg-surface-low hover:border-surface-highest",
              )}
            >
              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className={cn(
                      tierKey === "FREE"
                        ? "text-slate-500"
                        : tierKey === "PRO"
                          ? "text-deckly-primary"
                          : "text-amber-400",
                    )}
                  >
                    <TierIcon size={20} />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-foreground">
                    {tierKey === "PRO_PLUS" ? "Pro+" : tierKey}
                  </h3>
                </div>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold tracking-tighter text-white">
                    ${price}
                  </span>
                  <span className="text-sm text-muted-foreground opacity-60">
                    /month
                  </span>
                </div>
                {billingCycle === "yearly" && tierKey !== "FREE" && (
                  <div className="space-y-1 mt-1">
                    <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase opacity-40">
                      Billed annually
                    </p>
                    <p className="text-[9px] text-deckly-primary font-bold tracking-widest uppercase">
                      Save $
                      {TIER_PRICING[tierKey].monthly * 12 -
                        TIER_PRICING[tierKey].yearly}
                      /year
                    </p>
                  </div>
                )}
              </div>

              {/* Feature Intro */}
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                {tierKey === "FREE"
                  ? "What's included:"
                  : `Everything on ${prevTier === "PRO_PLUS" ? "Pro+" : prevTier}, plus:`}
              </p>

              {/* Features List */}
              <div className="flex-1 space-y-3 mb-8 overflow-hidden">
                {TIER_FEATURES.map(({ key, label, format }) => {
                  const val = TIER_CONFIG[tierKey][key];
                  const prevVal = prevTier ? TIER_CONFIG[prevTier][key] : -1;

                  // Only show if it's a new or improved feature compared to the previous tier
                  const isNewOrImproved = !areTierFeatureValuesEqual(
                    val,
                    prevVal,
                  );
                  if (!isNewOrImproved && tierKey !== "FREE") return null;

                  const isIncluded = val !== 0 && val !== false;

                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-start gap-3 transition-all",
                        isIncluded ? "opacity-100" : "opacity-20 translate-x-1",
                      )}
                    >
                      <Check
                        size={12}
                        className={cn(
                          "mt-0.5 shrink-0",
                          isIncluded
                            ? "text-deckly-primary"
                            : "text-muted-foreground",
                        )}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] text-foreground leading-tight">
                          {label}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5 truncate">
                          {format
                            ? format(val as number | boolean | string[])
                            : formatTierFeatureValue(val)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Button */}
              <button
                disabled={isCurrent}
                onClick={() => {
                  if (!isCurrent) {
                    setUpgradeNoticeOpen(true);
                  }
                }}
                className={cn(
                  "w-full py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-all",
                  isCurrent
                    ? "bg-white/5 text-muted-foreground cursor-not-allowed border border-white/5"
                    : TIER_ORDER[tierKey] < TIER_ORDER[currentTier]
                      ? "bg-white/5 text-foreground hover:bg-white/10 border border-border"
                      : isProPlus
                        ? "bg-amber-400 text-slate-950 hover:brightness-110 shadow-lg shadow-amber-400/5"
                        : "bg-deckly-primary text-primary-foreground hover:brightness-110 shadow-lg shadow-deckly-primary/10",
                )}
              >
                {isCurrent ? "Active Plan" : pricing.cta}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTierFeatureValue(value: number | boolean | string[]): string {
  if (Array.isArray(value)) return value.join(" / ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === -1) return "Unlimited";
  return `${value}`;
}

function areTierFeatureValuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => item === b[index]);
  }

  if (a && b && typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return a === b;
}

/* ── Collaboration Section ── */
function CollaborationSection() {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      {/* Coming Soon Badge */}
      <div className="relative bg-surface-low border border-border p-12 flex flex-col items-center justify-center text-center">
        <div className="absolute top-4 right-4 px-3 py-1 bg-deckly-primary/10 text-deckly-primary text-[8px] font-bold uppercase tracking-widest border border-deckly-primary/20">
          Enabling Soon
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
