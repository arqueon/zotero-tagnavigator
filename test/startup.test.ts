import { assert } from "chai";
import { config } from "../package.json";
import {
  formatCitekeyForZettlr,
  formatCitekeysForZettlr,
  TagNavigatorService,
} from "../src/modules/tagNavigatorService";
import { TagNavigator } from "../src/modules/tagnavigator";
import type { ItemSummary } from "../src/types/tagNavigator";
import {
  completeItemColumnWidths,
  sanitizeItemColumnWidths,
} from "../src/utils/itemColumns";
import {
  formatItemTimestamp,
  isItemTimestampInRange,
} from "../src/utils/itemDate";
import { compareItemSummaries } from "../src/utils/itemSort";
import { sanitizeSavedFilters } from "../src/utils/savedFilters";
import {
  hasZoteroItemDrag,
  parseZoteroItemDrop,
} from "../src/utils/zoteroDrag";

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
    assert.isObject(bootstrap.preferences.savedFilters);
  });

  it("should parse Zotero's native multi-item drag payload", function () {
    assert.deepEqual(parseZoteroItemDrop("42, 7,42,invalid,-3"), [42, 7]);
    assert.isTrue(hasZoteroItemDrag(["text/plain", "zotero/item"]));
    assert.isFalse(hasZoteroItemDrag(["text/plain"]));
  });

  it("should sanitize saved filters per library", function () {
    assert.deepEqual(
      sanitizeSavedFilters({
        1: [
          {
            id: "reading",
            name: "Reading queue",
            scope: { kind: "tag", tagName: "to-read" },
            query: "paper",
            secondTag: "methods",
            hasPDF: true,
          },
          {
            id: "recent-pdfs",
            name: "Recent PDFs",
            scope: { kind: "library" },
            dateModifiedFrom: "2026-01-01",
            hasPDF: true,
          },
        ],
        invalid: [{ id: "ignored" }],
      }),
      {
        1: [
          {
            id: "reading",
            name: "Reading queue",
            scope: { kind: "tag", tagName: "to-read" },
            query: "paper",
            author: "",
            secondTag: "methods",
            yearMin: "",
            yearMax: "",
            dateAddedFrom: "",
            dateAddedTo: "",
            dateModifiedFrom: "",
            dateModifiedTo: "",
            hasPDF: true,
            hasNotes: false,
          },
          {
            id: "recent-pdfs",
            name: "Recent PDFs",
            scope: { kind: "library" },
            query: "",
            author: "",
            secondTag: "",
            yearMin: "",
            yearMax: "",
            dateAddedFrom: "",
            dateAddedTo: "",
            dateModifiedFrom: "2026-01-01",
            dateModifiedTo: "",
            hasPDF: true,
            hasNotes: false,
          },
        ],
      },
    );
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
    assert.strictEqual(
      formatCitekeysForZettlr(["Author2026", "Editor2025"], "regular"),
      "[@Author2026; @Editor2025]",
    );
    assert.strictEqual(
      formatCitekeysForZettlr(["Author2026", "Editor2025"], "in-text"),
      "@Author2026; @Editor2025",
    );
  });

  it("should add and remove a tag across multiple items atomically", async function () {
    this.timeout(15000);
    const tagName = `TagNavigator batch ${Date.now()}`;
    const items = [new Zotero.Item("book"), new Zotero.Item("journalArticle")];
    for (const [index, item] of items.entries()) {
      item.libraryID = Zotero.Libraries.userLibraryID;
      item.setField("title", `TagNavigator batch item ${index + 1}`);
      await item.saveTx();
    }
    items[0].addTag(tagName, 1);
    await items[0].saveTx();

    try {
      const service = new TagNavigatorService();
      const added = await service.addTags(
        items.map((item) => item.id),
        tagName,
      );
      assert.strictEqual(added.selectedItems, 2);
      assert.strictEqual(added.affectedItems, 2);
      assert.isTrue(
        items.every((item) =>
          item.getTags().some((tag) => tag.tag === tagName),
        ),
      );
      assert.isTrue(items.every((item) => item.getTagType(tagName) === 0));

      const repeated = await service.addTags(
        items.map((item) => item.id),
        tagName,
      );
      assert.strictEqual(repeated.affectedItems, 0);

      const removed = await service.removeTags(
        items.map((item) => item.id),
        tagName,
      );
      assert.strictEqual(removed.affectedItems, 2);
      assert.isTrue(
        items.every(
          (item) => !item.getTags().some((tag) => tag.tag === tagName),
        ),
      );
    } finally {
      for (const item of items) await item.eraseTx();
    }
  });

  it("should merge one existing tag into another", async function () {
    this.timeout(15000);
    const suffix = Date.now();
    const sourceTag = `TagNavigator merge source ${suffix}`;
    const targetTag = `TagNavigator merge target ${suffix}`;
    const items = [new Zotero.Item("book"), new Zotero.Item("journalArticle")];

    for (const [index, item] of items.entries()) {
      item.libraryID = Zotero.Libraries.userLibraryID;
      item.setField("title", `TagNavigator merge item ${index + 1}`);
      item.addTag(sourceTag, 0);
      if (index === 1) item.addTag(targetTag, 0);
      await item.saveTx();
    }

    try {
      const service = new TagNavigatorService();
      const result = await service.mergeTags(
        Zotero.Libraries.userLibraryID,
        sourceTag,
        targetTag,
      );

      assert.deepEqual(result, {
        action: "merge",
        sourceName: sourceTag,
        targetName: targetTag,
        affectedItems: 2,
      });
      assert.isTrue(items.every((item) => item.hasTag(targetTag)));
      assert.isTrue(items.every((item) => !item.hasTag(sourceTag)));
    } finally {
      for (const item of items) await item.eraseTx();
    }
  });

  it("should merge tags through the floating-window controls", async function () {
    this.timeout(20000);
    const suffix = Date.now();
    const sourceTag = `TagNavigator UI merge source ${suffix}`;
    const targetTag = `TagNavigator UI merge target ${suffix}`;
    const items = [new Zotero.Item("book"), new Zotero.Item("journalArticle")];

    for (const [index, item] of items.entries()) {
      item.libraryID = Zotero.Libraries.userLibraryID;
      item.setField("title", `TagNavigator UI merge item ${index + 1}`);
      item.addTag(sourceTag, 0);
      if (index === 1) item.addTag(targetTag, 0);
      await item.saveTx();
    }

    const waitFor = async (predicate: () => boolean) => {
      const deadline = Date.now() + 10000;
      while (!predicate()) {
        if (Date.now() > deadline) throw new Error("Timed out waiting for UI");
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    };
    try {
      TagNavigator.openWindow();
      const win = (TagNavigator as any).openedWindow as Window;
      await waitFor(
        () =>
          win.document.readyState === "complete" &&
          win.document.getElementById("app")?.getAttribute("aria-busy") ===
            "false",
      );

      const search = win.document.getElementById(
        "tag-search",
      ) as HTMLInputElement;
      search.value = sourceTag;
      search.dispatchEvent(new win.Event("input", { bubbles: true }));
      await waitFor(() =>
        Array.from(win.document.querySelectorAll(".tag-name")).some(
          (node) => node.textContent === sourceTag,
        ),
      );
      const sourceRow = Array.from(
        win.document.querySelectorAll<HTMLElement>(".tag-row"),
      ).find(
        (row) => row.querySelector(".tag-name")?.textContent === sourceTag,
      );
      assert.exists(sourceRow);
      sourceRow!.click();

      const actions = win.document.getElementById(
        "tag-actions-button",
      ) as HTMLButtonElement;
      await waitFor(() => !actions.disabled);
      actions.click();
      const merge = win.document.querySelector(
        '[data-tag-action="merge"]',
      ) as HTMLButtonElement;
      merge.click();

      const dialog = win.document.getElementById(
        "tag-action-dialog",
      ) as HTMLDialogElement;
      await waitFor(() => dialog.open);
      const target = win.document.getElementById(
        "tag-action-target",
      ) as HTMLInputElement;
      target.dispatchEvent(
        new win.MouseEvent("pointerdown", { bubbles: true }),
      );
      target.value = targetTag;
      target.dispatchEvent(new win.Event("input", { bubbles: true }));
      const confirm = win.document.getElementById(
        "tag-action-confirm",
      ) as HTMLButtonElement;
      confirm.dispatchEvent(
        new win.MouseEvent("pointerdown", { bubbles: true }),
      );
      confirm.click();

      await waitFor(() => items.every((item) => item.hasTag(targetTag)));
      assert.isFalse(dialog.open);
      assert.isTrue(items.every((item) => !item.hasTag(sourceTag)));
    } finally {
      TagNavigator.stop();
      for (const item of items) await item.eraseTx();
    }
  });

  it("should copy multiple citekeys in raw and Zettlr formats", async function () {
    const service = new TagNavigatorService() as any;
    service.getRegularItems = async () => [
      { getField: () => "Author2026" },
      { getField: () => "" },
      { getField: () => "Editor2025" },
    ];
    service.getZettlrCitationFormat = async () => ({
      available: true,
      citeStyle: "regular",
      preview: "[@CiteKey]",
    });

    const clipboard = Zotero.Utilities.Internal as any;
    const originalCopy = clipboard.copyTextToClipboard;
    const copied: string[] = [];
    clipboard.copyTextToClipboard = (value: string) => copied.push(value);

    try {
      const raw = await service.copyMetadata([1, 2, 3], "citekey");
      assert.strictEqual(copied.pop(), "Author2026\nEditor2025");
      assert.deepEqual(raw, {
        requestedItems: 3,
        copiedItems: 2,
        missingCitekeys: 1,
      });

      await service.copyMetadata([1, 2, 3], "citekey", undefined, true);
      assert.strictEqual(copied.pop(), "[@Author2026; @Editor2025]");
    } finally {
      clipboard.copyTextToClipboard = originalCopy;
    }
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

  it("should filter stored timestamps by inclusive date ranges", function () {
    const timestamp = "2025-06-07 08:09:10";

    assert.isTrue(isItemTimestampInRange(timestamp, "2025-06-07", ""));
    assert.isTrue(
      isItemTimestampInRange(timestamp, "2025-01-01", "2025-06-07"),
    );
    assert.isFalse(isItemTimestampInRange(timestamp, "2025-06-08", ""));
    assert.isFalse(isItemTimestampInRange("", "2025-01-01", ""));
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

  it("should return a recent initial list ordered by date modified", async function () {
    this.timeout(15000);
    const dateModified = "2099-12-31 23:59:59";
    const item = new Zotero.Item("book");
    item.libraryID = Zotero.Libraries.userLibraryID;
    item.setField("title", "TagNavigator recent-list integration test");
    item.dateModified = dateModified;
    await item.saveTx({ skipDateModifiedUpdate: true });

    try {
      const service = new TagNavigatorService();
      const result = await service.getRecentItems(
        Zotero.Libraries.userLibraryID,
      );

      assert.strictEqual(result.items[0]?.id, item.id);
      assert.strictEqual(result.items[0]?.dateModified, dateModified);
      assert.isAtLeast(result.total, result.items.length);
    } finally {
      await item.eraseTx();
    }
  });

  it("should open on the recent list with Date Modified descending", async function () {
    this.timeout(20000);
    const item = new Zotero.Item("book");
    item.libraryID = Zotero.Libraries.userLibraryID;
    item.setField("title", "TagNavigator recent-window integration test");
    item.dateModified = "2099-12-31 23:59:59";
    await item.saveTx({ skipDateModifiedUpdate: true });

    const waitFor = async (predicate: () => boolean) => {
      const deadline = Date.now() + 10000;
      while (!predicate()) {
        if (Date.now() > deadline) throw new Error("Timed out waiting for UI");
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    };
    const rectSnapshot = (rect: DOMRect) => ({
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
    });

    try {
      TagNavigator.openWindow();
      const win = (TagNavigator as any).openedWindow as Window;
      await waitFor(
        () =>
          win.document.readyState === "complete" &&
          win.document.getElementById("app")?.getAttribute("aria-busy") ===
            "false" &&
          win.document.querySelectorAll(".item-row").length >= 2,
      );

      const rows = Array.from(
        win.document.querySelectorAll<HTMLElement>(".item-row"),
      );
      const firstTimestamp = rows[0].querySelector<HTMLElement>(
        ".date-modified-column",
      )?.dataset.timestamp;
      const secondTimestamp = rows[1].querySelector<HTMLElement>(
        ".date-modified-column",
      )?.dataset.timestamp;
      const modifiedHeader = win.document.querySelector(
        '[data-column="dateModified"]',
      ) as HTMLElement;
      assert.isString(firstTimestamp);
      assert.isString(secondTimestamp);
      assert.isAtLeast(firstTimestamp!.localeCompare(secondTimestamp!), 0);
      assert.strictEqual(
        modifiedHeader.getAttribute("aria-sort"),
        "descending",
      );
      assert.isFalse(
        (win.document.getElementById("date-added-from") as HTMLInputElement)
          .disabled,
      );
      assert.isFalse(
        (win.document.getElementById("date-modified-to") as HTMLInputElement)
          .disabled,
      );

      (
        win.document.getElementById("filters-toggle") as HTMLButtonElement
      ).click();
      const filtersBar = win.document.getElementById(
        "filters-bar",
      ) as HTMLElement;
      const itemsTable = win.document.getElementById(
        "items-table",
      ) as HTMLElement;
      await waitFor(() => !filtersBar.hidden && filtersBar.offsetHeight > 56);
      assert.isAtMost(
        filtersBar.getBoundingClientRect().bottom,
        itemsTable.getBoundingClientRect().top + 0.5,
      );

      const yearInput = win.document.getElementById("year-min")!;
      const authorFilter = win.document.getElementById("author-filter")!;
      const dateAddedFrom = win.document.getElementById("date-added-from")!;
      const dateAddedTo = win.document.getElementById("date-added-to")!;
      const dateModifiedFrom =
        win.document.getElementById("date-modified-from")!;
      const dateModifiedTo = win.document.getElementById("date-modified-to")!;
      const yearBounds = yearInput.getBoundingClientRect();
      const authorBounds = authorFilter.getBoundingClientRect();
      const yearFieldBounds = win.document
        .querySelector(".year-field")!
        .getBoundingClientRect();
      const authorFieldBounds =
        authorFilter.parentElement!.getBoundingClientRect();
      const dateBounds = [
        dateAddedFrom.getBoundingClientRect(),
        dateAddedTo.getBoundingClientRect(),
        dateModifiedFrom.getBoundingClientRect(),
        dateModifiedTo.getBoundingClientRect(),
      ];
      assert.closeTo(dateBounds[0].top, dateBounds[1].top, 0.5);
      assert.closeTo(dateBounds[2].top, dateBounds[3].top, 0.5);
      assert.closeTo(dateBounds[0].top, dateBounds[2].top, 0.5);
      assert.closeTo(
        yearBounds.top,
        authorBounds.top,
        0.5,
        JSON.stringify({
          year: rectSnapshot(yearBounds),
          author: rectSnapshot(authorBounds),
          yearField: rectSnapshot(yearFieldBounds),
          authorField: rectSnapshot(authorFieldBounds),
        }),
      );
      assert.closeTo(yearBounds.height, authorBounds.height, 0.5);
      for (const bounds of dateBounds) {
        assert.closeTo(bounds.height, yearBounds.height, 0.5);
      }

      const saveView = win.document.getElementById(
        "saved-filter-save",
      ) as HTMLButtonElement;
      const savedViewSelect = win.document.getElementById(
        "saved-filter-select",
      ) as HTMLSelectElement;
      const modifiedFromInput = dateModifiedFrom as HTMLInputElement;
      assert.isFalse(saveView.disabled);
      modifiedFromInput.value = "2026-01-01";
      modifiedFromInput.dispatchEvent(
        new win.Event("input", { bubbles: true }),
      );
      win.prompt = () => "Recent items since 2026";
      saveView.click();
      await waitFor(() => savedViewSelect.options.length > 1);
      const savedViewID = savedViewSelect.value;
      assert.isNotEmpty(savedViewID);

      modifiedFromInput.value = "";
      modifiedFromInput.dispatchEvent(
        new win.Event("input", { bubbles: true }),
      );
      savedViewSelect.value = savedViewID;
      savedViewSelect.dispatchEvent(new win.Event("change", { bubbles: true }));
      await waitFor(() => modifiedFromInput.value === "2026-01-01");
    } finally {
      TagNavigator.stop();
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
