import { createZToolkit } from "./utils/ztoolkit";
import { TagNavigator } from "./modules/tagnavigator";

const TOOLS_MENU_ID = "zotero-tagnavigator-tools-menu";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  // Initialize the local endpoint, caches, and Zotero change observers.
  TagNavigator.start();

  // Register the preferences pane in Zotero.
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: `chrome://${addon.data.config.addonRef}/content/preferences.xhtml`,
    label: "Zotero TagNavigator",
    image: `chrome://${addon.data.config.addonRef}/content/icons/tag-navigator-96.png`,
  });

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for this window.
  addon.data.ztoolkit = createZToolkit();

  // Keep a DOM fallback so the command remains available in Zotero 7 as well
  // as newer versions that expose Zotero.MenuManager.
  const doc = win.document;
  doc.getElementById(TOOLS_MENU_ID)?.remove();

  const toolsMenu = doc.getElementById("menu_ToolsPopup");
  if (!toolsMenu) {
    ztoolkit.log("Could not find Zotero's Tools menu");
    return;
  }

  const menuItem = doc.createXULElement("menuitem");
  menuItem.id = TOOLS_MENU_ID;
  menuItem.setAttribute("label", "Zotero TagNavigator");
  menuItem.addEventListener("command", () => TagNavigator.openWindow());
  toolsMenu.appendChild(menuItem);
}

async function onMainWindowUnload(win: Window): Promise<void> {
  win.document.getElementById(TOOLS_MENU_ID)?.remove();
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  // Unregister services and close the floating window.
  TagNavigator.stop();

  for (const win of Zotero.getMainWindows()) {
    win.document.getElementById(TOOLS_MENU_ID)?.remove();
  }

  ztoolkit.unregisterAll();

  // Clear the add-on reference.
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

// Empty handlers required by the Zotero plug-in lifecycle contract.
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
