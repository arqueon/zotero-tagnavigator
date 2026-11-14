# Zotero TagNavigator

<p align="center">
  <img src="assets/tag-navigator-icon-master.png" alt="Zotero TagNavigator icon" width="128">
</p>

<p align="center">
  <a href="https://zoteroplugins.org/p/zotero-tagnavigator">
    <img src="https://zoteroplugins.org/badge/zotero-tagnavigator.svg" alt="Zotero Plugins grade">
  </a>
</p>

<p align="center">
  A fast, Zotero-native workspace for colored tags, boolean tag faceting, drag-and-drop tagging, and Advanced Search.
</p>

Zotero TagNavigator **2.0** is an add-on for **Zotero 7, 8, 9, and 10**. It opens in a dedicated three-pane workspace—tags on the left, items and search in the center, and a rich item inspector on the right—designed to stay responsive across large personal and group libraries.

## Highlights in 2.0

- **Zotero colored tags (`1–9`).** Assign, reorder, or clear Zotero's 9 colored tag slots from a visual swatch & hex palette dialog, view live changes via Zotero's `setting` observer, see WCAG-contrasting color chips across tag rows, item rows, and the inspector, and toggle slots `1–9` directly on selected items from the keyboard.
- **Unlimited boolean tag filtering & live facets.** Click a tag to focus, `Ctrl`/`Cmd`-click to intersect (`AND`), or `Alt`-click to exclude (`NOT`) as many tags as needed. While a query or tag filter is active, every tag row displays live co-occurrence counts (`matched/total`) and dims zero-match facets.
- **Bidirectional drag-and-drop (`zotero/item` ↔ tags).** Drag items from Zotero's main library—or directly from TagNavigator's result rows—onto any tag row or colored slot pill (`Alt+Drop` removes the tag), or drag any tag chip onto one or more selected result rows. Virtualized lists auto-scroll near viewport edges during drags.
- **Tag curation & organization.** Sort tags A–Z, by count, or colored-first; filter by **All**, **Manual**, **Automatic**, **Colored**, or **`1×` single-use** tags; convert automatic tags to manual; rename, merge, or remove tags safely; or clear automatic tags across a library in a single transaction.
- **Zotero Quicksearch & Advanced Search.** Switch quicksearch modes (**Title, Creator, Year**, **All Fields & Tags**, **Everything**), scope to any **Collection** (with optional **Include subcollections**), **Unfiled Items**, or native **Zotero Saved Search**, and expand a full multi-condition `Zotero.Search` builder (`Match all` / `Match any`).
- **Saved Views & native Zotero Saved Searches.** Save any active query either as a TagNavigator **Saved View** or directly as a native **Zotero Saved Search** (`Zotero.Search.saveTx()`) via a keyboard-accessible `<dialog>`.
- **Progressive full-library pagination.** Browse large libraries without a hard 500-item ceiling using configurable page sizes plus **Load more** and **Load all** controls while keeping virtualized rendering smooth.
- **Modern three-pane UX.** Resizable left and right pane splitters, collapsible tag and inspector panes, **Comfortable / Compact** density toggle, customizable and resizable result columns (`Title`, `Creator`, `Year`, `Item Type`, `Publication`, `Date Added`, `Date Modified`, `CiteKey`, `Colored Tags`, `Attachments/Notes`), enriched inspector (collections, DOI link, clickable attachments, abstract, notes preview), and configurable row double-click behavior (**Open best attachment**, **Select in Zotero**, or **Do nothing**).
- **Academic Quick Copy & Zettlr integration.** Copy CiteKeys (including Zettlr `editor.citeStyle` single/grouped keys), formatted citations, bibliographies, or APA references for any multi-item selection through Zotero's CSL engine.

## Installation

1. Download `zotero-tag-navigator.xpi` from the
   [latest GitHub release](https://github.com/arqueon/zotero-tagnavigator/releases/latest).
2. In Zotero, open **Tools → Plugins**.
3. Open the gear menu and choose **Install Plugin From File…**.
4. Select the downloaded `.xpi` file and restart Zotero if prompted.

Open TagNavigator from **Tools → Zotero TagNavigator**.

## How it works

TagNavigator never opens or mutates `zotero.sqlite` outside Zotero's runtime. Its service layer executes read-only aggregate queries through `Zotero.DB` and multi-condition searches through `Zotero.Search`, while every tag assignment, color slot update, saved search creation, attachment launch, Quick Copy export, permission check, transaction, and observer notification runs through Zotero's native APIs (`Zotero.Tags`, `Zotero.Items`, `Zotero.Collections`, `Zotero.Searches`, `Zotero.Notifier`). All assets are bundled locally with zero external runtime requests or custom `zotero://` protocol handlers.

## Wayland and Niri shortcut

While Zotero is running, the add-on exposes a local endpoint at
`http://127.0.0.1:23119/tagnavigator/open`. Calling it opens TagNavigator or
focuses the existing window. For example, add this binding to your Niri
configuration:

```kdl
binds {
    Mod+Shift+F3 { spawn "curl" "-s" "http://127.0.0.1:23119/tagnavigator/open"; }
}
```

The endpoint listens only through Zotero's local connector server.

## Development

Requirements: Node.js, npm, and a local Zotero installation.

```bash
npm install --allow-git=all
npm run lint:check
npm run build
npm test -- --no-watch
```

The packaged add-on is written to
`.scaffold/build/zotero-tag-navigator.xpi`.

## License

Zotero TagNavigator is licensed under the
[GNU General Public License v3.0 or later](LICENSE).
