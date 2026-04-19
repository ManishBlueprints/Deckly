/**
 * Centralized utility for generating public sharing URLs.
 * Ensures consistent handle-based routing across the application.
 * Actual routes: 
 *   Decks: /:handle/:slug
 *   Rooms: /:handle/room/:slug
 */

/**
 * Safely resolves the origin for SSR/test environments.
 * Falls back to process.env.BASE_URL or localhost in non-browser contexts.
 */
function resolveOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  // Fallback for SSR/tests - use env var or localhost
  return process.env.BASE_URL || 'http://localhost:5173';
}

export const getDeckShareUrl = (handle: string, slug: string): string => {
  return `${resolveOrigin()}${getDeckPath(handle, slug)}`;
};

export const getDataRoomShareUrl = (handle: string, slug: string): string => {
  return `${resolveOrigin()}${getDataRoomPath(handle, slug)}`;
};

export const getDeckPreviewPath = (deckId: string): string => {
  return `/preview/deck/${encodeURIComponent(deckId)}`;
};

export const getDataRoomPreviewPath = (roomId: string): string => {
  return `/preview/room/${encodeURIComponent(roomId)}`;
};

export const getDeckPath = (handle: string, slug: string): string => {
  // Encode path segments to handle reserved characters
  return `/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}`;
};

export const getDataRoomPath = (handle: string, slug: string): string => {
  // Encode handle and slug, preserve literal "/room/" segment
  return `/${encodeURIComponent(handle)}/room/${encodeURIComponent(slug)}`;
};
