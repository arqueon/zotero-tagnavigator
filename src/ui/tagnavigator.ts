import type {
  CopyKind,
  ItemColumnKey,
  ItemColumnWidths,
  ItemDetails,
  ItemScope,
  ItemSummary,
  NavigatorBootstrap,
  TagNavigatorAPI,
  TagMutationResult,
  TagOverview,
  TagSummary,
} from "../types/tagNavigator";
import {
  clampItemColumnWidth,
  completeItemColumnWidths,
  DEFAULT_ITEM_COLUMN_WIDTHS,
  getItemColumnLimits,
  ITEM_COLUMN_KEYS,
} from "../utils/itemColumns";
import { formatItemTimestamp } from "../utils/itemDate";
import {
  compareItemSummaries,
  type ItemSortDirection,
  type ItemSortKey,
} from "../utils/itemSort";

// The plugin sandbox typings intentionally omit browser globals, while this
// entry point runs inside the standalone chrome HTML window.
declare const window: WindowProxy;
declare const document: Document;

type TagActionMode = "rename" | "merge" | "delete";

type TagListEntry = {
  key: string;
  label: string;
  count: number;
  kind: "manual" | "automatic" | "mixed" | "untagged";
  scope: ItemScope;
};

type TranslationValue = string;
type TranslationTable = Record<string, TranslationValue>;

const TRANSLATIONS: Record<"en" | "es", TranslationTable> = {
  en: {
    library: "Library",
    refresh: "Refresh",
    toggleInspector: "Toggle item pane",
    closeInspector: "Close item pane",
    dismiss: "Dismiss",
    retry: "Retry",
    tags: "Tags",
    searchTags: "Search tags",
    searchItems: "Title, creator, abstract or CiteKey",
    clearSearch: "Clear search",
    hideAutomatic: "Hide automatic tags",
    manual: "Manual",
    automatic: "Automatic",
    mixed: "Manual and automatic",
    selectTag: "Select a tag",
    allLibrary: "All library",
    deselectTag: "Select again to search the whole library",
    filters: "Filters",
    author: "Author",
    allAuthors: "All authors",
    intersectTag: "Intersect tag",
    anyTag: "Any tag",
    yearRange: "Year range",
    from: "From",
    to: "To",
    hasPDF: "Has PDF",
    hasNotes: "Has notes",
    clearFilters: "Clear filters",
    searchLibrary: "Search the whole library",
    searchLibraryTitle: "Search the whole library",
    searchLibraryBody:
      "Enter metadata, a creator, tag, note, DOI or CiteKey. Nothing is loaded until you search.",
    searchingLibrary: "Searching library…",
    libraryItemCount: "{count} items in this library",
    librarySearchStatus: "{visible} of {total} matches",
    librarySearchLimitedStatus:
      "{visible} visible · {shown} loaded of {total} matches",
    chooseTagTitle: "Choose a tag to begin",
    chooseTagBody:
      "Combine a tag with text, author, year, PDF, notes and another tag.",
    noItemsTitle: "No matching items",
    noItemsBody: "Change or clear one of the active filters.",
    emptyTagTitle: "This tag has no items",
    emptyTagBody: "The library may have changed since the tag list was loaded.",
    title: "Title",
    creator: "Creator",
    year: "Year",
    dateAdded: "Date Added",
    dateModified: "Date Modified",
    resizeColumn: "Drag to resize · Double-click to reset",
    resizeColumnLabel: "Resize {column} column",
    filesAndNotes: "Files and notes",
    itemDetails: "Item details",
    selectItem: "Select an item to inspect it.",
    showInZotero: "Open in Zotero",
    openFile: "Open file",
    info: "Info",
    itemType: "Item type",
    date: "Date",
    publication: "Publication",
    addTag: "Add tag",
    frequentTags: "Frequent tags",
    quickCopy: "Quick Copy",
    citationStyle: "Citation style",
    zettlrCitationFormat: "Zettlr citation format",
    zettlrFormatHint: "CiteKey will be copied as {format}",
    zettlrConfigUnavailable: "Zettlr configuration not found",
    copyCitation: "Copy citation",
    copyBibliography: "Copy bibliography",
    loadingLibrary: "Loading library…",
    loadingTags: "Loading tags…",
    loadingItems: "Loading items…",
    loadingDetails: "Loading item details…",
    untagged: "Untagged",
    untitled: "Untitled",
    unknownCreator: "Unknown creator",
    notAvailable: "—",
    tagStatus: "{visible} of {total}",
    itemStatus: "{visible} of {total} items",
    tagCount: "{count} tags",
    copiedCitekey: "CiteKey copied",
    copiedZettlrCitation: "Zettlr citation copied",
    copiedCitation: "Citation copied",
    copiedBibliography: "Bibliography copied",
    tagAdded: "Tag added: {tag}",
    tagRemoved: "Tag removed: {tag}",
    tagActions: "Tag actions",
    renameTag: "Rename tag…",
    mergeTag: "Merge into…",
    deleteTag: "Remove tag from library…",
    renameTagTitle: "Rename tag",
    mergeTagTitle: "Merge tags",
    deleteTagTitle: "Remove tag from library",
    renameTagDescription:
      "Rename “{tag}” across {count} items in this library.",
    mergeTagDescription:
      "Merge “{tag}” into an existing tag across {count} items. Zotero will resolve duplicate assignments.",
    deleteTagDescription:
      "Remove “{tag}” from {count} items in this library. No items or files will be deleted.",
    newTagName: "New tag name",
    mergeTarget: "Existing destination tag",
    mergeTargetPlaceholder: "Search destination tags",
    cancel: "Cancel",
    confirmRename: "Rename",
    confirmMerge: "Merge tags",
    confirmDelete: "Remove tag",
    tagRenamed: "Renamed “{source}” to “{target}” on {count} items",
    tagsMerged: "Merged “{source}” into “{target}” on {count} items",
    libraryTagDeleted: "Removed “{tag}” from {count} items",
    noAttachment: "No readable attachment was found",
    readOnlyLibrary: "This library is read-only",
    noCitekey: "This item has no CiteKey",
    invalidCitationStyle: "Select a valid citation style",
    errorGeneric: "Tag Navigator could not complete the operation: {detail}",
    errorDatabase: "The Zotero database query did not return a valid result.",
    errorLibrary: "The selected library is no longer available.",
    errorItem: "The selected item is no longer available.",
    errorCopy: "Zotero's copy interface is unavailable.",
    errorZettlrConfig:
      "Zettlr's citation format could not be read from its configuration.",
    errorEmptyTag: "Enter a tag name.",
    errorLongTag: "The tag is longer than Zotero allows.",
    errorTagNotFound: "The source tag is no longer present in this library.",
    errorTagExists:
      "That tag already exists in this library. Use Merge into instead.",
    errorMergeTarget: "Choose an existing destination tag from this library.",
    errorSameTag: "The source and destination tags must be different.",
    showingLibrary: "{name}",
  },
  es: {
    library: "Biblioteca",
    refresh: "Actualizar",
    toggleInspector: "Mostrar u ocultar panel de información",
    closeInspector: "Cerrar panel de información",
    dismiss: "Cerrar",
    retry: "Reintentar",
    tags: "Etiquetas",
    searchTags: "Buscar etiquetas",
    searchItems: "Título, autor, resumen o CiteKey",
    clearSearch: "Borrar búsqueda",
    hideAutomatic: "Ocultar etiquetas automáticas",
    manual: "Manual",
    automatic: "Automática",
    mixed: "Manual y automática",
    selectTag: "Selecciona una etiqueta",
    allLibrary: "Toda la biblioteca",
    deselectTag: "Selecciona de nuevo para buscar en toda la biblioteca",
    filters: "Filtros",
    author: "Autor",
    allAuthors: "Todos los autores",
    intersectTag: "Cruzar etiqueta",
    anyTag: "Cualquier etiqueta",
    yearRange: "Rango de años",
    from: "Desde",
    to: "Hasta",
    hasPDF: "Con PDF",
    hasNotes: "Con notas",
    clearFilters: "Limpiar filtros",
    searchLibrary: "Buscar en toda la biblioteca",
    searchLibraryTitle: "Busca en toda la biblioteca",
    searchLibraryBody:
      "Escribe metadatos, un autor, etiqueta, nota, DOI o CiteKey. No se carga nada hasta que busques.",
    searchingLibrary: "Buscando en la biblioteca…",
    libraryItemCount: "{count} elementos en esta biblioteca",
    librarySearchStatus: "{visible} de {total} coincidencias",
    librarySearchLimitedStatus:
      "{visible} visibles · {shown} cargados de {total} coincidencias",
    chooseTagTitle: "Elige una etiqueta para comenzar",
    chooseTagBody:
      "Combina una etiqueta con texto, autor, año, PDF, notas y una segunda etiqueta.",
    noItemsTitle: "No hay elementos coincidentes",
    noItemsBody: "Cambia o limpia alguno de los filtros activos.",
    emptyTagTitle: "Esta etiqueta no contiene elementos",
    emptyTagBody:
      "La biblioteca pudo cambiar desde que se cargó la lista de etiquetas.",
    title: "Título",
    creator: "Autor",
    year: "Año",
    dateAdded: "Fecha de añadido",
    dateModified: "Fecha de modificación",
    resizeColumn: "Arrastra para ajustar · Doble clic para restaurar",
    resizeColumnLabel: "Ajustar columna {column}",
    filesAndNotes: "Archivos y notas",
    itemDetails: "Información del elemento",
    selectItem: "Selecciona un elemento para consultar su información.",
    showInZotero: "Abrir en Zotero",
    openFile: "Abrir archivo",
    info: "Información",
    itemType: "Tipo de elemento",
    date: "Fecha",
    publication: "Publicación",
    addTag: "Añadir etiqueta",
    frequentTags: "Etiquetas frecuentes",
    quickCopy: "Copiado rápido",
    citationStyle: "Estilo de cita",
    zettlrCitationFormat: "Formato de cita de Zettlr",
    zettlrFormatHint: "La CiteKey se copiará como {format}",
    zettlrConfigUnavailable: "No se encontró la configuración de Zettlr",
    copyCitation: "Copiar cita",
    copyBibliography: "Copiar bibliografía",
    loadingLibrary: "Cargando biblioteca…",
    loadingTags: "Cargando etiquetas…",
    loadingItems: "Cargando elementos…",
    loadingDetails: "Cargando información…",
    untagged: "Sin etiquetas",
    untitled: "Sin título",
    unknownCreator: "Autor desconocido",
    notAvailable: "—",
    tagStatus: "{visible} de {total}",
    itemStatus: "{visible} de {total} elementos",
    tagCount: "{count} etiquetas",
    copiedCitekey: "CiteKey copiada",
    copiedZettlrCitation: "Cita para Zettlr copiada",
    copiedCitation: "Cita copiada",
    copiedBibliography: "Bibliografía copiada",
    tagAdded: "Etiqueta añadida: {tag}",
    tagRemoved: "Etiqueta eliminada: {tag}",
    tagActions: "Acciones de etiqueta",
    renameTag: "Renombrar etiqueta…",
    mergeTag: "Fusionar con…",
    deleteTag: "Quitar etiqueta de la biblioteca…",
    renameTagTitle: "Renombrar etiqueta",
    mergeTagTitle: "Fusionar etiquetas",
    deleteTagTitle: "Quitar etiqueta de la biblioteca",
    renameTagDescription:
      "Renombra “{tag}” en {count} elementos de esta biblioteca.",
    mergeTagDescription:
      "Fusiona “{tag}” con una etiqueta existente en {count} elementos. Zotero resolverá las asignaciones duplicadas.",
    deleteTagDescription:
      "Quita “{tag}” de {count} elementos de esta biblioteca. No se eliminarán elementos ni archivos.",
    newTagName: "Nuevo nombre de etiqueta",
    mergeTarget: "Etiqueta de destino existente",
    mergeTargetPlaceholder: "Buscar etiquetas de destino",
    cancel: "Cancelar",
    confirmRename: "Renombrar",
    confirmMerge: "Fusionar etiquetas",
    confirmDelete: "Quitar etiqueta",
    tagRenamed: "Se renombró “{source}” como “{target}” en {count} elementos",
    tagsMerged: "Se fusionó “{source}” con “{target}” en {count} elementos",
    libraryTagDeleted: "Se quitó “{tag}” de {count} elementos",
    noAttachment: "No se encontró un adjunto legible",
    readOnlyLibrary: "Esta biblioteca es de sólo lectura",
    noCitekey: "Este elemento no tiene CiteKey",
    invalidCitationStyle: "Selecciona un estilo de cita válido",
    errorGeneric: "Tag Navigator no pudo completar la operación: {detail}",
    errorDatabase:
      "La consulta a la base de datos de Zotero no devolvió un resultado válido.",
    errorLibrary: "La biblioteca seleccionada ya no está disponible.",
    errorItem: "El elemento seleccionado ya no está disponible.",
    errorCopy: "La interfaz de copiado de Zotero no está disponible.",
    errorZettlrConfig:
      "No se pudo leer el formato de cita desde la configuración de Zettlr.",
    errorEmptyTag: "Escribe el nombre de una etiqueta.",
    errorLongTag: "La etiqueta supera la longitud permitida por Zotero.",
    errorTagNotFound:
      "La etiqueta de origen ya no está presente en esta biblioteca.",
    errorTagExists:
      "Esa etiqueta ya existe en esta biblioteca. Usa Fusionar con.",
    errorMergeTarget:
      "Elige una etiqueta de destino que exista en esta biblioteca.",
    errorSameTag: "Las etiquetas de origen y destino deben ser diferentes.",
    showingLibrary: "{name}",
  },
};

