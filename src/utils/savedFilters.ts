import type {
  AdvancedSearchCondition,
  QuickSearchMode,
  SavedFilterPreset,
  SavedFilterScope,
  SavedFiltersByLibrary,
  SearchJoinMode,
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

function cleanStringList(value: unknown, maxLength = 255): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value.slice(0, 50)) {
    if (typeof item !== "string") continue;
    const cleaned = item.trim().slice(0, maxLength);
    if (cleaned) seen.add(cleaned);
  }
  return Array.from(seen);
}

function cleanAdvancedConditions(value: unknown): AdvancedSearchCondition[] {
  if (!Array.isArray(value)) return [];
  const cleaned: AdvancedSearchCondition[] = [];
  for (const candidate of value.slice(0, 24)) {
    if (!candidate || typeof candidate !== "object") continue;
    const raw = candidate as Partial<AdvancedSearchCondition>;
    const condition =
      typeof raw.condition === "string"
        ? raw.condition.trim().slice(0, 80)
        : "";
    const operator =
      typeof raw.operator === "string" ? raw.operator.trim().slice(0, 40) : "";
    const val = typeof raw.value === "string" ? raw.value.slice(0, 500) : "";
    if (condition && operator) {
      cleaned.push({ condition, operator, value: val });
    }
  }
  return cleaned;
}

function cleanQuickSearchMode(value: unknown): QuickSearchMode | undefined {
  if (
    value === "titleCreatorYear" ||
    value === "fields" ||
    value === "everything"
  ) {
    return value;
  }
  return undefined;
}

function cleanJoinMode(value: unknown): SearchJoinMode | undefined {
  if (value === "all" || value === "any") return value;
  return undefined;
}

function cleanPreset(value: unknown): SavedFilterPreset | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<SavedFilterPreset>;
  const id = typeof raw.id === "string" ? raw.id.trim().slice(0, 120) : "";
  const name =
    typeof raw.name === "string" ? raw.name.trim().slice(0, 120) : "";
  const scope = cleanScope(raw.scope);
  if (!id || !name || !scope) return null;

  const preset: SavedFilterPreset = {
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

  const includeTags = cleanStringList(raw.includeTags);
  if (includeTags.length) preset.includeTags = includeTags;

  const excludeTags = cleanStringList(raw.excludeTags);
  if (excludeTags.length) preset.excludeTags = excludeTags;

  if (
    typeof raw.collectionID === "number" &&
    Number.isSafeInteger(raw.collectionID) &&
    raw.collectionID > 0
  ) {
    preset.collectionID = raw.collectionID;
  }
  if (raw.unfiledOnly === true) preset.unfiledOnly = true;
  if (raw.includeSubcollections === false) preset.includeSubcollections = false;
  else if (raw.includeSubcollections === true)
    preset.includeSubcollections = true;

  const quickSearchMode = cleanQuickSearchMode(raw.quickSearchMode);
  if (quickSearchMode) preset.quickSearchMode = quickSearchMode;

  const joinMode = cleanJoinMode(raw.joinMode);
  if (joinMode) preset.joinMode = joinMode;

  const advancedConditions = cleanAdvancedConditions(raw.advancedConditions);
  if (advancedConditions.length) preset.advancedConditions = advancedConditions;

  return preset;
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
