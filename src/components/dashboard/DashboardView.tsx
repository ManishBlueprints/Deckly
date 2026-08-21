import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { WelcomeBanner } from "./WelcomeBanner";
import { ActiveDecksTable } from "./ActiveDecksTable";
import { DashboardTour } from "../tours/DashboardTour";

export function DashboardView() {
  return (
    <div className="flex flex-col gap-8">
      <DashboardTour />
      <WelcomeBanner />

      <div className="space-y-8">
        <AnalyticsDashboard />
        <ActiveDecksTable />
      </div>
    </div>
  );
}
