import { config, version as pluginVersion } from "../../package.json";
import type {
  AdvancedSearchCondition,
  BatchTagMutationResult,
  CitationStyleOption,
  CollectionOption,
  ColoredTagSlot,
  CopyKind,
  CopyMetadataResult,
  DoubleClickAction,
  InterfaceDensity,
  ItemAttachmentSummary,
  ItemCollectionSummary,
  ItemDetails,
  ItemNoteSummary,
  ItemScope,
  ItemSummary,
  ItemTypeOption,
  LibraryOption,
  LibrarySearchResult,
  NavigatorBootstrap,
  NavigatorPreferences,
  SavedSearchOption,
  SearchConditionDefinition,
  TagMutationResult,
  TagNavigatorAPI,
  TagOverview,
  TagSummary,
  UnifiedItemQuery,
  UnifiedQueryResult,
  ZettlrCitationFormat,
  ZettlrCitationStyle,
} from "../types/tagNavigator";
import {
  sanitizeItemColumnWidths,
  sanitizeVisibleItemColumns,
} from "../utils/itemColumns";
import { sanitizeSavedFilters } from "../utils/savedFilters";
import { MAX_COLORED_TAG_SLOTS, normalizeHexColor } from "../utils/tagColor";

type TagAggregateRow = {
  name: string;
  count: number;
  manualCount: number;
  automaticCount: number;
};

type TagFacetRow = {
  name: string;
  count: number;
};

const PREF_PREFIX = `extensions.zotero.${config.addonRef}.`;
const DEFAULT_PAGE_SIZE = 500;
const SQLITE_CHUNK_SIZE = 850;

const PRIORITY_SEARCH_CONDITIONS = [
  "title",
  "creator",
  "tag",
  "anyField",
  "abstractNote",
  "publicationTitle",
  "date",
  "year",
  "itemType",
  "citationKey",
  "DOI",
  "extra",
  "note",
  "childNote",
  "annotationText",
  "fulltextContent",
  "collection",
  "unfiled",
  "dateAdded",
  "dateModified",
  "ISBN",
  "ISSN",
  "publisher",
  "language",
  "url",
];

function normalizeZettlrCitationStyle(value: unknown): ZettlrCitationStyle {
  return value === "in-text" || value === "in-text-suffix" ? value : "regular";
}

function normalizeDoubleClickAction(value: unknown): DoubleClickAction {
  return value === "selectInZotero" || value === "none"
    ? value
    : "openAttachment";
}

function normalizeDensity(value: unknown): InterfaceDensity {
  return value === "compact" ? "compact" : "comfortable";
}

function clampPaneWidth(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(Math.min(max, Math.max(min, numeric)));
}

function clampPageSize(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_PAGE_SIZE;
  return Math.round(Math.min(5000, Math.max(100, numeric)));
}

function stripHtmlSnippet(html: string, maxChars = 140): string {
  const plain = String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxChars ? `${plain.slice(0, maxChars - 1)}…` : plain;
}

/** Mirrors Zettlr's citation autocomplete formats. */
export function formatCitekeyForZettlr(
  citekey: string,
  citeStyle: ZettlrCitationStyle,
): string {
  if (citeStyle === "in-text") return `@${citekey}`;
  if (citeStyle === "in-text-suffix") return `@${citekey} []`;
  return `[@${citekey}]`;
}

/** Formats one or more citekeys as a single Zettlr/Pandoc citation. */
export function formatCitekeysForZettlr(
  citekeys: string[],
  citeStyle: ZettlrCitationStyle,
): string {
  if (citekeys.length === 1) {
    return formatCitekeyForZettlr(citekeys[0], citeStyle);
  }
  if (citeStyle === "in-text") {
    return citekeys.map((citekey) => `@${citekey}`).join("; ");
  }
  if (citeStyle === "in-text-suffix") {
    return citekeys.map((citekey) => `@${citekey} []`).join("; ");
  }
  return `[${citekeys.map((citekey) => `@${citekey}`).join("; ")}]`;
}

/**
 * The only layer that knows about Zotero internals and its SQLite schema.
 * The floating window receives a small, stable API made of plain objects.
 */
export class TagNavigatorService implements TagNavigatorAPI {
  private overviewCache = new Map<number, TagOverview>();
  private itemCache = new Map<string, ItemSummary[]>();

  async initialize(): Promise<NavigatorBootstrap> {
    await Zotero.Styles.init();

    const libraries = this.getLibraries();
    const citationStyles = this.getCitationStyles();
    const preferences = this.getPreferences(libraries);
    const zettlrCitationFormat = await this.getZettlrCitationFormat();
    const searchConditions = this.getSearchConditionDefinitions();
    const itemTypes = this.getItemTypes();

    return {
      locale: Zotero.locale || "en-US",
      appVersion: Zotero.version,
      pluginVersion,
      libraries,
      citationStyles,
      defaultCitationStyleID: this.getDefaultCitationStyleID(citationStyles),
      zettlrCitationFormat,
      searchConditions,
      itemTypes,
      preferences,
    };
  }

  async getTagOverview(libraryID: number): Promise<TagOverview> {
    this.assertLibrary(libraryID);

    const cached = this.overviewCache.get(libraryID);
    if (cached) return cached;

    const regularItemWhere = `
      I.libraryID = ?
      AND D.itemID IS NULL
      AND ITEMTYPE.typeName NOT IN ('attachment', 'note', 'annotation')
    `;

    const rows = await this.queryRows<TagAggregateRow>(
      `
        SELECT
          T.name AS name,
          COUNT(*) AS count,
          SUM(CASE WHEN IT.type = 0 THEN 1 ELSE 0 END) AS manualCount,
          SUM(CASE WHEN IT.type = 1 THEN 1 ELSE 0 END) AS automaticCount
        FROM tags T
        JOIN itemTags IT USING (tagID)
        JOIN items I USING (itemID)
        JOIN itemTypes ITEMTYPE USING (itemTypeID)
        LEFT JOIN deletedItems D USING (itemID)
        WHERE ${regularItemWhere}
        GROUP BY T.tagID, T.name
        ORDER BY T.name COLLATE NOCASE
      `,
      [libraryID],
    );

    const colorMap = this.readColorMap(libraryID);
    const coloredTags: ColoredTagSlot[] = Array.from(colorMap.entries())
      .map(([name, info]) => ({
        name,
        color: info.color,
        position: info.position,
      }))
      .sort((a, b) => a.position - b.position);

    const tags: TagSummary[] = rows.map((row) => {
      const name = String(row.name);
      const manualCount = Number(row.manualCount) || 0;
      const automaticCount = Number(row.automaticCount) || 0;
      const colorEntry =
        colorMap.get(name) || colorMap.get(name.normalize()) || undefined;
      const summary: TagSummary = {
        name,
        count: Number(row.count) || 0,
        manualCount,
        automaticCount,
        kind:
          manualCount > 0 && automaticCount > 0
            ? "mixed"
            : automaticCount > 0
              ? "automatic"
              : "manual",
      };
      if (colorEntry) {
        summary.color = colorEntry.color;
        summary.colorPosition = colorEntry.position;
      }
      return summary;
    });

    const totalItems = await this.valueQuery(
      `
        SELECT COUNT(*)
        FROM items I
        JOIN itemTypes ITEMTYPE USING (itemTypeID)
        LEFT JOIN deletedItems D USING (itemID)
        WHERE ${regularItemWhere}
      `,
      [libraryID],
    );

    const untaggedItems = await this.valueQuery(
      `
        SELECT COUNT(*)
        FROM items I
        JOIN itemTypes ITEMTYPE USING (itemTypeID)
        LEFT JOIN deletedItems D USING (itemID)
        WHERE ${regularItemWhere}
          AND NOT EXISTS (
            SELECT 1 FROM itemTags UNT WHERE UNT.itemID = I.itemID
          )
      `,
      [libraryID],
    );

    const overview: TagOverview = {
      libraryID,
      totalItems,
      untaggedItems,
      tags,
      coloredTags,
    };
    this.overviewCache.set(libraryID, overview);
    return overview;
  }

