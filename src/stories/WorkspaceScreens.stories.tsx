import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { ContentView } from "../components/dashboard/ContentView";
import { DashboardView } from "../components/dashboard/DashboardView";
import { WorkspaceShell } from "../components/layout/WorkspaceShell";
import { SavedLibraryView } from "../components/saved-decks/SavedDecksView";
import { TAG_COLOR_OPTIONS } from "../constants/itemColors";
import { AuthContextProvider, type AuthContextType } from "../contexts/AuthContext";
import { ThemeContextProvider, type ResolvedTheme } from "../contexts/ThemeContext";
import { TourContextProvider } from "../contexts/TourContext";
import DataRoomsPage from "../pages/DataRoomsPage";
import Profile from "../pages/Profile";
import type {
  BrandingSettings,
  DataRoom,
  DeckWithAnalytics,
  LibraryFolder,
  LibraryTag,
  SavedDataRoomOrganized,
  SavedDeckOrganized,
  UserProfile,
} from "../types";

const STORY_USER_ID = "storybook-user";
const FIXED_NOW = "2026-08-20T10:00:00+05:30";

const profile: UserProfile = {
  id: STORY_USER_ID,
  full_name: "Manish Kumar",
  handle: "manish",
  avatar_url: null,
  tier: "PRO_PLUS",
  tutorial_state: { onboarding_completed: true, dashboard_completed: true },
  updated_at: FIXED_NOW,
};

const branding: BrandingSettings = {
  id: "storybook-branding",
  user_id: STORY_USER_ID,
  room_name: "LapsusNext Workspace",
  banner_url: null,
  logo_url: null,
  primary_color: null,
  secondary_color: null,
  updated_at: FIXED_NOW,
};

const session: Session = {
  access_token: "storybook-access-token",
  refresh_token: "storybook-refresh-token",
  expires_in: 3600,
  expires_at: 1_787_204_800,
  token_type: "bearer",
  user: {
    id: STORY_USER_ID,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    aud: "authenticated",
    email: "story@deckly.test",
    created_at: FIXED_NOW,
  },
};

const tags: LibraryTag[] = [
  { id: "tag-fundraising", name: "Fundraising", color: TAG_COLOR_OPTIONS[0].key, deleted_at: null },
  { id: "tag-research", name: "Research", color: TAG_COLOR_OPTIONS[2].key, deleted_at: null },
];

const folders: LibraryFolder[] = [
  { id: "folder-fundraising", name: "Fundraising", color: "emerald", tags: [tags[0]], deck_count: 2, created_at: "2026-08-01T09:00:00+05:30" },
  { id: "folder-research", name: "Product research", color: "blue", tags: [tags[1]], deck_count: 1, created_at: "2026-08-04T09:00:00+05:30" },
];

const savedDecks: SavedDeckOrganized[] = [
  {
    library_id: "library-series-a", deck_id: "deck-series-a", user_id: STORY_USER_ID,
    folder_id: folders[0].id, tags: [tags[0]], saved_at: "2026-08-18T09:15:00+05:30",
    last_viewed_at: "2026-08-20T08:15:00+05:30", title: "Series A Narrative",
    slug: "series-a-narrative", status: "PROCESSED", user_handle: "manish",
    description: "Investor-ready fundraising narrative.",
    investor_note: "Use for founder meetings and investor updates.", is_available: true,
    updated_at: "2026-08-18T09:15:00+05:30",
  },
  {
    library_id: "library-market", deck_id: "deck-market", user_id: STORY_USER_ID,
    folder_id: folders[1].id, tags: [tags[1]], saved_at: "2026-08-15T09:15:00+05:30",
    last_viewed_at: null, title: "Market Landscape 2026", slug: "market-landscape-2026",
    status: "PROCESSED", user_handle: "manish", description: "Competitive landscape and market sizing.",
    investor_note: "Keep updated with new comps and market data.", is_available: true,
    updated_at: "2026-08-15T09:15:00+05:30",
  },
];

