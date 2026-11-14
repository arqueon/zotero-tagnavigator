export const ZOTERO_ITEM_DRAG_TYPE = "zotero/item";
export const TAGNAVIGATOR_TAG_DRAG_TYPE = "application/x-tagnavigator-tag";

/** Zotero serializes number[] into a comma-separated DataTransfer value. */
export function serializeZoteroItemDrag(itemIDs: number[]): string {
  const seen = new Set<number>();
  for (const id of itemIDs) {
    if (Number.isSafeInteger(id) && id > 0) seen.add(id);
  }
  return Array.from(seen).join(",");
}

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

export function hasTagNavigatorTagDrag(types: Iterable<string>): boolean {
  return Array.from(types).includes(TAGNAVIGATOR_TAG_DRAG_TYPE);
}
