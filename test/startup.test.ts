import { assert } from "chai";
import { config } from "../package.json";
import {
  formatCitekeyForZettlr,
  TagNavigatorService,
} from "../src/modules/tagNavigatorService";
import type { ItemSummary } from "../src/types/tagNavigator";
import {
  completeItemColumnWidths,
  sanitizeItemColumnWidths,
} from "../src/utils/itemColumns";
import { formatItemTimestamp } from "../src/utils/itemDate";
import { compareItemSummaries } from "../src/utils/itemSort";

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
    assert.isObject(bootstrap.preferences.itemColumnWidths);
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

  it("should sort item results by date added and date modified", function () {
    const older = {
      title: "Older item",
      dateAdded: "2024-01-15 10:00:00",
      dateModified: "2026-04-20 08:30:00",
    } as ItemSummary;
    const newer = {
      title: "Newer item",
      dateAdded: "2025-07-01 14:00:00",
      dateModified: "2025-08-09 09:45:00",
    } as ItemSummary;

    assert.deepEqual(
      [newer, older].sort((left, right) =>
        compareItemSummaries(left, right, "dateAdded", "ascending", "en"),
      ),
      [older, newer],
    );
    assert.deepEqual(
      [newer, older].sort((left, right) =>
        compareItemSummaries(left, right, "dateModified", "descending", "en"),
      ),
      [older, newer],
    );
  });

  it("should format Zotero timestamps as compact dates", function () {
    const formatted = formatItemTimestamp("2024-02-03 18:05:06.123", "es-MX");

    assert.match(formatted.display, /^\d{2}\/\d{2}\/\d{2}$/);
    assert.notInclude(formatted.display, ":");
    assert.include(formatted.tooltip, "2024");
    assert.include(formatted.tooltip, ":");
  });

  it("should clamp and complete saved item column widths", function () {
    assert.deepEqual(
      sanitizeItemColumnWidths({
        title: 20,
        dateAdded: 999,
        creator: "wide",
      }),
      { title: 120, dateAdded: 280 },
    );
    assert.deepInclude(completeItemColumnWidths({ year: 75 }), {
      title: 300,
      creator: 110,
      year: 75,
      dateAdded: 80,
      dateModified: 80,
    });
  });

  it("should expose Zotero's stored date added and date modified", async function () {
    this.timeout(15000);
    const dateAdded = "2024-02-03 04:05:06";
    const dateModified = "2025-06-07 08:09:10";
    const item = new Zotero.Item("book");
    item.libraryID = Zotero.Libraries.userLibraryID;
    item.setField("title", "TagNavigator date integration test");
    item.dateAdded = dateAdded;
    item.dateModified = dateModified;
    await item.saveTx({ skipDateModifiedUpdate: true });

    try {
      const service = new TagNavigatorService();
      const summary = await service.getItemDetails(item.id);

      assert.strictEqual(summary.dateAdded, dateAdded);
      assert.strictEqual(summary.dateModified, dateModified);
    } finally {
      await item.eraseTx();
    }
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