const savedRooms: SavedDataRoomOrganized[] = [
  {
    library_id: "library-product-room", data_room_id: "room-product", folder_id: folders[1].id,
    tags: [tags[1]], saved_at: "2026-08-17T11:00:00+05:30", last_viewed_at: "2026-08-19T11:00:00+05:30",
    title: "Product Strategy Room", slug: "product-strategy-room", room_handle: "product-strategy-room",
    room_owner_handle: "alex", room_owner_id: "story-room-owner", description: "Internal strategy materials.",
    investor_note: "Internal strategy sync with product and engineering leads.", is_available: true,
    is_deleted: false, expires_at: null, require_email: true, require_password: false,
    updated_at: "2026-08-17T11:00:00+05:30",
  },
];

const decks: DeckWithAnalytics[] = [
  {
    id: "deck-series-a", title: "Series A Narrative", slug: "series-a-narrative",
    file_url: "/fixtures/series-a.pdf", status: "PROCESSED", user_id: STORY_USER_ID,
    display_order: 0, pages: [], created_at: "2026-08-18T09:15:00+05:30",
    updated_at: "2026-08-20T09:15:00+05:30", total_views: 128, save_count: 14,
    last_viewed_at: "2026-08-20T09:15:00+05:30", avg_attention_seconds: 164,
    active_link_count: 2, tags: [tags[0]],
  },
  {
    id: "deck-product", title: "Product Strategy and Market Expansion", slug: "product-strategy",
    file_url: "/fixtures/product.pdf", status: "PROCESSED", user_id: STORY_USER_ID,
    display_order: 1, pages: [], created_at: "2026-08-15T09:15:00+05:30",
    updated_at: "2026-08-19T16:30:00+05:30", total_views: 72, save_count: 8,
    last_viewed_at: "2026-08-19T16:30:00+05:30", avg_attention_seconds: 96,
    active_link_count: 1, tags: [tags[1]],
  },
];

const rooms: DataRoom[] = [
  {
    id: "room-main", user_id: STORY_USER_ID, name: "Main Room", slug: "main-room",
    description: "Secure workspace for sharing decks and documents.", require_email: true,
    require_password: false, is_public: false, expires_at: null,
    created_at: "2026-08-20T09:00:00+05:30", updated_at: "2026-08-20T09:00:00+05:30",
  },
];

const portfolioStats = { totalViews: 200, totalTimeSeconds: 920, totalSaves: 22, deckCount: 2 };
const dailyMetrics = {
  labels: ["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"],
  visits: [18, 22, 19, 34, 27, 41, 39], timeSpent: [70, 82, 65, 120, 96, 142, 130],
  bookmarks: [1, 2, 1, 4, 3, 6, 5],
};

const meta = { title: "Screens/Workspace", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
type SeedQueries = (client: QueryClient) => void;

function createStoryClient(seed: SeedQueries) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } } });
  client.setQueryData(["notifications", "list", STORY_USER_ID], []);
  client.setQueryData(["notifications", "unread-count", STORY_USER_ID], 0);
  seed(client);
  return client;
}

function buildAuthValue(): AuthContextType {
  return {
    session, passwordRecovery: false, clearPasswordRecovery: () => undefined, profile,
    loading: false, isPro: true, refreshProfile: async () => undefined, branding,
    brandingLoading: false, brandingError: false, setBranding: () => undefined,
    refreshBranding: async () => undefined, signOut: async () => undefined,
    signOutAllDevices: async () => undefined, deleteAccount: async () => undefined,
    initializationError: null, profileLoading: false, profileError: false,
  };
}

function StoryProviders({ client, initialPath, children }: { client: QueryClient; initialPath: string; children: ReactNode }) {
  const theme = (document.documentElement.dataset.theme === "dark" ? "dark" : "light") as ResolvedTheme;
  return (
    <ThemeContextProvider value={{ theme, preference: theme, setTheme: () => undefined, toggleTheme: () => undefined }}>
      <QueryClientProvider client={client}>
        <AuthContextProvider value={buildAuthValue()}>
          <TourContextProvider value={{ hasCompletedTour: () => true, markTourComplete: async () => undefined, resetTours: async () => undefined }}>
            <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
          </TourContextProvider>
        </AuthContextProvider>
      </QueryClientProvider>
    </ThemeContextProvider>
  );
}

