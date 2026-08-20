import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import {
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  FileText,
  FolderKanban,
  Home,
  Monitor,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import decklyMark from "../../assets/favicon-32x32.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { TIER_CONFIG } from "../../constants/tiers";
import { cn } from "../../lib/utils";
import { MascotSettingsModal } from "../dashboard/MascotSettingsModal";
import { NotificationBell } from "../notifications/NotificationBell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { PortalHostProvider } from "../ui/portal-host";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface WorkspaceShellProps {
  children: React.ReactNode;
  title?: string;
  primaryAction?: { label: string; href: string; icon?: React.ElementType };
}

const NAV_ITEMS = [
  { label: "Overview", href: "/", icon: Home },
  { label: "Content", href: "/content", icon: FileText },
  { label: "Rooms", href: "/rooms", icon: Users },
  { label: "Saved library", href: "/saved-library", icon: Bookmark },
];

type WorkspaceNavItem = (typeof NAV_ITEMS)[number];

function isActiveRoute(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function MobileNavItem({ item, active }: { item: WorkspaceNavItem; active: boolean }) {
  const Icon = item.icon;
  const mobileLabel = item.label === "Saved library" ? "Saved" : item.label;

  return (
    <Link
      to={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[10px] px-1 text-[11px] font-medium transition-[color,transform] duration-200 active:scale-95",
        active ? "font-semibold text-ui-text" : "text-ui-muted hover:text-ui-text",
      )}
    >
      <span className={cn("flex h-8 min-w-10 items-center justify-center rounded-[10px] px-2 transition-[background-color,transform] duration-200 group-hover:scale-105", active && "bg-ui-primary/15")}>
        <Icon size={20} strokeWidth={active ? 2.35 : 1.8} aria-hidden="true" />
      </span>
      <span className="truncate">{mobileLabel}</span>
    </Link>
  );
}

function WorkspaceIdentityMark({
  logoUrl,
  name,
  className,
}: {
  logoUrl?: string | null;
  name: string;
  className?: string;
}) {
  return (
    <span title={name} className={cn("flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-ui-border bg-ui-subtle text-ui-muted", className)}>
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <FolderKanban size={17} aria-hidden="true" />
      )}
    </span>
  );
}

function getDefaultAction(pathname: string) {
  if (pathname.startsWith("/rooms")) return { label: "New room", href: "/rooms/new", icon: Plus };
  return { label: "New deck", href: "/upload", icon: Plus };
}

function ThemeMenuItem({
  label,
  icon: Icon,
  selected,
  onSelect,
}: {
  label: string;
  icon: React.ElementType;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className="gap-2.5 rounded-sm px-2.5 py-2 focus:bg-ui-subtle"
    >
      <Icon size={16} className="text-ui-muted" />
      <span className="flex-1">{label}</span>
      {selected ? <Check size={15} className="text-ui-primary" /> : null}
    </DropdownMenuItem>
  );
}

