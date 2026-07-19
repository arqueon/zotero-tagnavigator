import { config, version as pluginVersion } from "../../package.json";
import type {
  CitationStyleOption,
  CopyKind,
  ItemDetails,
  ItemScope,
  ItemSummary,
  LibrarySearchResult,
  LibraryOption,
  NavigatorBootstrap,
  NavigatorPreferences,
  TagNavigatorAPI,
  TagMutationResult,
  TagOverview,
  TagSummary,
  ZettlrCitationFormat,
  ZettlrCitationStyle,
} from "../types/tagNavigator";

type TagAggregateRow = {
  name: string;
  count: number;
  manualCount: number;
  automaticCount: number;
};

const PREF_PREFIX = `extensions.zotero.${config.addonRef}.`;
const LIBRARY_SEARCH_LIMIT = 500;

function normalizeZettlrCitationStyle(value: unknown): ZettlrCitationStyle {
  return value === "in-text" || value === "in-text-suffix" ? value : "regular";
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

/**
 * The only layer that knows about Zotero internals and its SQLite schema.
 * The popup receives a small, stable API made of plain objects.
 */
export class TagNavigatorService implements TagNavigatorAPI {
  private overviewCache = new Map<number, TagOverview>();
  private itemCache = new Map<string, ItemSummary[]>();

  async initialize(): Promise<NavigatorBootstrap> {
    // A plugin window can open before Zotero's asynchronous CSL bootstrap has
    // finished. Styles.getVisible() throws in that state, so join the same
    // idempotent initialization promise before exposing citation actions.
    await Zotero.Styles.init();

    const libraries = this.getLibraries();
    const citationStyles = this.getCitationStyles();
    const preferences = this.getPreferences(libraries);
    const zettlrCitationFormat = await this.getZettlrCitationFormat();

    return {
      locale: Zotero.locale || "en-US",
      appVersion: Zotero.version,
      pluginVersion,
      libraries,
      citationStyles,
      defaultCitationStyleID: this.getDefaultCitationStyleID(citationStyles),
      zettlrCitationFormat,
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

    const tags: TagSummary[] = rows.map((row) => {
      const manualCount = Number(row.manualCount) || 0;
      const automaticCount = Number(row.automaticCount) || 0;
      return {
        name: String(row.name),
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

    const overview = { libraryID, totalItems, untaggedItems, tags };
    this.overviewCache.set(libraryID, overview);
    return overview;
  }

  async getItems(libraryID: number, scope: ItemScope): Promise<ItemSummary[]> {
    this.assertLibrary(libraryID);
    const cacheKey = `${libraryID}:${
      scope.kind === "tag" ? `tag:${scope.tagName}` : "untagged"
    }`;
    const cached = this.itemCache.get(cacheKey);
    if (cached) return cached;

    const params: Array<string | number> = [libraryID];
    let scopeJoin = "";
    let scopeWhere: string;

    if (scope.kind === "tag") {
      scopeJoin = `
        JOIN itemTags FILTER_IT ON FILTER_IT.itemID = I.itemID
        JOIN tags FILTER_T ON FILTER_T.tagID = FILTER_IT.tagID
      `;
      scopeWhere = "AND FILTER_T.name = ?";
      params.push(scope.tagName);
    } else {
      scopeWhere = `
        AND NOT EXISTS (
          SELECT 1 FROM itemTags UNT WHERE UNT.itemID = I.itemID
        )
      `;
    }

    const itemIDs = await Zotero.DB.columnQueryAsync<number>(
      `
        SELECT DISTINCT I.itemID
        FROM items I
        JOIN itemTypes ITEMTYPE USING (itemTypeID)
        LEFT JOIN deletedItems D USING (itemID)
        ${scopeJoin}
        WHERE I.libraryID = ?
          AND D.itemID IS NULL
          AND ITEMTYPE.typeName NOT IN ('attachment', 'note', 'annotation')
          ${scopeWhere}
        ORDER BY I.dateModified DESC
      `.trim(),
      params,
    );

    const items = itemIDs.length
      ? await Zotero.Items.getAsync(itemIDs)
      : ([] as Zotero.Item[]);
    const regularItems = items.filter((item) => item?.isRegularItem());
    const summaries = await this.buildItemSummaries(regularItems);

    this.rememberItems(cacheKey, summaries);
    return summaries;
  }

  /**
   * Searches the active library through Zotero's own metadata search engine.
   * An empty query intentionally returns no rows so opening the window never
   * materializes a large library in memory.
   */
  async searchLibrary(
    libraryID: number,
    query: string,
  ): Promise<LibrarySearchResult> {
    this.assertLibrary(libraryID);
    const cleaned = query.trim();
    if (!cleaned) return { items: [], total: 0, limited: false };

    const search = new Zotero.Search({ libraryID });
    search.addCondition("quicksearch-fields", "contains", cleaned);
    search.addCondition("noChildren", "true");
    search.addCondition("itemType", "isNot", "attachment");
    search.addCondition("itemType", "isNot", "note");
    search.addCondition("itemType", "isNot", "annotation");
    search.addCondition("deleted", "false");

    const itemIDs = await search.search();
    const visibleIDs = itemIDs.slice(0, LIBRARY_SEARCH_LIMIT);
    const items = visibleIDs.length
      ? await Zotero.Items.getAsync(visibleIDs)
      : ([] as Zotero.Item[]);
    const summaries = await this.buildItemSummaries(
      items.filter((item) => item?.isRegularItem()),
    );

    return {
      items: summaries,
      total: itemIDs.length,
      limited: itemIDs.length > summaries.length,
    };
  }

  async getItemDetails(itemID: number): Promise<ItemDetails> {
    const item = await this.getRegularItem(itemID);
    const [summary] = await this.buildItemSummaries([item]);

    return {
      ...summary,
      publicationTitle: this.getField(item, "publicationTitle"),
      doi: this.getField(item, "DOI"),
      url: this.getField(item, "url"),
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

    // Zotero's native implementation uses UPDATE OR REPLACE, so items that
    // already have the target tag are deduplicated inside Zotero's transaction.
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
    itemID: number,
    kind: CopyKind,
    styleID?: string,
    useZettlrFormat = false,
  ): Promise<void> {
    const item = await this.getRegularItem(itemID);

    if (kind === "citekey") {
      const citekey = this.getField(item, "citationKey");
      if (!citekey) throw new Error("NO_CITEKEY");
      if (useZettlrFormat) {
        const zettlrFormat = await this.getZettlrCitationFormat();
        if (!zettlrFormat.available) {
          throw new Error("ZETTLR_CONFIG_UNAVAILABLE");
        }
        Zotero.Utilities.Internal.copyTextToClipboard(
          formatCitekeyForZettlr(citekey, zettlrFormat.citeStyle),
        );
      } else {
        Zotero.Utilities.Internal.copyTextToClipboard(citekey);
      }
      return;
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
      [item],
      styleID,
      locale,
      false,
      kind === "citation",
    );
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
    if (typeof preferences.zettlrCitationFormat === "boolean") {
      this.setPref("zettlrCitationFormat", preferences.zettlrCitationFormat);
    }
  }

  invalidate(): void {
    this.overviewCache.clear();
    this.itemCache.clear();
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
      zettlrCitationFormat: this.getPref("zettlrCitationFormat") === true,
    };
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

      return {
        id: item.id,
        libraryID: item.libraryID,
        title: this.getField(item, "title"),
        abstract: this.getField(item, "abstractNote"),
        date,
        year: yearMatch ? Number(yearMatch[1]) : null,
        itemType: String(item.itemType),
        itemTypeLabel: Zotero.ItemTypes.getLocalizedString(item.itemTypeID),
        iconURI: String(item.getImageSrc()),
        firstCreator: creators[0] || "",
        creators,
        creatorSearch: creators.join(" ").toLocaleLowerCase(Zotero.locale),
        citekey: this.getField(item, "citationKey"),
        tags: item.getTags().map((tag) => ({
          name: tag.tag,
          type: tag.type === 1 ? 1 : 0,
        })),
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

  private async getEditableRegularItem(itemID: number): Promise<Zotero.Item> {
    const item = await this.getRegularItem(itemID);
    const library = Zotero.Libraries.get(item.libraryID);
    if (!library || !library.editable) {
      throw new Error("LIBRARY_READ_ONLY");
    }
    return item;
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
    // Zotero 9 detects SELECT with a parser that only treats an ASCII space as
    // the command delimiter. Leading whitespace or `SELECT\n...` executes in
    // SQLite but makes queryAsync return undefined, so normalize the header.
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

  private getPref(name: string): boolean | string | number | undefined {
    return Zotero.Prefs.get(`${PREF_PREFIX}${name}`, true);
  }

  private setPref(name: string, value: boolean | string | number): void {
    Zotero.Prefs.set(`${PREF_PREFIX}${name}`, value, true);
  }
}
