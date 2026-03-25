/**
 * Centralized utility for generating public sharing URLs.
 * Ensures consistent handle-based routing across the application.
 * Actual routes: 
 *   Decks: /:handle/:slug
 *   Rooms: /:handle/room/:slug
 */

export const getDeckShareUrl = (handle: string, slug: string): string => {
  return `${window.location.origin}${getDeckPath(handle, slug)}`;
};

export const getDataRoomShareUrl = (handle: string, slug: string): string => {
  return `${window.location.origin}${getDataRoomPath(handle, slug)}`;
};

export const getDeckPath = (handle: string, slug: string): string => {
  return `/${handle}/${slug}`;
};

export const getDataRoomPath = (handle: string, slug: string): string => {
  return `/${handle}/room/${slug}`;
};
