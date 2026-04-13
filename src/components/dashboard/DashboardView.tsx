import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { WelcomeBanner } from "./WelcomeBanner";
import { TopDecksCard } from "./TopDecksCard";
import { CommentsCard } from "./CommentsCard";
import { DashboardTour } from "../tours/DashboardTour";

export function DashboardView() {
  return (
    <div className="flex flex-col gap-12">
      <DashboardTour />
      <WelcomeBanner />

      <div className="space-y-12">
        <AnalyticsDashboard />
        <div className="flex flex-col gap-12 lg:grid lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-8 h-full min-h-[500px]">
            <TopDecksCard />
          </div>
          <div className="lg:col-span-4 h-full min-h-[500px]">
            <CommentsCard />
          </div>
        </div>
      </div>
    </div>
  );
}
