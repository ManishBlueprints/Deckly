import { DashboardLayout } from "../components/layout/DashboardLayout";
import { AdminNotificationComposer } from "../components/notifications/AdminNotificationComposer";
import { useAuth } from "../contexts/AuthContext";
import { ShieldAlert, Loader2, AlertTriangle, Users } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "../hooks/useAdminNotifications";
import { useAdminMetrics } from "../hooks/useAdminMetrics";

function AdminDashboardPage() {
  const { session } = useAuth();
  const { isAdmin, isLoading, isError, error, refetch: refetchAdmin } = useIsAdmin(
    session?.user?.id,
  );
  
  const { 
    totalUsers, 
    isLoading: isLoadingMetrics, 
    isError: isMetricsError,
    refetch: refetchMetrics
  } = useAdminMetrics(isAdmin);

  if (!session) return <Navigate to="/login" replace />;

  // Display a centered loading state while we check the server-side admin status
  if (isLoading) {
    return (
      <DashboardLayout title="Admin Dashboard" showFab={false}>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-deckly-primary" />
          <p className="text-sm font-medium">Verifying admin access...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (isError) {
    console.error("[Admin Verification Failed]", error);
    return (
       <DashboardLayout title="Admin Dashboard" showFab={false}>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-6">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">
            Admin verification failed
          </h2>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            We could not verify admin access right now. Please try again.
          </p>
          <button
            onClick={() => refetchAdmin()}
            className="px-5 py-2.5 rounded-lg bg-deckly-primary text-slate-950 font-semibold hover:bg-deckly-primary/90 transition-colors"
          >
            Retry Verification
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (!isLoading && isAdmin === false) return <Navigate to="/" replace />;

  return (
    <DashboardLayout title="Admin Dashboard" showFab={false}>
      <div className="max-w-4xl mx-auto space-y-10 py-10">
        {/* Header */}
        <div className="border-b border-border pb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-primary/10 flex items-center justify-center border border-primary/20">
              <ShieldAlert size={24} className="text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white uppercase">
                Admin Control <span className="text-primary tracking-widest">Center</span>
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
                <span className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground">Total Users</span>
              </div>
              
              <div className="flex items-baseline gap-2">
                {isLoadingMetrics ? (
                  <div className="h-10 w-24 bg-white/5 animate-pulse"></div>
                ) : isMetricsError ? (
                  <div className="flex items-center text-destructive text-sm gap-2">
                    <AlertTriangle size={14} /> 
                    <button onClick={() => refetchMetrics()} className="hover:underline font-bold uppercase tracking-tighter">Retry</button>
                  </div>
                ) : (
                  <h3 className="text-5xl font-black text-white tracking-tighter">
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
             <h2 className="text-sm font-bold text-white uppercase tracking-[0.3em] px-4">Broadcast System</h2>
             <div className="h-[1px] flex-1 bg-border"></div>
           </div>
           
           <div className="bg-surface-low border border-border p-10">
             <AdminNotificationComposer />
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AdminDashboardPage;
