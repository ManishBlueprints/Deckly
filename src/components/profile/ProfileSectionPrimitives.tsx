import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type ProfileTone = "primary" | "neutral" | "warning" | "danger";

const toneStyles: Record<ProfileTone, { eyebrow: string; icon: string; surface: string }> = {
  primary: {
    eyebrow: "text-ui-primary",
    icon: "border-ui-primary/25 bg-ui-primary/10 text-ui-primary",
    surface: "border-ui-border bg-ui-surface",
  },
  neutral: {
    eyebrow: "text-ui-muted",
    icon: "border-ui-border bg-ui-subtle text-ui-muted",
    surface: "border-ui-border bg-ui-surface",
  },
  warning: {
    eyebrow: "text-ui-warning",
    icon: "border-ui-warning/40 bg-ui-warning/15 text-ui-warning",
    surface: "border-ui-warning/35 bg-ui-warning/10",
  },
  danger: {
    eyebrow: "text-ui-destructive",
    icon: "border-ui-destructive/45 bg-ui-destructive/15 text-ui-destructive",
    surface: "border-ui-destructive/40 bg-ui-destructive/10",
  },
};

export function ProfileSectionHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  badge,
  tone = "primary",
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  badge?: ReactNode;
  tone?: ProfileTone;
}) {
  const styles = toneStyles[tone];

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-[10px] border", styles.icon)}>
          <Icon size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className={cn("text-[10px] font-bold uppercase tracking-[0.18em]", styles.eyebrow)}>{eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-ui-text">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ui-muted">{description}</p>
        </div>
      </div>
      {badge ? <div className="shrink-0 self-start">{badge}</div> : null}
    </header>
  );
}

export function ProfileActionCard({
  icon: Icon,
  title,
  description,
  tone = "neutral",
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: ProfileTone;
  children?: ReactNode;
  className?: string;
}) {
  const styles = toneStyles[tone];

  return (
    <section className={cn("rounded-[14px] border p-4 shadow-[var(--ui-shadow-control)] sm:p-5", styles.surface, className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-[9px] border", styles.icon)}>
          <Icon size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ui-text">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-ui-muted">{description}</p>
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
