import { DashboardLayout } from "../components/layout/DashboardLayout";
import { SavedDecksView } from "../components/saved-decks/SavedDecksView";

function SavedDecks() {
  return (
    <DashboardLayout title="Saved Decks">
      <SavedDecksView />
    </DashboardLayout>
  );
}

export default SavedDecks;
