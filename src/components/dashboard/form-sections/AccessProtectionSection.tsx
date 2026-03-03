import { useState } from "react";
import { Lock, Eye, EyeOff, Mail, CalendarDays } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "../../ui/switch";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { cn } from "@/lib/utils";

interface AccessProtectionSectionProps {
  requireEmail: boolean;
  setRequireEmail: (v: boolean) => void;
  expiryEnabled: boolean;
  setExpiryEnabled: (v: boolean) => void;
  expiryDate: string;
  setExpiryDate: (v: string) => void;
  requirePassword: boolean;
  setRequirePassword: (v: boolean) => void;
  viewPassword: string;
  setViewPassword: (v: string) => void;
}

export function AccessProtectionSection({
  requireEmail,
  setRequireEmail,
  expiryEnabled,
  setExpiryEnabled,
  expiryDate,
  setExpiryDate,
  requirePassword,
  setRequirePassword,
  viewPassword,
  setViewPassword,
}: AccessProtectionSectionProps) {
  const [showPasswordField, setShowPasswordField] = useState(false);

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3 px-1 mb-6">
        <Lock size={16} className="text-deckly-primary" />
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
          SECURITY OVERRIDE
        </h3>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Email Required */}
          <div
            className={cn(
              "flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 group cursor-pointer",
              requireEmail
                ? "bg-deckly-primary/[0.08] border-deckly-primary/30 shadow-[0_0_30px_rgba(34,197,94,0.05)]"
                : "bg-white/[0.02] border-white/10 hover:border-white/20",
            )}
            onClick={() => setRequireEmail(!requireEmail)}
          >
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 shadow-inner shrink-0 aspect-square",
                  requireEmail
                    ? "bg-deckly-primary/20 text-deckly-primary border border-deckly-primary/30"
                    : "bg-white/5 text-slate-700 border border-white/5",
                )}
              >
                <Mail size={18} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-white uppercase tracking-wider leading-tight">
                  EMAIL REQUIRED
                </p>
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-1">
                  ID AUTHENTICATION
                </p>
              </div>
            </div>
            <Switch
              id="require-email"
              checked={requireEmail}
              onCheckedChange={setRequireEmail}
              className="data-[state=checked]:bg-deckly-primary"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Gate Access */}
          <div
            className={cn(
              "flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 group cursor-pointer",
              requirePassword
                ? "bg-deckly-primary/[0.08] border-deckly-primary/30 shadow-[0_0_30px_rgba(34,197,94,0.05)]"
                : "bg-white/[0.02] border-white/10 hover:border-white/20",
            )}
            onClick={() => setRequirePassword(!requirePassword)}
          >
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 shadow-inner shrink-0 aspect-square",
                  requirePassword
                    ? "bg-deckly-primary/20 text-deckly-primary border border-deckly-primary/30"
                    : "bg-white/5 text-slate-700 border border-white/5",
                )}
              >
                <Lock size={18} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-white uppercase tracking-wider leading-tight">
                  GATE ACCESS
                </p>
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-1">
                  PASSWORD LOCK
                </p>
              </div>
            </div>
            <Switch
              id="require-password"
              checked={requirePassword}
              onCheckedChange={setRequirePassword}
              className="data-[state=checked]:bg-deckly-primary"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {/* Password Reveal */}
        <AnimatePresence>
          {requirePassword && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 mt-1 pb-2">
                <Label
                  htmlFor="view-password"
                  className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 ml-1"
                >
                  Set Security Key
                </Label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-slate-700 group-focus-within:text-deckly-primary group-focus-within:border-deckly-primary/30 transition-all">
                    <Lock size={14} />
                  </div>
                  <Input
                    id="view-password"
                    type={showPasswordField ? "text" : "password"}
                    value={viewPassword}
                    onChange={(e) => setViewPassword(e.target.value)}
                    placeholder="ENTER STRONG PASSWORD..."
                    className="h-12 pl-14 pr-12 rounded-xl border-white/5 bg-white/[0.03] focus-visible:ring-deckly-primary/30 text-white font-bold uppercase tracking-widest placeholder:text-slate-800 transition-all shadow-inner focus:bg-white/[0.08]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordField(!showPasswordField)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors"
                  >
                    {showPasswordField ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expiration Toggle (Standalone Row) */}
        <div
          className={cn(
            "flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 group cursor-pointer",
            expiryEnabled
              ? "bg-deckly-primary/[0.08] border-deckly-primary/30 shadow-[0_0_30px_rgba(34,197,94,0.05)]"
              : "bg-white/[0.02] border-white/10 hover:border-white/20",
          )}
          onClick={() => {
            const next = !expiryEnabled;
            setExpiryEnabled(next);
            if (!next) setExpiryDate("");
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 shadow-inner shrink-0 aspect-square",
                expiryEnabled
                  ? "bg-deckly-primary/20 text-deckly-primary border border-deckly-primary/30"
                  : "bg-white/5 text-slate-700 border border-white/5",
              )}
            >
              <CalendarDays size={18} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-white uppercase tracking-wider leading-tight">
                EXPIRATION
              </p>
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-1">
                DURATION CONTROL
              </p>
            </div>
          </div>
          <Switch
            id="link-expiry"
            checked={expiryEnabled}
            onCheckedChange={(checked) => {
              setExpiryEnabled(checked);
              if (!checked) setExpiryDate("");
            }}
            className="data-[state=checked]:bg-deckly-primary"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Expiration Reveal */}
        <AnimatePresence>
          {expiryEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 mt-1">
                <Label
                  htmlFor="expiry-date"
                  className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 ml-1"
                >
                  Select Deadline
                </Label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-slate-700 group-focus-within:text-deckly-primary group-focus-within:border-deckly-primary/30 transition-all">
                    <CalendarDays size={14} />
                  </div>
                  <Input
                    id="expiry-date"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="h-12 pl-14 rounded-xl border-white/5 bg-white/[0.03] focus-visible:ring-deckly-primary/30 text-white font-bold uppercase tracking-widest placeholder:text-slate-800 transition-all shadow-inner focus:bg-white/[0.08] [color-scheme:dark]"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
