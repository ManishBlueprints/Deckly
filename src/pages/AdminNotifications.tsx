import { DashboardLayout } from "../components/layout/DashboardLayout";
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
      <DashboardLayout title="Admin Notifications" showFab={false}>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-deckly-primary" />
          <p className="text-sm font-medium">Verifying admin access...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (isError) {
    return (
      <DashboardLayout title="Admin Notifications" showFab={false}>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-6">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">
            Admin verification failed
          </h2>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            {(error as Error | null)?.message ||
              "We could not verify admin access right now. You can retry without leaving this page."}
          </p>
          <button
            onClick={() => refetch()}
            className="px-5 py-2.5 rounded-lg bg-deckly-primary text-slate-950 font-semibold hover:bg-deckly-primary/90 transition-colors"
          >
            Retry Verification
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (!isLoading && isAdmin === false) return <Navigate to="/" />;

  return (
    <DashboardLayout title="Admin Notifications" showFab={false}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-deckly-primary/10 flex items-center justify-center">
              <ShieldAlert size={20} className="text-deckly-primary" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              Admin Notifications
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Send notifications to individual users or broadcast to multiple
            users.
          </p>
        </div>

        <div className="bg-[#0e0e0e] border border-white/10 rounded-xl p-6">
          <AdminNotificationComposer />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AdminNotificationsPage;
