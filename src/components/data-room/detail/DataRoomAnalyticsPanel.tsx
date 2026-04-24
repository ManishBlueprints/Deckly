import { InterestSignalBadge } from "../../dashboard/InterestSignalBadge";
import { VisitorSignal } from "../../../services/interestSignalService";

interface DataRoomAnalyticsPanelProps {
  totalVisitors: number;
  signalsLoading: boolean;
  roomSignals: VisitorSignal[];
}

export function DataRoomAnalyticsPanel({
  totalVisitors,
  signalsLoading,
  roomSignals,
}: DataRoomAnalyticsPanelProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#222] bg-surface-card p-5 flex items-center justify-between">
        <p className="text-sm text-slate-400">Total Visitors</p>
        <p className="text-xl font-semibold text-white">{totalVisitors}</p>
      </div>

      <div className="rounded-lg border border-[#222] bg-surface-card">
        {signalsLoading ? (
          <div className="p-8 text-sm text-slate-500">Loading signals...</div>
        ) : roomSignals.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">
            No visitor signals yet.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {roomSignals.map((visitor) => (
              <div key={visitor.visitorId} className="p-6 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {visitor.viewerEmail || "Anonymous Viewer"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {visitor.totalVisits} visits · {visitor.totalTime}s
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {visitor.signals.map((signal) => (
                      <InterestSignalBadge key={signal} signal={signal} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
