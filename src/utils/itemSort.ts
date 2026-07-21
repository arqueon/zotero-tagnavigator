import type { ItemColumnKey, ItemSummary } from "../types/tagNavigator";

export type ItemSortKey = ItemColumnKey;

export type ItemSortDirection = "ascending" | "descending";

export function compareItemSummaries(
  left: ItemSummary,
  right: ItemSummary,
  sortKey: ItemSortKey,
  sortDirection: ItemSortDirection,
  locale: string,
): number {
  let result: number;
  if (sortKey === "title") {
    result = left.title.localeCompare(right.title, locale, {
      sensitivity: "base",
      numeric: true,
    });
  } else if (sortKey === "creator") {
    result = left.firstCreator.localeCompare(right.firstCreator, locale, {
      sensitivity: "base",
    });
  } else if (sortKey === "year") {
    result = (left.year ?? -Infinity) - (right.year ?? -Infinity);
  } else {
    // Zotero exposes these timestamps in sortable SQL form
    // (YYYY-MM-DD HH:MM:SS), so string comparison preserves chronology.
    result = (left[sortKey] || "").localeCompare(right[sortKey] || "", "en");
  }

  if (!result) result = left.title.localeCompare(right.title, locale);
  return result * (sortDirection === "ascending" ? 1 : -1);
}
