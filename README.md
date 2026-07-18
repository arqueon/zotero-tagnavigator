# Zotero TagNavigator

<p align="center">
  <img src="assets/tag-navigator-icon-master.png" alt="Zotero TagNavigator icon" width="128">
</p>

<p align="center">
  A fast, Zotero-native workspace for exploring, combining, editing, and assigning tags.
</p>

Zotero TagNavigator is an add-on for **Zotero 7, 8, and 9**. It opens in a
separate window and follows Zotero's familiar three-pane layout: tags on the
left, items in the center, and item details and actions on the right. It is
designed to remain responsive with large personal and group libraries.

## Highlights

- **Zotero-native interface.** Uses Zotero's visual language, item icons,
  compact controls, and light or dark theme. The inspector can collapse when
  more space is needed.
- **Whole-library search.** With no tag selected, search metadata, creators,
  tags, notes, DOI, and CiteKey across the active library using Zotero's search
  engine. Press `Ctrl+F` (or `Cmd+F` on macOS) to focus the item search from
  anywhere in the window.
- **Focused tag exploration.** Select a tag and refine its items by text,
  creator, year, PDF availability, notes, or a second intersecting tag. Click
  the active tag again, or press `Esc`, to return to whole-library search.
- **Safe tag management.** Rename, merge, or remove a tag across a library
  after reviewing its scope and confirming the operation. Changes use Zotero's
  native item and transaction APIs and respect read-only group permissions.
- **Deliberate window switching.** Selecting a result only updates the
  inspector. Use **Open in Zotero** to reveal the item in the main library, or
  **Open file** to launch its best attachment with Zotero's native viewer.
- **Quick tagging.** Add tags with autocomplete, remove them from the selected
  item, or use `Ctrl+1` through `Ctrl+5` for frequently used manual tags.
- **Academic Quick Copy.** Copy a CiteKey, formatted citation, or bibliography
  through Zotero's CSL and Quick Copy APIs.
- **Zettlr-ready citations.** Enable **Zettlr citation format** next to CiteKey
  to read Zettlr's `editor.citeStyle` setting and copy `[@key]`, `@key`, or
  `@key []` in the format expected by Zettlr.
- **Large-library performance.** Virtualized tag and item lists render only
  visible rows. Global results load progressively, display up to 500 rows, and
  preserve the full match count.
- **Personal and group libraries.** Switch libraries from the title bar while
  preserving each library's editing permissions.

## Installation

1. Download `zotero-tag-navigator.xpi` from the
   [latest GitHub release](https://github.com/arqueon/zotero-tagnavigator/releases/latest).
2. In Zotero, open **Tools → Plugins**.
3. Open the gear menu and choose **Install Plugin From File…**.
4. Select the downloaded `.xpi` file and restart Zotero if prompted.

Open TagNavigator from **Tools → Zotero TagNavigator**.

## How it works

TagNavigator does not open or modify `zotero.sqlite` directly. Its service
layer performs read-only queries through `Zotero.DB`, delegates global search
to `Zotero.Search`, and turns results into plain data for the window. All tag
changes, attachment opening, Quick Copy operations, permissions, transactions,
and notifications remain under Zotero's native APIs.

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
