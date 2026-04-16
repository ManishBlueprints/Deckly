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
    <section className="space-y-6 pt-6 border-t border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <Lock size={16} className="text-deckly-primary" />
        <h3 className="text-sm font-medium text-white">Security & Access</h3>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Email Required */}
          <div
            className={cn(
              "flex items-center justify-between p-4 rounded-lg border transition-all duration-200 cursor-pointer",
              requireEmail
                ? "bg-background border-deckly-primary/50"
                : "bg-surface-container border-white/10 hover:border-white/20",
            )}
            onClick={() => setRequireEmail(!requireEmail)}
          >
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-10 h-10 flex items-center justify-center transition-colors shrink-0 aspect-square",
                  requireEmail
                    ? "bg-deckly-primary/10 text-deckly-primary rounded-md"
                    : "text-slate-500",
                )}
              >
                <Mail size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">
                  Email Required
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  ID Authentication
                </p>
              </div>
            </div>
            <Switch
              id="require-email"
              checked={requireEmail}
              onCheckedChange={setRequireEmail}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Gate Access */}
          <div
            className={cn(
              "flex items-center justify-between p-4 rounded-lg border transition-all duration-200 cursor-pointer",
              requirePassword
                ? "bg-background border-deckly-primary/50"
                : "bg-surface-container border-white/10 hover:border-white/20",
            )}
            onClick={() => setRequirePassword(!requirePassword)}
          >
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-10 h-10 flex items-center justify-center transition-colors shrink-0 aspect-square",
                  requirePassword
                    ? "bg-deckly-primary/10 text-deckly-primary rounded-md"
                    : "text-slate-500",
                )}
              >
                <Lock size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">
                  Gate Access
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Password Lock</p>
              </div>
            </div>
            <Switch
              id="require-password"
              checked={requirePassword}
              onCheckedChange={setRequirePassword}
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
              <div className="space-y-2 mt-2 pb-2">
                <Label
                  htmlFor="view-password"
                  className="text-xs font-semibold text-slate-300"
                >
                  Set Security Key
                </Label>
                <div className="relative group">
                  <Input
                    id="view-password"
                    type={showPasswordField ? "text" : "password"}
                    value={viewPassword}
                    onChange={(e) => setViewPassword(e.target.value)}
                    placeholder="Enter strong password..."
                    className={cn(
                      "h-11 pr-12 rounded-md border-white/10 bg-[#2B2B2B] focus-visible:ring-1 focus-visible:ring-deckly-primary text-white placeholder:text-slate-500 transition-all focus:bg-[#2B2B2B]",
                      requirePassword && !viewPassword.trim() && "border-red-500/50"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordField(!showPasswordField)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
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
            "flex items-center justify-between p-4 rounded-lg border transition-all duration-200 cursor-pointer mt-4",
            expiryEnabled
              ? "bg-background border-deckly-primary/50"
              : "bg-surface-container border-white/10 hover:border-white/20",
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
                "w-10 h-10 flex items-center justify-center transition-colors shrink-0 aspect-square",
                expiryEnabled
                  ? "bg-deckly-primary/10 text-deckly-primary rounded-md"
                  : "text-slate-500",
              )}
            >
              <CalendarDays size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">
                Expiration
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Duration Control</p>
            </div>
          </div>
          <Switch
            id="link-expiry"
            checked={expiryEnabled}
            onCheckedChange={(checked) => {
              setExpiryEnabled(checked);
              if (!checked) setExpiryDate("");
            }}
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
              <div className="space-y-2 mt-2">
                <Label
                  htmlFor="expiry-date"
                  className="text-xs font-semibold text-slate-300"
                >
                  Select Deadline
                </Label>
                <Input
                  id="expiry-date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="h-11 rounded-md border-white/10 bg-[#2B2B2B] focus-visible:ring-1 focus-visible:ring-deckly-primary text-white transition-all focus:bg-[#2B2B2B] [color-scheme:dark]"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
