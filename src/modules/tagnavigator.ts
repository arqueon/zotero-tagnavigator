import { config } from "../../package.json";
import { TagNavigatorService } from "./tagNavigatorService";
import type {
  CopyKind,
  ItemScope,
  NavigatorPreferences,
  TagNavigatorAPI,
} from "../types/tagNavigator";

export class TagNavigatorManager {
  private openedWindow: Window | null = null;
  private notifierID: string | null = null;
  private readonly service = new TagNavigatorService();

  private readonly api: TagNavigatorAPI = {
    initialize: () => this.service.initialize(),
    getTagOverview: (libraryID: number) =>
      this.service.getTagOverview(libraryID),
    getItems: (libraryID: number, scope: ItemScope) =>
      this.service.getItems(libraryID, scope),
    searchLibrary: (libraryID: number, query: string) =>
      this.service.searchLibrary(libraryID, query),
    getItemDetails: (itemID: number) => this.service.getItemDetails(itemID),
    addTag: (itemID: number, tagName: string) =>
      this.service.addTag(itemID, tagName),
    removeTag: (itemID: number, tagName: string) =>
      this.service.removeTag(itemID, tagName),
    renameTag: (libraryID: number, sourceName: string, targetName: string) =>
      this.service.renameTag(libraryID, sourceName, targetName),
    mergeTags: (libraryID: number, sourceName: string, targetName: string) =>
      this.service.mergeTags(libraryID, sourceName, targetName),
    deleteTag: (libraryID: number, tagName: string) =>
      this.service.deleteTag(libraryID, tagName),
    copyMetadata: (
      itemID: number,
      kind: CopyKind,
      styleID?: string,
      useZettlrFormat?: boolean,
    ) => this.service.copyMetadata(itemID, kind, styleID, useZettlrFormat),
    selectInMainWindow: (itemID: number) =>
      this.service.selectInMainWindow(itemID),
    openBestAttachment: (itemID: number) =>
      this.service.openBestAttachment(itemID),
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
        ["item", "item-tag", "tag", "group"],
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
    if (this.openedWindow && !this.openedWindow.closed) {
      this.openedWindow.close();
    }
    this.openedWindow = null;
    this.service.invalidate();
  }

  /** Opens the floating navigator, or focuses the existing instance. */
  openWindow(): void {
    try {
      if (this.openedWindow && !this.openedWindow.closed) {
        this.openedWindow.focus();
        return;
      }

      const windowWatcher = (Components.classes as any)[
        "@mozilla.org/embedcomp/window-watcher;1"
      ].getService(Components.interfaces.nsIWindowWatcher);
      const parentWindow = Zotero.getMainWindow() || null;

      this.openedWindow = windowWatcher.openWindow(
        parentWindow,
        `chrome://${config.addonRef}/content/tagnavigator.html`,
        "tagnavigator-window",
        "chrome,dialog=no,titlebar,close,resizable,centerscreen,width=1280,height=800",
        // nsIWindowWatcher only transports arbitrary JavaScript values when
        // they are explicitly exposed through wrappedJSObject.
        { wrappedJSObject: { api: this.api } },
      );

      this.openedWindow?.addEventListener(
        "unload",
        () => {
          this.openedWindow = null;
        },
        { once: true },
      );
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
