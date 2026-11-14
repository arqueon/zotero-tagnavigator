import { BasicTool, unregister } from "zotero-plugin-toolkit";
import { config } from "../../package.json";

export { createZToolkit };

class TagNavigatorToolkit extends BasicTool {
  unregisterAll() {
    unregister(this);
  }
}

function createZToolkit() {
  const _ztoolkit = new TagNavigatorToolkit();
  initZToolkit(_ztoolkit);
  return _ztoolkit;
}

function initZToolkit(_ztoolkit: TagNavigatorToolkit) {
  const env = __env__;
  _ztoolkit.basicOptions.log.prefix = `[${config.addonName}]`;
  _ztoolkit.basicOptions.log.disableConsole = env === "production";
  _ztoolkit.basicOptions.api.pluginID = config.addonID;
}
