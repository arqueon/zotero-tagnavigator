export type LibraryKind = "user" | "group";

export interface LibraryOption {
  id: number;
  name: string;
  type: LibraryKind;
  editable: boolean;
}

export type TagKind = "manual" | "automatic" | "mixed";

export interface ColoredTagSlot {
  name: string;
  color: string;
  position: number;
}

export interface TagSummary {
  name: string;
  kind: TagKind;
  count: number;
  manualCount: number;
  automaticCount: number;
  color?: string;
  colorPosition?: number;
}

export interface TagOverview {
  libraryID: number;
  totalItems: number;
  untaggedItems: number;
  tags: TagSummary[];
  coloredTags: ColoredTagSlot[];
}

export type ItemScope = { kind: "tag"; tagName: string } | { kind: "untagged" };

export type SavedFilterScope = ItemScope | { kind: "library" };

export type QuickSearchMode = "titleCreatorYear" | "fields" | "everything";

export type SearchJoinMode = "all" | "any";

export interface AdvancedSearchCondition {
  condition: string;
  operator: string;
  value: string;
}

export interface SearchConditionDefinition {
  name: string;
  label: string;
  operators: string[];
}

export interface ItemTypeOption {
  name: string;
  label: string;
}

export interface CollectionOption {
  id: number;
  key: string;
  name: string;
  parentID: number | null;
  depth: number;
  path: string;
}

export interface SavedSearchOption {
  id: number;
  key: string;
  name: string;
}

export interface SavedFilterPreset {
  id: string;
  name: string;
  scope: SavedFilterScope;
  query: string;
  author: string;
  secondTag: string;
  yearMin: string;
  yearMax: string;
  dateAddedFrom: string;
  dateAddedTo: string;
  dateModifiedFrom: string;
  dateModifiedTo: string;
  hasPDF: boolean;
  hasNotes: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  collectionID?: number | null;
  unfiledOnly?: boolean;
  includeSubcollections?: boolean;
  quickSearchMode?: QuickSearchMode;
  joinMode?: SearchJoinMode;
  advancedConditions?: AdvancedSearchCondition[];
}

export type SavedFiltersByLibrary = Record<string, SavedFilterPreset[]>;

export interface ItemTag {
  name: string;
  type: 0 | 1;
  color?: string;
  colorPosition?: number;
}

export type ItemColumnKey =
  | "title"
  | "creator"
  | "year"
  | "publication"
  | "itemType"
  | "citekey"
  | "dateAdded"
  | "dateModified";

export type ItemColumnWidths = Record<ItemColumnKey, number>;

export interface ItemSummary {
  id: number;
  libraryID: number;
  title: string;
  abstract: string;
  publicationTitle: string;
  date: string;
  year: number | null;
  dateAdded: string;
  dateModified: string;
  itemType: string;
  itemTypeLabel: string;
  iconURI: string;
  firstCreator: string;
  creators: string[];
  creatorSearch: string;
  citekey: string;
  tags: ItemTag[];
  attachmentCount: number;
  noteCount: number;
  hasPDF: boolean;
}

export interface LibrarySearchResult {
  items: ItemSummary[];
  total: number;
  limited: boolean;
}

export interface UnifiedItemQuery {
  includeTags?: string[];
  excludeTags?: string[];
  untaggedOnly?: boolean;
  collectionID?: number | null;
  unfiledOnly?: boolean;
  includeSubcollections?: boolean;
  savedSearchID?: number | null;
  quickSearchQuery?: string;
  quickSearchMode?: QuickSearchMode;
  joinMode?: SearchJoinMode;
  advancedConditions?: AdvancedSearchCondition[];
  offset?: number;
  limit?: number;
}

export interface UnifiedQueryResult {
  items: ItemSummary[];
  total: number;
  offset: number;
  hasMore: boolean;
  facetTagCounts: Record<string, number>;
}

export interface ItemAttachmentSummary {
  id: number;
  title: string;
  contentType: string;
  isPDF: boolean;
}

export interface ItemNoteSummary {
  id: number;
  snippet: string;
}

export interface ItemCollectionSummary {
  id: number;
  path: string;
}

export interface ItemDetails extends ItemSummary {
  doi: string;
  url: string;
  collections: ItemCollectionSummary[];
  attachments: ItemAttachmentSummary[];
  notesPreview: ItemNoteSummary[];
}

export interface CitationStyleOption {
  id: string;
  title: string;
}

