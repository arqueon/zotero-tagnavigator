export type LibraryKind = "user" | "group";

export interface LibraryOption {
  id: number;
  name: string;
  type: LibraryKind;
  editable: boolean;
}

export type TagKind = "manual" | "automatic" | "mixed";

export interface TagSummary {
  name: string;
  kind: TagKind;
  count: number;
  manualCount: number;
  automaticCount: number;
}

export interface TagOverview {
  libraryID: number;
  totalItems: number;
  untaggedItems: number;
  tags: TagSummary[];
}

export type ItemScope = { kind: "tag"; tagName: string } | { kind: "untagged" };

export interface ItemTag {
  name: string;
  type: 0 | 1;
}

export interface ItemSummary {
  id: number;
  libraryID: number;
  title: string;
  abstract: string;
  date: string;
  year: number | null;
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

export interface ItemDetails extends ItemSummary {
  publicationTitle: string;
  doi: string;
  url: string;
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

export interface NavigatorPreferences {
  hideAutomaticTags: boolean;
  selectedLibraryID: number;
  inspectorOpen: boolean;
  zettlrCitationFormat: boolean;
}

export interface NavigatorBootstrap {
  locale: string;
  appVersion: string;
  pluginVersion: string;
  libraries: LibraryOption[];
  citationStyles: CitationStyleOption[];
  defaultCitationStyleID: string;
  zettlrCitationFormat: ZettlrCitationFormat;
  preferences: NavigatorPreferences;
}

export type CopyKind = "citekey" | "citation" | "bibliography";

export interface TagMutationResult {
  action: "rename" | "merge" | "delete";
  sourceName: string;
  targetName?: string;
  affectedItems: number;
}

export interface TagNavigatorAPI {
  initialize(): Promise<NavigatorBootstrap>;
  getTagOverview(libraryID: number): Promise<TagOverview>;
  getItems(libraryID: number, scope: ItemScope): Promise<ItemSummary[]>;
  searchLibrary(libraryID: number, query: string): Promise<LibrarySearchResult>;
  getItemDetails(itemID: number): Promise<ItemDetails>;
  addTag(itemID: number, tagName: string): Promise<ItemDetails>;
  removeTag(itemID: number, tagName: string): Promise<ItemDetails>;
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
    itemID: number,
    kind: CopyKind,
    styleID?: string,
    useZettlrFormat?: boolean,
  ): Promise<void>;
  selectInMainWindow(itemID: number): Promise<void>;
  openBestAttachment(itemID: number): Promise<boolean>;
  savePreferences(preferences: Partial<NavigatorPreferences>): void;
  invalidate(): void;
}