class VirtualList<T> {
  private items: T[] = [];
  private frame = 0;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly container: HTMLElement,
    private readonly spacer: HTMLElement,
    private readonly windowElement: HTMLElement,
    private readonly rowHeight: number,
    private readonly renderRow: (item: T, index: number) => HTMLElement,
  ) {
    this.container.addEventListener("scroll", () => this.scheduleRender());
    this.resizeObserver = new ResizeObserver(() => this.scheduleRender());
    this.resizeObserver.observe(this.container);
  }

  setItems(items: T[]): void {
    this.items = items;
    this.spacer.style.height = `${Math.max(
      this.container.clientHeight,
      items.length * this.rowHeight,
    )}px`;
    this.container.scrollTop = 0;
    this.render();
  }

  refresh(): void {
    this.render();
  }

  scrollToIndex(index: number): void {
    if (index < 0 || index >= this.items.length) return;
    const rowTop = index * this.rowHeight;
    const rowBottom = rowTop + this.rowHeight;
    const viewportTop = this.container.scrollTop;
    const viewportBottom = viewportTop + this.container.clientHeight;
    if (rowTop < viewportTop) this.container.scrollTop = rowTop;
    if (rowBottom > viewportBottom) {
      this.container.scrollTop = rowBottom - this.container.clientHeight;
    }
    this.scheduleRender();
  }

  private scheduleRender(): void {
    if (this.frame) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  private render(): void {
    const overscan = 7;
    const viewportHeight = Math.max(
      this.container.clientHeight,
      this.rowHeight,
    );
    const start = Math.max(
      0,
      Math.floor(this.container.scrollTop / this.rowHeight) - overscan,
    );
    const visibleCount =
      Math.ceil(viewportHeight / this.rowHeight) + overscan * 2;
    const end = Math.min(this.items.length, start + visibleCount);
    const fragment = document.createDocumentFragment();

    for (let index = start; index < end; index++) {
      fragment.appendChild(this.renderRow(this.items[index], index));
    }

    this.windowElement.style.transform = `translateY(${start * this.rowHeight}px)`;
    this.windowElement.replaceChildren(fragment);
  }
}

const windowArgument = (window as any).arguments?.[0];
const api = (windowArgument?.wrappedJSObject?.api ||
  windowArgument?.api ||
  null) as TagNavigatorAPI | null;
let bootstrap: NavigatorBootstrap | null = null;
let overview: TagOverview | null = null;
let currentLibraryID = 0;
let currentScope: ItemScope | null = null;
let currentTagRows: TagListEntry[] = [];
let visibleTagRows: TagListEntry[] = [];
let allItems: ItemSummary[] = [];
let visibleItems: ItemSummary[] = [];
let selectedItemID: number | null = null;
let selectedDetails: ItemDetails | null = null;
let frequentTagCandidates: TagSummary[] = [];
let sortKey: ItemSortKey = "title";
let sortDirection: ItemSortDirection = "ascending";
let itemColumnWidths: ItemColumnWidths = {
  ...DEFAULT_ITEM_COLUMN_WIDTHS,
};
let language: "en" | "es" = "en";
let tagLoadToken = 0;
let itemLoadToken = 0;
let detailLoadToken = 0;
let toastTimer = 0;
let refreshTimer = 0;
let retryAction: (() => Promise<void>) | null = null;
let autocompleteIndex = -1;
let autocompleteMatches: TagSummary[] = [];
let suppressNotificationsUntil = 0;
let librarySearchQuery = "";
let librarySearchTotal = 0;
let librarySearchLimited = false;
let librarySearchTimer = 0;
let tagActionMode: TagActionMode | null = null;
let tagActionSource: TagSummary | null = null;
let tagActionAutocompleteMatches: TagSummary[] = [];
let tagActionAutocompleteIndex = -1;

