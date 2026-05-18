import { DashboardLayout } from "../components/layout/DashboardLayout";
import { SavedLibraryView } from "../components/saved-decks/SavedDecksView";

function SavedLibrary() {
  return (
    <DashboardLayout title="Saved Library">
      <SavedLibraryView />
    </DashboardLayout>
  );
}

export default SavedLibrary;
