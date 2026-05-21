export interface FolderColorOption {
  key: string;
  label: string;
  hex: string;
}

export const FOLDER_COLORS: readonly FolderColorOption[] = [
  { key: "slate", label: "Slate", hex: "#64748B" },
  { key: "emerald", label: "Emerald", hex: "#10B981" },
  { key: "blue", label: "Blue", hex: "#3B82F6" },
  { key: "indigo", label: "Indigo", hex: "#6366F1" },
  { key: "violet", label: "Violet", hex: "#8B5CF6" },
  { key: "cyan", label: "Cyan", hex: "#06B6D4" },
  { key: "amber", label: "Amber", hex: "#F59E0B" },
  { key: "rose", label: "Rose", hex: "#F43F5E" },
  { key: "orange", label: "Orange", hex: "#F97316" },
  { key: "lime", label: "Lime", hex: "#84CC16" },
] as const;

export type FolderColorKey = (typeof FOLDER_COLORS)[number]["key"];

export const DEFAULT_FOLDER_COLOR: FolderColorKey = "slate";

export const FOLDER_COLOR_KEYS = new Set<FolderColorKey>(
  FOLDER_COLORS.map((color) => color.key),
);

export const isFolderColorKey = (value: string): value is FolderColorKey =>
  FOLDER_COLOR_KEYS.has(value as FolderColorKey);

export const getFolderColorHex = (value: string): string =>
  FOLDER_COLORS.find((color) => color.key === value)?.hex ?? value;

export const FOLDER_PICKER_COLORS: readonly FolderColorOption[] = [
  { key: "slate", label: "Gray", hex: "#666666" },
  { key: "emerald", label: "Green", hex: "#54e98a" },
  { key: "blue", label: "Blue", hex: "#3B82F6" },
  { key: "violet", label: "Purple", hex: "#A855F7" },
  { key: "orange", label: "Orange", hex: "#F97316" },
  { key: "rose", label: "Red", hex: "#EF4444" },
] as const;

export const resolveFolderColorKey = (
  value: string | null | undefined,
): FolderColorKey => {
  if (value && isFolderColorKey(value)) {
    return value;
  }

  const normalizedValue = value?.toLowerCase();
  const byHex = [...FOLDER_PICKER_COLORS, ...FOLDER_COLORS].find(
    (color) => color.hex.toLowerCase() === normalizedValue,
  );

  return byHex?.key ?? DEFAULT_FOLDER_COLOR;
};
