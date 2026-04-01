import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";
import { Deck } from "../../types";
import { deckService } from "../../services/deckService";
import Card from "../common/Card";
import Input from "../common/Input";
import Button from "../common/Button";

interface AccessGateProps {
  deck: Deck;
  onAccessGranted: (email?: string, password?: string) => void;
  onVerifyPassword?: (password: string) => Promise<boolean>;
  sessionEmail?: string; // pre-fill from logged-in user or undefined
}

const EMAIL_CACHE_TTL = 24 * 60 * 60 * 1000;

const AccessGate: React.FC<AccessGateProps> = ({
  deck,
  onAccessGranted,
  onVerifyPassword,
  sessionEmail,
}) => {
  const EMAIL_CACHE_KEY = useMemo(
    () => `deckly_email_${deck.id}`,
    [deck.id],
  );

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
      onAccessGranted(hasEmail ? email : undefined, undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const trimmedEmail = email.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
        setError("Please enter a valid email address.");
        return;
      }

      if (trimmedEmail !== email) {
        setEmail(trimmedEmail);
      }

      const finalEmail = trimmedEmail;

      if (deck.require_password) {
        setStep("password");
      } else {
        saveEmailToCache(finalEmail);
        onAccessGranted(finalEmail, undefined);
      }
    } else {
      try {
        setIsVerifying(true);
        const isValid = onVerifyPassword
          ? await onVerifyPassword(password)
          : await deckService.checkDeckPassword(deck.slug, password);

        if (isValid) {
          if (email) saveEmailToCache(email);
          onAccessGranted(email || undefined, password);
        } else {
          setError("Incorrect password. Please try again.");
        }
      } catch (err) {
        console.error("Verification error:", err);
        setError("Failed to verify password. Please try again.");
      } finally {
        setIsVerifying(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden bg-grid-kinetic animate-in fade-in duration-700">
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-primary/10 rounded-full blur-[120px] -mr-80 -mt-80 -z-10" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-brand-tertiary/5 rounded-full blur-[100px] -ml-80 -mb-80 -z-10" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "circOut" }}
        className="max-w-md w-full relative"
      >
        <Card
          variant="glass"
          className="p-10 md:p-14 rounded-3xl text-center"
          hoverable={false}
        >
          <div className="flex flex-col items-center">
            {/* Visual Icon */}
            <div className="w-24 h-24 bg-white/5 rounded-2xl flex items-center justify-center mb-10 border border-white/10 shadow-2xl group relative">
              <div className="absolute inset-0 bg-brand-primary/20 rounded-2xl blur-xl opacity-50" />
              <ShieldCheck
                size={48}
                className="text-brand-primary relative z-10"
              />
            </div>

            {/* Typography */}
            <span className="text-brand-primary text-[10px] font-bold uppercase tracking-[0.4em] mb-4">
              Secure Access protocol
            </span>
            <h2 className="text-5xl font-bold text-white tracking-tight mb-6 mt-2">
              Gatekeeper
            </h2>
            <p className="text-slate-500 font-medium text-[11px] uppercase tracking-widest leading-relaxed mb-12 max-w-[280px]">
              This document is protected. Please verify your credentials to
              access <span className="text-white">"{deck.title}"</span>.
            </p>

            <form
              onSubmit={handleSubmit}
              className="w-full flex flex-col gap-6 text-left"
            >
              <AnimatePresence mode="wait">
                {step === "email" ? (
                  <motion.div
                    key="email-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <Input
                      label="AUTHORIZED EMAIL"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      icon={Mail}
                      required
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck="false"
                      className="group"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="password-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <Input
                      label="ACCESS PERMIT"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      icon={Lock}
                      required
                      autoFocus
                      className="group"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 text-brand-tertiary bg-brand-tertiary/5 p-4 rounded-xl border border-brand-tertiary/10 text-[10px] font-bold uppercase tracking-widest"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="large"
                fullWidth
                loading={isVerifying}
                icon={ArrowRight}
                className="mt-4 uppercase tracking-[0.2em] text-[11px]"
              >
                {step === "email" && deck.require_password
                  ? "Next: Password"
                  : "Execute Unlock"}
              </Button>
            </form>
          </div>
        </Card>

        {/* Footer Details */}
        <div className="mt-12 flex flex-col items-center gap-4 opacity-40">
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
          <p className="text-center text-white text-[10px] uppercase font-bold tracking-[0.3em]">
            Encrypted Via Deckly Protocol &copy; 2026
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AccessGate;
