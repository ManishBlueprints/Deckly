/**
 * Normalizes a string into a URL-friendly slug.
 */
export const normalizeSlug = (slug: string): string => {
  return slug
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
};

/**
 * Normalizes a string into a clean username handle.
 * No hyphens, just alphanumeric.
 */
export const normalizeHandle = (name: string): string => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "") // Handles are usually just alphanumeric
    .slice(0, 50);
};
