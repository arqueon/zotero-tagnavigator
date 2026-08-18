import type {
  SavedFilterPreset,
  SavedFilterScope,
  SavedFiltersByLibrary,
} from "../types/tagNavigator";

function cleanScope(value: unknown): SavedFilterScope | null {
  if (!value || typeof value !== "object") return null;
  const scope = value as { kind?: unknown; tagName?: unknown };
  if (scope.kind === "library") return { kind: "library" };
  if (scope.kind === "untagged") return { kind: "untagged" };
  if (scope.kind !== "tag" || typeof scope.tagName !== "string") return null;
  const tagName = scope.tagName.trim();
  return tagName ? { kind: "tag", tagName } : null;
}

function cleanPreset(value: unknown): SavedFilterPreset | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<SavedFilterPreset>;
  const id = typeof raw.id === "string" ? raw.id.trim().slice(0, 120) : "";
  const name =
    typeof raw.name === "string" ? raw.name.trim().slice(0, 120) : "";
  const scope = cleanScope(raw.scope);
  if (!id || !name || !scope) return null;
  return {
    id,
    name,
    scope,
    query: typeof raw.query === "string" ? raw.query.slice(0, 500) : "",
    author: typeof raw.author === "string" ? raw.author.slice(0, 300) : "",
    secondTag:
      typeof raw.secondTag === "string" ? raw.secondTag.slice(0, 255) : "",
    yearMin: typeof raw.yearMin === "string" ? raw.yearMin.slice(0, 4) : "",
    yearMax: typeof raw.yearMax === "string" ? raw.yearMax.slice(0, 4) : "",
    dateAddedFrom: cleanDate(raw.dateAddedFrom),
    dateAddedTo: cleanDate(raw.dateAddedTo),
    dateModifiedFrom: cleanDate(raw.dateModifiedFrom),
    dateModifiedTo: cleanDate(raw.dateModifiedTo),
    hasPDF: raw.hasPDF === true,
    hasNotes: raw.hasNotes === true,
  };
}

function cleanDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

export function sanitizeSavedFilters(value: unknown): SavedFiltersByLibrary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: SavedFiltersByLibrary = {};
  for (const [libraryID, presets] of Object.entries(value)) {
    if (!/^\d+$/.test(libraryID) || !Array.isArray(presets)) continue;
    const seen = new Set<string>();
    const cleaned: SavedFilterPreset[] = [];
    for (const candidate of presets.slice(0, 100)) {
      const preset = cleanPreset(candidate);
      if (!preset || seen.has(preset.id)) continue;
      seen.add(preset.id);
      cleaned.push(preset);
    }
    if (cleaned.length) result[libraryID] = cleaned;
  }
  return result;
}
