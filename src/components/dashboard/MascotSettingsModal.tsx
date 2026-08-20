import { useState, useRef, useEffect } from "react";
import {
  X,
  Upload,
  Trash2,
  RotateCcw,
  Camera,
  Loader2,
  Info,
  AlertCircle,
  Check,
} from "lucide-react";
import { motion } from "framer-motion";
import { BrandingSettings, UserProfile } from "../../types";
import { deckService } from "../../services/deckService";
import { userService } from "../../services/userService";
import { useAuth } from "../../contexts/AuthContext";
import { normalizeSlug } from "../../utils/slug";
import penguinMascot from "../../assets/penguine.png";
import { useTourState } from "../../contexts/TourContext";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface MascotSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  branding: BrandingSettings | null;
  onUpdate: (newBranding: BrandingSettings) => void;
  userProfile?: UserProfile;
  setupMode?: boolean;
  onComplete?: () => void;
}

export function MascotSettingsModal({
  isOpen,
  onClose,
  branding,
  onUpdate,
  userProfile,
  setupMode = false,
  onComplete,
}: MascotSettingsModalProps) {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { markTourComplete, resetTours } = useTourState();
  const { refreshProfile } = useAuth();

  // Workspace settings
  const [roomName, setRoomName] = useState(branding?.room_name || "");
  const [userName, setUserName] = useState(userProfile?.full_name || "");
  const [workspaceSlug, setWorkspaceSlug] = useState(userProfile?.handle || "");
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [isSlugAvailable, setIsSlugAvailable] = useState<boolean | null>(null);

  const getWorkspaceSaveErrorMessage = (err: unknown): string => {
    const maybeError = err as {
      code?: string;
      message?: string;
      details?: string;
    } | null;

    if (maybeError?.code === "23505") {
      return "This workspace slug is already taken.";
    }

    if (maybeError?.message) {
      return maybeError.message;
    }

    return "Failed to save workspace settings.";
  };

  useEffect(() => {
    if (branding?.room_name) setRoomName(branding.room_name);
    if (userProfile?.full_name !== undefined)
      setUserName(userProfile.full_name || "");
    if (userProfile?.handle) setWorkspaceSlug(userProfile.handle);
  }, [branding?.room_name, userProfile?.full_name, userProfile?.handle]);

  // Slug availability check
  useEffect(() => {
    if (workspaceSlug === userProfile?.handle || workspaceSlug.length < 3) {
      setIsSlugAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingSlug(true);
      try {
        const available = await userService.isHandleAvailable(workspaceSlug);
        setIsSlugAvailable(available);
      } catch {
        setIsSlugAvailable(false);
      } finally {
        setIsCheckingSlug(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [workspaceSlug, userProfile?.handle]);

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
      onUpdate(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
      // Reset input value so the same file can be selected again
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  const handleResetLogo = async () => {
    setUploading(true);
    try {
      const updated = await deckService.updateBrandingSettings({
        logo_url: null,
      });
      onUpdate(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to reset logo.");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveWorkspace = async () => {
    setSaving(true);
    setError(null);
    try {
      // 1. Update Workspace Name if changed
      if (roomName !== branding?.room_name) {
        const updated = await deckService.updateBrandingSettings({
          room_name: roomName,
        });
        onUpdate(updated);
      }

      // 2. Update Profile Name if changed
      const trimmedUserName = userName.trim();
      let profileUpdated = false;
      if (trimmedUserName !== (userProfile?.full_name || "")) {
        if (userProfile?.id) {
          await userService.updateProfile(userProfile.id, {
            full_name: trimmedUserName || null,
          });
          profileUpdated = true;
        }
      }

      // 3. Update Slug if changed and available
      if (workspaceSlug !== userProfile?.handle && isSlugAvailable) {
        if (userProfile?.id) {
          await userService.updateProfile(userProfile.id, {
            handle: workspaceSlug,
          });
          profileUpdated = true;
        }
      }

      if (profileUpdated) {
        await refreshProfile();
      }

      if (setupMode && userProfile?.id) {
        await markTourComplete("workspace_setup_completed");
      }

      if (setupMode) {
        onComplete?.();
      } else {
        onClose();
      }
    } catch (err: unknown) {
      setError(getWorkspaceSaveErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !setupMode && !uploading && !saving) onClose();
      }}
    >
      <DialogContent
        size="md"
        closeOnOutsideClick={!setupMode && !uploading && !saving}
        hideClose={setupMode}
        className="max-h-[calc(100dvh-2rem)]"
      >
        <DialogHeader>
          <DialogTitle>Workspace settings</DialogTitle>
          <DialogDescription>
            Manage your workspace identity, branding, and public URL.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
              {/* Workspace Identity Section */}
              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="workspace-name"
                    className="mb-2 block text-xs font-medium text-ui-text"
                  >
                    Workspace Name
                  </label>
                  <input
                    id="workspace-name"
                    name="workspace-name"
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="h-10 w-full rounded-md border border-ui-border bg-ui-surface px-3 text-sm text-ui-text outline-none transition-colors placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/15"
                    placeholder="e.g. Acme Corp"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-name"
                    className="mb-2 block text-xs font-medium text-ui-text"
                  >
                    User Name
                  </label>
                  <input
                    id="profile-name"
                    name="profile-name"
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="h-10 w-full rounded-md border border-ui-border bg-ui-surface px-3 text-sm text-ui-text outline-none transition-colors placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/15"
                    placeholder="e.g. Your Name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="workspace-slug"
                    className="mb-2 block text-xs font-medium text-ui-text"
                  >
                    Workspace Slug (URL)
                  </label>
                  <div className="relative">
                    <div className="flex h-10 items-center overflow-hidden rounded-md border border-ui-border bg-ui-surface transition-colors focus-within:border-ui-primary focus-within:ring-2 focus-within:ring-ui-primary/15">
                      <span className="select-none pl-3 pr-1 text-xs text-ui-muted">
                        /
                      </span>
                      <input
                        id="workspace-slug"
                        name="workspace-slug"
                        type="text"
                        value={workspaceSlug}
                        onChange={(e) =>
                          setWorkspaceSlug(normalizeSlug(e.target.value))
                        }
                        className="min-w-0 flex-1 bg-transparent pr-3 text-sm text-ui-text outline-none placeholder:text-ui-muted"
                        placeholder="workspace-slug"
                      />
                      <div className="pr-4">
                        {isCheckingSlug ? (
                          <Loader2
                            size={14}
                            className="animate-spin text-ui-muted"
                          />
                        ) : isSlugAvailable === true ? (
                          <Check size={14} className="text-ui-primary" />
                        ) : isSlugAvailable === false ? (
                          <X size={14} className="text-ui-destructive" />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {workspaceSlug !== userProfile?.handle &&
                    isSlugAvailable === false && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 flex items-center gap-2 text-ui-destructive"
                      >
                        <AlertCircle size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Workspace slug already taken
                        </span>
                      </motion.div>
                    )}

                  {workspaceSlug !== userProfile?.handle &&
                    workspaceSlug.length > 0 &&
                    workspaceSlug.length < 3 && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 flex items-center gap-2 text-ui-muted"
                      >
                        <Info size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Too short (min 3 chars)
                        </span>
                      </motion.div>
                    )}

                  {!setupMode &&
                    workspaceSlug !== userProfile?.handle &&
                    isSlugAvailable === true && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 flex gap-3 rounded-lg border border-ui-destructive/20 bg-ui-destructive/10 p-3"
                      >
                        <AlertCircle
                          size={16}
                          className="mt-0.5 shrink-0 text-ui-destructive"
                        />
                        <p className="text-xs font-medium leading-relaxed text-ui-destructive">
                          Warning: Changing this breaks all shared links.
                        </p>
                      </motion.div>
                    )}
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-ui-border bg-ui-subtle px-4 text-sm font-medium text-ui-text transition-colors hover:bg-ui-elevated disabled:opacity-50"
                >
                  <Upload size={16} className="text-ui-primary" />
                  Upload logo
                </button>
              </div>

              <div className="h-px bg-ui-border" />

              {/* Logo / Mascot Section */}
              <div className="flex flex-col items-center">
                <div className="relative group/mascot">
                  <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border border-ui-border bg-ui-subtle p-4">
                    <img
                      src={currentLogo}
                      alt="Mascot Preview"
                      className="w-full h-full object-contain"
                    />

                    {uploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-ui-scrim/60 backdrop-blur-[2px]">
                        <Loader2
                          size={24}
                          className="animate-spin text-ui-primary"
                        />
                      </div>
                    )}
                  </div>

                  {!uploading && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-md border-4 border-ui-elevated bg-ui-primary text-ui-primary-text shadow-[var(--ui-shadow-control)] transition-transform hover:scale-105"
                      title="Upload New"
                    >
                      <Camera size={16} />
                    </button>
                  )}
                </div>

                <div className="mt-8 w-full space-y-4">
                  <div className="flex gap-3 rounded-lg border border-ui-border bg-ui-subtle p-4">
                    <Info
                      size={16}
                      className="mt-0.5 shrink-0 text-ui-primary"
                    />
                    <p className="text-xs leading-relaxed text-ui-muted">
                      Your brand mascot appears in the sidebar. PNGs work best.
                      Max 2MB.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={handleSaveWorkspace}
                      disabled={
                        saving ||
                        (workspaceSlug !== userProfile?.handle &&
                          !isSlugAvailable)
                      }
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-primary-text transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {saving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>
                          {!userProfile?.handle
                            ? "Finalize Setup"
                            : "Save Workspace"}{" "}
                          <Check size={14} />
                        </>
                      )}
                    </button>

                    {branding?.logo_url && (
                      <button
                        onClick={handleResetLogo}
                        disabled={uploading}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-ui-destructive/20 bg-ui-destructive/10 px-4 text-sm font-medium text-ui-destructive transition-colors hover:bg-ui-destructive/15 disabled:opacity-50"
                        title="Reset to Default"
                      >
                        <Trash2 size={16} />
                        Reset Logo
                      </button>
                    )}

                    {!setupMode && (
                      <div className="mt-4 space-y-3 border-t border-ui-border pt-4">
                        <div className="flex items-center gap-2 text-ui-muted">
                          <Info size={14} />
                          <span className="text-xs font-medium">
                            Tutorial Settings
                          </span>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await resetTours();
                              onClose();
                              window.location.reload();
                            } catch (err: unknown) {
                              const message =
                                err instanceof Error
                                  ? err.message
                                  : String(err);
                              setError(message || "Failed to reset tutorials.");
                            }
                          }}
                          className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-ui-border bg-ui-surface px-4 text-sm font-medium text-ui-muted transition-colors hover:bg-ui-subtle hover:text-ui-text"
                        >
                          <RotateCcw size={16} className="opacity-50" />
                          Reset All Tutorials
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {error && (
                <div className="animate-shake rounded-lg border border-ui-destructive/20 bg-ui-destructive/10 p-3 text-center text-sm text-ui-destructive">
                  {error}
                </div>
              )}
        </DialogBody>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
      </DialogContent>
    </Dialog>
  );
}
