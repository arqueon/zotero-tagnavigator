import { assert } from "chai";
import { config } from "../package.json";
import {
  formatCitekeyForZettlr,
  TagNavigatorService,
} from "../src/modules/tagNavigatorService";

describe("startup", function () {
  it("should have plugin instance defined", function () {
    assert.isNotEmpty(Zotero[config.addonInstance]);
  });

  it("should register a modern GET-only launcher endpoint", function () {
    const Endpoint = Zotero.Server.Endpoints["/tagnavigator/open"] as any;
    const endpoint = new Endpoint();

    assert.strictEqual(endpoint.init.length, 1);
    assert.deepEqual(endpoint.supportedMethods, ["GET"]);
  });

  it("should expose Zotero's native attachment-opening API", function () {
    const pane = Zotero.getMainWindow()?.ZoteroPane as any;
    assert.isFunction(pane?.viewAttachment);
  });

  it("should open the best attachment through ZoteroPane.viewAttachment", async function () {
    const service = new TagNavigatorService();
    const attachmentID = 8675309;
    (service as any).getRegularItem = async () => ({
      getBestAttachment: async () => ({ id: attachmentID }),
    });

    const pane = Zotero.getMainWindow()?.ZoteroPane as any;
    const originalViewAttachment = pane.viewAttachment;
    const calls: unknown[][] = [];
    pane.viewAttachment = (...args: unknown[]) => calls.push(args);

    try {
      assert.isTrue(await service.openBestAttachment(42));
      assert.deepEqual(calls, [[attachmentID, undefined, false]]);
    } finally {
      pane.viewAttachment = originalViewAttachment;
    }
  });

  it("should initialize the navigator service", async function () {
    this.timeout(15000);
    const service = new TagNavigatorService();
    const bootstrap = await service.initialize();

    assert.isNotEmpty(bootstrap.libraries);
    assert.isAtLeast(bootstrap.preferences.selectedLibraryID, 1);
    assert.isArray(bootstrap.citationStyles);
    assert.isBoolean(bootstrap.zettlrCitationFormat.available);
  });

  it("should mirror Zettlr's three citation insertion formats", function () {
    assert.strictEqual(
      formatCitekeyForZettlr("Author2026", "regular"),
      "[@Author2026]",
    );
    assert.strictEqual(
      formatCitekeyForZettlr("Author2026", "in-text"),
      "@Author2026",
    );
    assert.strictEqual(
      formatCitekeyForZettlr("Author2026", "in-text-suffix"),
      "@Author2026 []",
    );
  });

  it("should expose valid tag data through the service", async function () {
    this.timeout(15000);
    const service = new TagNavigatorService();
    const libraryID = Zotero.Libraries.userLibraryID;

    const overview = await service.getTagOverview(libraryID);
    assert.strictEqual(overview.libraryID, libraryID);
    assert.isArray(overview.tags);
    assert.isAtLeast(overview.totalItems, 0);
    assert.isAtLeast(overview.untaggedItems, 0);
  });

  it("should search the whole library without a selected tag", async function () {
    this.timeout(15000);
    const service = new TagNavigatorService();
    const result = await service.searchLibrary(
      Zotero.Libraries.userLibraryID,
      `__tagnavigator_no_match_${Date.now()}__`,
    );

    assert.deepEqual(result.items, []);
    assert.strictEqual(result.total, 0);
    assert.isFalse(result.limited);
  });
});