export function WorkspaceShell({ children, primaryAction }: WorkspaceShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { branding, profile, session, setBranding, signOut } = useAuth();
  const { theme, preference, setTheme } = useTheme();
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });
  const [commandOpen, setCommandOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const action = primaryAction ?? getDefaultAction(location.pathname);
  const workspaceName = branding?.room_name || profile?.full_name || "Workspace";
  const workspaceLogoUrl = branding?.logo_url;
  const openSettingsAfterOverlay = useCallback(() => {
    window.setTimeout(() => setSettingsOpen(true), 0);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const commands = useMemo(() => [
    ...NAV_ITEMS.map((item) => ({ ...item, group: "Navigate", run: () => navigate(item.href) })),
    { label: "Upload deck", icon: Upload, group: "Create", run: () => navigate("/upload") },
    { label: "Create room", icon: Plus, group: "Create", run: () => navigate("/rooms/new") },
    { label: "Workspace settings", icon: Settings, group: "Manage", run: openSettingsAfterOverlay },
    { label: "Profile", icon: User, group: "Manage", run: () => navigate("/profile") },
    { label: "Sign out", icon: LogOut, group: "Manage", run: () => void signOut().catch(() => toast.error("Failed to sign out. Please try again.")) },
    { label: "Help and feedback", icon: CircleHelp, group: "Help", run: () => navigate("/feedback") },
  ], [navigate, openSettingsAfterOverlay, signOut]);

  const runCommand = (run: () => void) => {
    setCommandOpen(false);
    run();
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("sidebar-collapsed", String(next));
    } catch {
      return;
    }
  };

  return (
    <PortalHostProvider container={portalHost}>
      <div className="ui-shell flex h-dvh overflow-hidden bg-ui-canvas font-sans text-ui-text">
        <aside className={cn("relative z-[var(--ui-layer-shell)] hidden h-dvh shrink-0 flex-col border-r border-ui-border bg-ui-surface transition-[width] duration-200 md:flex", collapsed ? "w-[76px]" : "w-[282px]")}>
          <div className={cn("flex h-[88px] items-center border-b border-ui-border px-5", collapsed ? "justify-center" : "gap-3")}>
            <img src={decklyMark} alt="" className="h-9 w-9 rounded-[10px] object-cover" />
            {!collapsed && <span className="text-[27px] font-semibold tracking-[-0.05em]">Deckly</span>}
            <button onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className={cn("ml-auto inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-ui-border text-ui-muted hover:bg-ui-subtle hover:text-ui-text", collapsed && "absolute -right-4 top-6 bg-ui-surface")}>
              <ChevronLeft size={18} className={cn("transition-transform", collapsed && "rotate-180")} />
            </button>
          </div>

          <div className="px-4 pt-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn("flex h-12 w-full items-center rounded-[12px] border border-ui-border bg-ui-surface text-left text-sm text-ui-text hover:bg-ui-subtle", collapsed ? "justify-center px-0" : "gap-3 px-3")}>
                  <WorkspaceIdentityMark logoUrl={workspaceLogoUrl} name={workspaceName} className="size-7" />
                  {!collapsed && <><span className="min-w-0 flex-1 truncate">{workspaceName}</span><ChevronDown size={16} className="text-ui-muted" /></>}
                </button>
              </DropdownMenuTrigger>
              <WorkspaceMenuContent onSettings={openSettingsAfterOverlay} />
            </DropdownMenu>
          </div>

          <nav className="flex-1 space-y-1.5 px-3 py-7" aria-label="Workspace navigation">
            {NAV_ITEMS.map((item) => {
              const active = isActiveRoute(location.pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "group relative flex h-12 items-center overflow-hidden rounded-[10px] text-sm font-medium transition-[background-color,color,transform,box-shadow] duration-200 active:scale-[0.98]",
                    collapsed ? "justify-center" : "gap-2.5 px-2.5",
                    active
                      ? "bg-ui-primary/10 text-ui-text shadow-[var(--ui-shadow-control)]"
                      : "text-ui-muted hover:bg-ui-subtle hover:text-ui-text",
                  )}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  {active ? <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-ui-primary" /> : null}
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md transition-[background-color,transform] duration-200 group-hover:scale-105", active && "bg-ui-primary/15")}>
                    <Icon size={19} strokeWidth={active ? 2.25 : 1.8} />
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-3 border-t border-ui-border p-4">
            <button onClick={() => navigate("/feedback")} className={cn("flex h-11 w-full items-center rounded-[12px] text-sm text-ui-muted hover:bg-ui-subtle hover:text-ui-text", collapsed ? "justify-center" : "gap-3 px-3")}>
              <CircleHelp size={19} />{!collapsed && <span>Help & feedback</span>}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn("flex w-full items-center rounded-[14px] bg-ui-subtle py-3 text-left hover:bg-ui-border/70", collapsed ? "justify-center px-2" : "gap-3 px-3")}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ui-surface text-sm font-semibold text-ui-primary">
                    {workspaceLogoUrl ? (
                      <img src={workspaceLogoUrl} alt="" className="h-full w-full object-cover" />
                    ) : profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      profile?.full_name?.slice(0, 2).toUpperCase() || "U"
                    )}
                  </span>
                  {!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{profile?.full_name || "Account"}</p><p className="mt-0.5 text-xs text-ui-muted">{TIER_CONFIG[profile?.tier ?? "FREE"].planLabel} plan</p></div>}
                  {!collapsed && <ChevronDown size={16} className="text-ui-muted" />}
                </button>
              </DropdownMenuTrigger>
              <WorkspaceMenuContent onSettings={openSettingsAfterOverlay} />
            </DropdownMenu>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0">
          <header className="sticky top-0 z-[var(--ui-layer-sticky)] flex h-[88px] items-center justify-between border-b border-ui-border bg-ui-canvas/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <Link to="/" className="flex min-w-0 items-center gap-2.5 md:hidden" aria-label="Deckly overview">
              <img src={decklyMark} alt="" className="h-9 w-9 rounded-[10px] object-cover" />
              <span className="truncate text-xl font-semibold tracking-[-0.04em]">Deckly</span>
            </Link>
            <button onClick={() => setCommandOpen(true)} className="ml-auto mr-2 hidden h-11 w-[264px] items-center gap-3 rounded-[12px] border border-ui-border bg-ui-surface px-4 text-sm text-ui-muted shadow-[var(--ui-shadow-control)] hover:border-ui-primary/40 sm:flex">
              <Search size={18} /><span className="flex-1 text-left">Search commands…</span><kbd className="font-mono text-xs">⌘K</kbd>
            </button>
            <div className="flex items-center gap-1.5">
              {profile?.id ? <NotificationBell userId={profile.id} /> : <button className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] text-ui-muted" aria-label="Notifications"><Bell size={20} /></button>}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-ui-border bg-ui-surface p-1.5 pr-2 text-left shadow-[var(--ui-shadow-control)] hover:bg-ui-subtle md:hidden"
                    aria-label="Open workspace and profile menu"
                  >
                    <WorkspaceIdentityMark logoUrl={workspaceLogoUrl} name={workspaceName} />
                    <ChevronDown size={14} className="text-ui-muted" />
                  </button>
                </DropdownMenuTrigger>
                <WorkspaceMenuContent onSettings={openSettingsAfterOverlay} />
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="hidden h-11 w-11 items-center justify-center rounded-[12px] text-ui-muted hover:bg-ui-subtle hover:text-ui-text md:inline-flex"
                    aria-label={`Theme: ${preference === "system" ? `System (${theme})` : preference}`}
                  >
                    {preference === "system" ? <Monitor size={20} /> : theme === "light" ? <Sun size={20} /> : <Moon size={20} />}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[var(--ui-layer-popover)] w-44 rounded-lg border-ui-border bg-ui-elevated p-1.5 text-ui-text shadow-overlay">
                  <DropdownMenuLabel className="px-2.5 py-2 text-xs font-medium text-ui-muted">Appearance</DropdownMenuLabel>
                  <ThemeMenuItem label="Light" icon={Sun} selected={preference === "light"} onSelect={() => setTheme("light")} />
                  <ThemeMenuItem label="Dark" icon={Moon} selected={preference === "dark"} onSelect={() => setTheme("dark")} />
                  <ThemeMenuItem label="System" icon={Monitor} selected={preference === "system"} onSelect={() => setTheme("system")} />
                </DropdownMenuContent>
              </DropdownMenu>
              <button onClick={() => navigate(action.href)} aria-label={action.label} className="ml-2 hidden h-11 items-center justify-center gap-2 rounded-[12px] bg-ui-primary px-5 text-sm font-semibold text-ui-primary-text shadow-[var(--ui-shadow-control)] hover:brightness-105 md:inline-flex">
                {React.createElement(action.icon ?? Plus, { size: 18 })}<span>{action.label}</span>
              </button>
            </div>
          </header>
          <div key={location.pathname} className="ui-page-transition min-h-full">
            {children}
          </div>
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-[var(--ui-layer-shell)] grid grid-cols-5 border-t border-ui-border bg-ui-elevated/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[var(--ui-shadow-overlay)] backdrop-blur-xl md:hidden"
          aria-label="Mobile workspace navigation"
        >
          {NAV_ITEMS.slice(0, 2).map((item) => (
            <MobileNavItem key={item.href} item={item} active={isActiveRoute(location.pathname, item.href)} />
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Create new"
                className="group relative flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-ui-primary transition-transform duration-200 active:scale-95"
              >
                <span className="flex size-12 items-center justify-center rounded-[14px] bg-ui-primary text-ui-primary-text shadow-[var(--ui-shadow-overlay)] transition-[transform,filter] duration-200 group-hover:scale-105 group-hover:brightness-105">
                  <Plus size={23} strokeWidth={2.4} aria-hidden="true" />
                </span>
                <span>Create</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="center" sideOffset={12} className="z-[var(--ui-layer-popover)] w-48 rounded-[12px] border-ui-border bg-ui-elevated p-2 text-ui-text shadow-[var(--ui-shadow-overlay)]">
              <DropdownMenuLabel className="px-3 py-2 text-xs font-medium text-ui-muted">Create new</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => navigate("/upload")} className="gap-3 rounded-[9px] px-3 py-3 focus:bg-ui-subtle">
                <Upload size={18} className="text-ui-primary" />
                New deck
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate("/rooms/new")} className="gap-3 rounded-[9px] px-3 py-3 focus:bg-ui-subtle">
                <Users size={18} className="text-ui-primary" />
                New room
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {NAV_ITEMS.slice(2).map((item) => (
            <MobileNavItem key={item.href} item={item} active={isActiveRoute(location.pathname, item.href)} />
          ))}
        </nav>

        <div ref={setPortalHost} id="workspace-portal-host" />
      </div>

      <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogContent size="lg" className="top-[15vh] -translate-y-0 p-0" hideClose>
          <DialogHeader className="sr-only"><DialogTitle>Command palette</DialogTitle><DialogDescription>Navigate and perform common workspace actions.</DialogDescription></DialogHeader>
          <Command className="bg-ui-elevated text-ui-text" loop>
            <div className="flex items-center gap-3 border-b border-ui-border px-5"><Search size={19} className="text-ui-muted" /><Command.Input autoFocus placeholder="Search commands…" className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-ui-muted" /><button onClick={() => setCommandOpen(false)} aria-label="Close command palette" className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ui-muted hover:bg-ui-subtle hover:text-ui-text"><X size={18} /></button></div>
            <Command.List className="max-h-[420px] overflow-y-auto p-2"><Command.Empty className="p-8 text-center text-sm text-ui-muted">No matching command.</Command.Empty>
              {["Navigate", "Create", "Manage", "Help"].map((group) => <Command.Group key={group} heading={group} className="px-2 py-2 text-xs text-ui-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-medium">
                {commands.filter((item) => item.group === group).map((item) => <Command.Item key={item.label} value={item.label} onSelect={() => runCommand(item.run)} className="flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-3 text-sm text-ui-text data-[selected=true]:bg-ui-subtle"><item.icon size={18} className="text-ui-muted" />{item.label}</Command.Item>)}
              </Command.Group>)}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>

      <MascotSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} branding={branding} onUpdate={setBranding} userProfile={profile || undefined} />
    </PortalHostProvider>
  );

  function WorkspaceMenuContent({ onSettings }: { onSettings: () => void }) {
    return (
      <DropdownMenuContent align="end" className="z-[var(--ui-layer-popover)] w-60 rounded-[14px] border-ui-border bg-ui-elevated p-2 text-ui-text shadow-[var(--ui-shadow-overlay)]">
        <DropdownMenuLabel className="flex items-center gap-3 px-3 py-2">
          <WorkspaceIdentityMark logoUrl={workspaceLogoUrl} name={workspaceName} className="size-10" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{workspaceName}</span>
            <span className="mt-1 block truncate text-xs font-normal text-ui-muted">{session?.user.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-ui-border" />
        <DropdownMenuItem onSelect={onSettings} className="gap-3 rounded-[10px] px-3 py-2.5 focus:bg-ui-subtle"><Settings size={17} />Workspace settings</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/profile")} className="gap-3 rounded-[10px] px-3 py-2.5 focus:bg-ui-subtle"><User size={17} />Profile</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/feedback")} className="gap-3 rounded-[10px] px-3 py-2.5 focus:bg-ui-subtle"><CircleHelp size={17} />Help and feedback</DropdownMenuItem>
        <DropdownMenuSeparator className="bg-ui-border" />
        <DropdownMenuLabel className="px-3 py-2 text-xs font-medium text-ui-muted">Appearance</DropdownMenuLabel>
        <ThemeMenuItem label="Light" icon={Sun} selected={preference === "light"} onSelect={() => setTheme("light")} />
        <ThemeMenuItem label="Dark" icon={Moon} selected={preference === "dark"} onSelect={() => setTheme("dark")} />
        <ThemeMenuItem label="System" icon={Monitor} selected={preference === "system"} onSelect={() => setTheme("system")} />
        <DropdownMenuSeparator className="bg-ui-border" />
        <DropdownMenuItem onSelect={() => void signOut().catch(() => toast.error("Failed to sign out. Please try again."))} className="gap-3 rounded-[10px] px-3 py-2.5 text-ui-destructive focus:bg-ui-destructive/10 focus:text-ui-destructive"><LogOut size={17} />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    );
  }
}
