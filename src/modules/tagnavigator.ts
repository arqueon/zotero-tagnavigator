import { config } from "../../package.json";
import { TagNavigatorService } from "./tagNavigatorService";
import type {
  CopyKind,
  ItemScope,
  NavigatorPreferences,
  TagNavigatorAPI,
  UnifiedItemQuery,
} from "../types/tagNavigator";

export class TagNavigatorManager {
  private openedWindow: Window | null = null;
  private notifierID: string | null = null;
  private readonly service = new TagNavigatorService();

  private readonly api: TagNavigatorAPI = {
    initialize: () => this.service.initialize(),
    getTagOverview: (libraryID: number) =>
      this.service.getTagOverview(libraryID),
    getCollections: (libraryID: number) =>
      this.service.getCollections(libraryID),
    getSavedSearches: (libraryID: number) =>
      this.service.getSavedSearches(libraryID),
    queryItems: (libraryID: number, query: UnifiedItemQuery) =>
      this.service.queryItems(libraryID, query),
    saveZoteroSearch: (
      libraryID: number,
      name: string,
      query: UnifiedItemQuery,
    ) => this.service.saveZoteroSearch(libraryID, name, query),
    getItems: (libraryID: number, scope: ItemScope) =>
      this.service.getItems(libraryID, scope),
    getRecentItems: (libraryID: number) =>
      this.service.getRecentItems(libraryID),
    searchLibrary: (libraryID: number, query: string) =>
      this.service.searchLibrary(libraryID, query),
    getItemDetails: (itemID: number) => this.service.getItemDetails(itemID),
    addTag: (itemID: number, tagName: string) =>
      this.service.addTag(itemID, tagName),
    removeTag: (itemID: number, tagName: string) =>
      this.service.removeTag(itemID, tagName),
    addTags: (itemIDs: number[], tagName: string) =>
      this.service.addTags(itemIDs, tagName),
    removeTags: (itemIDs: number[], tagName: string) =>
      this.service.removeTags(itemIDs, tagName),
    setTagColor: (
      libraryID: number,
      tagName: string,
      color: string | null,
      position?: number,
    ) => this.service.setTagColor(libraryID, tagName, color, position),
    toggleColoredTagByPosition: (
      libraryID: number,
      itemIDs: number[],
      position: number,
    ) => this.service.toggleColoredTagByPosition(libraryID, itemIDs, position),
    convertAutomaticTagToManual: (libraryID: number, tagName: string) =>
      this.service.convertAutomaticTagToManual(libraryID, tagName),
    removeAutomaticTags: (libraryID: number) =>
      this.service.removeAutomaticTags(libraryID),
    renameTag: (libraryID: number, sourceName: string, targetName: string) =>
      this.service.renameTag(libraryID, sourceName, targetName),
    mergeTags: (libraryID: number, sourceName: string, targetName: string) =>
      this.service.mergeTags(libraryID, sourceName, targetName),
    deleteTag: (libraryID: number, tagName: string) =>
      this.service.deleteTag(libraryID, tagName),
    copyMetadata: (
      itemIDs: number[],
      kind: CopyKind,
      styleID?: string,
      useZettlrFormat?: boolean,
    ) => this.service.copyMetadata(itemIDs, kind, styleID, useZettlrFormat),
    selectInMainWindow: (itemID: number) =>
      this.service.selectInMainWindow(itemID),
    openBestAttachment: (itemID: number) =>
      this.service.openBestAttachment(itemID),
    openAttachmentByID: (attachmentID: number) =>
      this.service.openAttachmentByID(attachmentID),
    savePreferences: (preferences: Partial<NavigatorPreferences>) =>
      this.service.savePreferences(preferences),
    invalidate: () => this.service.invalidate(),
  };

  start(): void {
    this.registerServerEndpoint();
    if (!this.notifierID) {
      this.notifierID = Zotero.Notifier.registerObserver(
        {
          notify: async (_event, _type, _ids, _extraData) => {
            this.service.invalidate();
            this.dispatchDataChanged();
          },
        },
        [
          "item",
          "item-tag",
          "tag",
          "group",
          "collection",
          "collection-item",
          "search",
          "setting",
        ],
        config.addonID,
      );
    }
  }

  stop(): void {
    this.unregisterServerEndpoint();
    if (this.notifierID) {
      Zotero.Notifier.unregisterObserver(this.notifierID);
      this.notifierID = null;
    }
    this.closeWindow();
    this.service.invalidate();
  }

  closeWindow(): void {
    if (this.openedWindow && !this.openedWindow.closed) {
      this.openedWindow.close();
    }
    this.openedWindow = null;
  }

  /** Opens the floating navigator, or focuses the existing instance. */
  openWindow(): void {
    try {
      if (!this.notifierID) {
        this.start();
      }
      if (this.openedWindow && !this.openedWindow.closed) {
        this.openedWindow.focus();
        return;
      }

      const windowWatcher = (Components.classes as any)[
        "@mozilla.org/embedcomp/window-watcher;1"
      ].getService(Components.interfaces.nsIWindowWatcher);
      const parentWindow = Zotero.getMainWindow() || null;
      const targetURL = `chrome://${config.addonRef}/content/tagnavigator.html`;

      const win = windowWatcher.openWindow(
        parentWindow,
        targetURL,
        null,
        "chrome,dialog=no,titlebar,close,resizable,centerscreen,width=1340,height=840",
        // nsIWindowWatcher only transports arbitrary JavaScript values when
        // they are explicitly exposed through wrappedJSObject.
        { wrappedJSObject: { api: this.api } },
      ) as Window | null;
      this.openedWindow = win;

      win?.addEventListener("unload", (event: Event) => {
        const doc = event.target as Document | null;
        if (doc?.location?.href === "about:blank") return;
        if (this.openedWindow === win) {
          this.openedWindow = null;
        }
      });
    } catch (error) {
      Zotero.logError(error as Error);
    }
  }

  /** Registers the localhost endpoint used by the Niri shortcut. */
  private registerServerEndpoint(): void {
    try {
      if (!Zotero.Server) return;

      Zotero.Server.Endpoints["/tagnavigator/open"] = class {
        supportedMethods = ["GET"];

        init(_request: unknown) {
          TagNavigator.openWindow();
          return [200, "text/plain", "OK"];
        }
      };
    } catch (error) {
      Zotero.logError(error as Error);
    }
  }

  private unregisterServerEndpoint(): void {
    try {
      if (Zotero.Server?.Endpoints["/tagnavigator/open"]) {
        delete Zotero.Server.Endpoints["/tagnavigator/open"];
      }
    } catch (error) {
      Zotero.logError(error as Error);
    }
  }

  private dispatchDataChanged(): void {
    const targetWindow = this.openedWindow as any;
    if (!targetWindow || targetWindow.closed || !targetWindow.CustomEvent)
      return;
    targetWindow.dispatchEvent(
      new targetWindow.CustomEvent("tagnavigator-data-changed"),
    );
  }
}

export const TagNavigator = new TagNavigatorManager();
