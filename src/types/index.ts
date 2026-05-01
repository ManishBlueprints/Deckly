export * from "./metadataSearch";

export interface PdfLinkHotspot {
  href: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SlidePage {
  image_url: string;
  page_number: number;
  links?: PdfLinkHotspot[];
}

export interface Deck {
  id: string;
  title: string;
  slug: string;
  file_url: string;
  status: "PENDING" | "CONVERTING" | "PROCESSED";
  user_id: string;
  display_order: number;
  pages: SlidePage[];
  created_at: string;
  updated_at?: string;
  description?: string;
  file_size?: number;
  require_email?: boolean;
  require_password?: boolean;
  is_public?: boolean;
  view_password?: string;
  file_type?: string;
  display_mode?: "raw" | "interactive";
  expires_at?: string | null;
  investor_note?: string;
  user_handle?: string;
}

export interface DeckWithAnalytics extends Deck {
  total_views: number;
  save_count: number;
  last_viewed_at: string | null;
  tags?: LibraryTag[];
}

export interface GlobalTag {
  id: string;
  name: string;
  color: string;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string | null;
  user_id?: string;
}

export type LibraryTag = GlobalTag;

export interface LibraryFolder {
  id: string;
  name: string;
  color: string;
  tags: LibraryTag[];
  deck_count: number;
  created_at: string;
}

export interface DataRoomFolder {
  id: string;
  data_room_id: string;
  name: string;
  color: string;
  position: string;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataRoomTag extends GlobalTag {
  data_room_id?: string;
}

export interface DataRoomFolderTag {
  folder_id: string;
  tag_id: string;
}

export interface DataRoomDocumentTag {
  document_id: string;
  tag_id: string;
}

export interface DataRoomFolderWithTags extends DataRoomFolder {
  tags: DataRoomTag[];
}

export interface SavedDeckOrganized {
  library_id: string;
  deck_id: string;
  folder_id: string | null;
  tags: LibraryTag[];
  saved_at: string;
  last_viewed_at: string | null;
  // Deck metadata
  title: string;
  slug: string;
  file_type?: string;
  status: "PENDING" | "CONVERTING" | "PROCESSED" | "DELETED";
  user_handle: string;
  description: string | null;
  investor_note: string | null;
  // Availability
  is_available: boolean;
  updated_at: string;
}

export interface SavedDataRoomOrganized {
  library_id: string;
  data_room_id: string | null;
  folder_id: string | null;
  tags: LibraryTag[];
  saved_at: string;
  last_viewed_at: string | null;
  title: string;
  slug: string;
  room_handle: string;
  room_owner_handle: string;
  room_owner_id: string;
  description: string | null;
  investor_note: string | null;
  is_available: boolean;
  is_deleted: boolean;
  expires_at: string | null;
  require_email: boolean;
  require_password: boolean;
  updated_at: string;
}

export type SavedLibraryItemType = "deck" | "data_room";

export interface SavedLibraryItemBase {
  library_id: string;
  item_type: SavedLibraryItemType;
  folder_id: string | null;
  tags: LibraryTag[];
  saved_at: string;
  last_viewed_at: string | null;
  investor_note: string | null;
  title: string;
  description: string | null;
  updated_at: string;
}

export interface SavedDeckLibraryItem extends SavedLibraryItemBase {
  item_type: "deck";
  deck_id: string;
  slug: string;
  user_handle: string;
  file_type?: string;
  status: "PENDING" | "CONVERTING" | "PROCESSED" | "DELETED";
  is_available: boolean;
}

export interface SavedDataRoomLibraryItem extends SavedLibraryItemBase {
  item_type: "data_room";
  data_room_id: string | null;
  slug: string;
  room_handle: string;
  room_owner_handle: string;
  room_owner_id: string;
  is_available: boolean;
  is_deleted: boolean;
  expires_at: string | null;
  require_email: boolean;
  require_password: boolean;
}

export type SavedLibraryItem =
  | SavedDeckLibraryItem
  | SavedDataRoomLibraryItem;

export interface SavedDeck extends Deck {
  library_id?: string;
  investor_note?: string;
  saved_at: string;
  user_handle: string;
  updated_at: string;
  last_viewed_at: string | null;
}

export interface BrandingSettings {
  id: string;
  user_id: string;
  room_name?: string | null;
  banner_url?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  updated_at?: string | null;
}

export interface DeckPageStats {
  page_number: number;
  total_views: number;
  total_time_seconds: number;
}

export interface TutorialState {
  home_completed?: boolean;
  content_completed?: boolean;
  data_room_completed?: boolean;
  data_room_create_completed?: boolean;
  upload_completed?: boolean;
  workspace_setup_completed?: boolean;
  profile_onboarding_completed?: boolean;
  onboarding_completed?: boolean;
  dashboard_completed?: boolean;
}

export interface OnboardingProfile {
  role?: string | null;
  company_size?: string | null;
  primary_use_case?: string | null;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  tier: "FREE" | "PRO" | "PRO_PLUS";
  onboarding_profile?: OnboardingProfile | null;
  tutorial_state?: TutorialState | null;
  updated_at: string | null;
}

export interface DataRoom {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description?: string;
  icon_url?: string;
  require_email?: boolean;
  require_password?: boolean;
  is_public?: boolean;
  view_password?: string;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataRoomDocument {
  id: string;
  data_room_id: string;
  deck_id: string;
  folder_id: string | null;
  folder_name?: string | null;
  display_order: number;
  added_at: string;
  deck?: Deck;
  tags?: DataRoomTag[];
}

export type NotificationType =
  | "deck_view"
  | "deck_save"
  | "signal_threshold"
  | "deck_update"
  | "admin_message";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  expires_at: string;
}

export interface GroupedNotification {
  type: NotificationType;
  date: string; // YYYY-MM-DD
  title: string;
  count: number;
  notifications: Notification[];
}
