import { WorkspaceShell } from "../components/layout/WorkspaceShell";
import { AdminNotificationComposer } from "../components/notifications/AdminNotificationComposer";
import { useAuth } from "../contexts/AuthContext";
import { ShieldAlert, Loader2, AlertTriangle, Users } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "../hooks/useAdminNotifications";
import { useAdminMetrics } from "../hooks/useAdminMetrics";

function AdminDashboardPage() {
  const { session, loading: isAuthLoading } = useAuth();
  const {
    isAdmin,
    isLoading,
    isError,
    error,
    refetch: refetchAdmin,
  } = useIsAdmin(session?.user?.id);

  const {
    totalUsers,
    isLoading: isLoadingMetrics,
    isError: isMetricsError,
    refetch: refetchMetrics,
  } = useAdminMetrics(isAdmin);

  // Display a centered loading state while checking the server-side admin status or initial auth
  if (isAuthLoading || isLoading) {
    return (
      <WorkspaceShell title="Admin Control Center">
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface border border-border mt-8 h-[70vh]">
          <Loader2 size={40} className="text-primary animate-spin mb-4" />
          <h2 className="mb-2 text-2xl font-bold uppercase tracking-tighter text-ui-text">
            Authenticating
          </h2>
          <p className="text-muted-foreground uppercase tracking-widest text-xs font-bold">
            Verifying secure session...
          </p>
        </div>
      </WorkspaceShell>
    );
  }

  if (!isAuthLoading && !session) return <Navigate to="/login" replace />;

  if (isError) {
    console.error("[Admin Verification Failed]", error);
    return (
      <WorkspaceShell title="Admin Dashboard">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-ui-destructive/20 bg-ui-destructive/10">
            <AlertTriangle className="h-6 w-6 text-ui-destructive" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-ui-text">
            Admin verification failed
          </h2>
          <p className="mb-6 max-w-md text-sm text-ui-muted">
            We could not verify admin access right now. Please try again.
          </p>
          <button
            onClick={() => refetchAdmin()}
            className="rounded-lg bg-ui-primary px-5 py-2.5 font-semibold text-ui-primary-text transition-colors hover:brightness-95"
          >
            Retry Verification
          </button>
        </div>
      </WorkspaceShell>
    );
  }

  if (!isLoading && isAdmin === false) return <Navigate to="/" replace />;

  return (
    <WorkspaceShell title="Admin Dashboard">
      <div className="max-w-4xl mx-auto space-y-10 py-10">
        {/* Header */}
        <div className="border-b border-border pb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-primary/10 flex items-center justify-center border border-primary/20">
              <ShieldAlert size={24} className="text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold uppercase tracking-tight text-ui-text">
                Admin Control{" "}
                <span className="text-primary tracking-widest">Center</span>
              </h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mt-1">
                Authorized: {session?.user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface-low border border-border p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 -translate-y-12 translate-x-12 rotate-45 group-hover:bg-primary/10 transition-colors duration-500"></div>

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <Users size={18} className="text-primary" />
                <span className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground">
                  Total Users
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                {isLoadingMetrics ? (
                  <div className="h-10 w-24 animate-pulse bg-ui-subtle"></div>
                ) : isMetricsError ? (
                  <div className="flex items-center text-destructive text-sm gap-2">
                    <AlertTriangle size={14} />
                    <button
                      onClick={() => refetchMetrics()}
                      className="hover:underline font-bold uppercase tracking-tighter"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <h3 className="text-5xl font-bold tracking-tighter text-ui-text">
                    {totalUsers?.toLocaleString() || "0"}
                  </h3>
                )}
              </div>
            </div>
          </div>

          {/* Placeholder for more stats if needed later */}
          <div className="md:col-span-2 border border-dashed border-border flex items-center justify-center p-8 text-muted-foreground/30 text-sm uppercase tracking-widest">
            Future Stats Panel
          </div>
        </div>

        {/* Notifications Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-[1px] flex-1 bg-border"></div>
            <h2 className="px-4 text-sm font-bold uppercase tracking-[0.3em] text-ui-text">
              Broadcast System
            </h2>
            <div className="h-[1px] flex-1 bg-border"></div>
          </div>

          <div className="bg-surface-low border border-border p-10">
            <AdminNotificationComposer />
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}

export default AdminDashboardPage;
