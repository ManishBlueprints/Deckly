import { DashboardLayout } from "../components/layout/DashboardLayout";
import { ContentView } from "../components/dashboard/ContentView";

function ContentPage() {
  return (
    <DashboardLayout title="Content">
      <ContentView />
    </DashboardLayout>
  );
}

export default ContentPage;
