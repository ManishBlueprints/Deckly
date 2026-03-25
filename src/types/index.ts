export interface SlidePage {
  image_url: string;
  page_number: number;
}

export interface Deck {
  id: string;
  title: string;
  slug: string;
  file_url: string;
  status: "PENDING" | "PROCESSED";
  user_id: string;
  display_order: number;
  pages: SlidePage[];
  created_at: string;
  updated_at?: string;
  description?: string;
  file_size?: number;
  require_email?: boolean;
  require_password?: boolean;
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
}

export interface LibraryTag {
  id: string;
  name: string;
  color: string;
}

export interface LibraryFolder {
  id: string;
  name: string;
  color: string;
  tags: LibraryTag[];
  deck_count: number;
  created_at: string;
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
  file_type: string;
  status: string;
  user_handle: string;
  description: string | null;
  investor_note: string | null;
  // Availability
  is_available: boolean;
  updated_at: string;
}

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

export interface DeckStats {
  page_number: number;
  total_views: number;
  total_time_seconds: number;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  tier: "FREE" | "PRO" | "PRO_PLUS";
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
  view_password?: string;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataRoomDocument {
  id: string;
  data_room_id: string;
  deck_id: string;
  display_order: number;
  added_at: string;
  deck?: Deck;
}
