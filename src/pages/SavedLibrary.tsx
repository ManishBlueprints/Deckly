import { WorkspaceShell } from "../components/layout/WorkspaceShell";
import { SavedLibraryView } from "../components/saved-decks/SavedDecksView";

function SavedLibrary() {
  return (
    <WorkspaceShell title="Saved Library" primaryAction={{ label: "New room", href: "/rooms/new" }}>
      <SavedLibraryView />
    </WorkspaceShell>
  );
}

export default SavedLibrary;
