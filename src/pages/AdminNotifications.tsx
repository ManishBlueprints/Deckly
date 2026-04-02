import { DashboardLayout } from "../components/layout/DashboardLayout";
import { AdminNotificationComposer } from "../components/notifications/AdminNotificationComposer";
import { useAuth } from "../contexts/AuthContext";
import { ShieldAlert } from "lucide-react";
import { Navigate } from "react-router-dom";

// ── Admin allowlist (add emails here) ──
const ADMIN_EMAILS = [
  "manish@level29.games",
];

function AdminNotificationsPage() {
  const { session } = useAuth();

  if (!session) return <Navigate to="/login" />;

  const isAdmin = ADMIN_EMAILS.includes(session.user.email?.toLowerCase() || "");

  if (!isAdmin) return <Navigate to="/" />;

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
