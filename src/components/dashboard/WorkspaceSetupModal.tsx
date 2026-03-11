import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Loader2,
  Rocket,
  Link as LinkIcon,
  AlertCircle,
} from "lucide-react";
import { userService } from "../../services/userService";
import { deckService } from "../../services/deckService";
import { normalizeSlug } from "../../utils/slug";

interface WorkspaceSetupModalProps {
  isOpen: boolean;
  onComplete: (name: string, slug: string) => void;
  userId: string;
}

export function WorkspaceSetupModal({
  isOpen,
  onComplete,
  userId,
}: WorkspaceSetupModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from name
  useEffect(() => {
    if (name) {
      setSlug(normalizeSlug(name));
    }
  }, [name]);

  // Check availability when slug changes
  useEffect(() => {
    if (slug.length < 3) {
      setIsAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      try {
        const available = await userService.isHandleAvailable(slug);
        setIsAvailable(available);
      } catch (err) {
        console.error("Failed to check slug availability", err);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug]);

  const handleSave = async () => {
    if (!name.trim() || !slug.trim() || !isAvailable) return;

    setIsSaving(true);
    setError(null);

    try {
      // 1. Update Profile Handle (Slug)
      await userService.updateProfile(userId, { handle: slug });

      // 2. Update Branding Room Name (Display Name)
      await deckService.updateBrandingSettings({ room_name: name });

      onComplete(name, slug);
    } catch (err: unknown) {
      console.error("Setup failed", err);
      setError("Failed to save workspace settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
          >
            {/* Ambient Background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-deckly-primary/10 rounded-full blur-[100px] -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] -ml-32 -mb-32" />

            <div className="relative z-10 p-10 md:p-14">
              <div className="w-16 h-16 bg-deckly-primary/10 border border-deckly-primary/20 rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-2xl shadow-deckly-primary/10">
                <Rocket className="text-deckly-primary" size={32} />
              </div>

              <div className="text-center space-y-3 mb-12">
                <h2 className="text-3xl font-black text-white tracking-tight uppercase tracking-wider">
                  Initiate Workspace
                </h2>
                <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
                  Choose how your workspace appears and set your shareable link
                  handle.
                </p>
              </div>

              <div className="space-y-8">
                {/* Workspace Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl text-base text-white font-bold tracking-tight placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-deckly-primary/20 focus:border-deckly-primary/30 transition-all shadow-inner"
                  />
                </div>

                {/* Workspace Slug */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">
                    Workspace URL Handle
                  </label>
                  <div className="relative">
                    <div className="flex items-center bg-white/5 border border-white/5 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-deckly-primary/20 focus-within:border-deckly-primary/30 transition-all shadow-inner">
                      <span className="pl-6 pr-1 text-sm font-bold text-slate-600 select-none">
                        deckly.com/
                      </span>
                      <input
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                        placeholder="acme"
                        className="flex-1 py-4 pr-6 bg-transparent text-base text-deckly-primary font-bold focus:outline-none placeholder:text-slate-700"
                      />
                      <div className="pr-6">
                        {isChecking ? (
                          <Loader2
                            size={18}
                            className="text-slate-600 animate-spin"
                          />
                        ) : isAvailable === true ? (
                          <Check size={18} className="text-emerald-500" />
                        ) : isAvailable === false ? (
                          <AlertCircle size={18} className="text-red-500" />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-2.5 px-4 py-3 bg-white/[0.02] border border-white/5 rounded-xl">
                    <LinkIcon
                      size={14}
                      className="text-slate-600 shrink-0 mt-0.5"
                    />
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                      This handle will appear in all your shareable links.
                    </p>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-500 font-bold text-center uppercase tracking-wider animate-shake">
                    {error}
                  </p>
                )}

                <button
                  onClick={handleSave}
                  disabled={
                    !name.trim() || !slug.trim() || !isAvailable || isSaving
                  }
                  className="w-full py-5 bg-deckly-primary text-slate-950 font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:bg-opacity-90 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xl shadow-deckly-primary/20 mt-4 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <span>Complete Setup</span>
                      <Check size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
