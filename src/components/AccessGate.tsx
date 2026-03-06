import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";
import { Deck } from "../types";
import { deckService } from "../services/deckService";

interface AccessGateProps {
  deck: Deck;
  onAccessGranted: (email?: string) => void;
  onVerifyPassword?: (password: string) => Promise<boolean>;
  sessionEmail?: string; // pre-fill from logged-in user or undefined
}

const AccessGate: React.FC<AccessGateProps> = ({
  deck,
  onAccessGranted,
  onVerifyPassword,
  sessionEmail,
}) => {
  const EMAIL_CACHE_KEY = `deckly_email_${deck.id}`;
  const EMAIL_CACHE_TTL = 24 * 60 * 60 * 1000;

  // Pre-fill email from session; also check 24h localStorage cache
  const getInitialEmail = (): string => {
    if (sessionEmail) return sessionEmail;
    try {
      const raw = localStorage.getItem(EMAIL_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.email && Date.now() < parsed.expires) return parsed.email;
      }
    } catch {
      /* ignore */
    }
    return "";
  };

  const [email, setEmail] = useState(() => getInitialEmail());
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Determine the starting step based on requirements and known info
  const getStartingStep = (): "email" | "password" => {
    if (deck.require_email && !email) return "email";
    if (deck.require_password) return "password";
    return "email"; // Default fallback
  };

  const [step, setStep] = useState<"email" | "password">(getStartingStep());

  // Auto-grant access if all requirements are met on mount or update
  React.useEffect(() => {
    const hasEmail = !!email;
    const needsEmail = !!deck.require_email;
    const needsPassword = !!deck.require_password;

    if ((!needsEmail || hasEmail) && !needsPassword) {
      onAccessGranted(hasEmail ? email : undefined);
    }
  }, [deck.id]);

  const saveEmailToCache = (resolvedEmail: string) => {
    try {
      localStorage.setItem(
        EMAIL_CACHE_KEY,
        JSON.stringify({
          email: resolvedEmail,
          expires: Date.now() + EMAIL_CACHE_TTL,
        }),
      );
    } catch {
      /* ignore */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifying) return;
    setError(null);

    const isEmailStep = step === "email";

    if (isEmailStep) {
      if (!email || !email.includes("@")) {
        setError("Please enter a valid email address.");
        return;
      }

      if (deck.require_password) {
        setStep("password");
      } else {
        saveEmailToCache(email);
        onAccessGranted(email);
      }
    } else {
      try {
        setIsVerifying(true);
        const isValid = onVerifyPassword
          ? await onVerifyPassword(password)
          : await deckService.checkDeckPassword(deck.slug, password);

        if (isValid) {
          if (email) saveEmailToCache(email);
          onAccessGranted(email || undefined);
        } else {
          setError("Incorrect password. Please try again.");
        }
      } catch (err) {
        setError("Failed to verify password. Please try again.");
      } finally {
        setIsVerifying(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#090b10] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-deckly-primary/5 rounded-full blur-[100px] -mr-64 -mt-64" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[100px] -ml-64 -mb-64" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-md w-full relative z-10"
      >
        <div className="glass-shiny border border-white/5 rounded-[3rem] p-10 md:p-14 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mb-10 border border-white/10 shadow-2xl group-hover:scale-110 transition-transform duration-700 relative">
              <div className="absolute inset-0 bg-deckly-primary/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <ShieldCheck
                size={48}
                className="text-deckly-primary relative z-10"
              />
            </div>

            <p className="text-[10px] font-bold text-deckly-primary uppercase tracking-[0.3em] mb-4">
              SECURE ACCESS PROTOCOL
            </p>
            <h2 className="text-4xl font-bold text-white tracking-tight mb-6 uppercase tracking-wider">
              Gatekeeper
            </h2>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest leading-relaxed mb-12 opacity-80">
              This terminal is protected. Please verify your credentials to
              access <span className="text-white">"{deck.title}"</span>.
            </p>

            <form
              onSubmit={handleSubmit}
              className="w-full flex flex-col gap-8 text-left"
            >
              <AnimatePresence mode="wait">
                {step === "email" ? (
                  <motion.div
                    key="email-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-3"
                  >
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-4">
                      AUTHORIZED EMAIL
                    </label>
                    <div className="relative group">
                      <Mail
                        size={18}
                        className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-deckly-primary transition-colors"
                      />
                      <input
                        type="email"
                        placeholder="name@resources.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck="false"
                        className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 pl-16 pr-6 text-xs tracking-widest text-white focus:outline-none focus:border-deckly-primary/30 transition-all shadow-inner"
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="password-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-3"
                  >
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-4">
                      ACCESS PERMIT
                    </label>
                    <div className="relative group">
                      <Lock
                        size={18}
                        className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-deckly-primary transition-colors"
                      />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoFocus
                        className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 pl-16 pr-6 text-xs font-bold uppercase tracking-widest text-white focus:outline-none focus:border-deckly-primary/30 transition-all shadow-inner"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex items-center gap-3 text-red-500 bg-red-500/5 p-4 rounded-xl border border-red-500/10 text-[9px] font-bold uppercase tracking-widest"
                >
                  <AlertCircle size={14} />
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                className="w-full py-5 bg-white text-slate-950 font-bold uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-slate-200 transition-all active:scale-[0.98] shadow-2xl flex items-center justify-center gap-3 mt-4"
              >
                {step === "email" && deck.require_password
                  ? "PROCEED TO PASSWORD"
                  : "EXECUTE UNLOCK"}
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>

        <p className="mt-12 text-center text-slate-700 text-[10px] uppercase font-bold tracking-[0.3em] opacity-40">
          ENCRYPTED VIA DECKLY PROTOCOL &copy; 2026
        </p>
      </motion.div>
    </div>
  );
};

export default AccessGate;
