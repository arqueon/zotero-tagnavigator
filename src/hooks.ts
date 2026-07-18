import { createZToolkit } from "./utils/ztoolkit";
import { TagNavigator } from "./modules/tagnavigator";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  // Registrar el endpoint HTTP local para Wayland/Niri
  TagNavigator.registerServerEndpoint();

  // Registrar el panel de preferencias en Zotero
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: "Zotero TagNavigator",
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  });

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Crear ztoolkit para esta ventana
  addon.data.ztoolkit = createZToolkit();

  // Registrar el ítem en el menú "Herramientas" (Tools) de Zotero
  ztoolkit.Menu.register("menuTools", {
    tag: "menuitem",
    id: "zotero-tagnavigator-tools-menu",
    label: "Zotero TagNavigator",
    commandListener: () => {
      TagNavigator.openWindow();
    },
  });
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  // Desregistrar el endpoint local y cerrar ventanas flotantes
  TagNavigator.unregisterServerEndpoint();

  ztoolkit.unregisterAll();

  // Limpiar referencia de addon
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

// Controladores vacíos para cumplir la firma requerida por Zotero
async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {}
async function onPrefsEvent(type: string, data: { [key: string]: any }) {}
function onShortcuts(type: string) {}
function onDialogEvents(type: string) {}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents,
};
