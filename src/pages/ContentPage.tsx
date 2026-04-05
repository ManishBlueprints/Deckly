import { DashboardLayout } from "../components/layout/DashboardLayout";
import { ContentView } from "../components/dashboard/ContentView";
import { ContentTour } from "../components/tours/ContentTour";

function ContentPage() {
  return (
    <DashboardLayout title="Content">
      <ContentTour />
      <ContentView />
    </DashboardLayout>
  );
}

export default ContentPage;
