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
import { motion, AnimatePresence } from "framer-motion";
import { BrandingSettings, UserProfile } from "../../types";
import { deckService } from "../../services/deckService";
import { userService } from "../../services/userService";
import { useAuth } from "../../contexts/AuthContext";
import { normalizeSlug } from "../../utils/slug";
import penguinMascot from "../../assets/penguine.png";
import { useTourState } from "../../contexts/TourContext";

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
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to save workspace settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={setupMode ? undefined : onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-surface-card border-x border-t sm:border border-white/5 rounded-none overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-surface-card">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Workspace Settings
                </h2>
                <p className="text-xs text-slate-400">
                  Manage your branding and public URL
                </p>
              </div>
              <button
                onClick={onClose}
                style={setupMode ? { display: "none" } : undefined}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-none transition-colors"
                disabled={uploading || saving}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 max-h-[80vh] sm:max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar pb-32 sm:pb-6">
              {/* Workspace Identity Section */}
              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="workspace-name"
                    className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1"
                  >
                    Workspace Name
                  </label>
                  <input
                    id="workspace-name"
                    name="workspace-name"
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0d0d0d] border border-white/10 rounded-none text-sm text-white focus:outline-none focus:ring-1 focus:ring-deckly-primary/50 focus:border-deckly-primary transition-all shadow-inner"
                    placeholder="e.g. Acme Corp"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-name"
                    className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1"
                  >
                    User Name
                  </label>
                  <input
                    id="profile-name"
                    name="profile-name"
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0d0d0d] border border-white/10 rounded-none text-sm text-white focus:outline-none focus:ring-1 focus:ring-deckly-primary/50 focus:border-deckly-primary transition-all shadow-inner"
                    placeholder="e.g. Your Name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="workspace-slug"
                    className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1"
                  >
                    Workspace Slug (URL)
                  </label>
                  <div className="relative">
                    <div className="flex items-center bg-[#0d0d0d] border border-white/10 rounded-none overflow-hidden focus-within:ring-1 focus-within:ring-deckly-primary/50 focus-within:border-deckly-primary transition-all shadow-inner">
                      <span className="pl-4 pr-1 text-xs text-slate-600 select-none">
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
                        className="flex-1 py-3 pr-4 bg-transparent text-sm text-white focus:outline-none placeholder:text-slate-600"
                        placeholder="workspace-slug"
                      />
                      <div className="pr-4">
                        {isCheckingSlug ? (
                          <Loader2
                            size={14}
                            className="text-slate-600 animate-spin"
                          />
                        ) : isSlugAvailable === true ? (
                          <Check size={14} className="text-emerald-500" />
                        ) : isSlugAvailable === false ? (
                          <X size={14} className="text-red-500" />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {!setupMode &&
                    workspaceSlug !== userProfile?.handle &&
                    isSlugAvailable === false && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 flex items-center gap-2 text-red-500"
                      >
                        <AlertCircle size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Handle already taken
                        </span>
                      </motion.div>
                    )}

                  {!setupMode &&
                    workspaceSlug !== userProfile?.handle &&
                    workspaceSlug.length > 0 &&
                    workspaceSlug.length < 3 && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 flex items-center gap-2 text-slate-500"
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
                        className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-none flex gap-3"
                      >
                        <AlertCircle
                          size={16}
                          className="text-red-500 shrink-0 mt-0.5"
                        />
                        <p className="text-[10px] text-red-500 font-bold uppercase tracking-[0.15em] leading-relaxed">
                          Warning: Changing this breaks all shared links.
                        </p>
                      </motion.div>
                    )}
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface-low hover:bg-surface-high text-white text-[10px] font-bold uppercase tracking-widest rounded-none border border-white/5 transition-all disabled:opacity-50"
                >
                  <Upload size={14} className="text-primary" />
                  Upload Logo
                </button>
              </div>

              <div className="h-px bg-white/5" />

              {/* Logo / Mascot Section */}
              <div className="flex flex-col items-center">
                <div className="relative group/mascot">
                  <div className="w-32 h-32 bg-surface-low rounded-none border border-white/5 overflow-hidden flex items-center justify-center p-4">
                    <img
                      src={currentLogo}
                      alt="Mascot Preview"
                      className="w-full h-full object-contain"
                    />

                    {uploading && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                        <Loader2
                          size={24}
                          className="text-deckly-primary animate-spin"
                        />
                      </div>
                    )}
                  </div>

                  {!uploading && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 w-9 h-9 bg-deckly-primary text-slate-950 rounded-none flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all border-4 border-surface-card"
                      title="Upload New"
                    >
                      <Camera size={16} />
                    </button>
                  )}
                </div>

                <div className="mt-8 w-full space-y-4">
                  <div className="bg-surface-low rounded-none p-4 border border-white/5 flex gap-3">
                    <Info
                      size={16}
                      className="text-deckly-primary shrink-0 mt-0.5"
                    />
                    <p className="text-[10px] text-slate-400 leading-relaxed font-bold uppercase tracking-widest">
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
                      className="w-full py-3.5 bg-deckly-primary text-slate-950 font-bold uppercase tracking-[0.2em] text-[10px] rounded-none hover:brightness-110 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
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
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-none border border-red-500/20 transition-all disabled:opacity-50 text-[10px] font-bold uppercase tracking-widest"
                        title="Reset to Default"
                      >
                        <Trash2 size={16} />
                        Reset Logo
                      </button>
                    )}

                    {!setupMode && (
                      <div className="pt-4 mt-4 border-t border-white/5 space-y-4">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Info size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">
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
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-none border border-white/10 transition-all text-[10px] font-bold uppercase tracking-widest"
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
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-none text-[10px] font-bold uppercase tracking-widest text-red-400 text-center animate-shake">
                  {error}
                </div>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
