import { ITEM_COLOR_PALETTE } from "./itemColors";

export interface FolderColorOption {
  key: string;
  label: string;
  hex: string;
}

export const FOLDER_COLORS: readonly FolderColorOption[] = [
  ...ITEM_COLOR_PALETTE,
  // Retained for existing records created before the shared picker shipped.
  { key: "indigo", label: "Indigo", hex: "#6366F1" },
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

export const FOLDER_PICKER_COLORS: readonly FolderColorOption[] =
  ITEM_COLOR_PALETTE;

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
