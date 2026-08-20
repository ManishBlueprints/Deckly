import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Surface } from "../ui/surface";

export type Loadable<T> =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "ready"; data: T };

export function WorkspacePage({ title, description, actions, summary, toolbar, children }: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  summary?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-[1440px] space-y-6 px-4 pb-12 pt-6 sm:px-6 lg:px-10 lg:pt-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-ui-text sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm text-ui-muted sm:text-base">{description}</p>}
          {summary && <div className="mt-5">{summary}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {toolbar}
      {children}
    </section>
  );
}

export function SummaryLine({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center gap-3 text-sm text-ui-muted", className)}>{children}</div>;
}

export function EmptyState({ icon: Icon, title, description, primaryAction, secondaryAction, reassurance, compact = false }: {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  reassurance?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Surface className={cn("flex flex-col items-center justify-center rounded-[24px] px-6 text-center", compact ? "min-h-64 py-10" : "min-h-[440px] py-16")}>
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[14px] border border-ui-border bg-ui-subtle text-ui-primary"><Icon size={24} /></div>
      <h2 className="text-xl font-semibold tracking-[-0.03em] text-ui-text">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-ui-muted">{description}</p>
      {(primaryAction || secondaryAction) && <div className="mt-7 flex flex-wrap items-center justify-center gap-3">{primaryAction}{secondaryAction}</div>}
      {reassurance && <div className="mt-6 text-xs text-ui-muted">{reassurance}</div>}
    </Surface>
  );
}

export function FilterToolbar({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  return <Surface className={cn("flex flex-col gap-3 rounded-[18px] p-3 sm:flex-row sm:items-center", className)}>{children}</Surface>;
}
