/**
 * Appends an alpha hex value to a color string.
 * Handles 3-digit hex (#abc), 6-digit hex (#aabbcc), and RGB/RGBA formats.
 * @param color - The base color (e.g., "#54e98a", "#54e98a", "rgb(84, 233, 138)")
 * @param alpha - Opacity level (0.0 to 1.0)
 * @returns The color with the alpha appended as hex (e.g., "#54e98a33")
 */
export function hexWithAlpha(color: string, alpha: number): string {
  // Clean input
  let hex = color.trim();

  // If it's a hex color
  if (hex.startsWith("#")) {
    // Expand 3-digit hex to 6-digit (e.g., #abc -> #aabbcc)
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    // Extract just the 6 hex digits (strip any existing alpha)
    hex = hex.slice(1, 7);
  } else if (hex.startsWith("rgb")) {
    // Parse rgb(r, g, b) or rgba(r, g, b, a)
    const match = hex.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1], 10).toString(16).padStart(2, "0");
      const g = parseInt(match[2], 10).toString(16).padStart(2, "0");
      const b = parseInt(match[3], 10).toString(16).padStart(2, "0");
      hex = `${r}${g}${b}`;
    } else {
      // Fallback: return the color with rgba if parsing fails
      return color;
    }
  } else {
    // Named color or unsupported format - return as is
    return color;
  }

  // Convert alpha to 2-char hex (0-255)
  const alphaByte = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  const alphaHex = alphaByte.toString(16).padStart(2, "0");

  return `#${hex}${alphaHex}`;
}
