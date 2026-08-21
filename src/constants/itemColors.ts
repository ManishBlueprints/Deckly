export interface ItemColorOption {
  key: string;
  label: string;
  hex: string;
}

/**
 * The canonical color palette for user-created organizational metadata.
 * Folders and tags derive their storage-specific options from this list so
 * every picker presents the same colors in the same order.
 */
export const ITEM_COLOR_PALETTE = [
  { key: "mint", label: "Mint", hex: "#8affab" },
  { key: "emerald", label: "Green", hex: "#54e98a" },
  { key: "blue", label: "Blue", hex: "#3b82f6" },
  { key: "violet", label: "Purple", hex: "#a855f7" },
  { key: "orange", label: "Orange", hex: "#f97316" },
  { key: "rose", label: "Red", hex: "#ef4444" },
  { key: "pink", label: "Pink", hex: "#ec4899" },
  { key: "amber", label: "Yellow", hex: "#eab308" },
  { key: "cyan", label: "Cyan", hex: "#06b6d4" },
  { key: "slate", label: "Gray", hex: "#666666" },
] as const satisfies readonly ItemColorOption[];

export const TAG_COLOR_OPTIONS = ITEM_COLOR_PALETTE.map((color) => ({
  ...color,
  key: color.hex,
}));
