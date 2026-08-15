export const ZOTERO_ITEM_DRAG_TYPE = "zotero/item";

/** Zotero serializes number[] into a comma-separated DataTransfer value. */
export function parseZoteroItemDrop(value: string): number[] {
  const seen = new Set<number>();
  for (const part of String(value || "").split(",")) {
    const id = Number(part.trim());
    if (Number.isSafeInteger(id) && id > 0) seen.add(id);
  }
  return Array.from(seen);
}

export function hasZoteroItemDrag(types: Iterable<string>): boolean {
  return Array.from(types).includes(ZOTERO_ITEM_DRAG_TYPE);
}
