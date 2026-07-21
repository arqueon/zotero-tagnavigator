import type { ItemColumnKey, ItemColumnWidths } from "../types/tagNavigator";

export const ITEM_COLUMN_KEYS: ItemColumnKey[] = [
  "title",
  "creator",
  "year",
  "dateAdded",
  "dateModified",
];

export const DEFAULT_ITEM_COLUMN_WIDTHS: ItemColumnWidths = {
  title: 300,
  creator: 110,
  year: 52,
  dateAdded: 80,
  dateModified: 80,
};

const ITEM_COLUMN_LIMITS: Record<
  ItemColumnKey,
  { minimum: number; maximum: number }
> = {
  title: { minimum: 120, maximum: 800 },
  creator: { minimum: 72, maximum: 500 },
  year: { minimum: 44, maximum: 140 },
  dateAdded: { minimum: 64, maximum: 280 },
  dateModified: { minimum: 64, maximum: 280 },
};

export function clampItemColumnWidth(
  key: ItemColumnKey,
  width: number,
): number {
  const limits = ITEM_COLUMN_LIMITS[key];
  return Math.round(Math.min(limits.maximum, Math.max(limits.minimum, width)));
}

export function sanitizeItemColumnWidths(
  value: unknown,
): Partial<ItemColumnWidths> {
  if (!value || typeof value !== "object") return {};
  const candidate = value as Record<string, unknown>;
  const widths: Partial<ItemColumnWidths> = {};

  for (const key of ITEM_COLUMN_KEYS) {
    const width = candidate[key];
    if (typeof width === "number" && Number.isFinite(width)) {
      widths[key] = clampItemColumnWidth(key, width);
    }
  }
  return widths;
}

export function completeItemColumnWidths(value: unknown): ItemColumnWidths {
  return {
    ...DEFAULT_ITEM_COLUMN_WIDTHS,
    ...sanitizeItemColumnWidths(value),
  };
}

export function getItemColumnLimits(key: ItemColumnKey): {
  minimum: number;
  maximum: number;
} {
  return ITEM_COLUMN_LIMITS[key];
}