function ShellStory({ activePath, action, client, children }: { activePath: string; action: "New deck" | "New room"; client: QueryClient; children: ReactNode }) {
  return (
    <StoryProviders client={client} initialPath={activePath}>
      <WorkspaceShell primaryAction={{ label: action, href: action === "New deck" ? "/upload" : "/rooms/new" }}>{children}</WorkspaceShell>
    </StoryProviders>
  );
}

function seedPortfolio(client: QueryClient, sourceDecks = decks) {
  client.setQueryData(["decks", STORY_USER_ID], sourceDecks);
  sourceDecks.forEach((deck) => {
    client.setQueryData(["deck-links", deck.id, STORY_USER_ID], [
      {
        id: `link-${deck.id}`,
        deck_id: deck.id,
        link_name: "Default link",
        link_alias: null,
        public_token: `${deck.id.replaceAll("-", "")}00000000000000000000000000000000`.slice(0, 32),
        is_enabled: true,
        is_primary: true,
        created_at: deck.created_at,
        updated_at: deck.updated_at ?? deck.created_at,
        share_url: `https://deckly.test/manish/${deck.slug}`,
      },
    ]);
  });
  client.setQueryData(["user-total-stats", STORY_USER_ID, "all"], sourceDecks.length ? portfolioStats : { totalViews: 0, totalTimeSeconds: 0, totalSaves: 0, deckCount: 0 });
  client.setQueryData(["daily-metrics", STORY_USER_ID, "all"], sourceDecks.length ? dailyMetrics : { labels: [], visits: [], timeSpent: [], bookmarks: [] });
}

function seedLibrary(client: QueryClient, sourceDecks = savedDecks, sourceFolders = folders, sourceRooms = savedRooms) {
  client.setQueryData(["library-decks", STORY_USER_ID], sourceDecks);
  client.setQueryData(["library-folders", STORY_USER_ID], sourceFolders);
  client.setQueryData(["library-tags", STORY_USER_ID], tags);
  client.setQueryData(["saved-data-rooms", STORY_USER_ID], sourceRooms);
}

function seedRooms(client: QueryClient, sourceRooms: DataRoom[], maxDataRooms: number) {
  const roomIds = sourceRooms.map((room) => room.id);
  client.setQueryData(["data-rooms"], sourceRooms);
  client.setQueryData(["data-rooms", "search-document-summaries", roomIds], Object.fromEntries(roomIds.map((id) => [id, []])));
  client.setQueryData(["data-rooms", "with-meta", roomIds], Object.fromEntries(roomIds.map((id) => [id, { docCount: 3, visitors: 12 }])));
  client.setQueryData(["my-entitlements", "PRO_PLUS"], {
    tier: "PRO_PLUS", label: "Founder",
    limits: { maxDataRooms, maxDocuments: 150, maxDocumentsPerRoom: 150, storageLimitBytes: 3_221_225_472, maxFileSizeBytes: 3_221_225_472, maxViewableDocumentSizeBytes: 209_715_200, maxDocumentPages: 2000, analyticsRetentionDays: -1, aiCreditsPerDay: 200, plannedTeamMembers: 2 },
    storageUsedBytes: 0, features: [],
  });
}

export const OverviewPopulated: Story = { render: () => {
  const client = createStoryClient((queryClient) => seedPortfolio(queryClient));
  return <ShellStory activePath="/" action="New deck" client={client}><div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10"><DashboardView /></div></ShellStory>;
} };

export const OverviewEmpty: Story = { render: () => {
  const client = createStoryClient((queryClient) => seedPortfolio(queryClient, []));
  return <ShellStory activePath="/" action="New deck" client={client}><div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10"><DashboardView /></div></ShellStory>;
} };

export const ContentPopulated: Story = { render: () => {
  const client = createStoryClient((queryClient) => { seedPortfolio(queryClient); queryClient.setQueryData(["library-tags", STORY_USER_ID], tags); });
  return <ShellStory activePath="/content" action="New deck" client={client}><ContentView /></ShellStory>;
} };

