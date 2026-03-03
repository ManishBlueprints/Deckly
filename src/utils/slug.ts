/**
 * Normalizes a string into a URL-friendly slug.
 */
export const normalizeSlug = (slug: string): string => {
  return slug
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/**
 * Normalizes a string into a clean username handle.
 * No hyphens, just alphanumeric.
 */
export const normalizeHandle = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, ""); // Handles are usually just alphanumeric
};