  async getCollections(libraryID: number): Promise<CollectionOption[]> {
    this.assertLibrary(libraryID);
    const rawCollections =
      Zotero.Collections.getByLibrary(libraryID, true) || [];
    const byID = new Map<number, Zotero.Collection>();
    const childrenByParent = new Map<number | null, Zotero.Collection[]>();

    for (const col of rawCollections) {
      if (!col || col.deleted) continue;
      byID.set(col.id, col);
    }
    for (const col of byID.values()) {
      const parentID =
        col.parentID && byID.has(col.parentID) ? col.parentID : null;
      const list = childrenByParent.get(parentID) || [];
      list.push(col);
      childrenByParent.set(parentID, list);
    }

    const result: CollectionOption[] = [];
    const visit = (
      parentID: number | null,
      depth: number,
      prefix: string[],
    ) => {
      const siblings = (childrenByParent.get(parentID) || []).sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), Zotero.locale),
      );
      for (const col of siblings) {
        const name = String(col.name || "").trim();
        const pathParts = [...prefix, name];
        result.push({
          id: col.id,
          key: String(col.key || ""),
          name,
          parentID,
          depth,
          path: pathParts.join(" / "),
        });
        visit(col.id, depth + 1, pathParts);
      }
    };
    visit(null, 0, []);
    return result;
  }

  async getSavedSearches(libraryID: number): Promise<SavedSearchOption[]> {
    this.assertLibrary(libraryID);
    const searches = ((Zotero.Searches as any).getByLibrary(libraryID) ||
      []) as Array<{
      id: number;
      key?: string;
      name?: string;
      deleted?: boolean;
    }>;
    return searches
      .filter((search) => search && !search.deleted)
      .map((search) => ({
        id: search.id,
        key: String(search.key || ""),
        name: String(search.name || "").trim(),
      }))
      .filter((entry) => entry.name)
      .sort((a, b) => a.name.localeCompare(b.name, Zotero.locale));
  }

  async queryItems(
    libraryID: number,
    query: UnifiedItemQuery,
  ): Promise<UnifiedQueryResult> {
    this.assertLibrary(libraryID);

    const includeTags = Array.from(
      new Set(
        (query.includeTags || []).map((tag) => tag.trim()).filter(Boolean),
      ),
    );
    const excludeTags = Array.from(
      new Set(
        (query.excludeTags || [])
          .map((tag) => tag.trim())
          .filter((tag) => Boolean(tag) && !includeTags.includes(tag)),
      ),
    );
    const untaggedOnly = query.untaggedOnly === true;
    const collectionID =
      typeof query.collectionID === "number" && query.collectionID > 0
        ? query.collectionID
        : null;
    const unfiledOnly = query.unfiledOnly === true;
    const includeSubcollections = query.includeSubcollections !== false;
    const savedSearchID =
      typeof query.savedSearchID === "number" && query.savedSearchID > 0
        ? query.savedSearchID
        : null;
    const quickSearchQuery = String(query.quickSearchQuery || "").trim();
    const quickSearchMode =
      query.quickSearchMode === "titleCreatorYear" ||
      query.quickSearchMode === "everything"
        ? query.quickSearchMode
        : "fields";
    const joinMode = query.joinMode === "any" ? "any" : "all";
    const advancedConditions = this.filterValidConditions(
      query.advancedConditions || [],
    );

    const offset = Math.max(0, Math.floor(Number(query.offset) || 0));
    const requestedLimit =
      typeof query.limit === "number" ? Math.floor(query.limit) : undefined;
    const limit =
      requestedLimit === 0
        ? 0
        : requestedLimit && requestedLimit > 0
          ? Math.min(10000, requestedLimit)
          : this.getPageSize();

    const hasSearchComponent = Boolean(
      savedSearchID ||
      collectionID ||
      unfiledOnly ||
      quickSearchQuery ||
      advancedConditions.length,
    );
    const hasTagComponent = Boolean(
      untaggedOnly || includeTags.length || excludeTags.length,
    );

    // Fast path for unfiltered Recent Items view on large libraries
    if (!hasSearchComponent && !hasTagComponent) {
      const overview = await this.getTagOverview(libraryID);
      const facetTagCounts: Record<string, number> = {};
      for (const tag of overview.tags) {
        facetTagCounts[tag.name] = tag.count;
      }

      const limitClause = limit > 0 ? "LIMIT ? OFFSET ?" : "LIMIT -1 OFFSET ?";
      const params =
        limit > 0 ? [libraryID, limit, offset] : [libraryID, offset];
      const pageIDs = await Zotero.DB.columnQueryAsync<number>(
        `
          SELECT I.itemID
          FROM items I
          JOIN itemTypes ITEMTYPE USING (itemTypeID)
          LEFT JOIN deletedItems D USING (itemID)
          WHERE I.libraryID = ?
            AND D.itemID IS NULL
            AND ITEMTYPE.typeName NOT IN ('attachment', 'note', 'annotation')
          ORDER BY I.dateModified DESC, I.itemID DESC
          ${limitClause}
        `.trim(),
        params,
      );
      const summaries = await this.materializeOrderedRegularItems(pageIDs);
      return {
        items: summaries,
        total: overview.totalItems,
        offset,
        hasMore: offset + summaries.length < overview.totalItems,
        facetTagCounts,
      };
    }

    let searchCandidateSet: Set<number> | null = null;
    const hasOpenCandidates = (): boolean =>
      searchCandidateSet === null || searchCandidateSet.size > 0;
    const intersectCandidates = (ids: number[]) => {
      const next = new Set(ids);
      if (searchCandidateSet === null) {
        searchCandidateSet = next;
      } else {
        for (const id of searchCandidateSet) {
          if (!next.has(id)) searchCandidateSet.delete(id);
        }
      }
    };

    if (savedSearchID) {
      const saved = Zotero.Searches.get(savedSearchID);
      if (!saved || saved.libraryID !== libraryID) {
        intersectCandidates([]);
      } else {
        const rawIDs = await saved.search();
        intersectCandidates(
          await this.resolveToRegularItemIDs(libraryID, rawIDs),
        );
      }
    }

    if (hasOpenCandidates() && (unfiledOnly || collectionID)) {
      const colSearch = new Zotero.Search({ libraryID });
      if (unfiledOnly) {
        colSearch.addCondition("unfiled", "true");
      } else if (collectionID) {
        colSearch.addCondition("collectionID", "is", collectionID);
        if (
          includeSubcollections &&
          this.hasSearchOperator("recursive", "true")
        ) {
          colSearch.addCondition("recursive", "true");
        }
      }
      const rawIDs = await colSearch.search();
      intersectCandidates(
        await this.resolveToRegularItemIDs(libraryID, rawIDs),
      );
    }

    if (hasOpenCandidates() && quickSearchQuery) {
      const qs = new Zotero.Search({ libraryID });
      if (this.hasSearchOperator("includeParents", "true")) {
        qs.addCondition("includeParents", "true");
      }
      qs.addCondition(
        `quicksearch-${quickSearchMode}`,
        "contains",
        quickSearchQuery,
      );
      const rawIDs = await qs.search();
      intersectCandidates(
        await this.resolveToRegularItemIDs(libraryID, rawIDs),
      );
    }

    if (hasOpenCandidates() && advancedConditions.length) {
      const adv = new Zotero.Search({ libraryID });
      if (this.hasSearchOperator("includeParents", "true")) {
        adv.addCondition("includeParents", "true");
      }
      if (joinMode === "any") {
        adv.addCondition("joinMode", "any");
      }
      for (const cond of advancedConditions) {
        if (cond.condition === "collection" && /^\d+$/.test(cond.value)) {
          adv.addCondition(
            "collectionID",
            cond.operator as any,
            Number(cond.value),
          );
        } else {
          adv.addCondition(cond.condition, cond.operator as any, cond.value);
        }
      }
      const rawIDs = await adv.search();
      intersectCandidates(
        await this.resolveToRegularItemIDs(libraryID, rawIDs),
      );
    }

    if (
      searchCandidateSet !== null &&
      (searchCandidateSet as Set<number>).size === 0
    ) {
      return {
        items: [],
        total: 0,
        offset,
        hasMore: false,
        facetTagCounts: {},
      };
    }

    const sqlClauses: string[] = [
      "I.libraryID = ?",
      "D.itemID IS NULL",
      "ITEMTYPE.typeName NOT IN ('attachment', 'note', 'annotation')",
    ];
    const sqlParams: Array<string | number> = [libraryID];

    if (untaggedOnly) {
      sqlClauses.push(
        "NOT EXISTS (SELECT 1 FROM itemTags UNT WHERE UNT.itemID = I.itemID)",
      );
    } else {
      for (const tag of includeTags) {
        sqlClauses.push(
          `EXISTS (
            SELECT 1 FROM itemTags IT_INC
            JOIN tags T_INC USING (tagID)
            WHERE IT_INC.itemID = I.itemID AND T_INC.name = ?
          )`,
        );
        sqlParams.push(tag);
      }
      if (excludeTags.length) {
        const placeholders = excludeTags.map(() => "?").join(", ");
        sqlClauses.push(
          `NOT EXISTS (
            SELECT 1 FROM itemTags IT_EXC
            JOIN tags T_EXC USING (tagID)
            WHERE IT_EXC.itemID = I.itemID AND T_EXC.name IN (${placeholders})
          )`,
        );
        sqlParams.push(...excludeTags);
      }
    }

    const orderedBaseIDs = await Zotero.DB.columnQueryAsync<number>(
      `
        SELECT I.itemID
        FROM items I
        JOIN itemTypes ITEMTYPE USING (itemTypeID)
        LEFT JOIN deletedItems D USING (itemID)
        WHERE ${sqlClauses.join(" AND ")}
        ORDER BY I.dateModified DESC, I.itemID DESC
      `.trim(),
      sqlParams,
    );

    const matchedIDs =
      searchCandidateSet === null
        ? orderedBaseIDs
        : orderedBaseIDs.filter((id) =>
            (searchCandidateSet as Set<number>).has(id),
          );

    const facetTagCounts = await this.computeFacetTagCounts(matchedIDs);
    const pageIDs =
      limit > 0
        ? matchedIDs.slice(offset, offset + limit)
        : matchedIDs.slice(offset);
    const summaries = await this.materializeOrderedRegularItems(pageIDs);

    return {
      items: summaries,
      total: matchedIDs.length,
      offset,
      hasMore: offset + summaries.length < matchedIDs.length,
      facetTagCounts,
    };
  }

  async saveZoteroSearch(
    libraryID: number,
    name: string,
    query: UnifiedItemQuery,
  ): Promise<SavedSearchOption> {
    this.assertEditableLibrary(libraryID);
    const cleanedName = String(name || "").trim();
    if (!cleanedName) throw new Error("EMPTY_SEARCH_NAME");

    const search = new Zotero.Search({ libraryID, name: cleanedName });
    const includeTags = (query.includeTags || [])
      .map((tag) => tag.trim())
      .filter(Boolean);
    const excludeTags = (query.excludeTags || [])
      .map((tag) => tag.trim())
      .filter(Boolean);
    const validAdvanced = this.filterValidConditions(
      query.advancedConditions || [],
    );
    const quickSearchQuery = String(query.quickSearchQuery || "").trim();

    const hasOuterFilters = Boolean(
      query.unfiledOnly ||
      query.collectionID ||
      includeTags.length ||
      excludeTags.length ||
      quickSearchQuery,
    );

    if (query.unfiledOnly) {
      search.addCondition("unfiled", "true");
    } else if (query.collectionID) {
      search.addCondition("collectionID", "is", query.collectionID);
      if (
        query.includeSubcollections !== false &&
        this.hasSearchOperator("recursive", "true")
      ) {
        search.addCondition("recursive", "true");
      }
    }

    for (const tag of includeTags) {
      search.addCondition("tag", "is", tag);
    }
    for (const tag of excludeTags) {
      search.addCondition("tag", "isNot", tag);
    }

    if (quickSearchQuery) {
      if (query.quickSearchMode === "everything") {
        if (this.hasSearchOperator("groupStart", "true")) {
          search.addCondition("groupStart", "true", "");
          search.addCondition("joinMode", "any");
          search.addCondition("anyField", "contains", quickSearchQuery);
          search.addCondition("fulltextContent", "contains", quickSearchQuery);
          search.addCondition("note", "contains", quickSearchQuery);
          search.addCondition("groupEnd", "true", "");
        } else {
          search.addCondition("anyField", "contains", quickSearchQuery);
        }
      } else if (query.quickSearchMode === "titleCreatorYear") {
        if (this.hasSearchOperator("groupStart", "true")) {
          search.addCondition("groupStart", "true", "");
          search.addCondition("joinMode", "any");
          search.addCondition("title", "contains", quickSearchQuery);
          search.addCondition("creator", "contains", quickSearchQuery);
          search.addCondition("year", "contains", quickSearchQuery);
          search.addCondition("groupEnd", "true", "");
        } else {
          search.addCondition("title", "contains", quickSearchQuery);
        }
      } else {
        search.addCondition("anyField", "contains", quickSearchQuery);
      }
    }

    if (validAdvanced.length) {
      const useNestedGroup =
        query.joinMode === "any" &&
        hasOuterFilters &&
        this.hasSearchOperator("groupStart", "true");

      if (useNestedGroup) {
        search.addCondition("groupStart", "true", "");
        search.addCondition("joinMode", "any");
      } else if (query.joinMode === "any" && !hasOuterFilters) {
        search.addCondition("joinMode", "any");
      }

      for (const cond of validAdvanced) {
        if (cond.condition === "collection" && /^\d+$/.test(cond.value)) {
          search.addCondition(
            "collectionID",
            cond.operator as any,
            Number(cond.value),
          );
        } else {
          search.addCondition(cond.condition, cond.operator as any, cond.value);
        }
      }

      if (useNestedGroup) {
        search.addCondition("groupEnd", "true", "");
      }
    }

    // Ensure at least one condition exists so Zotero accepts saving it
    if (!Object.keys(search.getConditions() || {}).length) {
      search.addCondition("itemType", "isNot", "attachment");
    }

    await search.saveTx();
    this.invalidate();
    return {
      id: search.id,
      key: String(search.key || ""),
      name: String(search.name || cleanedName),
    };
  }

  async getItems(libraryID: number, scope: ItemScope): Promise<ItemSummary[]> {
    this.assertLibrary(libraryID);
    const cacheKey = `${libraryID}:${
      scope.kind === "tag" ? `tag:${scope.tagName}` : "untagged"
    }`;
    const cached = this.itemCache.get(cacheKey);
    if (cached) return cached;

    const result = await this.queryItems(
      libraryID,
      scope.kind === "tag"
        ? { includeTags: [scope.tagName], limit: 0 }
        : { untaggedOnly: true, limit: 0 },
    );
    this.rememberItems(cacheKey, result.items);
    return result.items;
  }

  async getRecentItems(libraryID: number): Promise<LibrarySearchResult> {
    const result = await this.queryItems(libraryID, {
      offset: 0,
      limit: this.getPageSize(),
    });
    return {
      items: result.items,
      total: result.total,
      limited: result.hasMore,
    };
  }

  async searchLibrary(
    libraryID: number,
    query: string,
  ): Promise<LibrarySearchResult> {
    this.assertLibrary(libraryID);
    const cleaned = query.trim();
    if (!cleaned) return { items: [], total: 0, limited: false };

    const result = await this.queryItems(libraryID, {
      quickSearchQuery: cleaned,
      quickSearchMode: "fields",
      offset: 0,
      limit: this.getPageSize(),
    });
    return {
      items: result.items,
      total: result.total,
      limited: result.hasMore,
    };
  }

  async getItemDetails(itemID: number): Promise<ItemDetails> {
    const item = await this.getRegularItem(itemID);
    const [summary] = await this.buildItemSummaries([item]);
    const collections = await this.getItemCollections(item);
    const attachments = await this.getItemAttachmentSummaries(item);
    const notesPreview = await this.getItemNoteSummaries(item);

    return {
      ...summary,
      doi: this.getField(item, "DOI"),
      url: this.getField(item, "url"),
      collections,
      attachments,
      notesPreview,
    };
  }

  async addTag(itemID: number, tagName: string): Promise<ItemDetails> {
    const item = await this.getEditableRegularItem(itemID);
    const cleaned = this.validateTagName(tagName);

    if (item.addTag(cleaned, 0)) {
      await item.saveTx();
      this.invalidate();
    }
    return this.getItemDetails(itemID);
  }

  async removeTag(itemID: number, tagName: string): Promise<ItemDetails> {
    const item = await this.getEditableRegularItem(itemID);
    if (item.removeTag(tagName)) {
      await item.saveTx();
      this.invalidate();
    }
    return this.getItemDetails(itemID);
  }

  async addTags(
    itemIDs: number[],
    tagName: string,
  ): Promise<BatchTagMutationResult> {
    const items = await this.getEditableRegularItems(itemIDs);
    const cleaned = this.validateTagName(tagName);
    let affectedItems = 0;

    await Zotero.DB.executeTransaction(async () => {
      for (const item of items) {
        if (item.hasTag(cleaned) && item.getTagType(cleaned) === 0) continue;
        if (!item.addTag(cleaned, 0)) continue;
        await item.save();
        affectedItems++;
      }
    });
    if (affectedItems) this.invalidate();
    return {
      action: "add",
      tagName: cleaned,
      selectedItems: items.length,
      affectedItems,
    };
  }

  async removeTags(
    itemIDs: number[],
    tagName: string,
  ): Promise<BatchTagMutationResult> {
    const items = await this.getEditableRegularItems(itemIDs);
    const cleaned = this.validateTagName(tagName);
    let affectedItems = 0;

    await Zotero.DB.executeTransaction(async () => {
      for (const item of items) {
        if (!item.hasTag(cleaned)) continue;
        if (!item.removeTag(cleaned)) continue;
        await item.save();
        affectedItems++;
      }
    });
    if (affectedItems) this.invalidate();
    return {
      action: "remove",
      tagName: cleaned,
      selectedItems: items.length,
      affectedItems,
    };
  }

  async setTagColor(
    libraryID: number,
    tagName: string,
    color: string | null,
    position?: number,
  ): Promise<void> {
    this.assertEditableLibrary(libraryID);
    const cleaned = this.validateTagName(tagName).normalize();

    if (!color) {
      await (Zotero.Tags as any).setColor(libraryID, cleaned, false, false);
      this.invalidate();
      return;
    }

    const normalizedColor = normalizeHexColor(color);
    if (!normalizedColor) throw new Error("INVALID_TAG_COLOR");

    const colors = this.readColorMap(libraryID);
    const maxSlots = Zotero.Tags.MAX_COLORED_TAGS || MAX_COLORED_TAG_SLOTS;
    const isExisting = colors.has(cleaned);

    let targetPosition: number | undefined;
    if (typeof position === "number" && Number.isInteger(position)) {
      if (position < 1 || position > maxSlots) {
        throw new Error("INVALID_COLOR_POSITION");
      }
      targetPosition = position - 1;
    }

    if (!isExisting && colors.size >= maxSlots) {
      if (targetPosition !== undefined) {
        const occupant = Zotero.Tags.getColorByPosition(
          libraryID,
          targetPosition,
        );
        if (occupant && occupant.name !== cleaned) {
          await (Zotero.Tags as any).setColor(
            libraryID,
            occupant.name,
            false,
            false,
          );
        } else {
          throw new Error("MAX_COLORED_TAGS_REACHED");
        }
      } else {
        throw new Error("MAX_COLORED_TAGS_REACHED");
      }
    }

    await (Zotero.Tags as any).setColor(
      libraryID,
      cleaned,
      normalizedColor,
      targetPosition,
    );
    this.invalidate();
  }

  async toggleColoredTagByPosition(
    libraryID: number,
    itemIDs: number[],
    position: number,
  ): Promise<BatchTagMutationResult | null> {
    this.assertEditableLibrary(libraryID);
    const maxSlots = Zotero.Tags.MAX_COLORED_TAGS || MAX_COLORED_TAG_SLOTS;
    if (!Number.isInteger(position) || position < 1 || position > maxSlots) {
      return null;
    }
    const slot = Zotero.Tags.getColorByPosition(libraryID, position - 1);
    if (!slot || !slot.name) return null;

    const items = await this.getEditableRegularItems(itemIDs);
    const allHaveTag = items.every((item) => item.hasTag(slot.name));
    return allHaveTag
      ? this.removeTags(itemIDs, slot.name)
      : this.addTags(itemIDs, slot.name);
  }

  async convertAutomaticTagToManual(
    libraryID: number,
    tagName: string,
  ): Promise<TagMutationResult> {
    this.assertEditableLibrary(libraryID);
    const cleaned = this.validateTagName(tagName);
    const itemIDs = await Zotero.DB.columnQueryAsync<number>(
      `
        SELECT DISTINCT I.itemID
        FROM items I
        JOIN itemTypes ITEMTYPE USING (itemTypeID)
        JOIN itemTags IT USING (itemID)
        JOIN tags T USING (tagID)
        LEFT JOIN deletedItems D USING (itemID)
        WHERE I.libraryID = ?
          AND D.itemID IS NULL
          AND ITEMTYPE.typeName NOT IN ('attachment', 'note', 'annotation')
          AND T.name = ?
          AND IT.type = 1
      `.trim(),
      [libraryID, cleaned],
    );

    if (!itemIDs.length) {
      return {
        action: "convertToManual",
        sourceName: cleaned,
        affectedItems: 0,
      };
    }

    const items = await Zotero.Items.getAsync(itemIDs);
    let affectedItems = 0;
    await Zotero.DB.executeTransaction(async () => {
      for (const item of items) {
        if (!item?.isRegularItem()) continue;
        if (item.addTag(cleaned, 0)) {
          await item.save();
          affectedItems++;
        }
      }
    });
    this.invalidate();
    return {
      action: "convertToManual",
      sourceName: cleaned,
      affectedItems,
    };
  }

  async removeAutomaticTags(libraryID: number): Promise<TagMutationResult> {
    this.assertEditableLibrary(libraryID);
    const affectedItems = await this.valueQuery(
      `
        SELECT COUNT(DISTINCT I.itemID)
        FROM items I
        JOIN itemTypes ITEMTYPE USING (itemTypeID)
        JOIN itemTags IT USING (itemID)
        LEFT JOIN deletedItems D USING (itemID)
        WHERE I.libraryID = ?
          AND D.itemID IS NULL
          AND ITEMTYPE.typeName NOT IN ('attachment', 'note', 'annotation')
          AND IT.type = 1
      `,
      [libraryID],
    );

    await Zotero.Tags.removeAutomaticFromLibrary(libraryID, () => undefined);
    this.invalidate();
    return {
      action: "removeAllAutomatic",
      sourceName: "*",
      affectedItems,
    };
  }

  async renameTag(
    libraryID: number,
    sourceName: string,
    targetName: string,
  ): Promise<TagMutationResult> {
    this.assertEditableLibrary(libraryID);
    const source = this.validateTagName(sourceName);
    const target = this.validateTagName(targetName);
    if (source === target) throw new Error("TAG_NAMES_IDENTICAL");

    const sourceUsage = await this.getTagUsage(libraryID, source);
    if (!sourceUsage) throw new Error("TAG_NOT_FOUND");
    if (await this.getTagUsage(libraryID, target)) {
      throw new Error("TAG_ALREADY_EXISTS");
    }

    await Zotero.Tags.rename(libraryID, source, target);
    this.invalidate();
    return {
      action: "rename",
      sourceName: source,
      targetName: target,
      affectedItems: sourceUsage.itemIDs.length,
    };
  }

  async mergeTags(
    libraryID: number,
    sourceName: string,
    targetName: string,
  ): Promise<TagMutationResult> {
    this.assertEditableLibrary(libraryID);
    const source = this.validateTagName(sourceName);
    const target = this.validateTagName(targetName);
    if (source === target) throw new Error("TAG_NAMES_IDENTICAL");

    const sourceUsage = await this.getTagUsage(libraryID, source);
    if (!sourceUsage) throw new Error("TAG_NOT_FOUND");
    if (!(await this.getTagUsage(libraryID, target))) {
      throw new Error("MERGE_TARGET_NOT_FOUND");
    }

    await Zotero.Tags.rename(libraryID, source, target);
    this.invalidate();
    return {
      action: "merge",
      sourceName: source,
      targetName: target,
      affectedItems: sourceUsage.itemIDs.length,
    };
  }

  async deleteTag(
    libraryID: number,
    tagName: string,
  ): Promise<TagMutationResult> {
    this.assertEditableLibrary(libraryID);
    const source = this.validateTagName(tagName);
    const sourceUsage = await this.getTagUsage(libraryID, source);
    if (!sourceUsage) throw new Error("TAG_NOT_FOUND");

    await Zotero.Tags.removeFromLibrary(
      libraryID,
      [sourceUsage.tagID],
      () => undefined,
      [0, 1],
    );
    this.invalidate();
    return {
      action: "delete",
      sourceName: source,
      affectedItems: sourceUsage.itemIDs.length,
    };
  }

  async copyMetadata(
    itemIDs: number[],
    kind: CopyKind,
    styleID?: string,
    useZettlrFormat = false,
  ): Promise<CopyMetadataResult> {
    const items = await this.getRegularItems(itemIDs);

    if (kind === "citekey") {
      const citekeys = items
        .map((item) => this.getField(item, "citationKey"))
        .filter(Boolean);
      if (!citekeys.length) throw new Error("NO_CITEKEY");
      if (useZettlrFormat) {
        const zettlrFormat = await this.getZettlrCitationFormat();
        if (!zettlrFormat.available) {
          throw new Error("ZETTLR_CONFIG_UNAVAILABLE");
        }
        Zotero.Utilities.Internal.copyTextToClipboard(
          formatCitekeysForZettlr(citekeys, zettlrFormat.citeStyle),
        );
      } else {
        Zotero.Utilities.Internal.copyTextToClipboard(citekeys.join("\n"));
      }
      return {
        requestedItems: items.length,
        copiedItems: citekeys.length,
        missingCitekeys: items.length - citekeys.length,
      };
    }

    if (!styleID || !Zotero.Styles.get(styleID)) {
      throw new Error("INVALID_CITATION_STYLE");
    }

    const mainWindow = Zotero.getMainWindow();
    const fileInterface = (mainWindow as any)?.Zotero_File_Interface;
    if (!fileInterface?.copyItemsToClipboard) {
      throw new Error("COPY_INTERFACE_UNAVAILABLE");
    }

    const locale = String(
      Zotero.Prefs.get("export.quickCopy.locale") || Zotero.locale || "",
    );
    fileInterface.copyItemsToClipboard(
      items,
      styleID,
      locale,
      false,
      kind === "citation",
    );
    return {
      requestedItems: items.length,
      copiedItems: items.length,
      missingCitekeys: 0,
    };
  }

  async selectInMainWindow(itemID: number): Promise<void> {
    await this.getRegularItem(itemID);
    const mainWindow = Zotero.getMainWindow();
    if (!mainWindow?.ZoteroPane) throw new Error("MAIN_WINDOW_UNAVAILABLE");

    mainWindow.focus();
    await Promise.resolve(mainWindow.ZoteroPane.selectItem(itemID));
  }

  async openBestAttachment(itemID: number): Promise<boolean> {
    const item = await this.getRegularItem(itemID);
    const attachment = await item.getBestAttachment();
    if (!attachment) return false;

    const mainWindow = Zotero.getMainWindow();
    if (!mainWindow?.ZoteroPane) throw new Error("MAIN_WINDOW_UNAVAILABLE");
    mainWindow.focus();
    await Promise.resolve(
      (mainWindow.ZoteroPane as any).viewAttachment(
        attachment.id,
        undefined,
        false,
      ),
    );
    return true;
  }

  async openAttachmentByID(attachmentID: number): Promise<boolean> {
    const attachment = await Zotero.Items.getAsync(attachmentID);
    if (!attachment || !attachment.isAttachment()) return false;
    const mainWindow = Zotero.getMainWindow();
    if (!mainWindow?.ZoteroPane) throw new Error("MAIN_WINDOW_UNAVAILABLE");
    mainWindow.focus();
    await Promise.resolve(
      (mainWindow.ZoteroPane as any).viewAttachment(
        attachment.id,
        undefined,
        false,
      ),
    );
    return true;
  }

  savePreferences(preferences: Partial<NavigatorPreferences>): void {
    if (typeof preferences.hideAutomaticTags === "boolean") {
      this.setPref("hideAutomaticTags", preferences.hideAutomaticTags);
    }
    if (
      typeof preferences.selectedLibraryID === "number" &&
      Zotero.Libraries.exists(preferences.selectedLibraryID)
    ) {
      this.setPref("selectedLibraryID", preferences.selectedLibraryID);
    }
    if (typeof preferences.inspectorOpen === "boolean") {
      this.setPref("inspectorOpen", preferences.inspectorOpen);
    }
    if (typeof preferences.tagPaneOpen === "boolean") {
      this.setPref("tagPaneOpen", preferences.tagPaneOpen);
    }
    if (typeof preferences.leftPaneWidth === "number") {
      this.setPref(
        "leftPaneWidth",
        clampPaneWidth(preferences.leftPaneWidth, 276, 210, 520),
      );
    }
    if (typeof preferences.rightPaneWidth === "number") {
      this.setPref(
        "rightPaneWidth",
        clampPaneWidth(preferences.rightPaneWidth, 328, 250, 560),
      );
    }
    if (preferences.density) {
      this.setPref("density", normalizeDensity(preferences.density));
    }
    if (preferences.doubleClickAction) {
      this.setPref(
        "doubleClickAction",
        normalizeDoubleClickAction(preferences.doubleClickAction),
      );
    }
    if (typeof preferences.pageSize === "number") {
      this.setPref("pageSize", clampPageSize(preferences.pageSize));
    }
    if (typeof preferences.zettlrCitationFormat === "boolean") {
      this.setPref("zettlrCitationFormat", preferences.zettlrCitationFormat);
    }
    if (preferences.itemColumnWidths) {
      const widths = sanitizeItemColumnWidths(preferences.itemColumnWidths);
      if (Object.keys(widths).length) {
        this.setPref("itemColumnWidths", JSON.stringify(widths));
      }
    }
    if (preferences.visibleColumns) {
      const visible = sanitizeVisibleItemColumns(preferences.visibleColumns);
      this.setPref("visibleColumns", JSON.stringify(visible));
    }
    if (preferences.savedFilters) {
      const savedFilters = sanitizeSavedFilters(preferences.savedFilters);
      this.setPref("savedFilters", JSON.stringify(savedFilters));
    }
  }

  invalidate(): void {
    this.overviewCache.clear();
    this.itemCache.clear();
  }

  private readColorMap(
    libraryID: number,
  ): Map<string, { color: string; position: number }> {
    try {
      const raw = Zotero.Tags.getColors(libraryID);
      if (!raw) return new Map();
      const normalized = new Map<string, { color: string; position: number }>();
      for (const [name, info] of raw.entries()) {
        normalized.set(name, {
          color: info.color,
          position: Number(info.position) + 1,
        });
      }
      return normalized;
    } catch {
      return new Map();
    }
  }

  private hasSearchOperator(condition: string, operator: string): boolean {
    try {
      return Boolean(
        (Zotero as any).SearchConditions?.hasOperator?.(condition, operator),
      );
    } catch {
      return false;
    }
  }

  private filterValidConditions(
    conditions: AdvancedSearchCondition[],
  ): AdvancedSearchCondition[] {
    const valid: AdvancedSearchCondition[] = [];
    for (const raw of conditions) {
      const condition = String(raw?.condition || "").trim();
      const operator = String(raw?.operator || "").trim();
      const value = String(raw?.value ?? "").trim();
      if (!condition || !operator) continue;
      const valueOptional =
        operator === "true" ||
        operator === "false" ||
        operator === "isEmpty" ||
        operator === "isNotEmpty";
      if (!valueOptional && !value) continue;

      if (
        condition === "collection" &&
        /^\d+$/.test(value) &&
        this.hasSearchOperator("collection", operator)
      ) {
        valid.push({ condition, operator, value });
        continue;
      }

      if (this.hasSearchOperator(condition, operator)) {
        valid.push({ condition, operator, value });
      }
    }
    return valid;
  }

  private async resolveToRegularItemIDs(
    libraryID: number,
    rawIDs: number[],
  ): Promise<number[]> {
    if (!rawIDs.length) return [];
    const unique = Array.from(
      new Set(rawIDs.filter((id) => Number.isInteger(id) && id > 0)),
    );
    if (!unique.length) return [];

    const resolved = new Set<number>();
    for (let i = 0; i < unique.length; i += SQLITE_CHUNK_SIZE) {
      const chunk = unique.slice(i, i + SQLITE_CHUNK_SIZE);
      const placeholders = chunk.map(() => "?").join(", ");
      const rows = await Zotero.DB.columnQueryAsync<number>(
        `
          SELECT DISTINCT COALESCE(IA.parentItemID, INO.parentItemID, IAN.parentItemID, I.itemID) AS resolvedID
          FROM items I
          LEFT JOIN itemAttachments IA ON IA.itemID = I.itemID
          LEFT JOIN itemNotes INO ON INO.itemID = I.itemID
          LEFT JOIN itemAnnotations IAN ON IAN.itemID = I.itemID
          WHERE I.libraryID = ? AND I.itemID IN (${placeholders})
        `.trim(),
        [libraryID, ...chunk],
      );
      for (const id of rows) {
        if (id) resolved.add(Number(id));
      }
    }
    return Array.from(resolved);
  }

  private async computeFacetTagCounts(
    itemIDs: number[],
  ): Promise<Record<string, number>> {
    if (!itemIDs.length) return {};
    const counts: Record<string, number> = {};

    if (itemIDs.length <= SQLITE_CHUNK_SIZE) {
      const placeholders = itemIDs.map(() => "?").join(", ");
      const rows = await this.queryRows<TagFacetRow>(
        `
          SELECT T.name AS name, COUNT(DISTINCT IT.itemID) AS count
          FROM itemTags IT
          JOIN tags T USING (tagID)
          WHERE IT.itemID IN (${placeholders})
          GROUP BY T.tagID, T.name
        `,
        itemIDs,
      );
      for (const row of rows) {
        counts[String(row.name)] = Number(row.count) || 0;
      }
      return counts;
    }

    // Large result sets (>850 items): aggregate distinct items per tag across chunks
    const seenByTag = new Map<string, number>();
    for (let i = 0; i < itemIDs.length; i += SQLITE_CHUNK_SIZE) {
      const chunk = itemIDs.slice(i, i + SQLITE_CHUNK_SIZE);
      const placeholders = chunk.map(() => "?").join(", ");
      const rows = await this.queryRows<TagFacetRow>(
        `
          SELECT T.name AS name, COUNT(DISTINCT IT.itemID) AS count
          FROM itemTags IT
          JOIN tags T USING (tagID)
          WHERE IT.itemID IN (${placeholders})
          GROUP BY T.tagID, T.name
        `,
        chunk,
      );
      for (const row of rows) {
        const name = String(row.name);
        seenByTag.set(
          name,
          (seenByTag.get(name) || 0) + (Number(row.count) || 0),
        );
      }
    }
    for (const [name, count] of seenByTag.entries()) {
      counts[name] = count;
    }
    return counts;
  }

  private async materializeOrderedRegularItems(
    itemIDs: number[],
  ): Promise<ItemSummary[]> {
    if (!itemIDs.length) return [];
    const items = await Zotero.Items.getAsync(itemIDs);
    const byID = new Map<number, Zotero.Item>();
    for (const item of items) {
      if (item?.isRegularItem()) byID.set(item.id, item);
    }
    const ordered = itemIDs
      .map((id) => byID.get(id))
      .filter((item): item is Zotero.Item => Boolean(item));
    return this.buildItemSummaries(ordered);
  }

  private getSearchConditionDefinitions(): SearchConditionDefinition[] {
    const sc = (Zotero as any).SearchConditions;
    if (!sc?.get) return [];

    const standard: Array<{ name: string }> =
      sc.getStandardConditions?.() || [];
    const candidateNames = Array.from(
      new Set([
        ...PRIORITY_SEARCH_CONDITIONS,
        ...standard.map((entry) => String(entry?.name || "")),
      ]),
    ).filter(Boolean);

    const definitions: SearchConditionDefinition[] = [];
    for (const name of candidateNames) {
      try {
        const cond = sc.get(name);
        if (!cond || !cond.operators) continue;
        const operators = Object.keys(cond.operators).filter(
          (op) => cond.operators[op],
        );
        if (!operators.length) continue;
        let label = name;
        try {
          label = String(sc.getLocalizedName?.(name) || cond.localized || name);
        } catch {
          label = String(cond.localized || name);
        }
        definitions.push({ name, label, operators });
      } catch {
        // Ignore unsupported conditions in older/newer Zotero builds
      }
    }
    return definitions;
  }

  private getItemTypes(): ItemTypeOption[] {
    try {
      const rawTypes: Array<{ id?: number; name: string }> =
        (Zotero.ItemTypes as any).getPrimaryTypes?.() ||
        (Zotero.ItemTypes as any).getTypes?.() ||
        [];
      return rawTypes
        .filter(
          (entry) =>
            entry?.name &&
            !["attachment", "note", "annotation"].includes(entry.name),
        )
        .map((entry) => ({
          name: entry.name,
          label: String(
            Zotero.ItemTypes.getLocalizedString(
              (entry.id ?? entry.name) as any,
            ) || entry.name,
          ),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, Zotero.locale));
    } catch {
      return [];
    }
  }

  private async getItemCollections(
    item: Zotero.Item,
  ): Promise<ItemCollectionSummary[]> {
    try {
      const collectionIDs = item.getCollections() || [];
      if (!collectionIDs.length) return [];
      const libraryCollections = await this.getCollections(item.libraryID);
      const byID = new Map(libraryCollections.map((col) => [col.id, col.path]));
      return collectionIDs
        .map((id) => ({
          id,
          path: byID.get(id) || "",
        }))
        .filter((entry) => entry.path)
        .sort((a, b) => a.path.localeCompare(b.path, Zotero.locale));
    } catch {
      return [];
    }
  }

  private async getItemAttachmentSummaries(
    item: Zotero.Item,
  ): Promise<ItemAttachmentSummary[]> {
    const attachmentIDs = item.getAttachments() || [];
    if (!attachmentIDs.length) return [];
    const attachments = await Zotero.Items.getAsync(attachmentIDs);
    return attachments
      .filter((att) => att && !att.deleted && att.isAttachment())
      .map((att) => ({
        id: att.id,
        title: this.getField(att, "title") || "Attachment",
        contentType: String((att as any).attachmentContentType || ""),
        isPDF: att.isPDFAttachment(),
      }));
  }

  private async getItemNoteSummaries(
    item: Zotero.Item,
  ): Promise<ItemNoteSummary[]> {
    const noteIDs = item.getNotes() || [];
    if (!noteIDs.length) return [];
    const notes = await Zotero.Items.getAsync(noteIDs);
    return notes
      .filter((note) => note && !note.deleted && note.isNote())
      .slice(0, 8)
      .map((note) => ({
        id: note.id,
        snippet: stripHtmlSnippet(note.getNote()),
      }))
      .filter((entry) => entry.snippet);
  }

  private getLibraries(): LibraryOption[] {
    return Zotero.Libraries.getAll()
      .filter(
        (library) =>
          library.libraryType === "user" || library.libraryType === "group",
      )
      .map((library) => ({
        id: library.libraryID,
        name: library.name,
        type: library.libraryType as "user" | "group",
        editable: Boolean(library.editable),
      }));
  }

  private getCitationStyles(): CitationStyleOption[] {
    return (Zotero.Styles.getVisible() as any[])
      .map((style) => ({
        id: String(style.styleID || ""),
        title: String(style.title || style.styleID || ""),
      }))
      .filter((style) => style.id)
      .sort((a, b) => a.title.localeCompare(b.title, Zotero.locale));
  }

  private getDefaultCitationStyleID(styles: CitationStyleOption[]): string {
    const rawSetting = Zotero.Prefs.get("export.quickCopy.setting");
    const setting = Zotero.QuickCopy.unserializeSetting(rawSetting);
    const preferredID = setting?.mode === "bibliography" ? setting.id : "";
    if (preferredID && styles.some((style) => style.id === preferredID)) {
      return preferredID;
    }

    return (
      styles.find((style) => style.id.endsWith("/apa"))?.id ||
      styles[0]?.id ||
      ""
    );
  }

  private getPageSize(): number {
    return clampPageSize(this.getPref("pageSize"));
  }

  private getPreferences(libraries: LibraryOption[]): NavigatorPreferences {
    const savedLibraryID = Number(this.getPref("selectedLibraryID")) || 0;
    const selectedLibraryID = libraries.some(
      (library) => library.id === savedLibraryID,
    )
      ? savedLibraryID
      : Zotero.Libraries.userLibraryID;

    const newHidePref = this.getPref("hideAutomaticTags");
    const legacyHidePref = Zotero.Prefs.get(`${PREF_PREFIX}enable`, true);

    return {
      hideAutomaticTags:
        typeof newHidePref === "boolean"
          ? newHidePref
          : typeof legacyHidePref === "boolean"
            ? legacyHidePref
            : true,
      selectedLibraryID,
      inspectorOpen: this.getPref("inspectorOpen") !== false,
      tagPaneOpen: this.getPref("tagPaneOpen") !== false,
      leftPaneWidth: clampPaneWidth(
        this.getPref("leftPaneWidth"),
        276,
        210,
        520,
      ),
      rightPaneWidth: clampPaneWidth(
        this.getPref("rightPaneWidth"),
        328,
        250,
        560,
      ),
      density: normalizeDensity(this.getPref("density")),
      doubleClickAction: normalizeDoubleClickAction(
        this.getPref("doubleClickAction"),
      ),
      pageSize: this.getPageSize(),
      zettlrCitationFormat: this.getPref("zettlrCitationFormat") === true,
      itemColumnWidths: this.getItemColumnWidths(),
      visibleColumns: this.getVisibleColumns(),
      savedFilters: this.getSavedFilters(),
    };
  }

  private getSavedFilters(): NavigatorPreferences["savedFilters"] {
    const saved = this.getPref("savedFilters");
    if (typeof saved !== "string" || !saved.trim()) return {};
    try {
      return sanitizeSavedFilters(JSON.parse(saved));
    } catch {
      return {};
    }
  }

  private getItemColumnWidths(): NavigatorPreferences["itemColumnWidths"] {
    const saved = this.getPref("itemColumnWidths");
    if (typeof saved !== "string" || !saved.trim()) return {};

    try {
      return sanitizeItemColumnWidths(JSON.parse(saved));
    } catch {
      return {};
    }
  }

  private getVisibleColumns(): NavigatorPreferences["visibleColumns"] {
    const saved = this.getPref("visibleColumns");
    if (typeof saved !== "string" || !saved.trim()) {
      return sanitizeVisibleItemColumns(null);
    }
    try {
      return sanitizeVisibleItemColumns(JSON.parse(saved));
    } catch {
      return sanitizeVisibleItemColumns(null);
    }
  }

  private async getZettlrCitationFormat(): Promise<ZettlrCitationFormat> {
    const unavailable: ZettlrCitationFormat = {
      available: false,
      citeStyle: "regular",
      preview: formatCitekeyForZettlr("CiteKey", "regular"),
    };

    try {
      const configData = await IOUtils.readJSON(this.getZettlrConfigPath());
      const configuredStyle = configData?.editor?.citeStyle;
      if (typeof configuredStyle !== "string") return unavailable;

      const citeStyle = normalizeZettlrCitationStyle(configuredStyle);
      return {
        available: true,
        citeStyle,
        preview: formatCitekeyForZettlr("CiteKey", citeStyle),
      };
    } catch {
      return unavailable;
    }
  }

  private getZettlrConfigPath(): string {
    const homeDirectory = Services.dirsvc.get(
      "Home",
      Components.interfaces.nsIFile,
    ).path;

    if (Zotero.isWin) {
      try {
        const appDataDirectory = Services.dirsvc.get(
          "AppData",
          Components.interfaces.nsIFile,
        ).path;
        return PathUtils.join(appDataDirectory, "Zettlr", "config.json");
      } catch {
        return PathUtils.join(
          homeDirectory,
          "AppData",
          "Roaming",
          "Zettlr",
          "config.json",
        );
      }
    }

    if (Zotero.isMac) {
      return PathUtils.join(
        homeDirectory,
        "Library",
        "Application Support",
        "Zettlr",
        "config.json",
      );
    }

    const xdgConfigDirectory = Services.env.get("XDG_CONFIG_HOME").trim();
    return PathUtils.join(
      xdgConfigDirectory || PathUtils.join(homeDirectory, ".config"),
      "Zettlr",
      "config.json",
    );
  }

  private async buildItemSummaries(
    items: Zotero.Item[],
  ): Promise<ItemSummary[]> {
    if (!items.length) return [];

    const attachmentIDs = Array.from(
      new Set(items.flatMap((item) => item.getAttachments())),
    );
    const attachments = attachmentIDs.length
      ? await Zotero.Items.getAsync(attachmentIDs)
      : ([] as Zotero.Item[]);
    const attachmentsByParent = new Map<number, Zotero.Item[]>();

    for (const attachment of attachments) {
      if (!attachment?.parentItemID) continue;
      const siblings = attachmentsByParent.get(attachment.parentItemID) || [];
      siblings.push(attachment);
      attachmentsByParent.set(attachment.parentItemID, siblings);
    }

    const colorMapsByLibrary = new Map<
      number,
      Map<string, { color: string; position: number }>
    >();
    const getLibraryColors = (libraryID: number) => {
      let map = colorMapsByLibrary.get(libraryID);
      if (!map) {
        map = this.readColorMap(libraryID);
        colorMapsByLibrary.set(libraryID, map);
      }
      return map;
    };

    return items.map((item) => {
      const creators = item
        .getCreators()
        .map((creator) => {
          const creatorData = creator as any;
          return String(
            creatorData.name ||
              [creatorData.firstName, creatorData.lastName]
                .filter(Boolean)
                .join(" "),
          ).trim();
        })
        .filter(Boolean);
      const date = this.getField(item, "date");
      const yearMatch = date.match(/(?:^|\D)(1\d{3}|20\d{2}|21\d{2})(?:\D|$)/);
      const itemAttachments = attachmentsByParent.get(item.id) || [];
      const libraryColors = getLibraryColors(item.libraryID);

      return {
        id: item.id,
        libraryID: item.libraryID,
        title: this.getField(item, "title"),
        abstract: this.getField(item, "abstractNote"),
        publicationTitle: this.getField(item, "publicationTitle"),
        date,
        year: yearMatch ? Number(yearMatch[1]) : null,
        dateAdded: String(item.dateAdded || ""),
        dateModified: String(item.dateModified || ""),
        itemType: String(item.itemType),
        itemTypeLabel: Zotero.ItemTypes.getLocalizedString(item.itemTypeID),
        iconURI: String(item.getImageSrc()),
        firstCreator: creators[0] || "",
        creators,
        creatorSearch: creators.join(" ").toLocaleLowerCase(Zotero.locale),
        citekey: this.getField(item, "citationKey"),
        tags: item.getTags().map((tag) => {
          const colorInfo =
            libraryColors.get(tag.tag) ||
            libraryColors.get(tag.tag.normalize());
          return {
            name: tag.tag,
            type: (tag.type === 1 ? 1 : 0) as 0 | 1,
            ...(colorInfo
              ? { color: colorInfo.color, colorPosition: colorInfo.position }
              : {}),
          };
        }),
        attachmentCount: itemAttachments.length,
        noteCount: item.getNotes().length,
        hasPDF: itemAttachments.some((attachment) =>
          attachment.isPDFAttachment(),
        ),
      };
    });
  }

  private async getRegularItem(itemID: number): Promise<Zotero.Item> {
    const item = await Zotero.Items.getAsync(itemID);
    if (!item || !item.isRegularItem()) throw new Error("ITEM_NOT_FOUND");
    return item;
  }

  private async getRegularItems(itemIDs: number[]): Promise<Zotero.Item[]> {
    const uniqueIDs = Array.from(new Set(itemIDs));
    if (!uniqueIDs.length) throw new Error("NO_ITEMS_SELECTED");
    const items = await Zotero.Items.getAsync(uniqueIDs);
    if (
      items.length !== uniqueIDs.length ||
      items.some((item) => !item?.isRegularItem())
    ) {
      throw new Error("ITEM_NOT_FOUND");
    }
    return items;
  }

  private async getEditableRegularItem(itemID: number): Promise<Zotero.Item> {
    const item = await this.getRegularItem(itemID);
    const library = Zotero.Libraries.get(item.libraryID);
    if (!library || !library.editable) {
      throw new Error("LIBRARY_READ_ONLY");
    }
    return item;
  }

  private async getEditableRegularItems(
    itemIDs: number[],
  ): Promise<Zotero.Item[]> {
    const items = await this.getRegularItems(itemIDs);
    const libraryIDs = new Set(items.map((item) => item.libraryID));
    if (libraryIDs.size !== 1) throw new Error("MIXED_LIBRARIES");
    const library = Zotero.Libraries.get(items[0].libraryID);
    if (!library || !library.editable) throw new Error("LIBRARY_READ_ONLY");
    return items;
  }

  private assertEditableLibrary(libraryID: number): void {
    this.assertLibrary(libraryID);
    const library = Zotero.Libraries.get(libraryID);
    if (!library || !library.editable) throw new Error("LIBRARY_READ_ONLY");
  }

  private async getTagUsage(
    libraryID: number,
    tagName: string,
  ): Promise<{ tagID: number; itemIDs: number[] } | null> {
    const tagID = Zotero.Tags.getID(tagName);
    if (tagID === false) return null;
    const itemIDs = await Zotero.Tags.getTagItems(libraryID, tagID);
    return itemIDs.length ? { tagID, itemIDs } : null;
  }

  private validateTagName(tagName: string): string {
    const cleaned = tagName.trim();
    if (!cleaned) throw new Error("EMPTY_TAG");
    if (cleaned.length > Zotero.Tags.MAX_SYNC_LENGTH) {
      throw new Error("TAG_TOO_LONG");
    }
    return cleaned;
  }

  private getField(item: Zotero.Item, field: string): string {
    try {
      return String(item.getField(field as any) || "").trim();
    } catch {
      return "";
    }
  }

  private async queryRows<T>(
    sql: string,
    params: Array<string | number>,
  ): Promise<T[]> {
    const normalizedSQL = sql
      .trim()
      .replace(/^([a-z]+)\s+/i, (_match, command: string) => `${command} `);
    const rows = await Zotero.DB.queryAsync(normalizedSQL, params);
    if (!rows) {
      throw new Error("DATABASE_QUERY_RETURNED_NO_ROWS_ARRAY");
    }
    return rows as T[];
  }

  private async valueQuery(
    sql: string,
    params: Array<string | number>,
  ): Promise<number> {
    const value = await Zotero.DB.valueQueryAsync<number>(sql.trim(), params);
    return value === false ? 0 : Number(value) || 0;
  }

  private assertLibrary(libraryID: number): void {
    if (!Number.isInteger(libraryID) || !Zotero.Libraries.exists(libraryID)) {
      throw new Error("LIBRARY_NOT_FOUND");
    }
  }

  private rememberItems(cacheKey: string, items: ItemSummary[]): void {
    if (this.itemCache.size >= 6) {
      const oldestKey = this.itemCache.keys().next().value;
      if (oldestKey) this.itemCache.delete(oldestKey);
    }
    this.itemCache.set(cacheKey, items);
  }

  private getPref(key: string): unknown {
    return Zotero.Prefs.get(`${PREF_PREFIX}${key}`, true);
  }

  private setPref(key: string, value: string | number | boolean): void {
    Zotero.Prefs.set(`${PREF_PREFIX}${key}`, value, true);
  }
}