let tagVirtualList: VirtualList<TagListEntry>;
let itemVirtualList: VirtualList<ItemSummary>;

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing UI element: ${id}`);
  return found as T;
}

function translate(
  key: string,
  values: Record<string, string | number> = {},
): string {
  let value = TRANSLATIONS[language][key] || TRANSLATIONS.en[key] || key;
  for (const [name, replacement] of Object.entries(values)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

function localizeDocument(): void {
  (document.documentElement as HTMLHtmlElement).lang = language;
  document
    .querySelectorAll<HTMLElement>("[data-i18n]")
    .forEach((node: HTMLElement) => {
      node.textContent = translate(node.dataset.i18n || "");
    });
  document
    .querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]")
    .forEach((node: HTMLInputElement) => {
      node.placeholder = translate(node.dataset.i18nPlaceholder || "");
    });
  document
    .querySelectorAll<HTMLElement>("[data-i18n-title]")
    .forEach((node: HTMLElement) => {
      const title = translate(node.dataset.i18nTitle || "");
      node.title = title;
      if (node.hasAttribute("aria-label"))
        node.setAttribute("aria-label", title);
    });
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase(language === "es" ? "es" : "en")
    .trim();
}

function createIcon(uri: string, className = "icon"): HTMLImageElement {
  const image = document.createElement("img");
  image.className = className;
  image.src = uri;
  image.alt = "";
  return image;
}

function initializeVirtualLists(): void {
  tagVirtualList = new VirtualList(
    element("tag-list"),
    element("tag-spacer"),
    element("tag-window"),
    30,
    renderTagRow,
  );
  itemVirtualList = new VirtualList(
    element("items-list"),
    element("items-spacer"),
    element("items-window"),
    34,
    renderItemRow,
  );
}

async function init(): Promise<void> {
  initializeVirtualLists();
  bindEvents();

  if (!api) {
    showFatalError(new Error("PLUGIN_API_UNAVAILABLE"));
    return;
  }

  try {
    bootstrap = await api.initialize();
    language = bootstrap.locale.toLocaleLowerCase().startsWith("es")
      ? "es"
      : "en";
    localizeDocument();
    configureItemColumns();
    configureStaticControls();
    configureZettlrCitationFormat();
    populateLibraries();
    populateCitationStyles();
    setInspectorOpen(bootstrap.preferences.inspectorOpen, false);
    element<HTMLInputElement>("hide-automatic-tags").checked =
      bootstrap.preferences.hideAutomaticTags;
    await loadLibrary(bootstrap.preferences.selectedLibraryID);
  } catch (error) {
    showFatalError(error);
  }
}

function configureStaticControls(): void {
  if (!bootstrap) return;
  element("version-label").textContent =
    `Zotero ${bootstrap.appVersion} · v${bootstrap.pluginVersion}`;
  const currentYear = new Date().getFullYear() + 1;
  for (const id of ["year-min", "year-max"]) {
    const input = element<HTMLInputElement>(id);
    input.min = "1000";
    input.max = String(currentYear);
  }
}

const ITEM_COLUMN_CSS_VARIABLES: Record<ItemColumnKey, string> = {
  title: "--item-column-title",
  creator: "--item-column-creator",
  year: "--item-column-year",
  dateAdded: "--item-column-date-added",
  dateModified: "--item-column-date-modified",
};

function configureItemColumns(): void {
  itemColumnWidths = completeItemColumnWidths(
    bootstrap?.preferences.itemColumnWidths,
  );
  for (const key of ITEM_COLUMN_KEYS) {
    applyItemColumnWidth(key, itemColumnWidths[key]);
    const resizer = document.querySelector<HTMLElement>(
      `[data-resize-column="${key}"]`,
    );
    if (!resizer) continue;
    const limits = getItemColumnLimits(key);
    resizer.title = translate("resizeColumn");
    resizer.setAttribute(
      "aria-label",
      translate("resizeColumnLabel", { column: translate(key) }),
    );
    resizer.setAttribute("aria-valuemin", String(limits.minimum));
    resizer.setAttribute("aria-valuemax", String(limits.maximum));
  }
  syncItemHeaderScroll();
}

function itemColumnKeyFromElement(target: HTMLElement): ItemColumnKey | null {
  const key = target.dataset.resizeColumn as ItemColumnKey | undefined;
  return key && ITEM_COLUMN_KEYS.includes(key) ? key : null;
}

function applyItemColumnWidth(key: ItemColumnKey, width: number): void {
  const clamped = clampItemColumnWidth(key, width);
  itemColumnWidths[key] = clamped;
  element("app").style.setProperty(
    ITEM_COLUMN_CSS_VARIABLES[key],
    `${clamped}px`,
  );
  document
    .querySelector<HTMLElement>(`[data-resize-column="${key}"]`)
    ?.setAttribute("aria-valuenow", String(clamped));
}

function persistItemColumnWidths(): void {
  api?.savePreferences({ itemColumnWidths: { ...itemColumnWidths } });
}

function startItemColumnResize(event: PointerEvent): void {
  if (event.button !== 0) return;
  const resizer = event.currentTarget as HTMLElement;
  const key = itemColumnKeyFromElement(resizer);
  if (!key) return;

  event.preventDefault();
  event.stopPropagation();
  const pointerID = event.pointerId;
  const startX = event.clientX;
  const startWidth = itemColumnWidths[key];
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    if (resizer.hasPointerCapture(pointerID)) {
      resizer.releasePointerCapture(pointerID);
    }
    resizer.classList.remove("active");
    element("app").classList.remove("column-resizing");
    resizer.removeEventListener("pointermove", move);
    resizer.removeEventListener("pointerup", finish);
    resizer.removeEventListener("pointercancel", finish);
    persistItemColumnWidths();
  };
  const move = (moveEvent: PointerEvent) => {
    applyItemColumnWidth(key, startWidth + moveEvent.clientX - startX);
  };

  resizer.classList.add("active");
  element("app").classList.add("column-resizing");
  resizer.setPointerCapture(pointerID);
  resizer.addEventListener("pointermove", move);
  resizer.addEventListener("pointerup", finish);
  resizer.addEventListener("pointercancel", finish);
}

function resetItemColumnWidth(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  const key = itemColumnKeyFromElement(event.currentTarget as HTMLElement);
  if (!key) return;
  applyItemColumnWidth(key, DEFAULT_ITEM_COLUMN_WIDTHS[key]);
  persistItemColumnWidths();
}

function handleItemColumnResizeKeyboard(event: KeyboardEvent): void {
  const key = itemColumnKeyFromElement(event.currentTarget as HTMLElement);
  if (!key) return;
  if (event.key === "Home") {
    event.preventDefault();
    applyItemColumnWidth(key, DEFAULT_ITEM_COLUMN_WIDTHS[key]);
    persistItemColumnWidths();
    return;
  }
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

  event.preventDefault();
  const step = event.shiftKey ? 24 : 8;
  applyItemColumnWidth(
    key,
    itemColumnWidths[key] + (event.key === "ArrowRight" ? step : -step),
  );
  persistItemColumnWidths();
}

function syncItemHeaderScroll(): void {
  const header = element("items-header");
  const scrollLeft = element("items-list").scrollLeft;
  header.style.transform = `translateX(${-scrollLeft}px)`;
}

function configureZettlrCitationFormat(): void {
  if (!bootstrap) return;
  const checkbox = element<HTMLInputElement>("zettlr-citation-format");
  const status = element("zettlr-format-status");
  // Keep upgrades from an already-running older backend usable until Zotero
  // finishes reloading the add-on and both sides share the same API version.
  const format = bootstrap.zettlrCitationFormat || {
    available: false,
    citeStyle: "regular" as const,
    preview: "[@CiteKey]",
  };

  checkbox.disabled = !format.available;
  checkbox.checked =
    format.available && bootstrap.preferences.zettlrCitationFormat;
  status.textContent = format.available
    ? format.preview
    : translate("zettlrConfigUnavailable");
  status.classList.toggle("unavailable", !format.available);
  const option = element("zettlr-format-option");
  option.title = format.available
    ? translate("zettlrFormatHint", { format: format.preview })
    : translate("zettlrConfigUnavailable");
}

function populateLibraries(): void {
  if (!bootstrap) return;
  const select = element<HTMLSelectElement>("library-select");
  const fragment = document.createDocumentFragment();
  for (const library of bootstrap.libraries) {
    const option = document.createElement("option");
    option.value = String(library.id);
    option.textContent = library.name;
    fragment.appendChild(option);
  }
  select.replaceChildren(fragment);
  select.value = String(bootstrap.preferences.selectedLibraryID);
}

function populateCitationStyles(): void {
  if (!bootstrap) return;
  const select = element<HTMLSelectElement>("citation-style");
  const fragment = document.createDocumentFragment();
  for (const style of bootstrap.citationStyles) {
    const option = document.createElement("option");
    option.value = style.id;
    option.textContent = style.title;
    fragment.appendChild(option);
  }
  select.replaceChildren(fragment);
  select.value = bootstrap.defaultCitationStyleID;
}

function bindEvents(): void {
  element<HTMLSelectElement>("library-select").addEventListener(
    "change",
    async (event) => {
      const libraryID = Number(
        (event.currentTarget as HTMLSelectElement).value,
      );
      await loadLibrary(libraryID);
    },
  );

  element("refresh-button").addEventListener(
    "click",
    () => void refreshCurrentView(),
  );
  element("inspector-toggle").addEventListener("click", () => {
    setInspectorOpen(
      element("app").classList.contains("inspector-closed"),
      true,
    );
  });
  element("inspector-close").addEventListener("click", () =>
    setInspectorOpen(false, true),
  );

  const tagSearch = element<HTMLInputElement>("tag-search");
  tagSearch.addEventListener("input", filterTagList);
  element("clear-tag-search").addEventListener("click", () => {
    tagSearch.value = "";
    tagSearch.focus();
    filterTagList();
  });
  element<HTMLInputElement>("hide-automatic-tags").addEventListener(
    "change",
    (event) => {
      const checked = (event.currentTarget as HTMLInputElement).checked;
      api?.savePreferences({ hideAutomaticTags: checked });
      filterTagList();
    },
  );
  element("tag-list").addEventListener("keydown", handleTagListKeyboard);

  element("tag-actions-button").addEventListener("click", (event) => {
    const source = selectedTagSummary();
    if (!source) return;
    const button = event.currentTarget as HTMLElement;
    const bounds = button.getBoundingClientRect();
    openTagActionsMenu(source, bounds.right, bounds.bottom + 3, true);
  });
  element("tag-actions-menu").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest(
      "button[data-tag-action]",
    ) as HTMLButtonElement | null;
    if (!button || !tagActionSource) return;
    openTagActionDialog(
      button.dataset.tagAction as TagActionMode,
      tagActionSource,
    );
  });
  document.addEventListener("pointerdown", (event) => {
    const target = event.target as Node;
    if (
      !element("tag-actions-menu").contains(target) &&
      !element("tag-actions-button").contains(target)
    ) {
      closeTagActionsMenu();
    }
  });

  const itemSearch = element<HTMLInputElement>("item-search");
  itemSearch.addEventListener("input", handleItemSearchInput);
  element("clear-item-search").addEventListener("click", () => {
    itemSearch.value = "";
    itemSearch.focus();
    handleItemSearchInput();
  });

  element("filters-toggle").addEventListener("click", toggleFilters);
  for (const id of [
    "author-filter",
    "second-tag-filter",
    "year-min",
    "year-max",
    "filter-has-pdf",
    "filter-has-notes",
  ]) {
    element(id).addEventListener("input", applyItemFilters);
    element(id).addEventListener("change", applyItemFilters);
  }
  element("clear-filters").addEventListener("click", clearFilters);

  document
    .querySelectorAll<HTMLButtonElement>("[data-sort]")
    .forEach((button: HTMLButtonElement) => {
      button.addEventListener("click", () =>
        setSort(button.dataset.sort as ItemSortKey),
      );
    });
  const itemsList = element("items-list");
  itemsList.addEventListener("keydown", handleItemListKeyboard);
  itemsList.addEventListener("scroll", syncItemHeaderScroll);
  document
    .querySelectorAll<HTMLElement>("[data-resize-column]")
    .forEach((resizer: HTMLElement) => {
      resizer.addEventListener("pointerdown", startItemColumnResize);
      resizer.addEventListener("dblclick", resetItemColumnWidth);
      resizer.addEventListener("keydown", handleItemColumnResizeKeyboard);
    });

  element("show-in-zotero").addEventListener("click", () => {
    if (selectedItemID) void api?.selectInMainWindow(selectedItemID);
  });
  element("open-attachment").addEventListener(
    "click",
    () => void openSelectedAttachment(),
  );
  element("copy-citekey").addEventListener(
    "click",
    () => void copySelected("citekey"),
  );
  element<HTMLInputElement>("zettlr-citation-format").addEventListener(
    "change",
    (event) => {
      api?.savePreferences({
        zettlrCitationFormat: (event.currentTarget as HTMLInputElement).checked,
      });
    },
  );
  element("copy-citation").addEventListener(
    "click",
    () => void copySelected("citation"),
  );
  element("copy-bibliography").addEventListener(
    "click",
    () => void copySelected("bibliography"),
  );

  element<HTMLFormElement>("add-tag-form").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      void submitTagInput();
    },
  );
  const tagInput = element<HTMLInputElement>("quick-tag-add");
  tagInput.addEventListener("input", updateTagAutocomplete);
  tagInput.addEventListener("keydown", handleAutocompleteKeyboard);

  element<HTMLFormElement>("tag-action-form").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      void submitTagAction();
    },
  );
  element("tag-action-close").addEventListener("click", closeTagActionDialog);
  element("tag-action-cancel").addEventListener("click", closeTagActionDialog);
  element<HTMLDialogElement>("tag-action-dialog").addEventListener(
    "cancel",
    (event) => {
      if (element("tag-action-form").getAttribute("aria-busy") === "true") {
        event.preventDefault();
      } else {
        closeTagActionDialog();
      }
    },
  );
  const tagActionTarget = element<HTMLInputElement>("tag-action-target");
  tagActionTarget.addEventListener("input", updateTagActionAutocomplete);
  tagActionTarget.addEventListener("keydown", handleTagActionAutocompleteKey);

  element("error-retry").addEventListener("click", () => {
    hideError();
    if (retryAction) void retryAction();
  });
  element("error-dismiss").addEventListener("click", hideError);

  window.addEventListener("tagnavigator-data-changed", scheduleExternalRefresh);
  window.addEventListener("keydown", handleGlobalKeyboard);
}

async function loadLibrary(libraryID: number): Promise<void> {
  if (!api || !bootstrap) return;
  const token = ++tagLoadToken;
  ++itemLoadToken;
  ++detailLoadToken;
  setLoading(true, "loadingLibrary");
  hideError();
  currentLibraryID = libraryID;
  overview = null;
  currentScope = null;
  selectedItemID = null;
  selectedDetails = null;
  allItems = [];
  visibleItems = [];
  resetInspector();
  resetItemView();

  try {
    const loaded = await api.getTagOverview(libraryID);
    if (token !== tagLoadToken) return;
    overview = loaded;
    element<HTMLSelectElement>("library-select").value = String(libraryID);
    api.savePreferences({ selectedLibraryID: libraryID });
    updateTagRows();
    enterLibrarySearch();
    const library = bootstrap.libraries.find((entry) => entry.id === libraryID);
    element("library-status").textContent = library
      ? translate("showingLibrary", { name: library.name })
      : "";
  } catch (error) {
    if (token === tagLoadToken) {
      showError(error, () => loadLibrary(libraryID));
    }
  } finally {
    if (token === tagLoadToken) setLoading(false);
  }
}

function updateTagRows(): void {
  if (!overview) {
    currentTagRows = [];
    filterTagList();
    return;
  }

  currentTagRows = [
    {
      key: "untagged",
      label: translate("untagged"),
      count: overview.untaggedItems,
      kind: "untagged",
      scope: { kind: "untagged" },
    },
    ...overview.tags.map((tag) => ({
      key: `tag:${tag.name}`,
      label: tag.name,
      count: tag.count,
      kind: tag.kind,
      scope: { kind: "tag" as const, tagName: tag.name },
    })),
  ];
  element("tag-total").textContent = String(overview.tags.length);
  filterTagList();
  updateTagActionButton();
}

function filterTagList(): void {
  const queryInput = element<HTMLInputElement>("tag-search");
  const query = normalize(queryInput.value);
  const hideAutomatic = element<HTMLInputElement>(
    "hide-automatic-tags",
  ).checked;
  element("clear-tag-search").hidden = !queryInput.value;

  visibleTagRows = currentTagRows.filter((entry) => {
    if (hideAutomatic && entry.kind === "automatic") return false;
    return !query || normalize(entry.label).includes(query);
  });
  tagVirtualList.setItems(visibleTagRows);
  const total = currentTagRows.length;
  element("tag-list-status").textContent = translate("tagStatus", {
    visible: visibleTagRows.length,
    total,
  });
}

function renderTagRow(entry: TagListEntry): HTMLElement {
  const row = document.createElement("div");
  row.className = "tag-row";
  row.setAttribute("role", "option");
  row.setAttribute(
    "aria-selected",
    String(scopesEqual(entry.scope, currentScope)),
  );
  row.title = entry.label;

  const dot = document.createElement("span");
  dot.className = `tag-dot ${entry.kind}`;
  const name = document.createElement("span");
  name.className = "tag-name";
  name.textContent = entry.label;
  const count = document.createElement("span");
  count.className = "tag-count";
  count.textContent = String(entry.count);
  row.append(dot, name, count);
  row.addEventListener("click", () => {
    if (scopesEqual(entry.scope, currentScope)) {
      enterLibrarySearch();
    } else {
      void selectScope(entry.scope);
    }
  });
  row.addEventListener("contextmenu", (event) => {
    if (entry.scope.kind !== "tag" || !isCurrentLibraryEditable()) return;
    const tagName = entry.scope.tagName;
    const source = overview?.tags.find((tag) => tag.name === tagName);
    if (!source) return;
    event.preventDefault();
    const mouseEvent = event as MouseEvent;
    openTagActionsMenu(source, mouseEvent.clientX, mouseEvent.clientY);
  });
  if (scopesEqual(entry.scope, currentScope)) {
    row.title = `${entry.label}\n${translate("deselectTag")}`;
  }
  return row;
}

function selectedTagSummary(): TagSummary | null {
  const scope = currentScope;
  if (!overview || scope?.kind !== "tag") return null;
  return overview.tags.find((tag) => tag.name === scope.tagName) || null;
}

function updateTagActionButton(): void {
  const button = element<HTMLButtonElement>("tag-actions-button");
  const source = selectedTagSummary();
  button.disabled = !source || !isCurrentLibraryEditable();
  button.title = source
    ? `${translate("tagActions")}: ${source.name}`
    : translate("tagActions");
  button.setAttribute("aria-label", button.title);
}

function openTagActionsMenu(
  source: TagSummary,
  x: number,
  y: number,
  alignEnd = false,
): void {
  if (!isCurrentLibraryEditable()) {
    showToast(translate("readOnlyLibrary"), true);
    return;
  }
  const menu = element("tag-actions-menu");
  tagActionSource = source;
  menu.hidden = false;
  const bounds = menu.getBoundingClientRect();
  const preferredLeft = alignEnd ? x - bounds.width : x;
  menu.style.left = `${Math.max(
    6,
    Math.min(preferredLeft, window.innerWidth - bounds.width - 6),
  )}px`;
  menu.style.top = `${Math.max(
    6,
    Math.min(y, window.innerHeight - bounds.height - 6),
  )}px`;
  window.setTimeout(
    () => (menu.querySelector("button") as HTMLButtonElement | null)?.focus(),
    0,
  );
}

function closeTagActionsMenu(): void {
  element("tag-actions-menu").hidden = true;
  tagActionSource = null;
}

function openTagActionDialog(mode: TagActionMode, source: TagSummary): void {
  closeTagActionsMenu();
  tagActionMode = mode;
  tagActionSource = source;
  tagActionAutocompleteMatches = [];
  tagActionAutocompleteIndex = -1;

  const keys = {
    rename: {
      title: "renameTagTitle",
      description: "renameTagDescription",
      label: "newTagName",
      confirm: "confirmRename",
    },
    merge: {
      title: "mergeTagTitle",
      description: "mergeTagDescription",
      label: "mergeTarget",
      confirm: "confirmMerge",
    },
    delete: {
      title: "deleteTagTitle",
      description: "deleteTagDescription",
      label: "mergeTarget",
      confirm: "confirmDelete",
    },
  }[mode];

  element("tag-action-title").textContent = translate(keys.title);
  element("tag-action-description").textContent = translate(keys.description, {
    tag: source.name,
    count: source.count.toLocaleString(language),
  });
  element("tag-action-target-label").textContent = translate(keys.label);
  const field = element("tag-action-target-field");
  field.hidden = mode === "delete";
  const input = element<HTMLInputElement>("tag-action-target");
  input.value = mode === "rename" ? source.name : "";
  input.placeholder =
    mode === "merge" ? translate("mergeTargetPlaceholder") : "";
  const confirm = element<HTMLButtonElement>("tag-action-confirm");
  confirm.textContent = translate(keys.confirm);
  confirm.classList.toggle("danger", mode === "delete");
  confirm.disabled = false;
  element<HTMLButtonElement>("tag-action-cancel").disabled = false;
  element<HTMLButtonElement>("tag-action-close").disabled = false;
  element("tag-action-error").hidden = true;
  element("tag-action-autocomplete").hidden = true;

  const dialog = element<HTMLDialogElement>("tag-action-dialog");
  if (!dialog.open) dialog.showModal();
  if (mode !== "delete") {
    window.setTimeout(() => {
      input.focus();
      if (mode === "rename") input.select();
    }, 0);
  } else {
    confirm.focus();
  }
}

function closeTagActionDialog(): void {
  const dialog = element<HTMLDialogElement>("tag-action-dialog");
  if (dialog.open) dialog.close();
  tagActionMode = null;
  tagActionSource = null;
  tagActionAutocompleteMatches = [];
  tagActionAutocompleteIndex = -1;
  element("tag-action-autocomplete").hidden = true;
}

function updateTagActionAutocomplete(): void {
  if (tagActionMode !== "merge" || !overview || !tagActionSource) {
    element("tag-action-autocomplete").hidden = true;
    return;
  }
  const query = normalize(element<HTMLInputElement>("tag-action-target").value);
  if (!query) {
    element("tag-action-autocomplete").hidden = true;
    return;
  }
  tagActionAutocompleteMatches = overview.tags
    .filter(
      (tag) =>
        tag.name !== tagActionSource?.name &&
        normalize(tag.name).includes(query),
    )
    .slice(0, 8);
  tagActionAutocompleteIndex = -1;
  renderTagActionAutocomplete();
}

function renderTagActionAutocomplete(): void {
  const menu = element("tag-action-autocomplete");
  if (!tagActionAutocompleteMatches.length) {
    menu.hidden = true;
    return;
  }
  const fragment = document.createDocumentFragment();
  tagActionAutocompleteMatches.forEach((tag, index) => {
    const option = document.createElement("div");
    option.className = "autocomplete-option";
    option.setAttribute("role", "option");
    option.setAttribute(
      "aria-selected",
      String(index === tagActionAutocompleteIndex),
    );
    option.textContent = tag.name;
    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.addEventListener("click", () => {
      element<HTMLInputElement>("tag-action-target").value = tag.name;
      menu.hidden = true;
    });
    fragment.appendChild(option);
  });
  menu.replaceChildren(fragment);
  menu.hidden = false;
}

function handleTagActionAutocompleteKey(event: KeyboardEvent): void {
  if (event.key === "ArrowDown" && tagActionAutocompleteMatches.length) {
    event.preventDefault();
    tagActionAutocompleteIndex = Math.min(
      tagActionAutocompleteIndex + 1,
      tagActionAutocompleteMatches.length - 1,
    );
    renderTagActionAutocomplete();
  } else if (event.key === "ArrowUp" && tagActionAutocompleteMatches.length) {
    event.preventDefault();
    tagActionAutocompleteIndex = Math.max(tagActionAutocompleteIndex - 1, 0);
    renderTagActionAutocomplete();
  } else if (event.key === "Enter" && tagActionAutocompleteIndex >= 0) {
    event.preventDefault();
    const match = tagActionAutocompleteMatches[tagActionAutocompleteIndex];
    if (match) {
      element<HTMLInputElement>("tag-action-target").value = match.name;
      element("tag-action-autocomplete").hidden = true;
    }
  } else if (event.key === "Escape") {
    element("tag-action-autocomplete").hidden = true;
  }
}

async function submitTagAction(): Promise<void> {
  if (!api || !tagActionMode || !tagActionSource) return;
  const mode = tagActionMode;
  const source = tagActionSource;
  const target = element<HTMLInputElement>("tag-action-target").value.trim();
  const confirm = element<HTMLButtonElement>("tag-action-confirm");
  const cancel = element<HTMLButtonElement>("tag-action-cancel");
  const close = element<HTMLButtonElement>("tag-action-close");
  const errorLabel = element("tag-action-error");
  errorLabel.hidden = true;
  confirm.disabled = true;
  cancel.disabled = true;
  close.disabled = true;
  element("tag-action-form").setAttribute("aria-busy", "true");

  let result: TagMutationResult;
  try {
    suppressNotificationsUntil = Date.now() + 2500;
    if (mode === "rename") {
      result = await api.renameTag(currentLibraryID, source.name, target);
    } else if (mode === "merge") {
      result = await api.mergeTags(currentLibraryID, source.name, target);
    } else {
      result = await api.deleteTag(currentLibraryID, source.name);
    }
  } catch (error) {
    errorLabel.textContent = friendlyError(error);
    errorLabel.hidden = false;
    confirm.disabled = false;
    cancel.disabled = false;
    close.disabled = false;
    return;
  } finally {
    element("tag-action-form").setAttribute("aria-busy", "false");
  }

  closeTagActionDialog();
  try {
    await refreshAfterBulkTagMutation(result);
  } catch (error) {
    showError(error, refreshCurrentView);
  }
}

async function refreshAfterBulkTagMutation(
  result: TagMutationResult,
): Promise<void> {
  if (!api) return;
  api.invalidate();
  overview = await api.getTagOverview(currentLibraryID);
  updateTagRows();

  if (result.action === "delete" || !result.targetName) {
    enterLibrarySearch();
    showToast(
      translate("libraryTagDeleted", {
        tag: result.sourceName,
        count: result.affectedItems.toLocaleString(language),
      }),
    );
    return;
  }

  await selectScope({ kind: "tag", tagName: result.targetName });
  showToast(
    translate(result.action === "merge" ? "tagsMerged" : "tagRenamed", {
      source: result.sourceName,
      target: result.targetName,
      count: result.affectedItems.toLocaleString(language),
    }),
  );
}

async function selectScope(scope: ItemScope): Promise<void> {
  if (!api || !overview) return;
  const token = ++itemLoadToken;
  currentScope = scope;
  selectedItemID = null;
  selectedDetails = null;
  allItems = [];
  visibleItems = [];
  resetInspector();
  closeTagActionsMenu();
  tagVirtualList.refresh();
  resetFilters();
  setItemSearchMode(false);
  updateTagActionButton();
  setItemControlsEnabled(false);
  showItemsEmpty("loadingItems", "");
  element("results-title").textContent = scopeLabel(scope);
  element("results-count").textContent = "…";
  element("items-status").textContent = translate("loadingItems");
  hideError();

  try {
    const items = await api.getItems(currentLibraryID, scope);
    if (token !== itemLoadToken) return;
    allItems = items;
    populateItemFilterOptions();
    setItemControlsEnabled(true);
    applyItemFilters();
  } catch (error) {
    if (token === itemLoadToken) {
      showError(error, () => selectScope(scope));
      showItemsEmpty("emptyTagTitle", "emptyTagBody");
    }
  }
}

function enterLibrarySearch(): void {
  window.clearTimeout(librarySearchTimer);
  ++itemLoadToken;
  ++detailLoadToken;
  currentScope = null;
  librarySearchQuery = "";
  librarySearchTotal = 0;
  librarySearchLimited = false;
  selectedItemID = null;
  selectedDetails = null;
  allItems = [];
  visibleItems = [];
  resetInspector();
  resetFilters();
  setItemSearchMode(true);
  setItemControlsEnabled(false);
  element<HTMLInputElement>("item-search").disabled = false;
  element("results-title").textContent = translate("allLibrary");
  element("results-count").textContent = "0";
  element("items-status").textContent = overview
    ? translate("libraryItemCount", {
        count: overview.totalItems.toLocaleString(language),
      })
    : "";
  showItemsEmpty("searchLibraryTitle", "searchLibraryBody");
  itemVirtualList.setItems([]);
  tagVirtualList.refresh();
  closeTagActionsMenu();
  updateTagActionButton();
}

function setItemSearchMode(global: boolean): void {
  const input = element<HTMLInputElement>("item-search");
  const label = translate(global ? "searchLibrary" : "searchItems");
  input.placeholder = label;
  input.setAttribute("aria-label", label);
}

function scopeLabel(scope: ItemScope): string {
  return scope.kind === "untagged" ? translate("untagged") : scope.tagName;
}

function scopesEqual(left: ItemScope, right: ItemScope | null): boolean {
  if (!right || left.kind !== right.kind) return false;
  return (
    left.kind === "untagged" ||
    (right.kind === "tag" && left.tagName === right.tagName)
  );
}

function populateItemFilterOptions(): void {
  const authorSelect = element<HTMLSelectElement>("author-filter");
  const tagSelect = element<HTMLSelectElement>("second-tag-filter");
  const authors = new Set<string>();
  const tags = new Set<string>();

  for (const item of allItems) {
    item.creators.forEach((creator) => authors.add(creator));
    item.tags.forEach((tag) => {
      if (currentScope?.kind !== "tag" || tag.name !== currentScope.tagName) {
        tags.add(tag.name);
      }
    });
  }

  authorSelect.replaceChildren(createOption("", translate("allAuthors")));
  Array.from(authors)
    .sort((a, b) => a.localeCompare(b, language))
    .forEach((author) =>
      authorSelect.appendChild(createOption(author, author)),
    );

  tagSelect.replaceChildren(createOption("", translate("anyTag")));
  Array.from(tags)
    .sort((a, b) => a.localeCompare(b, language))
    .forEach((tag) => tagSelect.appendChild(createOption(tag, tag)));
}

function createOption(value: string, label: string): HTMLOptionElement {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function handleItemSearchInput(): void {
  const input = element<HTMLInputElement>("item-search");
  input.parentElement
    ?.querySelector("button")
    ?.toggleAttribute("hidden", !input.value);
  updateActiveFilterCount();

  if (currentScope) {
    applyItemFilters();
    return;
  }

  window.clearTimeout(librarySearchTimer);
  ++itemLoadToken;
  const query = input.value.trim();
  if (!query) {
    librarySearchQuery = "";
    librarySearchTotal = 0;
    librarySearchLimited = false;
    allItems = [];
    visibleItems = [];
    selectedItemID = null;
    resetInspector();
    setResultFilterControlsEnabled(false);
    element("results-count").textContent = "0";
    element("items-status").textContent = overview
      ? translate("libraryItemCount", {
          count: overview.totalItems.toLocaleString(language),
        })
      : "";
    showItemsEmpty("searchLibraryTitle", "searchLibraryBody");
    itemVirtualList.setItems([]);
    return;
  }

  element("results-count").textContent = "…";
  element("items-status").textContent = translate("searchingLibrary");
  setResultFilterControlsEnabled(false);
  showItemsEmpty("searchingLibrary", "");
  librarySearchTimer = window.setTimeout(
    () => void searchWholeLibrary(query),
    250,
  );
}

async function searchWholeLibrary(
  query: string,
  preserveItemID: number | null = null,
): Promise<void> {
  if (!api || currentScope) return;
  const token = ++itemLoadToken;
  librarySearchQuery = query;
  selectedItemID = preserveItemID;
  if (!preserveItemID) resetInspector();
  hideError();

  try {
    const result = await api.searchLibrary(currentLibraryID, query);
    if (
      token !== itemLoadToken ||
      currentScope ||
      element<HTMLInputElement>("item-search").value.trim() !== query
    ) {
      return;
    }
    allItems = result.items;
    librarySearchTotal = result.total;
    librarySearchLimited = result.limited;
    populateItemFilterOptions();
    setResultFilterControlsEnabled(allItems.length > 0);
    applyItemFilters();

    if (preserveItemID && allItems.some((item) => item.id === preserveItemID)) {
      await selectItem(preserveItemID);
    } else if (preserveItemID) {
      selectedItemID = null;
      resetInspector();
    }
  } catch (error) {
    if (token !== itemLoadToken) return;
    showError(error, () => searchWholeLibrary(query, preserveItemID));
    showItemsEmpty("noItemsTitle", "noItemsBody");
  }
}

function applyItemFilters(): void {
  if (!currentScope && !librarySearchQuery) return;
  const searchInput = element<HTMLInputElement>("item-search");
  const query = normalize(searchInput.value);
  const author = element<HTMLSelectElement>("author-filter").value;
  const secondTag = element<HTMLSelectElement>("second-tag-filter").value;
  const minimum = numberOrNull(element<HTMLInputElement>("year-min").value);
  const maximum = numberOrNull(element<HTMLInputElement>("year-max").value);
  const hasPDF = element<HTMLInputElement>("filter-has-pdf").checked;
  const hasNotes = element<HTMLInputElement>("filter-has-notes").checked;

  visibleItems = allItems.filter((item) => {
    if (query && currentScope) {
      const haystack = normalize(
        `${item.title}\n${item.abstract}\n${item.creatorSearch}\n${item.citekey}`,
      );
      if (!haystack.includes(query)) return false;
    }
    if (author && !item.creators.includes(author)) return false;
    if (secondTag && !item.tags.some((tag) => tag.name === secondTag))
      return false;
    if (minimum !== null && (item.year === null || item.year < minimum))
      return false;
    if (maximum !== null && (item.year === null || item.year > maximum))
      return false;
    if (hasPDF && !item.hasPDF) return false;
    if (hasNotes && item.noteCount === 0) return false;
    return true;
  });

  sortVisibleItems();
  updateActiveFilterCount();
  searchInput.parentElement
    ?.querySelector("button")
    ?.toggleAttribute("hidden", !searchInput.value);
  if (currentScope) {
    element("results-count").textContent = String(visibleItems.length);
    element("items-status").textContent = translate("itemStatus", {
      visible: visibleItems.length,
      total: allItems.length,
    });
  } else {
    element("results-count").textContent =
      librarySearchTotal.toLocaleString(language);
    element("items-status").textContent = translate(
      librarySearchLimited
        ? "librarySearchLimitedStatus"
        : "librarySearchStatus",
      {
        visible: visibleItems.length,
        shown: allItems.length,
        total: librarySearchTotal.toLocaleString(language),
      },
    );
  }

  if (!visibleItems.length) {
    if (allItems.length || !currentScope) {
      showItemsEmpty("noItemsTitle", "noItemsBody");
    } else {
      showItemsEmpty("emptyTagTitle", "emptyTagBody");
    }
    itemVirtualList.setItems([]);
    return;
  }

  element("items-empty").hidden = true;
  element("items-table").hidden = false;
  itemVirtualList.setItems(visibleItems);
  updateSortHeaders();
}

function sortVisibleItems(): void {
  visibleItems.sort((left, right) =>
    compareItemSummaries(left, right, sortKey, sortDirection, language),
  );
}

function setSort(nextKey: ItemSortKey): void {
  if (sortKey === nextKey) {
    sortDirection = sortDirection === "ascending" ? "descending" : "ascending";
  } else {
    sortKey = nextKey;
    sortDirection = "ascending";
  }
  applyItemFilters();
}

function updateSortHeaders(): void {
  document
    .querySelectorAll<HTMLElement>(".column-header[data-column]")
    .forEach((header: HTMLElement) => {
      if (header.dataset.column === sortKey) {
        header.setAttribute("aria-sort", sortDirection);
      } else {
        header.removeAttribute("aria-sort");
      }
    });
}

function createTimestampCell(
  value: string,
  className: string,
): HTMLSpanElement {
  const cell = document.createElement("span");
  cell.className = className;
  cell.setAttribute("role", "cell");
  if (!value) return cell;

  const formatted = formatItemTimestamp(value, bootstrap?.locale || language);
  cell.textContent = formatted.display;
  cell.title = formatted.tooltip;
  return cell;
}

function renderItemRow(item: ItemSummary): HTMLElement {
  const row = document.createElement("div");
  row.className = "item-row";
  row.setAttribute("role", "row");
  row.setAttribute("aria-selected", String(item.id === selectedItemID));
  row.dataset.itemId = String(item.id);

  const typeCell = document.createElement("span");
  typeCell.className = "type-column";
  typeCell.setAttribute("role", "cell");
  const typeIcon = createIcon(item.iconURI, "item-type-icon");
  typeIcon.title = item.itemTypeLabel;
  typeCell.appendChild(typeIcon);

  const titleCell = document.createElement("span");
  titleCell.className = "title-column";
  titleCell.setAttribute("role", "cell");
  titleCell.textContent = item.title || translate("untitled");
  titleCell.title = item.title || translate("untitled");

  const creatorCell = document.createElement("span");
  creatorCell.className = "creator-column";
  creatorCell.setAttribute("role", "cell");
  creatorCell.textContent = item.firstCreator || translate("unknownCreator");
  creatorCell.title = item.creators.join(", ");

  const yearCell = document.createElement("span");
  yearCell.className = "year-column";
  yearCell.setAttribute("role", "cell");
  yearCell.textContent = item.year ? String(item.year) : "";

  const dateAddedCell = createTimestampCell(
    item.dateAdded,
    "date-added-column",
  );
  const dateModifiedCell = createTimestampCell(
    item.dateModified,
    "date-modified-column",
  );

  const stateCell = document.createElement("span");
  stateCell.className = "state-column row-state-icons";
  stateCell.setAttribute("role", "cell");
  if (item.hasPDF) {
    const icon = createIcon("chrome://zotero/skin/16/universal/attachment.svg");
    icon.title = translate("hasPDF");
    stateCell.appendChild(icon);
  }
  if (item.noteCount) {
    const icon = createIcon("chrome://zotero/skin/16/universal/note.svg");
    icon.title = `${translate("hasNotes")}: ${item.noteCount}`;
    stateCell.appendChild(icon);
  }

  row.append(
    typeCell,
    titleCell,
    creatorCell,
    yearCell,
    dateAddedCell,
    dateModifiedCell,
    stateCell,
  );
  row.addEventListener("click", () => void selectItem(item.id));
  return row;
}

async function selectItem(itemID: number): Promise<void> {
  if (!api) return;
  selectedItemID = itemID;
  selectedDetails = null;
  itemVirtualList.refresh();
  setInspectorOpen(true, false);
  showInspectorLoading();

  const token = ++detailLoadToken;
  try {
    const details = await api.getItemDetails(itemID);
    if (token !== detailLoadToken || selectedItemID !== itemID) return;
    selectedDetails = details;
    renderInspector(details);
  } catch (error) {
    if (token === detailLoadToken) showError(error);
  }
}

function showInspectorLoading(): void {
  element("inspector-empty").hidden = false;
  element("inspector-empty").querySelector("p")!.textContent =
    translate("loadingDetails");
  element("inspector-content").hidden = true;
}

function renderInspector(details: ItemDetails): void {
  element("inspector-empty").hidden = true;
  element("inspector-content").hidden = false;
  const icon = element<HTMLImageElement>("detail-type-icon");
  icon.src = details.iconURI;
  icon.title = details.itemTypeLabel;
  element("detail-title").textContent = details.title || translate("untitled");
  element("detail-byline").textContent = [
    details.creators.join(", ") || translate("unknownCreator"),
    details.date,
  ]
    .filter(Boolean)
    .join(" · ");
  setMetadata("detail-item-type", details.itemTypeLabel);
  setMetadata("detail-date", details.date);
  setMetadata("detail-publication", details.publicationTitle);
  setMetadata("detail-doi", details.doi);
  setMetadata("detail-citekey", details.citekey);
  element("detail-tag-count").textContent = String(details.tags.length);
  element<HTMLButtonElement>("open-attachment").disabled =
    details.attachmentCount === 0;
  renderItemTags(details);
  renderFrequentTags(details);
  const editable = isCurrentLibraryEditable();
  element<HTMLInputElement>("quick-tag-add").disabled = !editable;
  element<HTMLFormElement>("add-tag-form").querySelector("button")!.disabled =
    !editable;
}

function setMetadata(id: string, value: string): void {
  const target = element(id);
  target.textContent = value || translate("notAvailable");
  target.title = value || "";
}

function renderItemTags(details: ItemDetails): void {
  const container = element("detail-tags");
  const fragment = document.createDocumentFragment();
  const editable = isCurrentLibraryEditable();
  for (const tag of details.tags
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, language))) {
    const chip = document.createElement("span");
    chip.className = `tag-chip ${tag.type === 1 ? "automatic" : "manual"}`;
    const label = document.createElement("span");
    label.textContent = tag.name;
    label.title = tag.name;
    chip.appendChild(label);
    if (editable) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.title = `${translate("dismiss")}: ${tag.name}`;
      remove.setAttribute("aria-label", remove.title);
      remove.appendChild(
        createIcon("chrome://zotero/skin/16/universal/x-8.svg"),
      );
      remove.addEventListener("click", () => void removeSelectedTag(tag.name));
      chip.appendChild(remove);
    }
    fragment.appendChild(chip);
  }
  container.replaceChildren(fragment);
}

function renderFrequentTags(details: ItemDetails): void {
  const container = element("frequent-tags");
  if (!overview || !isCurrentLibraryEditable()) {
    container.replaceChildren();
    frequentTagCandidates = [];
    return;
  }

  const assigned = new Set(details.tags.map((tag) => tag.name));
  frequentTagCandidates = overview.tags
    .filter((tag) => tag.kind !== "automatic" && !assigned.has(tag.name))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, language))
    .slice(0, 5);
  const fragment = document.createDocumentFragment();
  frequentTagCandidates.forEach((tag, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "frequent-tag-button";
    button.title = tag.name;
    const key = document.createElement("kbd");
    key.textContent = `Ctrl+${index + 1}`;
    const label = document.createElement("span");
    label.textContent = tag.name;
    button.append(key, label);
    button.addEventListener("click", () => void addTag(tag.name));
    fragment.appendChild(button);
  });
  container.replaceChildren(fragment);
}

async function submitTagInput(): Promise<void> {
  const input = element<HTMLInputElement>("quick-tag-add");
  const tagName =
    autocompleteIndex >= 0 && autocompleteMatches[autocompleteIndex]
      ? autocompleteMatches[autocompleteIndex].name
      : input.value.trim();
  if (!tagName) return;
  await addTag(tagName);
}

async function addTag(tagName: string): Promise<void> {
  if (!api || !selectedItemID) return;
  if (!isCurrentLibraryEditable()) {
    showToast(translate("readOnlyLibrary"), true);
    return;
  }

  try {
    suppressNotificationsUntil = Date.now() + 1200;
    const details = await api.addTag(selectedItemID, tagName);
    selectedDetails = details;
    element<HTMLInputElement>("quick-tag-add").value = "";
    closeAutocomplete();
    renderInspector(details);
    showToast(translate("tagAdded", { tag: tagName }));
    await refreshAfterMutation();
  } catch (error) {
    showError(error);
  }
}

async function removeSelectedTag(tagName: string): Promise<void> {
  if (!api || !selectedItemID) return;
  try {
    suppressNotificationsUntil = Date.now() + 1200;
    const details = await api.removeTag(selectedItemID, tagName);
    selectedDetails = details;
    renderInspector(details);
    showToast(translate("tagRemoved", { tag: tagName }));
    await refreshAfterMutation();
  } catch (error) {
    showError(error);
  }
}

async function refreshAfterMutation(): Promise<void> {
  if (!api) return;
  const preserveID = selectedItemID;
  const savedScope = currentScope;
  const savedQuery = element<HTMLInputElement>("item-search").value.trim();
  api.invalidate();
  overview = await api.getTagOverview(currentLibraryID);
  updateTagRows();
  if (savedScope) {
    const items = await api.getItems(currentLibraryID, savedScope);
    allItems = items;
    populateItemFilterOptions();
    applyItemFilters();
    if (preserveID && items.some((item) => item.id === preserveID)) {
      await selectItem(preserveID);
    } else {
      selectedItemID = null;
      resetInspector();
    }
  } else if (savedQuery) {
    await searchWholeLibrary(savedQuery, preserveID);
  }
}

function updateTagAutocomplete(): void {
  if (!overview || !selectedDetails) return;
  const input = element<HTMLInputElement>("quick-tag-add");
  const query = normalize(input.value);
  if (!query) {
    closeAutocomplete();
    return;
  }

  const assigned = new Set(selectedDetails.tags.map((tag) => tag.name));
  autocompleteMatches = overview.tags
    .filter(
      (tag) => !assigned.has(tag.name) && normalize(tag.name).includes(query),
    )
    .slice(0, 8);
  autocompleteIndex = -1;
  renderAutocomplete();
}

function renderAutocomplete(): void {
  const menu = element("tag-autocomplete");
  if (!autocompleteMatches.length) {
    closeAutocomplete();
    return;
  }
  const fragment = document.createDocumentFragment();
  autocompleteMatches.forEach((tag, index) => {
    const option = document.createElement("div");
    option.className = "autocomplete-option";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(index === autocompleteIndex));
    option.textContent = tag.name;
    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.addEventListener("click", () => void addTag(tag.name));
    fragment.appendChild(option);
  });
  menu.replaceChildren(fragment);
  menu.hidden = false;
}

function closeAutocomplete(): void {
  autocompleteMatches = [];
  autocompleteIndex = -1;
  element("tag-autocomplete").hidden = true;
}

function handleAutocompleteKeyboard(event: KeyboardEvent): void {
  if (event.key === "ArrowDown" && autocompleteMatches.length) {
    event.preventDefault();
    autocompleteIndex = Math.min(
      autocompleteIndex + 1,
      autocompleteMatches.length - 1,
    );
    renderAutocomplete();
  } else if (event.key === "ArrowUp" && autocompleteMatches.length) {
    event.preventDefault();
    autocompleteIndex = Math.max(autocompleteIndex - 1, 0);
    renderAutocomplete();
  } else if (event.key === "Escape") {
    closeAutocomplete();
  }
}

async function copySelected(kind: CopyKind): Promise<void> {
  if (!api || !selectedItemID) return;
  const styleID = element<HTMLSelectElement>("citation-style").value;
  const useZettlrFormat =
    kind === "citekey" &&
    element<HTMLInputElement>("zettlr-citation-format").checked;
  try {
    await api.copyMetadata(selectedItemID, kind, styleID, useZettlrFormat);
    showToast(
      translate(
        kind === "citekey"
          ? useZettlrFormat
            ? "copiedZettlrCitation"
            : "copiedCitekey"
          : kind === "citation"
            ? "copiedCitation"
            : "copiedBibliography",
      ),
    );
  } catch (error) {
    showError(error);
  }
}

async function openSelectedAttachment(): Promise<void> {
  if (selectedItemID) await openAttachment(selectedItemID);
}

async function openAttachment(itemID: number): Promise<void> {
  if (!api) return;
  try {
    const opened = await api.openBestAttachment(itemID);
    if (!opened) showToast(translate("noAttachment"), true);
  } catch (error) {
    showError(error);
  }
}

function handleTagListKeyboard(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    enterLibrarySearch();
    return;
  }
  if (!visibleTagRows.length) return;
  let index = visibleTagRows.findIndex((entry) =>
    scopesEqual(entry.scope, currentScope),
  );
  if (event.key === "ArrowDown")
    index = Math.min(index + 1, visibleTagRows.length - 1);
  else if (event.key === "ArrowUp") index = Math.max(index - 1, 0);
  else if (event.key === "Home") index = 0;
  else if (event.key === "End") index = visibleTagRows.length - 1;
  else return;

  event.preventDefault();
  tagVirtualList.scrollToIndex(index);
  void selectScope(visibleTagRows[index].scope);
}

function handleItemListKeyboard(event: KeyboardEvent): void {
  if (!visibleItems.length) return;
  const activeIndex = visibleItems.findIndex(
    (item) => item.id === selectedItemID,
  );
  let nextIndex: number;
  if (event.key === "ArrowDown")
    nextIndex = Math.min(activeIndex + 1, visibleItems.length - 1);
  else if (event.key === "ArrowUp") nextIndex = Math.max(activeIndex - 1, 0);
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = visibleItems.length - 1;
  else return;

  event.preventDefault();
  itemVirtualList.scrollToIndex(nextIndex);
  void selectItem(visibleItems[nextIndex].id);
}

function handleGlobalKeyboard(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  const isEditing = target?.matches(
    "input, select, textarea, [contenteditable='true']",
  );

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
    event.preventDefault();
    const search = element<HTMLInputElement>("item-search");
    if (!search.disabled) {
      search.focus();
      search.select();
    }
    return;
  }

  if (!isEditing && event.key.toLocaleLowerCase() === "c" && selectedItemID) {
    event.preventDefault();
    void copySelected("citekey");
  }

  if (!isEditing && event.ctrlKey && /^[1-5]$/.test(event.key)) {
    const tag = frequentTagCandidates[Number(event.key) - 1];
    if (tag) {
      event.preventDefault();
      void addTag(tag.name);
    }
  }

  if (event.key === "Escape") {
    closeAutocomplete();
    closeTagActionsMenu();
  }
}

function toggleFilters(): void {
  const bar = element("filters-bar");
  const button = element("filters-toggle");
  bar.hidden = !bar.hidden;
  button.setAttribute("aria-expanded", String(!bar.hidden));
}

function resetFilters(): void {
  element<HTMLInputElement>("item-search").value = "";
  element<HTMLSelectElement>("author-filter").value = "";
  element<HTMLSelectElement>("second-tag-filter").value = "";
  element<HTMLInputElement>("year-min").value = "";
  element<HTMLInputElement>("year-max").value = "";
  element<HTMLInputElement>("filter-has-pdf").checked = false;
  element<HTMLInputElement>("filter-has-notes").checked = false;
  updateActiveFilterCount();
}

function clearFilters(): void {
  resetFilters();
  if (currentScope) applyItemFilters();
  else handleItemSearchInput();
}

function updateActiveFilterCount(): void {
  const values = [
    element<HTMLInputElement>("item-search").value,
    element<HTMLSelectElement>("author-filter").value,
    element<HTMLSelectElement>("second-tag-filter").value,
    element<HTMLInputElement>("year-min").value,
    element<HTMLInputElement>("year-max").value,
  ];
  let count = values.filter(Boolean).length;
  if (element<HTMLInputElement>("filter-has-pdf").checked) count++;
  if (element<HTMLInputElement>("filter-has-notes").checked) count++;
  const badge = element("active-filter-count");
  badge.textContent = String(count);
  badge.hidden = count === 0;
  element<HTMLButtonElement>("clear-filters").disabled = count === 0;
}

function resetItemView(): void {
  element("results-title").textContent = translate("allLibrary");
  element("results-count").textContent = "0";
  element("items-status").textContent = "";
  setItemControlsEnabled(false);
  showItemsEmpty("searchLibraryTitle", "searchLibraryBody");
  itemVirtualList.setItems([]);
}

function showItemsEmpty(titleKey: string, bodyKey: string): void {
  const empty = element("items-empty");
  empty.hidden = false;
  element("items-table").hidden = true;
  const title = empty.querySelector("h2");
  const body = empty.querySelector("p");
  if (title) title.textContent = translate(titleKey);
  if (body) {
    body.textContent = bodyKey ? translate(bodyKey) : "";
    body.hidden = !bodyKey;
  }
}

function resetInspector(): void {
  selectedDetails = null;
  frequentTagCandidates = [];
  element("inspector-empty").hidden = false;
  element("inspector-empty").querySelector("p")!.textContent =
    translate("selectItem");
  element("inspector-content").hidden = true;
}

function setItemControlsEnabled(enabled: boolean): void {
  element<HTMLInputElement>("item-search").disabled = !enabled;
  setResultFilterControlsEnabled(enabled);
}

function setResultFilterControlsEnabled(enabled: boolean): void {
  for (const id of [
    "filters-toggle",
    "author-filter",
    "second-tag-filter",
    "year-min",
    "year-max",
    "filter-has-pdf",
    "filter-has-notes",
  ]) {
    (
      element(id) as HTMLInputElement | HTMLSelectElement | HTMLButtonElement
    ).disabled = !enabled;
  }
  if (!enabled) element<HTMLButtonElement>("clear-filters").disabled = true;
  else updateActiveFilterCount();
}

function setInspectorOpen(open: boolean, persist: boolean): void {
  const app = element("app");
  app.classList.toggle("inspector-closed", !open);
  element("inspector-toggle").setAttribute("aria-pressed", String(open));
  if (persist) api?.savePreferences({ inspectorOpen: open });
}

function isCurrentLibraryEditable(): boolean {
  return (
    bootstrap?.libraries.find((library) => library.id === currentLibraryID)
      ?.editable ?? false
  );
}

function setLoading(loading: boolean, messageKey = "loadingLibrary"): void {
  element("app").setAttribute("aria-busy", String(loading));
  const overlay = element("loading-overlay");
  overlay.hidden = !loading;
  const label = overlay.querySelector("span:last-child");
  if (label) label.textContent = translate(messageKey);
}

async function refreshCurrentView(): Promise<void> {
  if (!api || !currentLibraryID) return;
  const savedScope = currentScope;
  const savedSelectedID = selectedItemID;
  const savedQuery = element<HTMLInputElement>("item-search").value.trim();
  setLoading(true, "loadingLibrary");
  hideError();
  try {
    api.invalidate();
    overview = await api.getTagOverview(currentLibraryID);
    updateTagRows();
    if (savedScope) {
      allItems = await api.getItems(currentLibraryID, savedScope);
      currentScope = savedScope;
      populateItemFilterOptions();
      applyItemFilters();
      if (
        savedSelectedID &&
        allItems.some((item) => item.id === savedSelectedID)
      ) {
        await selectItem(savedSelectedID);
      }
    } else if (savedQuery) {
      currentScope = null;
      await searchWholeLibrary(savedQuery, savedSelectedID);
    } else {
      enterLibrarySearch();
    }
  } catch (error) {
    showError(error, refreshCurrentView);
  } finally {
    setLoading(false);
  }
}

function scheduleExternalRefresh(): void {
  if (Date.now() < suppressNotificationsUntil) return;
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => void refreshCurrentView(), 450);
}

function showFatalError(error: unknown): void {
  setLoading(false);
  showError(error, init);
}

function showError(error: unknown, retry?: () => Promise<void>): void {
  const banner = element("error-banner");
  element("error-message").textContent = friendlyError(error);
  retryAction = retry || null;
  element("error-retry").hidden = !retry;
  banner.hidden = false;
}

function hideError(): void {
  element("error-banner").hidden = true;
  retryAction = null;
}

function friendlyError(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  const mappings: Record<string, string> = {
    DATABASE_QUERY_RETURNED_NO_ROWS_ARRAY: "errorDatabase",
    LIBRARY_NOT_FOUND: "errorLibrary",
    ITEM_NOT_FOUND: "errorItem",
    LIBRARY_READ_ONLY: "readOnlyLibrary",
    NO_CITEKEY: "noCitekey",
    INVALID_CITATION_STYLE: "invalidCitationStyle",
    COPY_INTERFACE_UNAVAILABLE: "errorCopy",
    ZETTLR_CONFIG_UNAVAILABLE: "errorZettlrConfig",
    MAIN_WINDOW_UNAVAILABLE: "errorCopy",
    EMPTY_TAG: "errorEmptyTag",
    TAG_TOO_LONG: "errorLongTag",
    TAG_NOT_FOUND: "errorTagNotFound",
    TAG_ALREADY_EXISTS: "errorTagExists",
    MERGE_TARGET_NOT_FOUND: "errorMergeTarget",
    TAG_NAMES_IDENTICAL: "errorSameTag",
  };
  return mappings[detail]
    ? translate(mappings[detail])
    : translate("errorGeneric", { detail });
}

function showToast(message: string, isError = false): void {
  const toast = element("toast");
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => void init(), {
    once: true,
  });
} else {
  void init();
}
