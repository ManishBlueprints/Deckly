/**
 * Centralized utility for generating public sharing URLs.
 * Ensures consistent workspace-slug-based routing across the application.
 * Actual routes: 
 *   Decks: /:workspaceSlug/:slug
 *   Rooms: /:workspaceSlug/room/:slug
 */

/**
 * Safely resolves the origin for SSR/test environments.
 * Falls back to process.env.BASE_URL or localhost in non-browser contexts.
 */
/**
 * Always returns the public-facing share domain (deckly.space).
 * Sharing links must NEVER use app.deckly.space — they are proxied
 * through the marketing site so the URL stays on the root domain.
 */
function resolveShareOrigin(): string {
  if (typeof window !== 'undefined' && import.meta.env.VITE_SHARE_BASE_URL) {
    return import.meta.env.VITE_SHARE_BASE_URL;
  }
  
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  // Fallback for SSR/tests
  return process.env.BASE_URL || 'http://localhost:5173';
}

export const getDeckPath = (workspaceSlug: string, slug: string): string => {
  // Encode path segments to handle reserved characters
  return `/${encodeURIComponent(workspaceSlug)}/${encodeURIComponent(slug)}`;
};

export const getDeckShareUrl = (workspaceSlug: string, slug: string): string => {
  return `${resolveShareOrigin()}${getDeckPath(workspaceSlug, slug)}`;
};

export const getDeckLinkShareUrl = (
  workspaceSlug: string,
  slugOrAlias: string,
): string => {
  return getDeckShareUrl(workspaceSlug, slugOrAlias);
};

export const getDataRoomPath = (workspaceSlug: string, slug: string): string => {
  // Encode workspace slug and slug, preserve literal "/room/" segment
  return `/${encodeURIComponent(workspaceSlug)}/room/${encodeURIComponent(slug)}`;
};

export const getDataRoomShareUrl = (workspaceSlug: string, slug: string): string => {
  return `${resolveShareOrigin()}${getDataRoomPath(workspaceSlug, slug)}`;
};

export const getDeckPreviewPath = (deckId: string): string => {
  return `/preview/deck/${encodeURIComponent(deckId)}`;
};

export const getDataRoomPreviewPath = (roomId: string): string => {
  return `/preview/room/${encodeURIComponent(roomId)}`;
};
