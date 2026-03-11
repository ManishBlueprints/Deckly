import { useState, useRef, useEffect } from "react";
import {
  X,
  Upload,
  Trash2,
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
import { normalizeSlug } from "../../utils/slug";
import penguinMascot from "../../assets/penguine.png";

interface MascotSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  branding: BrandingSettings | null;
  onUpdate: (newBranding: BrandingSettings) => void;
  userProfile?: UserProfile;
}

export function MascotSettingsModal({
  isOpen,
  onClose,
  branding,
  onUpdate,
  userProfile,
}: MascotSettingsModalProps) {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Workspace settings
  const [roomName, setRoomName] = useState(branding?.room_name || "");
  const [workspaceSlug, setWorkspaceSlug] = useState(userProfile?.handle || "");
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [isSlugAvailable, setIsSlugAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (branding?.room_name) setRoomName(branding.room_name);
    if (userProfile?.handle) setWorkspaceSlug(userProfile.handle);
  }, [branding?.room_name, userProfile?.handle]);

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
    } catch {
      setError("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleResetLogo = async () => {
    setUploading(true);
    try {
      const updated = await deckService.updateBrandingSettings({
        logo_url: null,
      });
      onUpdate(updated);
    } catch {
      setError("Failed to reset logo.");
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

      // 2. Update Slug if changed and available
      if (workspaceSlug !== userProfile?.handle && isSlugAvailable) {
        if (userProfile?.id) {
          await userService.updateProfile(userProfile.id, {
            handle: workspaceSlug,
          });
          window.location.reload();
        }
      }
    } catch {
      setError("Failed to save workspace settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
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
                className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                disabled={uploading || saving}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto scrollbar-none">
              {/* Workspace Identity Section */}
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-deckly-primary/30 transition-all shadow-inner"
                    placeholder="e.g. Acme Corp"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">
                    Workspace Slug (URL)
                  </label>
                  <div className="relative">
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden focus-within:border-deckly-primary/30 transition-all shadow-inner">
                      <span className="pl-4 pr-1 text-xs text-slate-600 select-none">
                        /
                      </span>
                      <input
                        type="text"
                        value={workspaceSlug}
                        onChange={(e) =>
                          setWorkspaceSlug(normalizeSlug(e.target.value))
                        }
                        className="flex-1 py-3 pr-4 bg-transparent text-sm text-white focus:outline-none"
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

                  {workspaceSlug !== userProfile?.handle && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3"
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
                  onClick={handleSaveWorkspace}
                  disabled={
                    saving ||
                    (workspaceSlug !== userProfile?.handle && !isSlugAvailable)
                  }
                  className="w-full py-3.5 bg-white text-slate-950 font-black uppercase tracking-[0.2em] text-[10px] rounded-xl hover:bg-slate-200 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Save Workspace <Check size={14} />
                    </>
                  )}
                </button>
              </div>

              <div className="h-px bg-white/5" />

              {/* Logo / Mascot Section */}
              <div className="flex flex-col items-center">
                <div className="relative group/mascot">
                  <div className="w-32 h-32 bg-slate-800 rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center p-4">
                    <img
                      src={currentLogo}
                      alt="Mascot Preview"
                      className="w-full h-full object-contain"
                    />

                    {uploading && (
                      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center">
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
                      className="absolute -bottom-2 -right-2 w-9 h-9 bg-deckly-primary text-slate-950 rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all border-4 border-slate-900"
                      title="Upload New"
                    >
                      <Camera size={16} />
                    </button>
                  )}
                </div>

                <div className="mt-8 w-full space-y-4">
                  <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 flex gap-3">
                    <Info
                      size={16}
                      className="text-deckly-primary shrink-0 mt-0.5"
                    />
                    <p className="text-[10px] text-slate-400 leading-relaxed font-bold uppercase tracking-widest">
                      Your brand mascot appears in the sidebar. PNGs work best.
                      Max 2MB.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl border border-white/10 transition-all disabled:opacity-50"
                    >
                      <Upload size={14} />
                      Upload Logo
                    </button>

                    {branding?.logo_url && (
                      <button
                        onClick={handleResetLogo}
                        disabled={uploading}
                        className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition-all disabled:opacity-50"
                        title="Reset to Default"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest text-red-400 text-center animate-shake">
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