export type ZettlrCitationStyle = "regular" | "in-text" | "in-text-suffix";

export interface ZettlrCitationFormat {
  available: boolean;
  citeStyle: ZettlrCitationStyle;
  preview: string;
}

export type DoubleClickAction = "openAttachment" | "selectInZotero" | "none";

export type InterfaceDensity = "comfortable" | "compact";

export interface NavigatorPreferences {
  hideAutomaticTags: boolean;
  selectedLibraryID: number;
  inspectorOpen: boolean;
  tagPaneOpen: boolean;
  leftPaneWidth: number;
  rightPaneWidth: number;
  density: InterfaceDensity;
  doubleClickAction: DoubleClickAction;
  pageSize: number;
  zettlrCitationFormat: boolean;
  itemColumnWidths: Partial<ItemColumnWidths>;
  visibleColumns: ItemColumnKey[];
  savedFilters: SavedFiltersByLibrary;
}

export interface NavigatorBootstrap {
  locale: string;
  appVersion: string;
  pluginVersion: string;
  libraries: LibraryOption[];
  citationStyles: CitationStyleOption[];
  defaultCitationStyleID: string;
  zettlrCitationFormat: ZettlrCitationFormat;
  searchConditions: SearchConditionDefinition[];
  itemTypes: ItemTypeOption[];
  preferences: NavigatorPreferences;
}

export type CopyKind = "citekey" | "citation" | "bibliography";

export interface CopyMetadataResult {
  requestedItems: number;
  copiedItems: number;
  missingCitekeys: number;
}

export interface BatchTagMutationResult {
  action: "add" | "remove";
  tagName: string;
  selectedItems: number;
  affectedItems: number;
}

export interface TagMutationResult {
  action:
    "rename" | "merge" | "delete" | "convertToManual" | "removeAllAutomatic";
  sourceName: string;
  targetName?: string;
  affectedItems: number;
}

export interface TagNavigatorAPI {
  initialize(): Promise<NavigatorBootstrap>;
  getTagOverview(libraryID: number): Promise<TagOverview>;
  getCollections(libraryID: number): Promise<CollectionOption[]>;
  getSavedSearches(libraryID: number): Promise<SavedSearchOption[]>;
  queryItems(
    libraryID: number,
    query: UnifiedItemQuery,
  ): Promise<UnifiedQueryResult>;
  saveZoteroSearch(
    libraryID: number,
    name: string,
    query: UnifiedItemQuery,
  ): Promise<SavedSearchOption>;
  getItems(libraryID: number, scope: ItemScope): Promise<ItemSummary[]>;
  getRecentItems(libraryID: number): Promise<LibrarySearchResult>;
  searchLibrary(libraryID: number, query: string): Promise<LibrarySearchResult>;
  getItemDetails(itemID: number): Promise<ItemDetails>;
  addTag(itemID: number, tagName: string): Promise<ItemDetails>;
  removeTag(itemID: number, tagName: string): Promise<ItemDetails>;
  addTags(itemIDs: number[], tagName: string): Promise<BatchTagMutationResult>;
  removeTags(
    itemIDs: number[],
    tagName: string,
  ): Promise<BatchTagMutationResult>;
  setTagColor(
    libraryID: number,
    tagName: string,
    color: string | null,
    position?: number,
  ): Promise<void>;
  toggleColoredTagByPosition(
    libraryID: number,
    itemIDs: number[],
    position: number,
  ): Promise<BatchTagMutationResult | null>;
  convertAutomaticTagToManual(
    libraryID: number,
    tagName: string,
  ): Promise<TagMutationResult>;
  removeAutomaticTags(libraryID: number): Promise<TagMutationResult>;
  renameTag(
    libraryID: number,
    sourceName: string,
    targetName: string,
  ): Promise<TagMutationResult>;
  mergeTags(
    libraryID: number,
    sourceName: string,
    targetName: string,
  ): Promise<TagMutationResult>;
  deleteTag(libraryID: number, tagName: string): Promise<TagMutationResult>;
  copyMetadata(
    itemIDs: number[],
    kind: CopyKind,
    styleID?: string,
    useZettlrFormat?: boolean,
  ): Promise<CopyMetadataResult>;
  selectInMainWindow(itemID: number): Promise<void>;
  openBestAttachment(itemID: number): Promise<boolean>;
  openAttachmentByID(attachmentID: number): Promise<boolean>;
  savePreferences(preferences: Partial<NavigatorPreferences>): void;
  invalidate(): void;
}