export const ContentEmpty: Story = { render: () => {
  const client = createStoryClient((queryClient) => { seedPortfolio(queryClient, []); queryClient.setQueryData(["library-tags", STORY_USER_ID], []); });
  return <ShellStory activePath="/content" action="New deck" client={client}><ContentView /></ShellStory>;
} };

export const RoomsPopulated: Story = { render: () => {
  const client = createStoryClient((queryClient) => seedRooms(queryClient, rooms, 5));
  return <StoryProviders client={client} initialPath="/rooms"><DataRoomsPage /></StoryProviders>;
} };

export const RoomsPlanLimit: Story = { render: () => {
  const client = createStoryClient((queryClient) => seedRooms(queryClient, rooms, 1));
  return <StoryProviders client={client} initialPath="/rooms"><DataRoomsPage /></StoryProviders>;
} };

export const RoomsExpired: Story = { render: () => {
  const client = createStoryClient((queryClient) => seedRooms(queryClient, [{ ...rooms[0], id: "room-expired", name: "Expired diligence room", expires_at: "2026-08-01T09:00:00+05:30" }], 5));
  return <StoryProviders client={client} initialPath="/rooms"><DataRoomsPage /></StoryProviders>;
} };

export const RoomsEmpty: Story = { render: () => {
  const client = createStoryClient((queryClient) => seedRooms(queryClient, [], 5));
  return <StoryProviders client={client} initialPath="/rooms"><DataRoomsPage /></StoryProviders>;
} };

export const SavedLibraryPopulated: Story = { render: () => {
  const client = createStoryClient((queryClient) => seedLibrary(queryClient));
  return <ShellStory activePath="/saved-library" action="New room" client={client}><SavedLibraryView /></ShellStory>;
} };

export const SavedLibraryEmpty: Story = { render: () => {
  const client = createStoryClient((queryClient) => seedLibrary(queryClient, [], [], []));
  return <ShellStory activePath="/saved-library" action="New room" client={client}><SavedLibraryView /></ShellStory>;
} };

export const SavedLibraryDeletedSource: Story = { render: () => {
  const deletedDeck = { ...savedDecks[0], status: "DELETED" as const, is_available: false, title: "Deleted source deck" };
  const client = createStoryClient((queryClient) => seedLibrary(queryClient, [deletedDeck], folders, []));
  return <ShellStory activePath="/saved-library" action="New room" client={client}><SavedLibraryView /></ShellStory>;
} };

export const ProfilePlan: Story = { render: () => {
  const client = createStoryClient((queryClient) => {
    queryClient.setQueryData(["subscription", STORY_USER_ID], null);
    queryClient.setQueryData(["pricing-catalog"], {
      tiers: (["FREE", "PRO", "PRO_PLUS", "RAISE"] as const).map((tier, index) => ({
        tier, label: { FREE: "Free", PRO: "Share", PRO_PLUS: "Founder", RAISE: "Raise" }[tier], rank: index,
        limits: { maxDataRooms: [1, 1, 5, 20][index], maxDocuments: [5, 25, 150, 1000][index], maxDocumentsPerRoom: [5, 25, 150, 1000][index], storageLimitBytes: [104_857_600, 524_288_000, 3_221_225_472, 16_106_127_360][index], maxFileSizeBytes: [104_857_600, 524_288_000, 3_221_225_472, 16_106_127_360][index], maxViewableDocumentSizeBytes: 209_715_200, maxDocumentPages: 2000, analyticsRetentionDays: [7, 30, -1, -1][index], aiCreditsPerDay: [2, 20, 200, 500][index], plannedTeamMembers: [1, 1, 2, 5][index] },
        prices: { monthly: [0, 9, 15, 45][index], yearly: [0, 86.4, 144, 432][index], currency: "USD" }, features: [],
      })),
    });
  });
  return <StoryProviders client={client} initialPath="/profile?section=tier"><main><Profile /></main></StoryProviders>;
} };
