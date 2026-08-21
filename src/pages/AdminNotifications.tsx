import { WorkspaceShell } from "../components/layout/WorkspaceShell";
import { AdminNotificationComposer } from "../components/notifications/AdminNotificationComposer";
import { useAuth } from "../contexts/AuthContext";
import { ShieldAlert, Loader2, AlertTriangle } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "../hooks/useAdminNotifications";

function AdminNotificationsPage() {
  const { session } = useAuth();
  const { isAdmin, isLoading, isError, error, refetch } = useIsAdmin(
    session?.user?.id,
  );

  if (!session) return <Navigate to="/login" />;

  // Display a centered loading state while we check the server-side admin status
  if (isLoading) {
    return (
      <WorkspaceShell title="Admin Notifications">
        <div className="flex min-h-[400px] flex-col items-center justify-center text-ui-muted">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-deckly-primary" />
          <p className="text-sm font-medium">Verifying admin access...</p>
        </div>
      </WorkspaceShell>
    );
  }

  if (isError) {
    return (
      <WorkspaceShell title="Admin Notifications">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-ui-destructive/20 bg-ui-destructive/10">
            <AlertTriangle className="h-6 w-6 text-ui-destructive" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-ui-text">
            Admin verification failed
          </h2>
          <p className="mb-6 max-w-md text-sm text-ui-muted">
            {(error as Error | null)?.message ||
              "We could not verify admin access right now. You can retry without leaving this page."}
          </p>
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-ui-primary px-5 py-2.5 font-semibold text-ui-primary-text transition-colors hover:brightness-95"
          >
            Retry Verification
          </button>
        </div>
      </WorkspaceShell>
    );
  }

  if (!isLoading && isAdmin === false) return <Navigate to="/" />;

  return (
    <WorkspaceShell title="Admin Notifications">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-deckly-primary/10 flex items-center justify-center">
              <ShieldAlert size={20} className="text-deckly-primary" />
            </div>
            <h1 className="text-2xl font-bold text-ui-text">
              Admin Notifications
            </h1>
          </div>
          <p className="text-sm text-ui-muted">
            Send notifications to individual users or broadcast to multiple
            users.
          </p>
        </div>

        <div className="rounded-xl border border-ui-border bg-ui-surface p-6">
          <AdminNotificationComposer />
        </div>
      </div>
    </WorkspaceShell>
  );
}

export default AdminNotificationsPage;
