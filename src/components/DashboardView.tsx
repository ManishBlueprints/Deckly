import { AnalyticsDashboard } from "./dashboard/AnalyticsDashboard";
import { WelcomeBanner } from "./dashboard/WelcomeBanner";
import { TopDecksCard } from "./dashboard/TopDecksCard";
import { CommentsCard } from "./dashboard/CommentsCard";

export function DashboardView() {
  return (
    <div className="flex flex-col gap-12">
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
