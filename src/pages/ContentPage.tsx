import { WorkspaceShell } from "../components/layout/WorkspaceShell";
import { ContentView } from "../components/dashboard/ContentView";
import { ContentTour } from "../components/tours/ContentTour";

function ContentPage() {
  return (
    <WorkspaceShell title="Content" primaryAction={{ label: "New deck", href: "/upload" }}>
      <ContentTour />
      <ContentView />
    </WorkspaceShell>
  );
}

export default ContentPage;
