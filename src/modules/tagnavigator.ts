import { config } from "../../package.json";

export class TagNavigatorManager {
  private openedWindow: Window | null = null;

  /**
   * Abre la ventana flotante de TagNavigator. Si ya está abierta, la enfoca.
   */
  public openWindow() {
    try {
      Zotero.debug("[TagNavigator] Abriendo ventana...");

      if (this.openedWindow && !this.openedWindow.closed) {
        Zotero.debug("[TagNavigator] Ventana ya abierta. Enfocando...");
        this.openedWindow.focus();
        return;
      }

      // Obtener el WindowWatcher de Firefox/XPCOM
      const ww = (Components.classes as any)[
        "@mozilla.org/embedcomp/window-watcher;1"
      ].getService(Components.interfaces.nsIWindowWatcher);

      const parentWin = Zotero.getMainWindow() || null;

      // Abrir la ventana HTML pasándole la ventana principal como padre
      this.openedWindow = ww.openWindow(
        parentWin,
        `chrome://${config.addonRef}/content/tagnavigator.html`,
        "tagnavigator-window",
        "chrome,dialog=no,titlebar,close,resizable,centerscreen,width=1150,height=700",
        { Zotero, addon: (globalThis as any).addon },
      );

      Zotero.debug("[TagNavigator] Ventana instanciada con éxito.");
    } catch (error) {
      Zotero.logError(error as any);
    }
  }

  /**
   * Registra el endpoint HTTP local en Zotero (/tagnavigator/open).
   * Permite abrir la ventana haciendo una petición HTTP a http://127.0.0.1:23119/tagnavigator/open.
   */
  public registerServerEndpoint() {
    try {
      Zotero.debug("[TagNavigator] Registrando endpoint de servidor local...");

      if (!Zotero.Server) {
        Zotero.debug("[TagNavigator] Zotero.Server no inicializado aún.");
        return;
      }

      Zotero.Server.Endpoints["/tagnavigator/open"] = class {
        init(options: any) {
          Zotero.debug(
            "[TagNavigator] Petición HTTP recibida en /tagnavigator/open",
          );

          // Abre/enfoca la ventana
          TagNavigator.openWindow();

          // Retorna respuesta OK
          return [200, "text/plain", "OK"];
        }
      };

      Zotero.debug(
        "[TagNavigator] Endpoint registrado exitosamente en Zotero.Server",
      );
    } catch (error) {
      Zotero.logError(error as any);
    }
  }

  /**
   * Desregistra el endpoint al apagar el plugin.
   */
  public unregisterServerEndpoint() {
    try {
      Zotero.debug("[TagNavigator] Desregistrando endpoint...");
      if (Zotero.Server && Zotero.Server.Endpoints["/tagnavigator/open"]) {
        delete Zotero.Server.Endpoints["/tagnavigator/open"];
      }
      if (this.openedWindow && !this.openedWindow.closed) {
        this.openedWindow.close();
      }
    } catch (error) {
      Zotero.logError(error as any);
    }
  }
}

export const TagNavigator = new TagNavigatorManager();
