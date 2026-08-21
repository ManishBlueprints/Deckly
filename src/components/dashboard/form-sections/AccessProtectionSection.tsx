import { useState, type ReactNode } from "react";
import { Lock, Eye, EyeOff, Mail, CalendarDays, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "../../ui/switch";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { cn } from "@/lib/utils";
import { PremiumFeatureIcon } from "../PremiumFeatureIcon";

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
  allowDownload?: boolean;
  setAllowDownload?: (v: boolean) => void;
  canUseDownloadControls?: boolean;
  downloadControlsLoading?: boolean;
  onDownloadUpsell?: () => void;
  canUseAccessControls?: boolean;
  accessControlsLoading?: boolean;
  onAccessUpsell?: () => void;
  showHeading?: boolean;
  children?: ReactNode;
}

interface AccessOptionCardProps {
  id: string;
  checked: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function AccessOptionCard({
  id,
  checked,
  icon,
  title,
  description,
  onChange,
  disabled = false,
}: AccessOptionCardProps) {
  return (
    <div
      className={cn(
        "flex min-h-[88px] cursor-pointer items-center justify-between gap-4 rounded-[10px] border p-4 transition-colors",
        checked
          ? "border-ui-primary/50 bg-ui-primary/10 shadow-[var(--ui-shadow-control)]"
          : "border-ui-border bg-ui-surface hover:border-ui-primary/30 hover:bg-ui-subtle",
      )}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-md border transition-colors",
            checked
              ? "border-ui-primary/30 bg-ui-primary/15 text-ui-primary"
              : "border-ui-border bg-ui-subtle text-ui-muted",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold leading-tight text-ui-text">
            <PremiumFeatureIcon tier="PRO" />
            {title}
          </p>
          <p className="mt-1 text-xs text-ui-muted">{description}</p>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        onClick={(event) => event.stopPropagation()}
        aria-label={title}
      />
    </div>
  );
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
  allowDownload,
  setAllowDownload,
  canUseDownloadControls,
  downloadControlsLoading = false,
  onDownloadUpsell,
  canUseAccessControls = true,
  accessControlsLoading = false,
  onAccessUpsell,
  showHeading = true,
  children,
}: AccessProtectionSectionProps) {
  const [showPasswordField, setShowPasswordField] = useState(false);
  const hasDownloadControl = typeof allowDownload === "boolean" && Boolean(
    setAllowDownload && (canUseDownloadControls || onDownloadUpsell),
  );
  const requestAccessControl = () => onAccessUpsell?.();

  return (
    <section className={cn("space-y-5", showHeading && "border-t border-ui-border pt-6")}>
      {showHeading ? (
        <div className="mb-2 flex items-center gap-2">
          <Lock size={16} className="text-ui-primary" />
          <h3 className="text-sm font-semibold text-ui-text">Security & Access</h3>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AccessOptionCard
            id="require-email"
            checked={requireEmail}
            icon={<Mail size={18} />}
            title="Email Required"
            description="ID authentication"
            disabled={accessControlsLoading}
            onChange={(checked) => {
              if (checked && !canUseAccessControls) return requestAccessControl();
              setRequireEmail(checked);
            }}
          />

          <AccessOptionCard
            id="require-password"
            checked={requirePassword}
            icon={<Lock size={18} />}
            title="Gate Access"
            description="Password lock"
            disabled={accessControlsLoading}
            onChange={(checked) => {
              if (checked && !canUseAccessControls) return requestAccessControl();
              setRequirePassword(checked);
            }}
          />

          {hasDownloadControl && (
            <AccessOptionCard
              id="allow-download"
              checked={allowDownload ?? false}
              icon={<Download size={18} />}
              title="Downloads"
              description={allowDownload ? "Download enabled" : "Download disabled"}
              disabled={downloadControlsLoading}
              onChange={(checked) => {
                if (checked && !canUseDownloadControls) {
                  onDownloadUpsell?.();
                  return;
                }
                setAllowDownload?.(checked);
              }}
            />
          )}

          <AccessOptionCard
            id="link-expiry"
            checked={expiryEnabled}
            icon={<CalendarDays size={18} />}
            title="Expiration"
            description="Duration control"
            disabled={accessControlsLoading}
            onChange={(checked) => {
              if (checked && !canUseAccessControls) return requestAccessControl();
              setExpiryEnabled(checked);
              if (!checked) setExpiryDate("");
            }}
          />
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
                  className="text-xs font-semibold text-ui-text"
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
                      "h-11 rounded-md border-ui-border bg-ui-surface pr-12 text-ui-text placeholder:text-ui-muted focus-visible:ring-2 focus-visible:ring-ui-focus",
                      requirePassword && !viewPassword.trim() && "border-ui-destructive/60"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordField(!showPasswordField)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ui-muted transition-colors hover:text-ui-text"
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
                  className="text-xs font-semibold text-ui-text"
                >
                  Select Deadline
                </Label>
                <Input
                  id="expiry-date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="h-11 rounded-md border-ui-border bg-ui-surface text-ui-text focus-visible:ring-2 focus-visible:ring-ui-focus"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {children}
      </div>
    </section>
  );
}
