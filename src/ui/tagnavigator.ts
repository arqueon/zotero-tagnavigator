import type {
  AdvancedSearchCondition,
  CollectionOption,
  ColoredTagSlot,
  CopyKind,
  DoubleClickAction,
  InterfaceDensity,
  ItemColumnKey,
  ItemColumnWidths,
  ItemDetails,
  ItemScope,
  ItemSummary,
  NavigatorBootstrap,
  QuickSearchMode,
  SavedFilterPreset,
  SavedFiltersByLibrary,
  SavedSearchOption,
  SearchConditionDefinition,
  SearchJoinMode,
  TagMutationResult,
  TagNavigatorAPI,
  TagOverview,
  TagSummary,
  UnifiedItemQuery,
} from "../types/tagNavigator";
import {
  clampItemColumnWidth,
  completeItemColumnWidths,
  DEFAULT_ITEM_COLUMN_WIDTHS,
  DEFAULT_VISIBLE_ITEM_COLUMNS,
  getItemColumnLimits,
  ITEM_COLUMN_KEYS,
  sanitizeVisibleItemColumns,
} from "../utils/itemColumns";
import { formatItemTimestamp, isItemTimestampInRange } from "../utils/itemDate";
import {
  compareItemSummaries,
  type ItemSortDirection,
  type ItemSortKey,
} from "../utils/itemSort";
import {
  getContrastingTextColor,
  MAX_COLORED_TAG_SLOTS,
  normalizeHexColor,
  ZOTERO_TAG_PALETTE,
} from "../utils/tagColor";
import {
  hasTagNavigatorTagDrag,
  hasZoteroItemDrag,
  parseZoteroItemDrop,
  serializeZoteroItemDrag,
  TAGNAVIGATOR_TAG_DRAG_TYPE,
  ZOTERO_ITEM_DRAG_TYPE,
} from "../utils/zoteroDrag";

// The plugin sandbox typings intentionally omit browser globals, while this
// entry point runs inside the standalone chrome HTML window.
declare const window: WindowProxy;
declare const document: Document;

type TagActionMode =
  "rename" | "merge" | "delete" | "convertToManual" | "removeAllAutomatic";

type TagKindFilter = "all" | "manual" | "automatic" | "colored" | "single";
type TagSortMode = "name" | "count" | "color";
type SaveQueryMode = "view" | "zoteroSearch";

type TagListEntry = {
  key: string;
  label: string;
  count: number;
  kind: "manual" | "automatic" | "mixed" | "untagged";
  color?: string;
  colorPosition?: number;
  scope: ItemScope;
};

type TranslationValue = string;
type TranslationTable = Record<string, TranslationValue>;

const APA_STYLE_ID = "http://www.zotero.org/styles/apa";
const DEFAULT_LEFT_PANE_WIDTH = 276;
const DEFAULT_RIGHT_PANE_WIDTH = 328;

const TRANSLATIONS: Record<"en" | "es", TranslationTable> = {
  en: {
    library: "Library",
    collectionOrSearch: "Collection or Saved Search",
    allItemsScope: "All items",
    unfiledItemsScope: "Unfiled items",
    collectionsGroup: "Collections",
    savedSearchesGroup: "Saved Searches",
    refresh: "Refresh",
    toggleTagPane: "Toggle tag pane",
    toggleDensity: "Toggle compact / comfortable density",
    keyboardShortcuts: "Keyboard & pointer shortcuts",
    toggleInspector: "Toggle item pane",
    closeInspector: "Close item pane",
    resizePane: "Drag to resize pane · Double-click to reset",
    dismiss: "Close",
    retry: "Retry",
    tags: "Tags",
    tagCurationTools: "Tag curation tools",
    tagFilterAll: "All",
    tagFilterAuto: "Auto",
    tagFilterColored: "Colored",
    tagFilterSingle: "1×",
    sortTags: "Sort tags",
    sortName: "A–Z",
    sortCount: "Count",
    sortColor: "Color",
    searchTags: "Search tags",
    searchItems: "Filter items…",
    clearSearch: "Clear search",
    hideAutomatic: "Hide automatic tags",
    manual: "Manual",
    automatic: "Automatic",
    mixed: "Manual and automatic",
    selectTag: "Select a tag",
    allLibrary: "All library",
    recentItems: "Recently modified",
    recentItemsStatus: "{visible} visible · {shown} loaded of {total} items",
    deselectTag:
      "Click again to clear · Ctrl+Click for AND · Alt+Click for NOT",
    booleanTagHint: "Click: select · Ctrl+Click: AND (+) · Alt+Click: NOT (−)",
    dropTagHint: "Drop items to add tag · Hold Alt while dropping to remove",
    dropTagApplied: "Added “{tag}” to {count} items",
    dropTagRemoved: "Removed “{tag}” from {count} items",
    quickSearchMode: "Quick search mode",
    quickSearchFields: "Fields & Tags",
    quickSearchTitleCreatorYear: "Title, Creator, Year",
    quickSearchEverything: "Everything",
    advancedSearch: "Advanced",
    matchConditions: "Match",
    matchAll: "all (AND)",
    matchAny: "any (OR)",
    includeSubcollections: "Include subcollections",
    addCondition: "+ Condition",
    clearConditions: "Reset",
    saveViewEllipsis: "Save view…",
    saveZoteroSearchEllipsis: "Save Zotero Search…",
    runSearch: "Search",
    removeCondition: "Remove condition",
    clearAllFilters: "Clear all",
    columnsMenu: "Visible columns",
    loadMoreItems: "Load more",
    loadMoreItemsCount: "Load more (+{count})",
    loadAllItems: "Load all ({total})",
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
    savedFilters: "Saved views",
    saveView: "Save view",
    deleteView: "Delete view",
    save: "Save",
    savedFilterName: "Saved view name",
    saveViewDescription:
      "Save the active tags, scope, search conditions, and quick filters in Tag Navigator.",
    saveZoteroSearchTitle: "Save Zotero Saved Search",
    saveZoteroSearchName: "Saved Search name",
    saveZoteroSearchDescription:
      "Create a native Zotero Saved Search in this library from the active query.",
    savedFilterSaved: "Saved view: {name}",
    zoteroSearchSaved: "Saved Zotero Search: {name}",
    savedFilterDeleted: "Deleted saved view: {name}",
    savedFilterMissingTag:
      "This saved view references a tag that no longer exists: {tag}",
    searchLibrary: "Search library…",
    searchingLibrary: "Searching library…",
    librarySearchStatus: "{visible} visible of {total} matches",
    librarySearchLimitedStatus:
      "{visible} visible · {shown} loaded of {total} matches",
    chooseTagTitle: "Choose a tag or run a search",
    chooseTagBody:
      "Combine tags (AND / NOT), collections, quick search, or Zotero Advanced Search.",
    noItemsTitle: "No matching items",
    noItemsBody: "Change or clear one of the active filters.",
    emptyTagTitle: "This tag has no items",
    emptyTagBody: "The library may have changed since the tag list was loaded.",
    title: "Title",
    creator: "Creator",
    year: "Year",
    publication: "Publication",
    itemType: "Item type",
    citekey: "CiteKey",
    dateAdded: "Date Added",
    dateModified: "Date Modified",
    dateAddedRange: "Date Added · From → To",
    dateModifiedRange: "Date Modified · From → To",
    resizeColumn: "Drag to resize · Double-click to reset",
    resizeColumnLabel: "Resize {column} column",
    filesAndNotes: "Files and notes",
    selectAllVisible: "Select all visible items",
    selectItemCheckbox: "Select {title}",
    itemDetails: "Item details",
    selectItem: "Select an item to inspect it.",
    selectedItems: "{count} items selected",
    batchEditing: "Batch editing",
    batchTags: "Batch tags",
    showInZotero: "Open in Zotero",
    openFile: "Open file",
    abstract: "Abstract",
    info: "Info",
    date: "Date",
    collections: "Collections",
    addTag: "Add tag",
    coloredTagsShortcut: "Colored tags (1–9)",
    frequentTags: "Frequent tags",
    quickCopy: "Quick Copy",
    citationStyle: "Citation style",
    zettlrCitationFormat: "Zettlr citation format",
    zettlrFormatHint: "CiteKey will be copied as {format}",
    zettlrConfigUnavailable: "Zettlr configuration not found",
    copyCitekeyAction: "Copy CiteKey",
    copyCitation: "Copy citation",
    copyBibliography: "Copy bibliography",
    copyAPA: "Copy APA references",
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
    copiedCitekey: "CiteKey copied",
    copiedZettlrCitation: "Zettlr citation copied",
    copiedCitation: "Citation copied",
    copiedBibliography: "Bibliography copied",
    copiedAPA: "APA references copied",
    copiedItems: "Copied {count} items",
    copiedCitekeysWithMissing:
      "Copied {count} CiteKeys; {missing} selected items had no CiteKey",
    tagAdded: "Tag added: {tag}",
    tagRemoved: "Tag removed: {tag}",
    batchTagAdded: "Added “{tag}” to {count} items",
    batchTagRemoved: "Removed “{tag}” from {count} items",
    tagActions: "Tag actions",
    filterIncludeTag: "Filter with AND (+)",
    filterExcludeTag: "Exclude with NOT (−)",
    assignTagColor: "Assign / change color (1–9)…",
    removeTagColor: "Remove color",
    convertAutoToManual: "Convert automatic → manual…",
    showSingleUseTags: "Show single-use tags (1×)",
    showColoredTags: "Show colored tags",
    removeAllAutomaticTags: "Remove all automatic tags in library…",
    assignColorTitle: "Assign tag color",
    assignColorDescription:
      "Choose a color and shortcut slot (1–9) for “{tag}”.",
    customColorHex: "Color (Hex)",
    shortcutPosition: "Shortcut position (1–9)",
    slotFree: "{pos} — Available",
    slotCurrent: "{pos} — {tag} (current)",
    slotUsed: "{pos} — {tag}",
    saveColor: "Set color",
    tagColorSaved: "Assigned color #{pos} to “{tag}”",
    tagColorRemoved: "Removed color from “{tag}”",
    renameTag: "Rename tag…",
    mergeTag: "Merge into…",
    deleteTag: "Remove tag from library…",
    renameTagTitle: "Rename tag",
    mergeTagTitle: "Merge tags",
    deleteTagTitle: "Remove tag from library",
    convertAutoTitle: "Convert automatic tag to manual",
    removeAllAutoTitle: "Remove all automatic tags",
    renameTagDescription:
      "Rename “{tag}” across {count} items in this library.",
    mergeTagDescription:
      "Merge “{tag}” into an existing tag across {count} items. Zotero will resolve duplicate assignments.",
    deleteTagDescription:
      "Remove “{tag}” from {count} items in this library. No items or files will be deleted.",
    convertAutoDescription:
      "Convert automatic occurrences of “{tag}” ({count} items) into manual tags.",
    removeAllAutoDescription:
      "Remove all automatic (imported) tags across {count} tag entries in this library. Manual tags and items are kept.",
    newTagName: "New tag name",
    mergeTarget: "Existing destination tag",
    mergeTargetPlaceholder: "Search destination tags",
    cancel: "Cancel",
    confirmRename: "Rename",
    confirmMerge: "Merge tags",
    confirmDelete: "Remove tag",
    confirmConvertAuto: "Convert to manual",
    confirmRemoveAllAuto: "Remove automatic tags",
    tagRenamed: "Renamed “{source}” to “{target}” on {count} items",
    tagsMerged: "Merged “{source}” into “{target}” on {count} items",
    libraryTagDeleted: "Removed “{tag}” from {count} items",
    tagConvertedManual: "Converted “{tag}” to manual on {count} items",
    allAutoTagsRemoved: "Removed automatic tags from {count} items",
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
    errorEmptySearchName: "Enter a name first.",
    errorNoSearchConditions:
      "Add at least one tag, search term, collection, or condition first.",
    errorMaxColoredTags:
      "Zotero supports at most 9 colored tags per library. Remove a color from an existing slot first.",
    errorInvalidColor: "Enter a valid 6-digit hex color (e.g. #2ea8e5).",
    errorLongTag: "The tag is longer than Zotero allows.",
    errorTagNotFound: "The source tag is no longer present in this library.",
    errorTagExists:
      "That tag already exists in this library. Use Merge into instead.",
    errorMergeTarget: "Choose an existing destination tag from this library.",
    errorSameTag: "The source and destination tags must be different.",
    showingLibrary: "{name}",
    dragItemsBadge: "{count} items",
    op_is: "is",
    op_isNot: "is not",
    op_contains: "contains",
    op_doesNotContain: "does not contain",
    op_beginsWith: "begins with",
    op_isBefore: "is before",
    op_isAfter: "is after",
    op_isInTheLast: "is in the last",
    op_isLessThan: "is less than",
    op_isGreaterThan: "is greater than",
    op_isEmpty: "is empty",
    op_isNotEmpty: "is not empty",
    op_true: "is true",
    op_false: "is false",
    sc_clickTag: "Select primary tag (click again to clear)",
    sc_ctrlClickTag: "Add / remove tag in boolean AND (+) filter",
    sc_altClickTag: "Exclude / unexclude tag with boolean NOT (−)",
    sc_dragItems: "Assign tag to dragged items (Alt+Drop removes tag)",
    sc_dragTag: "Assign dragged tag onto an item row or inspector",
    sc_numKeys: "Toggle colored tag slot 1–9 on selected items",
    sc_ctrlNumKeys: "Add frequent tag 1–5 to selected items",
    sc_copyKey: "Copy CiteKey (or Zettlr format) for selected items",
    sc_searchKey: "Focus quick search input",
    sc_doubleClick: "Open best attachment (configurable in Settings)",
  },
  es: {
    library: "Biblioteca",
    collectionOrSearch: "Colección o búsqueda guardada",
    allItemsScope: "Todos los elementos",
    unfiledItemsScope: "Elementos sin clasificar",
    collectionsGroup: "Colecciones",
    savedSearchesGroup: "Búsquedas guardadas",
    refresh: "Actualizar",
    toggleTagPane: "Mostrar u ocultar panel de etiquetas",
    toggleDensity: "Alternar densidad compacta o cómoda",
    keyboardShortcuts: "Atajos de teclado y ratón",
    toggleInspector: "Mostrar u ocultar panel de información",
    closeInspector: "Cerrar panel de información",
    resizePane: "Arrastra para redimensionar · Doble clic para restaurar",
    dismiss: "Cerrar",
    retry: "Reintentar",
    tags: "Etiquetas",
    tagCurationTools: "Herramientas de curación de etiquetas",
    tagFilterAll: "Todas",
    tagFilterAuto: "Auto",
    tagFilterColored: "Color",
    tagFilterSingle: "1×",
    sortTags: "Ordenar etiquetas",
    sortName: "A–Z",
    sortCount: "Uso",
    sortColor: "Color",
    searchTags: "Buscar etiquetas",
    searchItems: "Filtrar elementos…",
    clearSearch: "Borrar búsqueda",
    hideAutomatic: "Ocultar etiquetas automáticas",
    manual: "Manual",
    automatic: "Automática",
    mixed: "Manual y automática",
    selectTag: "Selecciona una etiqueta",
    allLibrary: "Toda la biblioteca",
    recentItems: "Modificados recientemente",
    recentItemsStatus:
      "{visible} visibles · {shown} cargados de {total} elementos",
    deselectTag:
      "Clic de nuevo para limpiar · Ctrl+Clic para Y · Alt+Clic para NO",
    booleanTagHint:
      "Clic: elegir · Ctrl+Clic: Y (+) · Alt+Clic: excluir NO (−)",
    dropTagHint:
      "Suelta elementos para etiquetar · Mantén Alt al soltar para quitar",
    dropTagApplied: "Se añadió «{tag}» a {count} elementos",
    dropTagRemoved: "Se quitó «{tag}» de {count} elementos",
    quickSearchMode: "Modo de búsqueda rápida",
    quickSearchFields: "Campos y etiquetas",
    quickSearchTitleCreatorYear: "Título, autor, año",
    quickSearchEverything: "Todo",
    advancedSearch: "Avanzada",
    matchConditions: "Cumplir",
    matchAll: "todas (AND)",
    matchAny: "cualquiera (OR)",
    includeSubcollections: "Incluir subcolecciones",
    addCondition: "+ Condición",
    clearConditions: "Reiniciar",
    saveViewEllipsis: "Guardar vista…",
    saveZoteroSearchEllipsis: "Guardar en Zotero…",
    runSearch: "Buscar",
    removeCondition: "Quitar condición",
    clearAllFilters: "Limpiar todo",
    columnsMenu: "Columnas visibles",
    loadMoreItems: "Cargar más",
    loadMoreItemsCount: "Cargar más (+{count})",
    loadAllItems: "Cargar todos ({total})",
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
    savedFilters: "Vistas guardadas",
    saveView: "Guardar vista",
    deleteView: "Eliminar vista",
    save: "Guardar",
    savedFilterName: "Nombre de la vista guardada",
    saveViewDescription:
      "Guarda en Tag Navigator las etiquetas, colección, condiciones y filtros rápidos activos.",
    saveZoteroSearchTitle: "Guardar búsqueda en Zotero",
    saveZoteroSearchName: "Nombre de la búsqueda guardada",
    saveZoteroSearchDescription:
      "Crea una búsqueda guardada nativa de Zotero en esta biblioteca con la consulta actual.",
    savedFilterSaved: "Vista guardada: {name}",
    zoteroSearchSaved: "Búsqueda guardada en Zotero: {name}",
    savedFilterDeleted: "Vista guardada eliminada: {name}",
    savedFilterMissingTag:
      "Esta vista guardada usa una etiqueta que ya no existe: {tag}",
    searchLibrary: "Buscar en la biblioteca…",
    searchingLibrary: "Buscando en la biblioteca…",
    librarySearchStatus: "{visible} visibles de {total} coincidencias",
    librarySearchLimitedStatus:
      "{visible} visibles · {shown} cargados de {total} coincidencias",
    chooseTagTitle: "Elige una etiqueta o ejecuta una búsqueda",
    chooseTagBody:
      "Combina etiquetas (AND / NOT), colecciones, búsqueda rápida o búsqueda avanzada de Zotero.",
    noItemsTitle: "No hay elementos coincidentes",
    noItemsBody: "Cambia o limpia alguno de los filtros activos.",
    emptyTagTitle: "Esta etiqueta no contiene elementos",
    emptyTagBody:
      "La biblioteca pudo cambiar desde que se cargó la lista de etiquetas.",
    title: "Título",
    creator: "Autor",
    year: "Año",
    publication: "Publicación",
    itemType: "Tipo de elemento",
    citekey: "CiteKey",
    dateAdded: "Fecha de añadido",
    dateModified: "Fecha de modificación",
    dateAddedRange: "Fecha de añadido · Desde → Hasta",
    dateModifiedRange: "Fecha de modificación · Desde → Hasta",
    resizeColumn: "Arrastra para ajustar · Doble clic para restaurar",
    resizeColumnLabel: "Ajustar columna {column}",
    filesAndNotes: "Archivos y notas",
    selectAllVisible: "Seleccionar todos los elementos visibles",
    selectItemCheckbox: "Seleccionar {title}",
    itemDetails: "Información del elemento",
    selectItem: "Selecciona un elemento para consultar su información.",
    selectedItems: "{count} elementos seleccionados",
    batchEditing: "Edición por lotes",
    batchTags: "Etiquetas por lotes",
    showInZotero: "Abrir en Zotero",
    openFile: "Abrir archivo",
    abstract: "Resumen",
    info: "Información",
    date: "Fecha",
    collections: "Colecciones",
    addTag: "Añadir etiqueta",
    coloredTagsShortcut: "Etiquetas de color (1–9)",
    frequentTags: "Etiquetas frecuentes",
    quickCopy: "Copiado rápido",
    citationStyle: "Estilo de cita",
    zettlrCitationFormat: "Formato de cita de Zettlr",
    zettlrFormatHint: "La CiteKey se copiará como {format}",
    zettlrConfigUnavailable: "No se encontró la configuración de Zettlr",
    copyCitekeyAction: "Copiar CiteKey",
    copyCitation: "Copiar cita",
    copyBibliography: "Copiar bibliografía",
    copyAPA: "Copiar referencias APA",
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
    copiedCitekey: "CiteKey copiada",
    copiedZettlrCitation: "Cita para Zettlr copiada",
    copiedCitation: "Cita copiada",
    copiedBibliography: "Bibliografía copiada",
    copiedAPA: "Referencias APA copiadas",
    copiedItems: "Se copiaron {count} elementos",
    copiedCitekeysWithMissing:
      "Se copiaron {count} CiteKeys; {missing} elementos seleccionados no tenían CiteKey",
    tagAdded: "Etiqueta añadida: {tag}",
    tagRemoved: "Etiqueta eliminada: {tag}",
    batchTagAdded: "Se añadió «{tag}» a {count} elementos",
    batchTagRemoved: "Se quitó «{tag}» de {count} elementos",
    tagActions: "Acciones de etiqueta",
    filterIncludeTag: "Filtrar con AND (+)",
    filterExcludeTag: "Excluir con NOT (−)",
    assignTagColor: "Asignar o cambiar color (1–9)…",
    removeTagColor: "Quitar color",
    convertAutoToManual: "Convertir automática → manual…",
    showSingleUseTags: "Ver etiquetas de un solo uso (1×)",
    showColoredTags: "Ver etiquetas con color",
    removeAllAutomaticTags:
      "Eliminar todas las etiquetas automáticas de la biblioteca…",
    assignColorTitle: "Asignar color de etiqueta",
    assignColorDescription:
      "Elige un color y posición rápida (1–9) para «{tag}».",
    customColorHex: "Color (Hex)",
    shortcutPosition: "Posición de atajo (1–9)",
    slotFree: "{pos} — Disponible",
    slotCurrent: "{pos} — {tag} (actual)",
    slotUsed: "{pos} — {tag}",
    saveColor: "Guardar color",
    tagColorSaved: "Se asignó el color #{pos} a «{tag}»",
    tagColorRemoved: "Se quitó el color de «{tag}»",
    renameTag: "Renombrar etiqueta…",
    mergeTag: "Fusionar con…",
    deleteTag: "Quitar etiqueta de la biblioteca…",
    renameTagTitle: "Renombrar etiqueta",
    mergeTagTitle: "Fusionar etiquetas",
    deleteTagTitle: "Quitar etiqueta de la biblioteca",
    convertAutoTitle: "Convertir etiqueta automática en manual",
    removeAllAutoTitle: "Eliminar todas las etiquetas automáticas",
    renameTagDescription:
      "Renombra «{tag}» en {count} elementos de esta biblioteca.",
    mergeTagDescription:
      "Fusiona «{tag}» con una etiqueta existente en {count} elementos. Zotero resolverá las asignaciones duplicadas.",
    deleteTagDescription:
      "Quita «{tag}» de {count} elementos de esta biblioteca. No se eliminarán elementos ni archivos.",
    convertAutoDescription:
      "Convierte las apariciones automáticas de «{tag}» ({count} elementos) en etiquetas manuales.",
    removeAllAutoDescription:
      "Elimina todas las etiquetas automáticas (importadas) en {count} entradas de esta biblioteca. Las etiquetas manuales y los elementos se conservan.",
    newTagName: "Nuevo nombre de etiqueta",
    mergeTarget: "Etiqueta de destino existente",
    mergeTargetPlaceholder: "Buscar etiquetas de destino",
    cancel: "Cancelar",
    confirmRename: "Renombrar",
    confirmMerge: "Fusionar etiquetas",
    confirmDelete: "Quitar etiqueta",
    confirmConvertAuto: "Convertir en manual",
    confirmRemoveAllAuto: "Eliminar automáticas",
    tagRenamed: "Se renombró «{source}» como «{target}» en {count} elementos",
    tagsMerged: "Se fusionó «{source}» con «{target}» en {count} elementos",
    libraryTagDeleted: "Se quitó «{tag}» de {count} elementos",
    tagConvertedManual: "Se convirtió «{tag}» en manual en {count} elementos",
    allAutoTagsRemoved:
      "Se eliminaron etiquetas automáticas en {count} elementos",
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
    errorEmptySearchName: "Escribe un nombre primero.",
    errorNoSearchConditions:
      "Añade al menos una etiqueta, texto de búsqueda, colección o condición primero.",
    errorMaxColoredTags:
      "Zotero admite hasta 9 etiquetas con color por biblioteca. Quita primero el color de otra etiqueta.",
    errorInvalidColor: "Escribe un color hexadecimal válido (p. ej. #2ea8e5).",
    errorLongTag: "La etiqueta supera la longitud permitida por Zotero.",
    errorTagNotFound:
      "La etiqueta de origen ya no está presente en esta biblioteca.",
    errorTagExists:
      "Esa etiqueta ya existe en esta biblioteca. Usa Fusionar con.",
    errorMergeTarget:
      "Elige una etiqueta de destino que exista en esta biblioteca.",
    errorSameTag: "Las etiquetas de origen y destino deben ser diferentes.",
    showingLibrary: "{name}",
    dragItemsBadge: "{count} elementos",
    op_is: "es",
    op_isNot: "no es",
    op_contains: "contiene",
    op_doesNotContain: "no contiene",
    op_beginsWith: "empieza por",
    op_isBefore: "es anterior a",
    op_isAfter: "es posterior a",
    op_isInTheLast: "está en los últimos",
    op_isLessThan: "es menor que",
    op_isGreaterThan: "es mayor que",
    op_isEmpty: "está vacío",
    op_isNotEmpty: "no está vacío",
    op_true: "es verdadero",
    op_false: "es falso",
    sc_clickTag: "Seleccionar etiqueta principal (clic de nuevo para limpiar)",
    sc_ctrlClickTag: "Añadir o quitar etiqueta en filtro booleano AND (+)",
    sc_altClickTag: "Excluir o incluir etiqueta con filtro booleano NOT (−)",
    sc_dragItems:
      "Asignar etiqueta a elementos arrastrados (Alt+Soltar la quita)",
    sc_dragTag: "Asignar etiqueta arrastrada sobre una fila o el inspector",
    sc_numKeys: "Alternar etiqueta de color 1–9 en los elementos seleccionados",
    sc_ctrlNumKeys: "Añadir etiqueta frecuente 1–5 a la selección",
    sc_copyKey: "Copiar CiteKey (o formato Zettlr) de la selección",
    sc_searchKey: "Enfocar el cuadro de búsqueda rápida",
    sc_doubleClick: "Abrir mejor adjunto (configurable en Ajustes)",
  },
};

const UNARY_OPERATORS = new Set(["isEmpty", "isNotEmpty", "true", "false"]);

class VirtualList<T> {
  private items: T[] = [];
  private frame = 0;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly container: HTMLElement,
    private readonly spacer: HTMLElement,
    private readonly windowElement: HTMLElement,
    private rowHeight: number,
    private readonly renderRow: (item: T, index: number) => HTMLElement,
  ) {
    this.container.addEventListener("scroll", () => this.scheduleRender());
    this.resizeObserver = new ResizeObserver(() => this.scheduleRender());
    this.resizeObserver.observe(this.container);
  }

  setRowHeight(height: number): void {
    if (this.rowHeight === height) return;
    this.rowHeight = height;
    this.updateSpacerHeight();
    this.render();
  }

  setItems(items: T[], preserveScroll = false): void {
    this.items = items;
    this.updateSpacerHeight();
    if (!preserveScroll) {
      this.container.scrollTop = 0;
    }
    this.render();
  }

  refresh(): void {
    this.updateSpacerHeight();
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

  private updateSpacerHeight(): void {
    this.spacer.style.height = `${Math.max(
      this.container.clientHeight,
      this.items.length * this.rowHeight,
    )}px`;
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
let collections: CollectionOption[] = [];
let savedSearches: SavedSearchOption[] = [];
let currentLibraryID = 0;

// Unified v2 Query State
let includeTags: string[] = [];
let excludeTags: string[] = [];
let untaggedOnly = false;
let activeCollectionID: number | null = null;
let unfiledOnly = false;
let activeSavedSearchID: number | null = null;
let includeSubcollections = true;
let quickSearchMode: QuickSearchMode = "fields";
let joinMode: SearchJoinMode = "all";
let advancedConditions: AdvancedSearchCondition[] = [];

// Query Result & Facet State
let queryTotal = 0;
let queryHasMore = false;
let facetTagCounts: Record<string, number> = {};

// Tag List UI State
let tagKindFilter: TagKindFilter = "all";
let tagSortMode: TagSortMode = "name";
let currentTagRows: TagListEntry[] = [];
let visibleTagRows: TagListEntry[] = [];

// Item Table & Selection State
let allItems: ItemSummary[] = [];
let visibleItems: ItemSummary[] = [];
let selectedItemID: number | null = null;
let selectedItemIDs = new Set<number>();
let selectionAnchorID: number | null = null;
let selectedDetails: ItemDetails | null = null;
let frequentTagCandidates: TagSummary[] = [];
let sortKey: ItemSortKey = "dateModified";
let sortDirection: ItemSortDirection = "descending";

// Layout & Preferences State
let itemColumnWidths: ItemColumnWidths = {
  ...DEFAULT_ITEM_COLUMN_WIDTHS,
};
let visibleColumns: ItemColumnKey[] = [...DEFAULT_VISIBLE_ITEM_COLUMNS];
let leftPaneWidth = DEFAULT_LEFT_PANE_WIDTH;
let rightPaneWidth = DEFAULT_RIGHT_PANE_WIDTH;
let density: InterfaceDensity = "comfortable";
let doubleClickAction: DoubleClickAction = "openAttachment";
let pageSize = 500;
let language: "en" | "es" = "en";

// Async Tokens & Timers
let tagLoadToken = 0;
let itemLoadToken = 0;
let detailLoadToken = 0;
let toastTimer = 0;
let refreshTimer = 0;
let quickSearchTimer = 0;
let retryAction: (() => Promise<void>) | null = null;
let autocompleteIndex = -1;
let autocompleteMatches: TagSummary[] = [];
let suppressNotificationsUntil = 0;

// Dialog & Menu State
let tagActionMode: TagActionMode | null = null;
let tagActionSource: TagSummary | null = null;
let tagActionAutocompleteMatches: TagSummary[] = [];
let tagActionAutocompleteIndex = -1;
let colorDialogSource: TagSummary | null = null;
let saveQueryMode: SaveQueryMode = "view";
let savedFilters: SavedFiltersByLibrary = {};
let applyingSavedFilter = false;
let activeDragGhost: HTMLElement | null = null;

let tagVirtualList: VirtualList<TagListEntry>;
let itemVirtualList: VirtualList<ItemSummary>;

const ITEM_COLUMN_CSS_VARIABLES: Record<ItemColumnKey, string> = {
  title: "--item-column-title",
  creator: "--item-column-creator",
  year: "--item-column-year",
  publication: "--item-column-publication",
  itemType: "--item-column-item-type",
  citekey: "--item-column-citekey",
  dateAdded: "--item-column-date-added",
  dateModified: "--item-column-date-modified",
};

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

function translateOperator(operator: string): string {
  const key = `op_${operator}`;
  return TRANSLATIONS[language][key] || TRANSLATIONS.en[key] || operator;
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
      if (node.hasAttribute("aria-label")) {
        node.setAttribute("aria-label", title);
      }
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

function createOption(value: string, label: string): HTMLOptionElement {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
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

    const prefs = bootstrap.preferences;
    doubleClickAction = prefs.doubleClickAction || "openAttachment";
    pageSize = prefs.pageSize || 500;
    visibleColumns = sanitizeVisibleItemColumns(prefs.visibleColumns);
    leftPaneWidth = clampPaneWidth("left", prefs.leftPaneWidth);
    rightPaneWidth = clampPaneWidth("right", prefs.rightPaneWidth);

    applyPaneWidth("left", leftPaneWidth);
    applyPaneWidth("right", rightPaneWidth);
    setTagPaneOpen(prefs.tagPaneOpen !== false, false);
    setInspectorOpen(prefs.inspectorOpen !== false, false);
    setDensity(prefs.density || "comfortable", false);

    configureItemColumns();
    configureStaticControls();
    configureZettlrCitationFormat();
    renderShortcutsDialogContent();

    savedFilters = { ...prefs.savedFilters };
    populateLibraries();
    populateCitationStyles();
    element<HTMLInputElement>("hide-automatic-tags").checked =
      prefs.hideAutomaticTags;

    await loadLibrary(prefs.selectedLibraryID);
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

/* ==========================================================================
 * Layout, Splitters, Density & Dynamic Columns
 * ========================================================================== */

function clampPaneWidth(side: "left" | "right", width: number): number {
  if (!Number.isFinite(width)) {
    return side === "left" ? DEFAULT_LEFT_PANE_WIDTH : DEFAULT_RIGHT_PANE_WIDTH;
  }
  return side === "left"
    ? Math.max(190, Math.min(480, Math.round(width)))
    : Math.max(240, Math.min(540, Math.round(width)));
}

function applyPaneWidth(side: "left" | "right", width: number): void {
  const clamped = clampPaneWidth(side, width);
  if (side === "left") {
    leftPaneWidth = clamped;
    element("app").style.setProperty("--left-pane-width", `${clamped}px`);
    element("left-splitter").setAttribute("aria-valuenow", String(clamped));
  } else {
    rightPaneWidth = clamped;
    element("app").style.setProperty("--right-pane-width", `${clamped}px`);
    element("right-splitter").setAttribute("aria-valuenow", String(clamped));
  }
}

function startPaneResize(side: "left" | "right", event: PointerEvent): void {
  if (event.button !== 0) return;
  const splitter = event.currentTarget as HTMLElement;
  event.preventDefault();
  event.stopPropagation();

  const pointerID = event.pointerId;
  const startX = event.clientX;
  const startWidth = side === "left" ? leftPaneWidth : rightPaneWidth;
  let finished = false;

  const move = (moveEvent: PointerEvent) => {
    const delta = moveEvent.clientX - startX;
    applyPaneWidth(
      side,
      side === "left" ? startWidth + delta : startWidth - delta,
    );
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    if (splitter.hasPointerCapture(pointerID)) {
      splitter.releasePointerCapture(pointerID);
    }
    splitter.classList.remove("active");
    element("app").classList.remove("pane-resizing");
    splitter.removeEventListener("pointermove", move);
    splitter.removeEventListener("pointerup", finish);
    splitter.removeEventListener("pointercancel", finish);
    api?.savePreferences(
      side === "left" ? { leftPaneWidth } : { rightPaneWidth },
    );
  };

  splitter.classList.add("active");
  element("app").classList.add("pane-resizing");
  splitter.setPointerCapture(pointerID);
  splitter.addEventListener("pointermove", move);
  splitter.addEventListener("pointerup", finish);
  splitter.addEventListener("pointercancel", finish);
}

function handlePaneSplitterKeyboard(
  side: "left" | "right",
  event: KeyboardEvent,
): void {
  if (event.key === "Home") {
    event.preventDefault();
    applyPaneWidth(
      side,
      side === "left" ? DEFAULT_LEFT_PANE_WIDTH : DEFAULT_RIGHT_PANE_WIDTH,
    );
    api?.savePreferences(
      side === "left" ? { leftPaneWidth } : { rightPaneWidth },
    );
    return;
  }
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const step = event.shiftKey ? 24 : 10;
  const direction = event.key === "ArrowRight" ? 1 : -1;
  const current = side === "left" ? leftPaneWidth : rightPaneWidth;
  applyPaneWidth(
    side,
    side === "left" ? current + direction * step : current - direction * step,
  );
  api?.savePreferences(
    side === "left" ? { leftPaneWidth } : { rightPaneWidth },
  );
}

function setTagPaneOpen(open: boolean, persist: boolean): void {
  element("app").classList.toggle("tag-pane-closed", !open);
  element("tag-pane-toggle").setAttribute("aria-pressed", String(open));
  if (persist) api?.savePreferences({ tagPaneOpen: open });
}

function setInspectorOpen(open: boolean, persist: boolean): void {
  element("app").classList.toggle("inspector-closed", !open);
  element("inspector-toggle").setAttribute("aria-pressed", String(open));
  if (persist) api?.savePreferences({ inspectorOpen: open });
}

function setDensity(nextDensity: InterfaceDensity, persist: boolean): void {
  density = nextDensity === "compact" ? "compact" : "comfortable";
  const isCompact = density === "compact";
  element("app").classList.toggle("density-compact", isCompact);
  element("density-toggle").setAttribute("aria-pressed", String(isCompact));
  tagVirtualList.setRowHeight(isCompact ? 25 : 30);
  itemVirtualList.setRowHeight(isCompact ? 28 : 34);
  if (persist) api?.savePreferences({ density });
}

function configureItemColumns(): void {
  itemColumnWidths = completeItemColumnWidths(
    bootstrap?.preferences.itemColumnWidths,
  );
  for (const key of ITEM_COLUMN_KEYS) {
    applyItemColumnWidth(key, itemColumnWidths[key], false);
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
  updateDynamicColumnsGrid();
  syncItemHeaderScroll();
}

function updateDynamicColumnsGrid(): void {
  visibleColumns = sanitizeVisibleItemColumns(visibleColumns);
  const activeCols = ITEM_COLUMN_KEYS.filter((key) =>
    visibleColumns.includes(key),
  );
  for (const key of ITEM_COLUMN_KEYS) {
    const header = document.querySelector<HTMLElement>(
      `.column-header[data-column="${key}"]`,
    );
    if (header) header.hidden = !activeCols.includes(key);
  }
  const templateParts = [
    "52px",
    ...activeCols.map((key) => `var(${ITEM_COLUMN_CSS_VARIABLES[key]})`),
    "minmax(48px, 1fr)",
  ];
  const minWidth =
    52 + activeCols.reduce((sum, key) => sum + itemColumnWidths[key], 0) + 54;
  const app = element("app");
  app.style.setProperty("--items-grid-template", templateParts.join(" "));
  app.style.setProperty("--item-table-min-width", `${minWidth}px`);
  itemVirtualList?.refresh();
}

function openColumnsMenu(anchor: HTMLElement): void {
  closeAllContextMenus();
  const menu = element("columns-menu");
  const fragment = document.createDocumentFragment();
  for (const key of ITEM_COLUMN_KEYS) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = visibleColumns.includes(key);
    checkbox.disabled = key === "title";
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        if (!visibleColumns.includes(key)) visibleColumns.push(key);
      } else {
        visibleColumns = visibleColumns.filter((col) => col !== key);
      }
      updateDynamicColumnsGrid();
      api?.savePreferences({ visibleColumns: [...visibleColumns] });
    });
    const span = document.createElement("span");
    span.textContent = key === "citekey" ? "CiteKey" : translate(key);
    label.append(checkbox, span);
    fragment.appendChild(label);
  }
  menu.replaceChildren(fragment);
  positionContextMenu(
    menu,
    anchor.getBoundingClientRect().right,
    anchor.getBoundingClientRect().bottom + 4,
    true,
  );
}

function itemColumnKeyFromElement(target: HTMLElement): ItemColumnKey | null {
  const key = target.dataset.resizeColumn as ItemColumnKey | undefined;
  return key && ITEM_COLUMN_KEYS.includes(key) ? key : null;
}

function applyItemColumnWidth(
  key: ItemColumnKey,
  width: number,
  refreshGrid = true,
): void {
  const clamped = clampItemColumnWidth(key, width);
  itemColumnWidths[key] = clamped;
  element("app").style.setProperty(
    ITEM_COLUMN_CSS_VARIABLES[key],
    `${clamped}px`,
  );
  document
    .querySelector<HTMLElement>(`[data-resize-column="${key}"]`)
    ?.setAttribute("aria-valuenow", String(clamped));
  if (refreshGrid) updateDynamicColumnsGrid();
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

/* ==========================================================================
 * Bootstrap Controls & Populators
 * ========================================================================== */

function configureZettlrCitationFormat(): void {
  if (!bootstrap) return;
  const checkbox = element<HTMLInputElement>("zettlr-citation-format");
  const status = element("zettlr-format-status");
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
    fragment.appendChild(createOption(String(library.id), library.name));
  }
  select.replaceChildren(fragment);
  select.value = String(bootstrap.preferences.selectedLibraryID);
}

function populateCitationStyles(): void {
  if (!bootstrap) return;
  const select = element<HTMLSelectElement>("citation-style");
  const fragment = document.createDocumentFragment();
  for (const style of bootstrap.citationStyles) {
    fragment.appendChild(createOption(style.id, style.title));
  }
  select.replaceChildren(fragment);
  select.value = bootstrap.defaultCitationStyleID;
}

function populateScopeCollectionSelect(): void {
  const select = element<HTMLSelectElement>("scope-collection-select");
  const currentValue = activeSavedSearchID
    ? `search:${activeSavedSearchID}`
    : activeCollectionID
      ? `col:${activeCollectionID}`
      : unfiledOnly
        ? "unfiled"
        : "";

  const fragment = document.createDocumentFragment();
  fragment.appendChild(createOption("", translate("allItemsScope")));
  fragment.appendChild(createOption("unfiled", translate("unfiledItemsScope")));

  if (collections.length) {
    const group = document.createElement("optgroup");
    group.label = translate("collectionsGroup");
    for (const col of collections) {
      const prefix = col.depth > 0 ? `${"  ".repeat(col.depth)}↳ ` : "";
      group.appendChild(createOption(`col:${col.id}`, `${prefix}${col.name}`));
    }
    fragment.appendChild(group);
  }

  if (savedSearches.length) {
    const group = document.createElement("optgroup");
    group.label = translate("savedSearchesGroup");
    for (const search of savedSearches) {
      group.appendChild(
        createOption(`search:${search.id}`, `🔍 ${search.name}`),
      );
    }
    fragment.appendChild(group);
  }

  select.replaceChildren(fragment);
  if (
    Array.from(
      select.querySelectorAll("option") as unknown as HTMLOptionElement[],
    ).some((opt) => opt.value === currentValue)
  ) {
    select.value = currentValue;
  } else {
    select.value = "";
  }
}

/* ==========================================================================
 * Event Binding
 * ========================================================================== */

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

  element<HTMLSelectElement>("scope-collection-select").addEventListener(
    "change",
    (event) => {
      markSavedFilterDirty();
      const value = (event.currentTarget as HTMLSelectElement).value;
      activeCollectionID = null;
      unfiledOnly = false;
      activeSavedSearchID = null;
      if (value === "unfiled") {
        unfiledOnly = true;
      } else if (value.startsWith("col:")) {
        activeCollectionID = Number(value.slice(4)) || null;
      } else if (value.startsWith("search:")) {
        activeSavedSearchID = Number(value.slice(7)) || null;
      }
      void executeUnifiedQuery();
    },
  );

  element("tag-pane-toggle").addEventListener("click", () => {
    setTagPaneOpen(element("app").classList.contains("tag-pane-closed"), true);
  });
  element("density-toggle").addEventListener("click", () => {
    setDensity(density === "compact" ? "comfortable" : "compact", true);
  });
  element("shortcuts-button").addEventListener("click", openShortcutsDialog);
  element("shortcuts-close").addEventListener("click", closeShortcutsDialog);
  element("shortcuts-ok").addEventListener("click", closeShortcutsDialog);

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

  // Pane splitters
  const leftSplitter = element("left-splitter");
  leftSplitter.addEventListener("pointerdown", (e) =>
    startPaneResize("left", e as PointerEvent),
  );
  leftSplitter.addEventListener("dblclick", () => {
    applyPaneWidth("left", DEFAULT_LEFT_PANE_WIDTH);
    api?.savePreferences({ leftPaneWidth });
  });
  leftSplitter.addEventListener("keydown", (e) =>
    handlePaneSplitterKeyboard("left", e as KeyboardEvent),
  );

  const rightSplitter = element("right-splitter");
  rightSplitter.addEventListener("pointerdown", (e) =>
    startPaneResize("right", e as PointerEvent),
  );
  rightSplitter.addEventListener("dblclick", () => {
    applyPaneWidth("right", DEFAULT_RIGHT_PANE_WIDTH);
    api?.savePreferences({ rightPaneWidth });
  });
  rightSplitter.addEventListener("keydown", (e) =>
    handlePaneSplitterKeyboard("right", e as KeyboardEvent),
  );

  // Tag Pane Controls
  const tagSearch = element<HTMLInputElement>("tag-search");
  tagSearch.addEventListener("input", filterTagList);
  element("clear-tag-search").addEventListener("click", () => {
    tagSearch.value = "";
    tagSearch.focus();
    filterTagList();
  });

  element("tag-kind-filters").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest(
      "button[data-tag-kind]",
    ) as HTMLButtonElement | null;
    if (!button) return;
    setTagKindFilter((button.dataset.tagKind as TagKindFilter) || "all");
  });

  element<HTMLSelectElement>("tag-sort-select").addEventListener(
    "change",
    (event) => {
      tagSortMode =
        ((event.currentTarget as HTMLSelectElement).value as TagSortMode) ||
        "name";
      updateTagRows();
    },
  );

  element<HTMLInputElement>("hide-automatic-tags").addEventListener(
    "change",
    (event) => {
      const checked = (event.currentTarget as HTMLInputElement).checked;
      api?.savePreferences({ hideAutomaticTags: checked });
      filterTagList();
    },
  );
  element("tag-list").addEventListener("keydown", handleTagListKeyboard);
  element("tag-list").addEventListener("dragover", (e) =>
    autoScrollVirtualContainer(element("tag-list"), e as DragEvent),
  );

  element("tag-curation-button").addEventListener("click", (event) => {
    const button = event.currentTarget as HTMLElement;
    openTagCurationMenu(button);
  });
  element("tag-curation-menu").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest(
      "button[data-curation]",
    ) as HTMLButtonElement | null;
    if (!button) return;
    closeAllContextMenus();
    const action = button.dataset.curation;
    if (action === "show-single") {
      setTagKindFilter("single");
    } else if (action === "show-colored") {
      setTagKindFilter("colored");
    } else if (action === "remove-all-auto" && overview) {
      const autoEntries = overview.tags.filter(
        (t) => t.automaticCount > 0,
      ).length;
      openTagActionDialog("removeAllAutomatic", {
        name: "",
        kind: "automatic",
        count: autoEntries,
        manualCount: 0,
        automaticCount: autoEntries,
      });
    }
  });

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
    if (!button || button.disabled || !tagActionSource) return;
    const source = tagActionSource;
    const action = button.dataset.tagAction;
    closeAllContextMenus();
    if (action === "filter-and") {
      toggleIncludeTag(source.name);
    } else if (action === "filter-not") {
      toggleExcludeTag(source.name);
    } else if (action === "color") {
      openTagColorDialog(source);
    } else if (action === "remove-color") {
      void removeColorFromTag(source.name);
    } else if (action === "convert-manual") {
      openTagActionDialog("convertToManual", source);
    } else if (
      action === "rename" ||
      action === "merge" ||
      action === "delete"
    ) {
      openTagActionDialog(action, source);
    }
  });

  // Global outside-click dismissal for custom context menus
  document.addEventListener("pointerdown", (event) => {
    const target = event.target as Node;
    for (const [menuId, triggerId] of [
      ["tag-actions-menu", "tag-actions-button"],
      ["tag-curation-menu", "tag-curation-button"],
      ["columns-menu", "columns-menu-button"],
      ["item-context-menu", ""],
    ] as const) {
      const menu = element(menuId);
      if (
        !menu.hidden &&
        !menu.contains(target) &&
        (!triggerId || !element(triggerId).contains(target))
      ) {
        menu.hidden = true;
        if (menuId === "tag-actions-menu") tagActionSource = null;
      }
    }
  });

  // Quick Search & Mode
  const itemSearch = element<HTMLInputElement>("item-search");
  itemSearch.addEventListener("input", handleItemSearchInput);
  element("clear-item-search").addEventListener("click", () => {
    itemSearch.value = "";
    itemSearch.focus();
    handleItemSearchInput();
  });
  element<HTMLSelectElement>("quicksearch-mode").addEventListener(
    "change",
    (event) => {
      markSavedFilterDirty();
      quickSearchMode =
        ((event.currentTarget as HTMLSelectElement).value as QuickSearchMode) ||
        "fields";
      if (itemSearch.value.trim()) {
        void executeUnifiedQuery();
      }
    },
  );

  // Advanced Search Builder
  element("advanced-search-toggle").addEventListener(
    "click",
    toggleAdvancedSearchPanel,
  );
  element<HTMLSelectElement>("advanced-join-mode").addEventListener(
    "change",
    (event) => {
      markSavedFilterDirty();
      joinMode =
        ((event.currentTarget as HTMLSelectElement).value as SearchJoinMode) ||
        "all";
    },
  );
  element<HTMLInputElement>("include-subcollections").addEventListener(
    "change",
    (event) => {
      markSavedFilterDirty();
      includeSubcollections = (event.currentTarget as HTMLInputElement).checked;
      if (
        activeCollectionID ||
        advancedConditions.some((c) => c.condition === "collection")
      ) {
        void executeUnifiedQuery();
      }
    },
  );
  element("advanced-add-row").addEventListener("click", () => {
    advancedConditions.push({
      condition: "title",
      operator: "contains",
      value: "",
    });
    renderAdvancedConditionRows();
  });
  element("advanced-clear").addEventListener("click", () => {
    markSavedFilterDirty();
    advancedConditions = [
      { condition: "title", operator: "contains", value: "" },
    ];
    renderAdvancedConditionRows();
    updateAdvancedConditionBadge();
    void executeUnifiedQuery();
  });
  element("advanced-run").addEventListener("click", () => {
    markSavedFilterDirty();
    updateAdvancedConditionBadge();
    void executeUnifiedQuery();
  });
  element("advanced-save-view").addEventListener("click", () =>
    openSaveQueryDialog("view"),
  );
  element("advanced-save-zotero").addEventListener("click", () =>
    openSaveQueryDialog("zoteroSearch"),
  );

  // Active Filter Strip
  element("clear-all-active-filters").addEventListener(
    "click",
    () => void clearAllActiveFilters(),
  );

  // Columns Menu & Pagination
  element("columns-menu-button").addEventListener("click", (event) => {
    openColumnsMenu(event.currentTarget as HTMLElement);
  });
  element("load-more-items").addEventListener("click", () => {
    void executeUnifiedQuery({
      append: true,
      preserveItemIDs: getSelectedItemIDs(),
    });
  });
  element("load-all-items").addEventListener("click", () => {
    void executeUnifiedQuery({
      append: true,
      loadAll: true,
      preserveItemIDs: getSelectedItemIDs(),
    });
  });

  // Facet & Date Filters Bar
  element("filters-toggle").addEventListener("click", toggleFilters);
  for (const id of [
    "author-filter",
    "second-tag-filter",
    "year-min",
    "year-max",
    "date-added-from",
    "date-added-to",
    "date-modified-from",
    "date-modified-to",
    "filter-has-pdf",
    "filter-has-notes",
  ]) {
    element(id).addEventListener("input", () => {
      markSavedFilterDirty();
      applyItemFilters();
      renderActiveFilterPills();
    });
    element(id).addEventListener("change", () => {
      markSavedFilterDirty();
      applyItemFilters();
      renderActiveFilterPills();
    });
  }
  element("clear-filters").addEventListener("click", clearClientFilters);
  element<HTMLSelectElement>("saved-filter-select").addEventListener(
    "change",
    (event) => {
      const presetID = (event.currentTarget as HTMLSelectElement).value;
      updateSavedFilterButtons();
      if (presetID) void applySavedFilter(presetID);
    },
  );
  element("saved-filter-save").addEventListener("click", () =>
    openSaveQueryDialog("view"),
  );
  element("saved-filter-delete").addEventListener("click", deleteSavedFilter);

  // Item Table Sorting, Resizing & Selection
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
  itemsList.addEventListener("dragover", (e) =>
    autoScrollVirtualContainer(itemsList, e as DragEvent),
  );
  element<HTMLInputElement>("select-visible-items").addEventListener(
    "change",
    (event) => {
      const checkbox = event.currentTarget as HTMLInputElement;
      if (checkbox.checked) selectAllVisibleItems();
      else clearItemSelection();
    },
  );
  document
    .querySelectorAll<HTMLElement>("[data-resize-column]")
    .forEach((resizer: HTMLElement) => {
      resizer.addEventListener("pointerdown", startItemColumnResize);
      resizer.addEventListener("dblclick", resetItemColumnWidth);
      resizer.addEventListener("keydown", handleItemColumnResizeKeyboard);
    });

  // Item Context Menu
  element("item-context-menu").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest(
      "button[data-item-action]",
    ) as HTMLButtonElement | null;
    if (!button) return;
    const action = button.dataset.itemAction;
    closeAllContextMenus();
    if (action === "open-file") void openSelectedAttachment();
    else if (action === "show-zotero" && selectedItemID)
      void api?.selectInMainWindow(selectedItemID);
    else if (action === "copy-citekey") void copySelected("citekey");
    else if (action === "copy-citation") void copySelected("citation");
    else if (action === "copy-bibliography") void copySelected("bibliography");
  });

  // Inspector Drop Target (drop tag onto inspector to assign to selected items)
  const inspectorPane = element("inspector-pane");
  inspectorPane.addEventListener("dragover", (rawEvent) => {
    const event = rawEvent as DragEvent;
    if (
      !event.dataTransfer ||
      !hasTagNavigatorTagDrag(event.dataTransfer.types) ||
      !selectedItemIDs.size ||
      !isCurrentLibraryEditable()
    ) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    inspectorPane.classList.add("drop-target");
  });
  inspectorPane.addEventListener("dragleave", (rawEvent) => {
    const event = rawEvent as DragEvent;
    if (!inspectorPane.contains(event.relatedTarget as Node | null)) {
      inspectorPane.classList.remove("drop-target");
    }
  });
  inspectorPane.addEventListener("drop", (rawEvent) => {
    const event = rawEvent as DragEvent;
    inspectorPane.classList.remove("drop-target");
    const tagName = event.dataTransfer?.getData(TAGNAVIGATOR_TAG_DRAG_TYPE);
    if (!tagName || !selectedItemIDs.size) return;
    event.preventDefault();
    event.stopPropagation();
    void addTag(tagName);
  });

  // Inspector Actions
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
  element("copy-apa").addEventListener(
    "click",
    () => void copySelected("bibliography", APA_STYLE_ID),
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

  // Tag Action Dialog
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

  // Tag Color Dialog
  element<HTMLFormElement>("tag-color-form").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      void submitTagColorDialog();
    },
  );
  element("tag-color-close").addEventListener("click", closeTagColorDialog);
  element("tag-color-cancel").addEventListener("click", closeTagColorDialog);
  element("tag-color-remove").addEventListener("click", () => {
    if (colorDialogSource) {
      const name = colorDialogSource.name;
      closeTagColorDialog();
      void removeColorFromTag(name);
    }
  });
  element<HTMLInputElement>("tag-color-picker").addEventListener(
    "input",
    (event) => {
      const val = (event.currentTarget as HTMLInputElement).value;
      element<HTMLInputElement>("tag-color-hex").value = val;
      highlightSelectedPaletteSwatch(val);
    },
  );
  element<HTMLInputElement>("tag-color-hex").addEventListener(
    "input",
    (event) => {
      const normalized = normalizeHexColor(
        (event.currentTarget as HTMLInputElement).value,
      );
      if (normalized) {
        element<HTMLInputElement>("tag-color-picker").value = normalized;
        highlightSelectedPaletteSwatch(normalized);
      }
    },
  );

  // Save Query / Saved View Dialog
  element<HTMLFormElement>("save-query-form").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      void submitSaveQueryDialog();
    },
  );
  element("save-query-close").addEventListener("click", closeSaveQueryDialog);
  element("save-query-cancel").addEventListener("click", closeSaveQueryDialog);

  // Error Banner
  element("error-retry").addEventListener("click", () => {
    hideError();
    if (retryAction) void retryAction();
  });
  element("error-dismiss").addEventListener("click", hideError);

  window.addEventListener("tagnavigator-data-changed", scheduleExternalRefresh);
  window.addEventListener("keydown", handleGlobalKeyboard);
}

/* ==========================================================================
 * Library Loading & Unified Query Engine
 * ========================================================================== */

async function loadLibrary(libraryID: number): Promise<void> {
  if (!api || !bootstrap) return;
  const token = ++tagLoadToken;
  ++itemLoadToken;
  ++detailLoadToken;
  setLoading(true, "loadingLibrary");
  hideError();

  currentLibraryID = libraryID;
  overview = null;
  collections = [];
  savedSearches = [];
  includeTags = [];
  excludeTags = [];
  untaggedOnly = false;
  activeCollectionID = null;
  unfiledOnly = false;
  activeSavedSearchID = null;
  advancedConditions = [];
  facetTagCounts = {};
  selectedItemID = null;
  selectedItemIDs.clear();
  selectionAnchorID = null;
  selectedDetails = null;
  allItems = [];
  visibleItems = [];
  sortKey = "dateModified";
  sortDirection = "descending";
  resetClientFilters();
  resetInspector();

  try {
    const [loadedOverview, loadedCollections, loadedSearches] =
      await Promise.all([
        api.getTagOverview(libraryID),
        api.getCollections(libraryID),
        api.getSavedSearches(libraryID),
      ]);
    if (token !== tagLoadToken) return;
    overview = loadedOverview;
    collections = loadedCollections;
    savedSearches = loadedSearches;

    element<HTMLSelectElement>("library-select").value = String(libraryID);
    api.savePreferences({ selectedLibraryID: libraryID });
    populateScopeCollectionSelect();
    populateSavedFilterSelect();
    renderAdvancedConditionRows();
    updateAdvancedConditionBadge();
    updateTagRows();

    const library = bootstrap.libraries.find((entry) => entry.id === libraryID);
    element("library-status").textContent = library
      ? translate("showingLibrary", { name: library.name })
      : "";

    await executeUnifiedQuery();
  } catch (error) {
    if (token === tagLoadToken) {
      showError(error, () => loadLibrary(libraryID));
    }
  } finally {
    if (token === tagLoadToken) setLoading(false);
  }
}

function activeAdvancedConditions(): AdvancedSearchCondition[] {
  return advancedConditions.filter(
    (row) =>
      row.condition &&
      row.operator &&
      (UNARY_OPERATORS.has(row.operator) || Boolean(row.value.trim())),
  );
}

function isFilteredQueryActive(): boolean {
  return Boolean(
    includeTags.length ||
    excludeTags.length ||
    untaggedOnly ||
    activeCollectionID !== null ||
    unfiledOnly ||
    activeSavedSearchID !== null ||
    element<HTMLInputElement>("item-search").value.trim() ||
    activeAdvancedConditions().length,
  );
}

function buildUnifiedQuery(): UnifiedItemQuery {
  return {
    includeTags: [...includeTags],
    excludeTags: [...excludeTags],
    untaggedOnly,
    collectionID: activeCollectionID,
    unfiledOnly,
    savedSearchID: activeSavedSearchID,
    includeSubcollections,
    quickSearchQuery: element<HTMLInputElement>("item-search").value.trim(),
    quickSearchMode,
    joinMode,
    advancedConditions: activeAdvancedConditions(),
  };
}

function currentQueryHeading(): string {
  if (activeSavedSearchID !== null) {
    const found = savedSearches.find((s) => s.id === activeSavedSearchID);
    if (found) return found.name;
  }
  if (untaggedOnly) return translate("untagged");
  if (includeTags.length === 1 && !excludeTags.length && !activeCollectionID) {
    return includeTags[0];
  }
  if (includeTags.length || excludeTags.length) {
    const parts = [
      ...includeTags.map((t) => `+${t}`),
      ...excludeTags.map((t) => `−${t}`),
    ];
    return parts.join(" ");
  }
  if (activeCollectionID !== null) {
    const col = collections.find((c) => c.id === activeCollectionID);
    if (col) return col.name;
  }
  if (unfiledOnly) return translate("unfiledItemsScope");
  if (
    element<HTMLInputElement>("item-search").value.trim() ||
    activeAdvancedConditions().length
  ) {
    return translate("allLibrary");
  }
  return translate("recentItems");
}

async function executeUnifiedQuery(
  options: {
    append?: boolean;
    loadAll?: boolean;
    preserveItemIDs?: number[];
  } = {},
): Promise<void> {
  if (!api || !currentLibraryID) return;
  const token = ++itemLoadToken;
  const append = Boolean(options.append);
  const preserveIDs = options.preserveItemIDs || [];

  if (!append) {
    selectedItemIDs = new Set(preserveIDs);
    selectedItemID = preserveIDs[0] || null;
    if (!preserveIDs.length) resetInspector();
    element("results-title").textContent = currentQueryHeading();
    element("results-count").textContent = "…";
    element("items-status").textContent = translate(
      isFilteredQueryActive() ? "searchingLibrary" : "loadingItems",
    );
    element("pagination-actions").hidden = true;
    showItemsEmpty("loadingItems", "");
  }

  element<HTMLInputElement>("item-search").disabled = false;
  updateTagActionButton();
  renderColoredTagsBar();
  renderActiveFilterPills();
  hideError();

  try {
    const query = buildUnifiedQuery();
    query.offset = append ? allItems.length : 0;
    query.limit = options.loadAll ? 0 : pageSize;

    const result = await api.queryItems(currentLibraryID, query);
    if (token !== itemLoadToken) return;

    if (append) {
      const seen = new Set(allItems.map((item) => item.id));
      for (const item of result.items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          allItems.push(item);
        }
      }
    } else {
      allItems = result.items;
    }

    queryTotal = result.total;
    queryHasMore = result.hasMore;
    facetTagCounts = result.facetTagCounts || {};

    element("results-title").textContent = currentQueryHeading();
    updatePaginationControls();
    tagVirtualList.refresh();
    populateItemFilterOptions();
    setResultFilterControlsEnabled(true);
    applyItemFilters(append);

    if (preserveIDs.length) {
      await restoreItemSelection(preserveIDs);
    }
  } catch (error) {
    if (token !== itemLoadToken) return;
    showError(error, () => executeUnifiedQuery(options));
    showItemsEmpty("noItemsTitle", "noItemsBody");
  }
}

function updatePaginationControls(): void {
  const container = element("pagination-actions");
  container.hidden = !queryHasMore;
  if (!queryHasMore) return;
  const remaining = Math.max(0, queryTotal - allItems.length);
  const nextStep = Math.min(pageSize, remaining);
  element("load-more-items").textContent = translate("loadMoreItemsCount", {
    count: nextStep.toLocaleString(language),
  });
  element("load-all-items").textContent = translate("loadAllItems", {
    total: queryTotal.toLocaleString(language),
  });
}

/* ==========================================================================
 * Left Tag Pane: Colored Tags, Filtering, Sorting & Drag/Drop
 * ========================================================================== */

function setTagKindFilter(kind: TagKindFilter): void {
  tagKindFilter = kind;
  element("tag-kind-filters")
    .querySelectorAll<HTMLButtonElement>("button[data-tag-kind]")
    .forEach((btn: HTMLButtonElement) => {
      btn.classList.toggle("active", btn.dataset.tagKind === kind);
    });
  filterTagList();
}

function updateTagRows(): void {
  if (!overview) {
    currentTagRows = [];
    renderColoredTagsBar();
    filterTagList();
    return;
  }

  const sortedTags = overview.tags.slice().sort((a, b) => {
    if (tagSortMode === "count") {
      return b.count - a.count || a.name.localeCompare(b.name, language);
    }
    if (tagSortMode === "color") {
      const posA = a.colorPosition ?? 999;
      const posB = b.colorPosition ?? 999;
      if (posA !== posB) return posA - posB;
      return a.name.localeCompare(b.name, language);
    }
    return a.name.localeCompare(b.name, language);
  });

  currentTagRows = [
    {
      key: "untagged",
      label: translate("untagged"),
      count: overview.untaggedItems,
      kind: "untagged",
      scope: { kind: "untagged" },
    },
    ...sortedTags.map((tag) => ({
      key: `tag:${tag.name}`,
      label: tag.name,
      count: tag.count,
      kind: tag.kind,
      color: tag.color,
      colorPosition: tag.colorPosition,
      scope: { kind: "tag" as const, tagName: tag.name },
    })),
  ];

  element("tag-total").textContent = String(overview.tags.length);
  renderColoredTagsBar();
  filterTagList();
  updateTagActionButton();
}

function renderColoredTagsBar(): void {
  const bar = element("colored-tags-bar");
  const slots = overview?.coloredTags || [];
  if (!slots.length) {
    bar.hidden = true;
    bar.replaceChildren();
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const slot of slots) {
    fragment.appendChild(createColoredSlotPill(slot));
  }
  bar.replaceChildren(fragment);
  bar.hidden = false;
}

function createColoredSlotPill(slot: ColoredTagSlot): HTMLButtonElement {
  const pill = document.createElement("button");
  pill.type = "button";
  pill.className = "colored-slot-pill";
  pill.style.setProperty("--tag-bg", slot.color);
  pill.style.setProperty("--tag-fg", getContrastingTextColor(slot.color));
  if (includeTags.includes(slot.name)) pill.classList.add("active-and");
  if (excludeTags.includes(slot.name)) pill.classList.add("active-not");
  pill.title = `[${slot.position}] ${slot.name}\n${translate("booleanTagHint")}`;

  const num = document.createElement("span");
  num.className = "colored-slot-num";
  num.textContent = String(slot.position);
  const name = document.createElement("span");
  name.className = "colored-slot-name";
  name.textContent = slot.name;
  pill.append(num, name);

  pill.addEventListener("click", (event) => {
    handleTagFilterClick(slot.name, event as MouseEvent);
  });
  pill.addEventListener("contextmenu", (event) => {
    const source = overview?.tags.find((t) => t.name === slot.name);
    if (!source) return;
    event.preventDefault();
    const mouseEvent = event as MouseEvent;
    openTagActionsMenu(source, mouseEvent.clientX, mouseEvent.clientY);
  });

  if (isCurrentLibraryEditable()) {
    pill.draggable = true;
    pill.addEventListener("dragstart", (rawEvent) => {
      startTagDrag(rawEvent as DragEvent, slot.name);
    });
    pill.addEventListener("dragend", cleanupDragGhost);
    bindItemDropOntoTagElement(pill, slot.name);
  }

  return pill;
}

function filterTagList(): void {
  const queryInput = element<HTMLInputElement>("tag-search");
  const query = normalize(queryInput.value);
  const hideAutomatic = element<HTMLInputElement>(
    "hide-automatic-tags",
  ).checked;
  element("clear-tag-search").hidden = !queryInput.value;

  visibleTagRows = currentTagRows.filter((entry) => {
    if (entry.kind === "untagged") {
      if (tagKindFilter !== "all") return false;
      return !query || normalize(entry.label).includes(query);
    }
    if (
      hideAutomatic &&
      entry.kind === "automatic" &&
      tagKindFilter !== "automatic"
    ) {
      return false;
    }
    if (tagKindFilter === "manual" && entry.kind === "automatic") return false;
    if (tagKindFilter === "automatic" && entry.kind === "manual") return false;
    if (tagKindFilter === "colored" && !entry.color) return false;
    if (tagKindFilter === "single" && entry.count !== 1) return false;
    return !query || normalize(entry.label).includes(query);
  });

  tagVirtualList.setItems(visibleTagRows);
  element("tag-list-status").textContent = translate("tagStatus", {
    visible: visibleTagRows.length,
    total: currentTagRows.length,
  });
}

function renderTagRow(entry: TagListEntry): HTMLElement {
  const row = document.createElement("div");
  row.className = "tag-row";
  row.setAttribute("role", "option");

  const isUntagged = entry.scope.kind === "untagged";
  const tagName = entry.scope.kind === "tag" ? entry.scope.tagName : "";
  const isIncluded = isUntagged ? untaggedOnly : includeTags.includes(tagName);
  const isExcluded = !isUntagged && excludeTags.includes(tagName);

  row.setAttribute("aria-selected", String(isIncluded));
  if (isExcluded) row.classList.add("excluded-tag");

  const filteredActive = isFilteredQueryActive();
  const facetCount =
    !isUntagged && filteredActive
      ? (facetTagCounts[tagName] ?? 0)
      : entry.count;
  if (!isUntagged && filteredActive && facetCount === 0 && !isIncluded) {
    row.classList.add("zero-facet");
  }

  const dot = document.createElement("span");
  if (entry.color) {
    dot.className = "tag-dot colored-swatch";
    dot.style.backgroundColor = entry.color;
    dot.style.color = getContrastingTextColor(entry.color);
    dot.textContent = entry.colorPosition ? String(entry.colorPosition) : "";
  } else {
    dot.className = `tag-dot ${entry.kind}`;
  }

  const name = document.createElement("span");
  name.className = "tag-name";
  name.textContent = entry.label;

  const meta = document.createElement("span");
  meta.className = "tag-meta-group";
  if (!isUntagged && (isIncluded || isExcluded)) {
    const badge = document.createElement("span");
    badge.className = "tag-bool-badge";
    badge.textContent = isExcluded ? "−" : "+";
    meta.appendChild(badge);
  }
  const count = document.createElement("span");
  count.className = "tag-count";
  count.textContent =
    !isUntagged && filteredActive
      ? `${facetCount}/${entry.count}`
      : String(entry.count);
  meta.appendChild(count);

  row.append(dot, name, meta);
  row.title = isUntagged
    ? entry.label
    : `${entry.label}\n${isIncluded ? translate("deselectTag") : translate("booleanTagHint")}`;

  row.addEventListener("click", (event) => {
    if (isUntagged) {
      markSavedFilterDirty();
      untaggedOnly = !untaggedOnly;
      if (untaggedOnly) {
        includeTags = [];
        excludeTags = [];
      }
      void executeUnifiedQuery();
    } else {
      handleTagFilterClick(tagName, event as MouseEvent);
    }
  });

  row.addEventListener("contextmenu", (event) => {
    if (entry.scope.kind !== "tag") return;
    const source = overview?.tags.find((tag) => tag.name === tagName);
    if (!source) return;
    event.preventDefault();
    const mouseEvent = event as MouseEvent;
    openTagActionsMenu(source, mouseEvent.clientX, mouseEvent.clientY);
  });

  if (entry.scope.kind === "tag" && isCurrentLibraryEditable()) {
    row.title += `\n${translate("dropTagHint")}`;
    row.draggable = true;
    row.addEventListener("dragstart", (rawEvent) => {
      startTagDrag(rawEvent as DragEvent, tagName);
    });
    row.addEventListener("dragend", cleanupDragGhost);
    bindItemDropOntoTagElement(row, tagName);
  }

  return row;
}

function handleTagFilterClick(tagName: string, event: MouseEvent): void {
  markSavedFilterDirty();
  untaggedOnly = false;
  if (event.altKey) {
    toggleExcludeTag(tagName);
    return;
  }
  if (event.ctrlKey || event.metaKey) {
    toggleIncludeTag(tagName);
    return;
  }
  if (
    includeTags.length === 1 &&
    includeTags[0] === tagName &&
    excludeTags.length === 0
  ) {
    includeTags = [];
  } else {
    includeTags = [tagName];
    excludeTags = excludeTags.filter((t) => t !== tagName);
  }
  void executeUnifiedQuery();
}

function toggleIncludeTag(tagName: string): void {
  markSavedFilterDirty();
  untaggedOnly = false;
  excludeTags = excludeTags.filter((t) => t !== tagName);
  if (includeTags.includes(tagName)) {
    includeTags = includeTags.filter((t) => t !== tagName);
  } else {
    includeTags = [...includeTags, tagName];
  }
  void executeUnifiedQuery();
}

function toggleExcludeTag(tagName: string): void {
  markSavedFilterDirty();
  untaggedOnly = false;
  includeTags = includeTags.filter((t) => t !== tagName);
  if (excludeTags.includes(tagName)) {
    excludeTags = excludeTags.filter((t) => t !== tagName);
  } else {
    excludeTags = [...excludeTags, tagName];
  }
  void executeUnifiedQuery();
}

function bindItemDropOntoTagElement(
  target: HTMLElement,
  dropTagName: string,
): void {
  target.addEventListener("dragover", (rawEvent) => {
    const event = rawEvent as DragEvent;
    if (!event.dataTransfer || !hasZoteroItemDrag(event.dataTransfer.types)) {
      return;
    }
    event.preventDefault();
    const removeMode = event.altKey;
    event.dataTransfer.dropEffect = removeMode ? "move" : "copy";
    target.classList.toggle("drop-target", !removeMode);
    target.classList.toggle("drop-remove-target", removeMode);
  });
  target.addEventListener("dragleave", (rawEvent) => {
    const event = rawEvent as DragEvent;
    if (!target.contains(event.relatedTarget as Node | null)) {
      target.classList.remove("drop-target", "drop-remove-target");
    }
  });
  target.addEventListener("drop", (rawEvent) => {
    const event = rawEvent as DragEvent;
    const removeMode = event.altKey;
    target.classList.remove("drop-target", "drop-remove-target");
    if (!event.dataTransfer) return;
    const itemIDs = parseZoteroItemDrop(
      event.dataTransfer.getData(ZOTERO_ITEM_DRAG_TYPE),
    );
    if (!itemIDs.length) return;
    event.preventDefault();
    event.stopPropagation();
    void mutateDroppedItemsOnTag(itemIDs, dropTagName, removeMode);
  });
}

async function mutateDroppedItemsOnTag(
  itemIDs: number[],
  tagName: string,
  removeMode: boolean,
): Promise<void> {
  if (!api || !isCurrentLibraryEditable()) return;
  const preserveIDs = getSelectedItemIDs();
  try {
    suppressNotificationsUntil = Date.now() + 1400;
    const result = removeMode
      ? await api.removeTags(itemIDs, tagName)
      : await api.addTags(itemIDs, tagName);
    showToast(
      translate(removeMode ? "dropTagRemoved" : "dropTagApplied", {
        tag: result.tagName,
        count: result.affectedItems,
      }),
    );
    await refreshAfterMutation(preserveIDs);
  } catch (error) {
    showError(error);
  }
}

function startTagDrag(event: DragEvent, tagName: string): void {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(TAGNAVIGATOR_TAG_DRAG_TYPE, tagName);
  event.dataTransfer.setData("text/plain", tagName);
  attachDragGhost(event, `#${tagName}`);
}

function startItemRowDrag(event: DragEvent, rowItem: ItemSummary): void {
  if (!event.dataTransfer) return;
  const draggedIDs = selectedItemIDs.has(rowItem.id)
    ? getSelectedItemIDs()
    : [rowItem.id];
  const payload = serializeZoteroItemDrag(draggedIDs);
  if (!payload) return;
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData(ZOTERO_ITEM_DRAG_TYPE, payload);
  event.dataTransfer.setData("text/plain", rowItem.title || payload);
  const label =
    draggedIDs.length > 1
      ? translate("dragItemsBadge", { count: draggedIDs.length })
      : (rowItem.title || translate("untitled")).slice(0, 44);
  attachDragGhost(event, label);
}

function attachDragGhost(event: DragEvent, label: string): void {
  cleanupDragGhost();
  if (!event.dataTransfer?.setDragImage || !document.body) return;
  const badge = document.createElement("div");
  badge.className = "drag-ghost-badge";
  badge.textContent = label;
  document.body.appendChild(badge);
  activeDragGhost = badge;
  event.dataTransfer.setDragImage(badge, 12, 14);
}

function cleanupDragGhost(): void {
  if (activeDragGhost) {
    activeDragGhost.remove();
    activeDragGhost = null;
  }
}

function autoScrollVirtualContainer(
  container: HTMLElement,
  event: DragEvent,
): void {
  const rect = container.getBoundingClientRect();
  const edgeThreshold = 34;
  if (event.clientY < rect.top + edgeThreshold) {
    container.scrollTop -= 12;
  } else if (event.clientY > rect.bottom - edgeThreshold) {
    container.scrollTop += 12;
  }
}

/* ==========================================================================
 * Context Menus, Tag Actions, Color Palette & Curation
 * ========================================================================== */

function selectedTagSummary(): TagSummary | null {
  if (!overview || !includeTags.length) return null;
  return overview.tags.find((tag) => tag.name === includeTags[0]) || null;
}

function updateTagActionButton(): void {
  const button = element<HTMLButtonElement>("tag-actions-button");
  const source = selectedTagSummary();
  button.disabled = !source;
  button.title = source
    ? `${translate("tagActions")}: ${source.name}`
    : translate("tagActions");
  button.setAttribute("aria-label", button.title);
}

function closeAllContextMenus(): void {
  for (const id of [
    "tag-actions-menu",
    "tag-curation-menu",
    "columns-menu",
    "item-context-menu",
  ]) {
    element(id).hidden = true;
  }
  tagActionSource = null;
}

function positionContextMenu(
  menu: HTMLElement,
  x: number,
  y: number,
  alignEnd = false,
): void {
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
}

function openTagActionsMenu(
  source: TagSummary,
  x: number,
  y: number,
  alignEnd = false,
): void {
  closeAllContextMenus();
  const editable = isCurrentLibraryEditable();
  const menu = element("tag-actions-menu");
  tagActionSource = source;

  const removeColorBtn = element<HTMLButtonElement>("tag-menu-remove-color");
  removeColorBtn.hidden = !source.color;
  removeColorBtn.disabled = !editable;

  const convertBtn = element<HTMLButtonElement>("tag-menu-convert-manual");
  convertBtn.hidden = source.automaticCount === 0;
  convertBtn.disabled = !editable;

  menu
    .querySelectorAll<HTMLButtonElement>("button[data-tag-action]")
    .forEach((btn: HTMLButtonElement) => {
      const act = btn.dataset.tagAction;
      if (act === "filter-and" || act === "filter-not") {
        btn.disabled = false;
      } else {
        btn.disabled = !editable;
      }
    });

  positionContextMenu(menu, x, y, alignEnd);
  window.setTimeout(
    () =>
      menu
        .querySelector<HTMLButtonElement>("button:not([hidden]):not(:disabled)")
        ?.focus(),
    0,
  );
}

function openTagCurationMenu(anchor: HTMLElement): void {
  closeAllContextMenus();
  const menu = element("tag-curation-menu");
  const removeAutoBtn = element<HTMLButtonElement>("curation-remove-auto");
  const hasAuto = Boolean(overview?.tags.some((t) => t.automaticCount > 0));
  removeAutoBtn.disabled = !isCurrentLibraryEditable() || !hasAuto;
  const rect = anchor.getBoundingClientRect();
  positionContextMenu(menu, rect.right, rect.bottom + 3, true);
}

function openItemContextMenu(x: number, y: number): void {
  closeAllContextMenus();
  const menu = element("item-context-menu");
  const slotsSection = element("item-context-colored-section");
  const slotsContainer = element("item-context-colored-slots");
  const slots = overview?.coloredTags || [];

  if (slots.length && isCurrentLibraryEditable() && selectedItemIDs.size > 0) {
    const fragment = document.createDocumentFragment();
    for (const slot of slots) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "colored-slot-pill";
      btn.style.setProperty("--tag-bg", slot.color);
      btn.style.setProperty("--tag-fg", getContrastingTextColor(slot.color));
      btn.title = `[${slot.position}] ${slot.name}`;
      btn.textContent = `${slot.position} · ${slot.name}`;
      btn.addEventListener("click", () => {
        closeAllContextMenus();
        void toggleColoredSlotOnSelection(slot.position);
      });
      fragment.appendChild(btn);
    }
    slotsContainer.replaceChildren(fragment);
    slotsSection.hidden = false;
  } else {
    slotsSection.hidden = true;
  }

  positionContextMenu(menu, x, y, false);
}

function openTagColorDialog(source: TagSummary): void {
  if (!isCurrentLibraryEditable()) {
    showToast(translate("readOnlyLibrary"), true);
    return;
  }
  colorDialogSource = source;
  element("tag-color-description").textContent = translate(
    "assignColorDescription",
    { tag: source.name },
  );
  element("tag-color-error").hidden = true;
  element("tag-color-remove").hidden = !source.color;

  const initialColor =
    normalizeHexColor(source.color || "") ||
    ZOTERO_TAG_PALETTE[
      Math.min(overview?.coloredTags.length || 0, ZOTERO_TAG_PALETTE.length - 1)
    ];
  element<HTMLInputElement>("tag-color-picker").value = initialColor;
  element<HTMLInputElement>("tag-color-hex").value = initialColor;

  const swatches = element("tag-color-swatches");
  const swatchFrag = document.createDocumentFragment();
  for (const hex of ZOTERO_TAG_PALETTE) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "palette-swatch-button";
    btn.style.backgroundColor = hex;
    btn.dataset.swatchColor = hex;
    btn.title = hex;
    btn.setAttribute("aria-label", hex);
    btn.addEventListener("click", () => {
      element<HTMLInputElement>("tag-color-picker").value = hex;
      element<HTMLInputElement>("tag-color-hex").value = hex;
      highlightSelectedPaletteSwatch(hex);
    });
    swatchFrag.appendChild(btn);
  }
  swatches.replaceChildren(swatchFrag);
  highlightSelectedPaletteSwatch(initialColor);

  const posSelect = element<HTMLSelectElement>("tag-color-position");
  const posFrag = document.createDocumentFragment();
  const coloredSlots = overview?.coloredTags || [];
  const maxPos = source.colorPosition
    ? coloredSlots.length
    : Math.min(MAX_COLORED_TAG_SLOTS, coloredSlots.length + 1);
  for (let pos = 1; pos <= Math.max(1, maxPos); pos++) {
    const existing = coloredSlots.find((s) => s.position === pos);
    const label = !existing
      ? translate("slotFree", { pos })
      : existing.name === source.name
        ? translate("slotCurrent", { pos, tag: existing.name })
        : translate("slotUsed", { pos, tag: existing.name });
    posFrag.appendChild(createOption(String(pos), label));
  }
  posSelect.replaceChildren(posFrag);
  posSelect.value = String(source.colorPosition || maxPos);

  const dialog = element<HTMLDialogElement>("tag-color-dialog");
  if (!dialog.open) dialog.showModal();
}

function highlightSelectedPaletteSwatch(hex: string): void {
  const normalized = normalizeHexColor(hex);
  element("tag-color-swatches")
    .querySelectorAll<HTMLButtonElement>(".palette-swatch-button")
    .forEach((btn: HTMLButtonElement) => {
      btn.classList.toggle("selected", btn.dataset.swatchColor === normalized);
    });
}

function closeTagColorDialog(): void {
  const dialog = element<HTMLDialogElement>("tag-color-dialog");
  if (dialog.open) dialog.close();
  colorDialogSource = null;
}

async function submitTagColorDialog(): Promise<void> {
  if (!api || !colorDialogSource) return;
  const source = colorDialogSource;
  const hex = normalizeHexColor(
    element<HTMLInputElement>("tag-color-hex").value,
  );
  const errorEl = element("tag-color-error");
  if (!hex) {
    errorEl.textContent = translate("errorInvalidColor");
    errorEl.hidden = false;
    return;
  }
  const position =
    Number(element<HTMLSelectElement>("tag-color-position").value) || 1;
  errorEl.hidden = true;

  try {
    suppressNotificationsUntil = Date.now() + 1800;
    await api.setTagColor(currentLibraryID, source.name, hex, position);
    closeTagColorDialog();
    showToast(translate("tagColorSaved", { pos: position, tag: source.name }));
    await refreshAfterMutation(getSelectedItemIDs());
  } catch (error) {
    errorEl.textContent = friendlyError(error);
    errorEl.hidden = false;
  }
}

async function removeColorFromTag(tagName: string): Promise<void> {
  if (!api || !isCurrentLibraryEditable()) return;
  try {
    suppressNotificationsUntil = Date.now() + 1800;
    await api.setTagColor(currentLibraryID, tagName, null);
    showToast(translate("tagColorRemoved", { tag: tagName }));
    await refreshAfterMutation(getSelectedItemIDs());
  } catch (error) {
    showError(error);
  }
}

async function toggleColoredSlotOnSelection(position: number): Promise<void> {
  if (!api || !isCurrentLibraryEditable()) return;
  const itemIDs = getSelectedItemIDs();
  if (!itemIDs.length) return;
  try {
    suppressNotificationsUntil = Date.now() + 1500;
    const result = await api.toggleColoredTagByPosition(
      currentLibraryID,
      itemIDs,
      position,
    );
    if (!result) return;
    showToast(
      translate(result.action === "add" ? "batchTagAdded" : "batchTagRemoved", {
        tag: result.tagName,
        count: result.affectedItems,
      }),
    );
    await refreshAfterMutation(itemIDs);
  } catch (error) {
    showError(error);
  }
}

function openTagActionDialog(mode: TagActionMode, source: TagSummary): void {
  closeAllContextMenus();
  tagActionMode = mode;
  tagActionSource = source;
  tagActionAutocompleteMatches = [];
  tagActionAutocompleteIndex = -1;

  const keys: Record<
    TagActionMode,
    {
      title: string;
      description: string;
      label: string;
      confirm: string;
      danger?: boolean;
      needsInput?: boolean;
    }
  > = {
    rename: {
      title: "renameTagTitle",
      description: "renameTagDescription",
      label: "newTagName",
      confirm: "confirmRename",
      needsInput: true,
    },
    merge: {
      title: "mergeTagTitle",
      description: "mergeTagDescription",
      label: "mergeTarget",
      confirm: "confirmMerge",
      needsInput: true,
    },
    delete: {
      title: "deleteTagTitle",
      description: "deleteTagDescription",
      label: "mergeTarget",
      confirm: "confirmDelete",
      danger: true,
    },
    convertToManual: {
      title: "convertAutoTitle",
      description: "convertAutoDescription",
      label: "newTagName",
      confirm: "confirmConvertAuto",
    },
    removeAllAutomatic: {
      title: "removeAllAutoTitle",
      description: "removeAllAutoDescription",
      label: "newTagName",
      confirm: "confirmRemoveAllAuto",
      danger: true,
    },
  };

  const config = keys[mode];
  element("tag-action-title").textContent = translate(config.title);
  element("tag-action-description").textContent = translate(
    config.description,
    {
      tag: source.name,
      count: (mode === "convertToManual"
        ? source.automaticCount
        : source.count
      ).toLocaleString(language),
    },
  );
  element("tag-action-target-label").textContent = translate(config.label);
  const field = element("tag-action-target-field");
  field.hidden = !config.needsInput;
  const input = element<HTMLInputElement>("tag-action-target");
  input.value = mode === "rename" ? source.name : "";
  input.placeholder =
    mode === "merge" ? translate("mergeTargetPlaceholder") : "";
  const confirm = element<HTMLButtonElement>("tag-action-confirm");
  confirm.textContent = translate(config.confirm);
  confirm.classList.toggle("danger", Boolean(config.danger));
  confirm.disabled = false;
  element<HTMLButtonElement>("tag-action-cancel").disabled = false;
  element<HTMLButtonElement>("tag-action-close").disabled = false;
  element("tag-action-error").hidden = true;
  element("tag-action-autocomplete").hidden = true;

  const dialog = element<HTMLDialogElement>("tag-action-dialog");
  if (!dialog.open) dialog.showModal();
  if (config.needsInput) {
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
    } else if (mode === "convertToManual") {
      result = await api.convertAutomaticTagToManual(
        currentLibraryID,
        source.name,
      );
    } else if (mode === "removeAllAutomatic") {
      result = await api.removeAutomaticTags(currentLibraryID);
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

  if (result.action === "delete") {
    includeTags = includeTags.filter((t) => t !== result.sourceName);
    excludeTags = excludeTags.filter((t) => t !== result.sourceName);
    await executeUnifiedQuery();
    showToast(
      translate("libraryTagDeleted", {
        tag: result.sourceName,
        count: result.affectedItems.toLocaleString(language),
      }),
    );
    return;
  }

  if (result.action === "convertToManual") {
    await executeUnifiedQuery({ preserveItemIDs: getSelectedItemIDs() });
    showToast(
      translate("tagConvertedManual", {
        tag: result.sourceName,
        count: result.affectedItems.toLocaleString(language),
      }),
    );
    return;
  }

  if (result.action === "removeAllAutomatic") {
    const validNames = new Set(overview.tags.map((t) => t.name));
    includeTags = includeTags.filter((t) => validNames.has(t));
    excludeTags = excludeTags.filter((t) => validNames.has(t));
    await executeUnifiedQuery({ preserveItemIDs: getSelectedItemIDs() });
    showToast(
      translate("allAutoTagsRemoved", {
        count: result.affectedItems.toLocaleString(language),
      }),
    );
    return;
  }

  if (result.targetName) {
    includeTags = includeTags.map((t) =>
      t === result.sourceName ? result.targetName! : t,
    );
    includeTags = Array.from(new Set(includeTags));
    if (!includeTags.length) includeTags = [result.targetName];
    await executeUnifiedQuery();
    showToast(
      translate(result.action === "merge" ? "tagsMerged" : "tagRenamed", {
        source: result.sourceName,
        target: result.targetName,
        count: result.affectedItems.toLocaleString(language),
      }),
    );
  }
}

/* ==========================================================================
 * Advanced Search Builder & Active Filter Strip
 * ========================================================================== */

function toggleAdvancedSearchPanel(): void {
  const panel = element("advanced-search-panel");
  const button = element("advanced-search-toggle");
  panel.hidden = !panel.hidden;
  button.setAttribute("aria-expanded", String(!panel.hidden));
  if (!panel.hidden && advancedConditions.length === 0) {
    advancedConditions.push({
      condition: "title",
      operator: "contains",
      value: "",
    });
    renderAdvancedConditionRows();
  }
}

function getConditionDefinitions(): SearchConditionDefinition[] {
  return bootstrap?.searchConditions?.length
    ? bootstrap.searchConditions
    : [
        {
          name: "title",
          label: translate("title"),
          operators: [
            "contains",
            "doesNotContain",
            "is",
            "isNot",
            "beginsWith",
          ],
        },
      ];
}

function renderAdvancedConditionRows(): void {
  const container = element("advanced-conditions-list");
  const defs = getConditionDefinitions();
  const fragment = document.createDocumentFragment();

  advancedConditions.forEach((row, index) => {
    const rowEl = document.createElement("div");
    rowEl.className = "advanced-condition-row";

    const condSelect = document.createElement("select");
    condSelect.className = "advanced-condition-field";
    for (const def of defs) {
      condSelect.appendChild(createOption(def.name, def.label));
    }
    if (!defs.some((d) => d.name === row.condition)) {
      row.condition = defs[0].name;
    }
    condSelect.value = row.condition;

    const currentDef = defs.find((d) => d.name === row.condition) || defs[0];
    const opSelect = document.createElement("select");
    opSelect.className = "advanced-condition-operator";
    for (const op of currentDef.operators) {
      opSelect.appendChild(createOption(op, translateOperator(op)));
    }
    if (!currentDef.operators.includes(row.operator)) {
      row.operator = currentDef.operators[0] || "contains";
    }
    opSelect.value = row.operator;

    const valueControl = buildAdvancedConditionValueControl(row);

    condSelect.addEventListener("change", () => {
      markSavedFilterDirty();
      row.condition = condSelect.value;
      const nextDef = defs.find((d) => d.name === row.condition) || defs[0];
      if (!nextDef.operators.includes(row.operator)) {
        row.operator = nextDef.operators[0] || "contains";
      }
      if (row.condition === "itemType" || row.condition === "collection") {
        row.value = "";
      }
      renderAdvancedConditionRows();
    });

    opSelect.addEventListener("change", () => {
      markSavedFilterDirty();
      row.operator = opSelect.value;
      renderAdvancedConditionRows();
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "icon-button compact";
    removeBtn.title = translate("removeCondition");
    removeBtn.setAttribute("aria-label", removeBtn.title);
    removeBtn.appendChild(
      createIcon("chrome://zotero/skin/16/universal/x-8.svg"),
    );
    removeBtn.addEventListener("click", () => {
      markSavedFilterDirty();
      advancedConditions.splice(index, 1);
      if (!advancedConditions.length) {
        advancedConditions.push({
          condition: "title",
          operator: "contains",
          value: "",
        });
      }
      renderAdvancedConditionRows();
      updateAdvancedConditionBadge();
      void executeUnifiedQuery();
    });

    rowEl.append(condSelect, opSelect, valueControl, removeBtn);
    fragment.appendChild(rowEl);
  });

  container.replaceChildren(fragment);
  element<HTMLSelectElement>("advanced-join-mode").value = joinMode;
  element<HTMLInputElement>("include-subcollections").checked =
    includeSubcollections;
}

function buildAdvancedConditionValueControl(
  row: AdvancedSearchCondition,
): HTMLElement {
  if (UNARY_OPERATORS.has(row.operator)) {
    const placeholder = document.createElement("input");
    placeholder.type = "text";
    placeholder.value = "—";
    placeholder.disabled = true;
    return placeholder;
  }

  if (row.condition === "itemType" && bootstrap?.itemTypes?.length) {
    const select = document.createElement("select");
    select.className = "advanced-condition-value";
    for (const itemType of bootstrap.itemTypes) {
      select.appendChild(createOption(itemType.name, itemType.label));
    }
    if (!row.value || !bootstrap.itemTypes.some((t) => t.name === row.value)) {
      row.value = bootstrap.itemTypes[0].name;
    }
    select.value = row.value;
    select.addEventListener("change", () => {
      markSavedFilterDirty();
      row.value = select.value;
      updateAdvancedConditionBadge();
    });
    return select;
  }

  if (row.condition === "collection" && collections.length) {
    const select = document.createElement("select");
    select.className = "advanced-condition-value";
    for (const col of collections) {
      select.appendChild(createOption(col.key, col.path));
    }
    if (!row.value || !collections.some((c) => c.key === row.value)) {
      row.value = collections[0].key;
    }
    select.value = row.value;
    select.addEventListener("change", () => {
      markSavedFilterDirty();
      row.value = select.value;
      updateAdvancedConditionBadge();
    });
    return select;
  }

  const input = document.createElement("input");
  input.className = "advanced-condition-value";
  if (
    (row.condition === "dateAdded" || row.condition === "dateModified") &&
    row.operator !== "isInTheLast"
  ) {
    input.type = "date";
  } else {
    input.type = "text";
  }
  input.value = row.value;
  input.addEventListener("input", () => {
    markSavedFilterDirty();
    row.value = input.value;
    updateAdvancedConditionBadge();
  });
  input.addEventListener("keydown", (rawEvent) => {
    const event = rawEvent as KeyboardEvent;
    if (event.key === "Enter") {
      event.preventDefault();
      updateAdvancedConditionBadge();
      void executeUnifiedQuery();
    }
  });
  return input;
}

function updateAdvancedConditionBadge(): void {
  const count = activeAdvancedConditions().length;
  const badge = element("advanced-condition-count");
  badge.textContent = String(count);
  badge.hidden = count === 0;
}

function renderActiveFilterPills(): void {
  const strip = element("active-filters-strip");
  const container = element("active-filter-pills");
  const pills: Array<{
    label: string;
    kind: "and" | "not" | "neutral";
    clear: () => void;
  }> = [];

  if (untaggedOnly) {
    pills.push({
      label: translate("untagged"),
      kind: "and",
      clear: () => {
        untaggedOnly = false;
        void executeUnifiedQuery();
      },
    });
  }
  for (const tag of includeTags) {
    pills.push({
      label: `+ #${tag}`,
      kind: "and",
      clear: () => toggleIncludeTag(tag),
    });
  }
  for (const tag of excludeTags) {
    pills.push({
      label: `− #${tag}`,
      kind: "not",
      clear: () => toggleExcludeTag(tag),
    });
  }
  if (activeCollectionID !== null) {
    const col = collections.find((c) => c.id === activeCollectionID);
    pills.push({
      label: `📁 ${col?.path || activeCollectionID}`,
      kind: "neutral",
      clear: () => {
        activeCollectionID = null;
        populateScopeCollectionSelect();
        void executeUnifiedQuery();
      },
    });
  } else if (unfiledOnly) {
    pills.push({
      label: `📁 ${translate("unfiledItemsScope")}`,
      kind: "neutral",
      clear: () => {
        unfiledOnly = false;
        populateScopeCollectionSelect();
        void executeUnifiedQuery();
      },
    });
  } else if (activeSavedSearchID !== null) {
    const search = savedSearches.find((s) => s.id === activeSavedSearchID);
    pills.push({
      label: `🔍 ${search?.name || activeSavedSearchID}`,
      kind: "neutral",
      clear: () => {
        activeSavedSearchID = null;
        populateScopeCollectionSelect();
        void executeUnifiedQuery();
      },
    });
  }

  const qs = element<HTMLInputElement>("item-search").value.trim();
  if (qs) {
    pills.push({
      label: `“${qs}”`,
      kind: "neutral",
      clear: () => {
        element<HTMLInputElement>("item-search").value = "";
        handleItemSearchInput();
      },
    });
  }

  for (const cond of activeAdvancedConditions()) {
    const def = getConditionDefinitions().find(
      (d) => d.name === cond.condition,
    );
    pills.push({
      label: `${def?.label || cond.condition} ${translateOperator(cond.operator)}${cond.value ? ` ${cond.value}` : ""}`,
      kind: "neutral",
      clear: () => {
        advancedConditions = advancedConditions.filter((c) => c !== cond);
        renderAdvancedConditionRows();
        updateAdvancedConditionBadge();
        void executeUnifiedQuery();
      },
    });
  }

  if (!pills.length) {
    strip.hidden = true;
    container.replaceChildren();
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const entry of pills) {
    const pill = document.createElement("span");
    pill.className = `active-pill ${entry.kind === "and" ? "pill-and" : entry.kind === "not" ? "pill-not" : ""}`;
    const text = document.createElement("span");
    text.textContent = entry.label;
    text.title = entry.label;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = `${translate("dismiss")}: ${entry.label}`;
    btn.setAttribute("aria-label", btn.title);
    btn.textContent = "×";
    btn.addEventListener("click", () => {
      markSavedFilterDirty();
      entry.clear();
    });
    pill.append(text, btn);
    fragment.appendChild(pill);
  }
  container.replaceChildren(fragment);
  strip.hidden = false;
}

async function clearAllActiveFilters(): Promise<void> {
  markSavedFilterDirty();
  includeTags = [];
  excludeTags = [];
  untaggedOnly = false;
  activeCollectionID = null;
  unfiledOnly = false;
  activeSavedSearchID = null;
  advancedConditions = [];
  element<HTMLInputElement>("item-search").value = "";
  element("clear-item-search").hidden = true;
  populateScopeCollectionSelect();
  renderAdvancedConditionRows();
  updateAdvancedConditionBadge();
  resetClientFilters();
  await executeUnifiedQuery();
}

/* ==========================================================================
 * Quick Search, Client Refinement Filters & Item Table
 * ========================================================================== */

function handleItemSearchInput(): void {
  markSavedFilterDirty();
  const input = element<HTMLInputElement>("item-search");
  element("clear-item-search").hidden = !input.value;
  updateActiveFilterCount();
  renderActiveFilterPills();

  window.clearTimeout(quickSearchTimer);
  quickSearchTimer = window.setTimeout(() => {
    void executeUnifiedQuery();
  }, 220);
}

function populateItemFilterOptions(): void {
  const authorSelect = element<HTMLSelectElement>("author-filter");
  const tagSelect = element<HTMLSelectElement>("second-tag-filter");
  const prevAuthor = authorSelect.value;
  const prevTag = tagSelect.value;
  const authors = new Set<string>();
  const tags = new Set<string>();

  for (const item of allItems) {
    item.creators.forEach((creator) => authors.add(creator));
    item.tags.forEach((tag) => {
      if (!includeTags.includes(tag.name)) {
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
  if (prevAuthor && authors.has(prevAuthor)) authorSelect.value = prevAuthor;

  tagSelect.replaceChildren(createOption("", translate("anyTag")));
  Array.from(tags)
    .sort((a, b) => a.localeCompare(b, language))
    .forEach((tag) => tagSelect.appendChild(createOption(tag, tag)));
  if (prevTag && tags.has(prevTag)) tagSelect.value = prevTag;
}

function applyItemFilters(preserveScroll = false): void {
  const author = element<HTMLSelectElement>("author-filter").value;
  const secondTag = element<HTMLSelectElement>("second-tag-filter").value;
  const minimum = numberOrNull(element<HTMLInputElement>("year-min").value);
  const maximum = numberOrNull(element<HTMLInputElement>("year-max").value);
  const dateAddedFrom = element<HTMLInputElement>("date-added-from").value;
  const dateAddedTo = element<HTMLInputElement>("date-added-to").value;
  const dateModifiedFrom =
    element<HTMLInputElement>("date-modified-from").value;
  const dateModifiedTo = element<HTMLInputElement>("date-modified-to").value;
  const hasPDF = element<HTMLInputElement>("filter-has-pdf").checked;
  const hasNotes = element<HTMLInputElement>("filter-has-notes").checked;

  visibleItems = allItems.filter((item) => {
    if (author && !item.creators.includes(author)) return false;
    if (secondTag && !item.tags.some((tag) => tag.name === secondTag))
      return false;
    if (minimum !== null && (item.year === null || item.year < minimum))
      return false;
    if (maximum !== null && (item.year === null || item.year > maximum))
      return false;
    if (!isItemTimestampInRange(item.dateAdded, dateAddedFrom, dateAddedTo))
      return false;
    if (
      !isItemTimestampInRange(
        item.dateModified,
        dateModifiedFrom,
        dateModifiedTo,
      )
    )
      return false;
    if (hasPDF && !item.hasPDF) return false;
    if (hasNotes && item.noteCount === 0) return false;
    return true;
  });

  sortVisibleItems();
  updateActiveFilterCount();

  const filteredActive = isFilteredQueryActive();
  element("results-count").textContent = queryHasMore
    ? queryTotal.toLocaleString(language)
    : String(visibleItems.length);
  element("items-status").textContent = translate(
    !filteredActive
      ? "recentItemsStatus"
      : queryHasMore
        ? "librarySearchLimitedStatus"
        : "librarySearchStatus",
    {
      visible: visibleItems.length,
      shown: allItems.length,
      total: queryTotal.toLocaleString(language),
    },
  );

  if (!visibleItems.length) {
    const hadSelection = selectedItemIDs.size > 0;
    selectedItemIDs.clear();
    selectedItemID = null;
    selectionAnchorID = null;
    showItemsEmpty("noItemsTitle", "noItemsBody");
    itemVirtualList.setItems([]);
    updateSelectionControls();
    if (hadSelection) resetInspector();
    return;
  }

  element("items-empty").hidden = true;
  element("items-table").hidden = false;
  itemVirtualList.setItems(visibleItems, preserveScroll);
  const selectionChanged = pruneSelectionToVisibleItems();
  updateSelectionControls();
  if (selectionChanged) void updateInspectorForSelection();
  updateSortHeaders();
}

function pruneSelectionToVisibleItems(): boolean {
  const visibleIDs = new Set(visibleItems.map((item) => item.id));
  const previousSize = selectedItemIDs.size;
  for (const itemID of selectedItemIDs) {
    if (!visibleIDs.has(itemID)) selectedItemIDs.delete(itemID);
  }
  if (selectedItemID !== null && !visibleIDs.has(selectedItemID)) {
    selectedItemID = getSelectedItemIDs()[0] || null;
  }
  if (selectionAnchorID !== null && !visibleIDs.has(selectionAnchorID)) {
    selectionAnchorID = selectedItemID;
  }
  return previousSize !== selectedItemIDs.size;
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

  cell.dataset.timestamp = value;
  const formatted = formatItemTimestamp(value, bootstrap?.locale || language);
  cell.textContent = formatted.display;
  cell.title = formatted.tooltip;
  return cell;
}

function renderItemColumnCell(
  item: ItemSummary,
  column: ItemColumnKey,
): HTMLElement {
  if (column === "title") {
    const titleCell = document.createElement("span");
    titleCell.className = "title-column";
    titleCell.setAttribute("role", "cell");

    const coloredItemTags = item.tags
      .filter((t) => Boolean(t.color))
      .sort((a, b) => (a.colorPosition ?? 99) - (b.colorPosition ?? 99))
      .slice(0, 6);
    if (coloredItemTags.length) {
      const swatches = document.createElement("span");
      swatches.className = "row-color-swatches";
      for (const ct of coloredItemTags) {
        const swatch = document.createElement("span");
        swatch.className = "row-color-swatch";
        swatch.style.backgroundColor = ct.color!;
        swatch.title = ct.name;
        swatches.appendChild(swatch);
      }
      titleCell.appendChild(swatches);
    }

    const titleText = document.createElement("span");
    titleText.className = "row-title-text";
    titleText.textContent = item.title || translate("untitled");
    titleCell.title = item.title || translate("untitled");
    titleCell.appendChild(titleText);
    return titleCell;
  }

  if (column === "creator") {
    const cell = document.createElement("span");
    cell.className = "creator-column";
    cell.setAttribute("role", "cell");
    cell.textContent = item.firstCreator || translate("unknownCreator");
    cell.title = item.creators.join(", ");
    return cell;
  }

  if (column === "year") {
    const cell = document.createElement("span");
    cell.className = "year-column";
    cell.setAttribute("role", "cell");
    cell.textContent = item.year ? String(item.year) : "";
    return cell;
  }

  if (column === "publication") {
    const cell = document.createElement("span");
    cell.className = "publication-column";
    cell.setAttribute("role", "cell");
    cell.textContent = item.publicationTitle || "";
    cell.title = item.publicationTitle || "";
    return cell;
  }

  if (column === "itemType") {
    const cell = document.createElement("span");
    cell.className = "item-type-column";
    cell.setAttribute("role", "cell");
    cell.textContent = item.itemTypeLabel || "";
    cell.title = item.itemTypeLabel || "";
    return cell;
  }

  if (column === "citekey") {
    const cell = document.createElement("span");
    cell.className = "citekey-column";
    cell.setAttribute("role", "cell");
    cell.textContent = item.citekey || "";
    cell.title = item.citekey || "";
    return cell;
  }

  if (column === "dateAdded") {
    return createTimestampCell(item.dateAdded, "date-added-column");
  }

  return createTimestampCell(item.dateModified, "date-modified-column");
}

function renderItemRow(item: ItemSummary): HTMLElement {
  const row = document.createElement("div");
  row.className = "item-row";
  row.setAttribute("role", "row");
  row.setAttribute("aria-selected", String(selectedItemIDs.has(item.id)));
  row.dataset.itemId = String(item.id);
  row.draggable = true;

  const typeCell = document.createElement("span");
  typeCell.className = "type-column";
  typeCell.setAttribute("role", "cell");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "item-select-checkbox";
  checkbox.checked = selectedItemIDs.has(item.id);
  checkbox.setAttribute(
    "aria-label",
    translate("selectItemCheckbox", {
      title: item.title || translate("untitled"),
    }),
  );
  checkbox.addEventListener("click", (event) => {
    event.stopPropagation();
    updateItemSelection(item.id, event as MouseEvent, true);
  });
  const typeIcon = createIcon(item.iconURI, "item-type-icon");
  typeIcon.title = item.itemTypeLabel;
  typeCell.append(checkbox, typeIcon);
  row.appendChild(typeCell);

  const activeCols = ITEM_COLUMN_KEYS.filter((key) =>
    visibleColumns.includes(key),
  );
  for (const col of activeCols) {
    row.appendChild(renderItemColumnCell(item, col));
  }

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
  row.appendChild(stateCell);

  row.addEventListener("click", (event) =>
    updateItemSelection(item.id, event as MouseEvent, false),
  );
  row.addEventListener("dblclick", () => {
    void triggerItemPrimaryAction(item.id);
  });
  row.addEventListener("contextmenu", (rawEvent) => {
    const event = rawEvent as MouseEvent;
    event.preventDefault();
    if (!selectedItemIDs.has(item.id)) {
      updateItemSelection(item.id, event, false);
    }
    openItemContextMenu(event.clientX, event.clientY);
  });

  row.addEventListener("dragstart", (rawEvent) => {
    startItemRowDrag(rawEvent as DragEvent, item);
  });
  row.addEventListener("dragend", cleanupDragGhost);

  // Drop dragged tag onto item row
  if (isCurrentLibraryEditable()) {
    row.addEventListener("dragover", (rawEvent) => {
      const event = rawEvent as DragEvent;
      if (
        !event.dataTransfer ||
        !hasTagNavigatorTagDrag(event.dataTransfer.types)
      ) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      row.classList.add("drop-target");
    });
    row.addEventListener("dragleave", (rawEvent) => {
      const event = rawEvent as DragEvent;
      if (!row.contains(event.relatedTarget as Node | null)) {
        row.classList.remove("drop-target");
      }
    });
    row.addEventListener("drop", (rawEvent) => {
      const event = rawEvent as DragEvent;
      row.classList.remove("drop-target");
      const tagName = event.dataTransfer?.getData(TAGNAVIGATOR_TAG_DRAG_TYPE);
      if (!tagName) return;
      event.preventDefault();
      event.stopPropagation();
      const targetIDs = selectedItemIDs.has(item.id)
        ? getSelectedItemIDs()
        : [item.id];
      void mutateDroppedItemsOnTag(targetIDs, tagName, false);
    });
  }

  return row;
}

async function triggerItemPrimaryAction(itemID: number): Promise<void> {
  if (!api || doubleClickAction === "none") return;
  if (doubleClickAction === "selectInZotero") {
    await api.selectInMainWindow(itemID);
    return;
  }
  try {
    const opened = await api.openBestAttachment(itemID);
    if (!opened) {
      await api.selectInMainWindow(itemID);
    }
  } catch (error) {
    showError(error);
  }
}

/* ==========================================================================
 * Item Selection & Right Inspector
 * ========================================================================== */

function updateItemSelection(
  itemID: number,
  event: MouseEvent | KeyboardEvent,
  checkboxToggle: boolean,
): void {
  const additive = event.ctrlKey || event.metaKey || checkboxToggle;
  const range = event.shiftKey;

  if (range && selectionAnchorID !== null) {
    const anchorIndex = visibleItems.findIndex(
      (item) => item.id === selectionAnchorID,
    );
    const itemIndex = visibleItems.findIndex((item) => item.id === itemID);
    if (anchorIndex >= 0 && itemIndex >= 0) {
      if (!additive) selectedItemIDs.clear();
      const start = Math.min(anchorIndex, itemIndex);
      const end = Math.max(anchorIndex, itemIndex);
      for (let index = start; index <= end; index++) {
        selectedItemIDs.add(visibleItems[index].id);
      }
    }
  } else if (additive) {
    if (selectedItemIDs.has(itemID)) selectedItemIDs.delete(itemID);
    else selectedItemIDs.add(itemID);
    selectionAnchorID = itemID;
  } else {
    selectedItemIDs = new Set([itemID]);
    selectionAnchorID = itemID;
  }

  selectedItemID = selectedItemIDs.has(itemID)
    ? itemID
    : getSelectedItemIDs()[0] || null;
  updateSelectionControls();
  itemVirtualList.refresh();
  void updateInspectorForSelection();
}

function selectAllVisibleItems(): void {
  selectedItemIDs = new Set(visibleItems.map((item) => item.id));
  selectedItemID = visibleItems[0]?.id || null;
  selectionAnchorID = selectedItemID;
  updateSelectionControls();
  itemVirtualList.refresh();
  void updateInspectorForSelection();
}

function clearItemSelection(): void {
  ++detailLoadToken;
  selectedItemIDs.clear();
  selectedItemID = null;
  selectionAnchorID = null;
  selectedDetails = null;
  updateSelectionControls();
  itemVirtualList.refresh();
  resetInspector();
}

function getSelectedItemIDs(): number[] {
  return visibleItems
    .filter((item) => selectedItemIDs.has(item.id))
    .map((item) => item.id);
}

function updateSelectionControls(): void {
  const checkbox = element<HTMLInputElement>("select-visible-items");
  const selectedVisible = visibleItems.filter((item) =>
    selectedItemIDs.has(item.id),
  ).length;
  checkbox.checked = Boolean(
    visibleItems.length && selectedVisible === visibleItems.length,
  );
  checkbox.indeterminate =
    selectedVisible > 0 && selectedVisible < visibleItems.length;
  checkbox.disabled = visibleItems.length === 0;
}

async function restoreItemSelection(itemIDs: number[]): Promise<void> {
  const available = new Set(visibleItems.map((item) => item.id));
  selectedItemIDs = new Set(itemIDs.filter((itemID) => available.has(itemID)));
  selectedItemID = itemIDs.find((itemID) => available.has(itemID)) || null;
  selectionAnchorID = selectedItemID;
  updateSelectionControls();
  itemVirtualList.refresh();
  await updateInspectorForSelection();
}

async function updateInspectorForSelection(): Promise<void> {
  const itemIDs = getSelectedItemIDs();
  if (!itemIDs.length) {
    resetInspector();
    return;
  }
  setInspectorOpen(true, false);
  if (itemIDs.length > 1) {
    ++detailLoadToken;
    renderMultiInspector(itemIDs);
    return;
  }
  selectedItemID = itemIDs[0];
  await loadSelectedItemDetails(itemIDs[0]);
}

async function loadSelectedItemDetails(itemID: number): Promise<void> {
  if (!api) return;
  selectedDetails = null;
  showInspectorLoading();

  const token = ++detailLoadToken;
  try {
    const details = await api.getItemDetails(itemID);
    if (
      token !== detailLoadToken ||
      selectedItemID !== itemID ||
      selectedItemIDs.size !== 1
    ) {
      return;
    }
    selectedDetails = details;
    renderInspector(details);
  } catch (error) {
    if (token === detailLoadToken) showError(error);
  }
}

function renderMultiInspector(itemIDs: number[]): void {
  selectedDetails = null;
  element("inspector-empty").hidden = true;
  element("inspector-content").hidden = false;
  element("inspector-heading-title").textContent = translate("selectedItems", {
    count: itemIDs.length,
  });
  element<HTMLImageElement>("detail-type-icon").hidden = true;
  element("detail-title").textContent = translate("selectedItems", {
    count: itemIDs.length,
  });
  element("detail-byline").textContent = translate("batchEditing");
  element("item-abstract-section").hidden = true;
  element("item-info-section").hidden = true;
  element("item-attachments-section").hidden = true;
  element("item-action-row").hidden = true;
  element("item-tags-heading").textContent = translate("batchTags");

  const items = visibleItems.filter((item) => itemIDs.includes(item.id));
  renderBatchTags(items);
  renderInspectorColoredSlots(commonTagsForItems(items).map((t) => t.name));
  renderFrequentTagsForSelection(items);
  const editable = isCurrentLibraryEditable();
  element<HTMLInputElement>("quick-tag-add").disabled = !editable;
  element<HTMLFormElement>("add-tag-form").querySelector("button")!.disabled =
    !editable;
}

function showInspectorLoading(): void {
  element("inspector-heading-title").textContent = translate("itemDetails");
  element("inspector-empty").hidden = false;
  element("inspector-empty").querySelector("p")!.textContent =
    translate("loadingDetails");
  element("inspector-content").hidden = true;
}

function renderInspector(details: ItemDetails): void {
  element("inspector-empty").hidden = true;
  element("inspector-content").hidden = false;
  element("inspector-heading-title").textContent = translate("itemDetails");
  const icon = element<HTMLImageElement>("detail-type-icon");
  icon.hidden = false;
  icon.src = details.iconURI;
  icon.title = details.itemTypeLabel;
  element("detail-title").textContent = details.title || translate("untitled");
  element("detail-byline").textContent = [
    details.creators.join(", ") || translate("unknownCreator"),
    details.date,
  ]
    .filter(Boolean)
    .join(" · ");

  // Abstract
  const abstractSection = element("item-abstract-section");
  if (details.abstract) {
    element("detail-abstract").textContent = details.abstract;
    abstractSection.hidden = false;
  } else {
    abstractSection.hidden = true;
  }

  // Metadata & Collections
  setMetadata("detail-item-type", details.itemTypeLabel);
  setMetadata("detail-date", details.date);
  setMetadata("detail-publication", details.publicationTitle);
  setMetadata("detail-doi", details.doi);
  setMetadata("detail-citekey", details.citekey);
  renderInspectorCollections(details);
  element("item-info-section").hidden = false;
  element("item-action-row").hidden = false;

  // Attachments & Notes
  renderInspectorAttachmentsAndNotes(details);

  // Tags
  element("item-tags-heading").textContent = translate("tags");
  element("detail-tag-count").textContent = String(details.tags.length);
  element<HTMLButtonElement>("open-attachment").disabled =
    details.attachmentCount === 0;
  renderItemTags(details);
  renderInspectorColoredSlots(details.tags.map((t) => t.name));
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

function renderInspectorCollections(details: ItemDetails): void {
  const container = element("detail-collections");
  const list = details.collections || [];
  if (!list.length) {
    container.textContent = translate("notAvailable");
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const col of list) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "collection-chip";
    chip.textContent = col.path;
    chip.title = col.path;
    chip.addEventListener("click", () => {
      markSavedFilterDirty();
      activeCollectionID = col.id;
      unfiledOnly = false;
      activeSavedSearchID = null;
      populateScopeCollectionSelect();
      void executeUnifiedQuery();
    });
    fragment.appendChild(chip);
  }
  container.replaceChildren(fragment);
}

function renderInspectorAttachmentsAndNotes(details: ItemDetails): void {
  const section = element("item-attachments-section");
  const attContainer = element("detail-attachments");
  const notesContainer = element("detail-notes");
  const attachments = details.attachments || [];
  const notes = details.notesPreview || [];
  const totalCount = attachments.length + notes.length;

  element("detail-files-count").textContent = String(totalCount);
  if (!totalCount) {
    section.hidden = true;
    attContainer.replaceChildren();
    notesContainer.replaceChildren();
    return;
  }

  section.hidden = false;
  const attFrag = document.createDocumentFragment();
  for (const att of attachments) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "attachment-row-button";
    btn.title = att.title;
    btn.appendChild(
      createIcon("chrome://zotero/skin/16/universal/attachment.svg"),
    );
    const label = document.createElement("span");
    label.textContent = att.title;
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      void api?.openAttachmentByID(att.id);
    });
    attFrag.appendChild(btn);
  }
  attContainer.replaceChildren(attFrag);
  attContainer.hidden = attachments.length === 0;

  const noteFrag = document.createDocumentFragment();
  for (const note of notes) {
    const div = document.createElement("div");
    div.className = "note-preview-item";
    div.textContent = note.snippet;
    noteFrag.appendChild(div);
  }
  notesContainer.replaceChildren(noteFrag);
  notesContainer.hidden = notes.length === 0;
}

function createInspectorTagChip(
  tag: ItemSummary["tags"][number],
  displayLabel: string,
  editable: boolean,
): HTMLElement {
  const chip = document.createElement("span");
  chip.className = `tag-chip ${tag.type === 1 ? "automatic" : "manual"}`;
  if (tag.color) {
    chip.classList.add("colored-chip");
    chip.style.setProperty("--tag-bg", tag.color);
    chip.style.setProperty("--tag-fg", getContrastingTextColor(tag.color));
  }

  const labelBtn = document.createElement("button");
  labelBtn.type = "button";
  labelBtn.className = "tag-chip-label";
  labelBtn.textContent = displayLabel;
  labelBtn.title = `${tag.name}\n${translate("booleanTagHint")}`;
  labelBtn.addEventListener("click", (event) => {
    handleTagFilterClick(tag.name, event as MouseEvent);
  });
  chip.appendChild(labelBtn);

  if (editable) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "tag-chip-remove";
    remove.title = `${translate("dismiss")}: ${tag.name}`;
    remove.setAttribute("aria-label", remove.title);
    remove.appendChild(createIcon("chrome://zotero/skin/16/universal/x-8.svg"));
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      void removeSelectedTag(tag.name);
    });
    chip.appendChild(remove);
  }
  return chip;
}

function renderItemTags(details: ItemDetails): void {
  const container = element("detail-tags");
  const fragment = document.createDocumentFragment();
  const editable = isCurrentLibraryEditable();
  for (const tag of details.tags
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, language))) {
    fragment.appendChild(createInspectorTagChip(tag, tag.name, editable));
  }
  container.replaceChildren(fragment);
}

function renderBatchTags(items: ItemSummary[]): void {
  const batchTags = tagCoverageForItems(items);
  element("detail-tag-count").textContent = String(batchTags.length);
  const container = element("detail-tags");
  const fragment = document.createDocumentFragment();
  const editable = isCurrentLibraryEditable();

  for (const tag of batchTags) {
    fragment.appendChild(
      createInspectorTagChip(
        tag,
        `${tag.name} · ${tag.count}/${items.length}`,
        editable,
      ),
    );
  }
  container.replaceChildren(fragment);
}

function renderInspectorColoredSlots(assignedNames: string[]): void {
  const block = element("inspector-colored-tags-block");
  const container = element("inspector-colored-tags");
  const slots = overview?.coloredTags || [];
  if (!slots.length || !isCurrentLibraryEditable()) {
    block.hidden = true;
    container.replaceChildren();
    return;
  }

  const assignedSet = new Set(assignedNames);
  const fragment = document.createDocumentFragment();
  for (const slot of slots) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "colored-slot-pill";
    btn.style.setProperty("--tag-bg", slot.color);
    btn.style.setProperty("--tag-fg", getContrastingTextColor(slot.color));
    if (assignedSet.has(slot.name)) btn.classList.add("active-and");
    btn.title = `[${slot.position}] ${slot.name}`;
    const num = document.createElement("span");
    num.className = "colored-slot-num";
    num.textContent = String(slot.position);
    const name = document.createElement("span");
    name.className = "colored-slot-name";
    name.textContent = slot.name;
    btn.append(num, name);
    btn.addEventListener("click", () => {
      void toggleColoredSlotOnSelection(slot.position);
    });
    fragment.appendChild(btn);
  }
  container.replaceChildren(fragment);
  block.hidden = false;
}

function tagCoverageForItems(
  items: ItemSummary[],
): Array<ItemSummary["tags"][number] & { count: number }> {
  const coverage = new Map<
    string,
    ItemSummary["tags"][number] & { count: number }
  >();
  for (const item of items) {
    for (const tag of item.tags) {
      const current = coverage.get(tag.name);
      if (current) {
        current.count++;
        if (tag.type === 0) current.type = 0;
      } else {
        coverage.set(tag.name, { ...tag, count: 1 });
      }
    }
  }
  return Array.from(coverage.values()).sort((left, right) =>
    left.name.localeCompare(right.name, language),
  );
}

function commonTagsForItems(items: ItemSummary[]): ItemSummary["tags"] {
  if (!items.length) return [];
  const remaining = new Map(
    items[0].tags.map((tag) => [tag.name, tag] as const),
  );
  for (const item of items.slice(1)) {
    const names = new Set(item.tags.map((tag) => tag.name));
    for (const name of remaining.keys()) {
      if (!names.has(name)) remaining.delete(name);
    }
  }
  return Array.from(remaining.values()).sort((left, right) =>
    left.name.localeCompare(right.name, language),
  );
}

function renderFrequentTags(details: ItemDetails): void {
  renderFrequentTagButtons(new Set(details.tags.map((tag) => tag.name)));
}

function renderFrequentTagsForSelection(items: ItemSummary[]): void {
  renderFrequentTagButtons(
    new Set(commonTagsForItems(items).map((tag) => tag.name)),
  );
}

function renderFrequentTagButtons(excludedNames: Set<string>): void {
  const container = element("frequent-tags");
  if (!overview || !isCurrentLibraryEditable()) {
    container.replaceChildren();
    frequentTagCandidates = [];
    return;
  }

  frequentTagCandidates = overview.tags
    .filter((tag) => tag.kind !== "automatic" && !excludedNames.has(tag.name))
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
  if (!api) return;
  const itemIDs = getSelectedItemIDs();
  if (!itemIDs.length) return;
  if (!isCurrentLibraryEditable()) {
    showToast(translate("readOnlyLibrary"), true);
    return;
  }

  try {
    suppressNotificationsUntil = Date.now() + 1200;
    if (itemIDs.length === 1) {
      selectedDetails = await api.addTag(itemIDs[0], tagName);
    } else {
      const result = await api.addTags(itemIDs, tagName);
      showToast(
        translate("batchTagAdded", {
          tag: result.tagName,
          count: result.affectedItems,
        }),
      );
    }
    element<HTMLInputElement>("quick-tag-add").value = "";
    closeAutocomplete();
    if (itemIDs.length === 1) {
      showToast(translate("tagAdded", { tag: tagName }));
    }
    await refreshAfterMutation(itemIDs);
  } catch (error) {
    showError(error);
  }
}

async function removeSelectedTag(tagName: string): Promise<void> {
  if (!api) return;
  const itemIDs = getSelectedItemIDs();
  if (!itemIDs.length) return;
  try {
    suppressNotificationsUntil = Date.now() + 1200;
    if (itemIDs.length === 1) {
      selectedDetails = await api.removeTag(itemIDs[0], tagName);
      showToast(translate("tagRemoved", { tag: tagName }));
    } else {
      const result = await api.removeTags(itemIDs, tagName);
      showToast(
        translate("batchTagRemoved", {
          tag: result.tagName,
          count: result.affectedItems,
        }),
      );
    }
    await refreshAfterMutation(itemIDs);
  } catch (error) {
    showError(error);
  }
}

async function refreshAfterMutation(preserveIDs: number[]): Promise<void> {
  if (!api) return;
  api.invalidate();
  overview = await api.getTagOverview(currentLibraryID);
  updateTagRows();
  await executeUnifiedQuery({ preserveItemIDs: preserveIDs });
}

function updateTagAutocomplete(): void {
  const itemIDs = getSelectedItemIDs();
  if (!overview || !itemIDs.length) return;
  const input = element<HTMLInputElement>("quick-tag-add");
  const query = normalize(input.value);
  if (!query) {
    closeAutocomplete();
    return;
  }

  const selectedItems = visibleItems.filter((item) =>
    selectedItemIDs.has(item.id),
  );
  const assigned = new Set(
    commonTagsForItems(selectedItems).map((tag) => tag.name),
  );
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

/* ==========================================================================
 * Quick Copy, Attachments & Keyboard Shortcuts
 * ========================================================================== */

async function copySelected(
  kind: CopyKind,
  styleOverride?: string,
): Promise<void> {
  if (!api) return;
  const itemIDs = getSelectedItemIDs();
  if (!itemIDs.length) return;
  const styleID =
    styleOverride || element<HTMLSelectElement>("citation-style").value;
  const useZettlrFormat =
    kind === "citekey" &&
    element<HTMLInputElement>("zettlr-citation-format").checked;
  try {
    const result = await api.copyMetadata(
      itemIDs,
      kind,
      styleID,
      useZettlrFormat,
    );
    if (kind === "citekey" && result.missingCitekeys) {
      showToast(
        translate("copiedCitekeysWithMissing", {
          count: result.copiedItems,
          missing: result.missingCitekeys,
        }),
      );
      return;
    }
    const message = translate(
      styleOverride === APA_STYLE_ID
        ? "copiedAPA"
        : kind === "citekey"
          ? useZettlrFormat
            ? "copiedZettlrCitation"
            : "copiedCitekey"
          : kind === "citation"
            ? "copiedCitation"
            : "copiedBibliography",
    );
    showToast(
      result.copiedItems > 1
        ? `${message} · ${translate("copiedItems", { count: result.copiedItems })}`
        : message,
    );
  } catch (error) {
    showError(error);
  }
}

async function openSelectedAttachment(): Promise<void> {
  if (!api || !selectedItemID) return;
  try {
    const opened = await api.openBestAttachment(selectedItemID);
    if (!opened) showToast(translate("noAttachment"), true);
  } catch (error) {
    showError(error);
  }
}

function handleTagListKeyboard(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    includeTags = [];
    excludeTags = [];
    untaggedOnly = false;
    void executeUnifiedQuery();
    return;
  }
  if (!visibleTagRows.length) return;
  let index = visibleTagRows.findIndex((entry) =>
    entry.scope.kind === "untagged"
      ? untaggedOnly
      : includeTags.includes(entry.scope.tagName),
  );
  if (event.key === "ArrowDown")
    index = Math.min(index + 1, visibleTagRows.length - 1);
  else if (event.key === "ArrowUp") index = Math.max(index - 1, 0);
  else if (event.key === "Home") index = 0;
  else if (event.key === "End") index = visibleTagRows.length - 1;
  else return;

  event.preventDefault();
  tagVirtualList.scrollToIndex(index);
  const target = visibleTagRows[index];
  if (target.scope.kind === "untagged") {
    untaggedOnly = true;
    includeTags = [];
    excludeTags = [];
  } else {
    const nextTagName = target.scope.tagName;
    untaggedOnly = false;
    includeTags = [nextTagName];
    excludeTags = excludeTags.filter((t) => t !== nextTagName);
  }
  void executeUnifiedQuery();
}

function handleItemListKeyboard(event: KeyboardEvent): void {
  if (!visibleItems.length) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
    event.preventDefault();
    selectAllVisibleItems();
    return;
  }
  if (event.key === "Enter" && selectedItemID) {
    event.preventDefault();
    void triggerItemPrimaryAction(selectedItemID);
    return;
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    (event.key === " " || event.key === "Spacebar") &&
    selectedItemID
  ) {
    event.preventDefault();
    updateItemSelection(selectedItemID, event, true);
    return;
  }
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
  updateItemSelection(visibleItems[nextIndex].id, event, false);
}

function handleGlobalKeyboard(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  const isEditing = target?.matches(
    "input, select, textarea, [contenteditable='true']",
  );
  const anyDialogOpen = Array.from(
    document.querySelectorAll("dialog") as unknown as HTMLDialogElement[],
  ).some((d) => d.open);
  if (anyDialogOpen) return;

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
    event.preventDefault();
    const search = element<HTMLInputElement>("item-search");
    if (!search.disabled) {
      search.focus();
      search.select();
    }
    return;
  }

  if (!isEditing && event.key === "?") {
    event.preventDefault();
    openShortcutsDialog();
    return;
  }

  if (
    !isEditing &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    /^[1-9]$/.test(event.key) &&
    selectedItemIDs.size > 0
  ) {
    event.preventDefault();
    void toggleColoredSlotOnSelection(Number(event.key));
    return;
  }

  if (
    !isEditing &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    event.key.toLocaleLowerCase() === "c" &&
    selectedItemIDs.size > 0
  ) {
    event.preventDefault();
    void copySelected("citekey");
    return;
  }

  if (!isEditing && event.ctrlKey && /^[1-5]$/.test(event.key)) {
    const tag = frequentTagCandidates[Number(event.key) - 1];
    if (tag) {
      event.preventDefault();
      void addTag(tag.name);
    }
    return;
  }

  if (event.key === "Escape") {
    if (selectedItemIDs.size > 1) clearItemSelection();
    closeAutocomplete();
    closeAllContextMenus();
  }
}

function renderShortcutsDialogContent(): void {
  const list = element("shortcuts-list");
  const rows: Array<[string, string]> = [
    ["Click", "sc_clickTag"],
    ["Ctrl / ⌘ + Click", "sc_ctrlClickTag"],
    ["Alt + Click", "sc_altClickTag"],
    ["Drag items → tag", "sc_dragItems"],
    ["Drag tag → item", "sc_dragTag"],
    ["1 – 9", "sc_numKeys"],
    ["Ctrl + 1 – 5", "sc_ctrlNumKeys"],
    ["C", "sc_copyKey"],
    ["Ctrl / ⌘ + F", "sc_searchKey"],
    ["Double-click", "sc_doubleClick"],
  ];
  const fragment = document.createDocumentFragment();
  for (const [keys, labelKey] of rows) {
    const kbd = document.createElement("kbd");
    kbd.textContent = keys;
    const desc = document.createElement("span");
    desc.textContent = translate(labelKey);
    fragment.append(kbd, desc);
  }
  list.replaceChildren(fragment);
}

function openShortcutsDialog(): void {
  renderShortcutsDialogContent();
  const dialog = element<HTMLDialogElement>("shortcuts-dialog");
  if (!dialog.open) dialog.showModal();
}

function closeShortcutsDialog(): void {
  const dialog = element<HTMLDialogElement>("shortcuts-dialog");
  if (dialog.open) dialog.close();
}

/* ==========================================================================
 * Saved Views & Native Zotero Saved Searches (<dialog>)
 * ========================================================================== */

function toggleFilters(): void {
  const bar = element("filters-bar");
  const button = element("filters-toggle");
  bar.hidden = !bar.hidden;
  button.setAttribute("aria-expanded", String(!bar.hidden));
}

function librarySavedFilters(): SavedFilterPreset[] {
  return savedFilters[String(currentLibraryID)] || [];
}

function populateSavedFilterSelect(selectedID = ""): void {
  const select = element<HTMLSelectElement>("saved-filter-select");
  const presets = librarySavedFilters()
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, language));
  select.replaceChildren(createOption("", translate("savedFilters")));
  for (const preset of presets) {
    select.appendChild(createOption(preset.id, preset.name));
  }
  select.disabled = presets.length === 0;
  select.value = presets.some((preset) => preset.id === selectedID)
    ? selectedID
    : "";
  updateSavedFilterButtons();
}

function updateSavedFilterButtons(): void {
  const selectedID = element<HTMLSelectElement>("saved-filter-select").value;
  const filtersReady = !element<HTMLButtonElement>("filters-toggle").disabled;
  element<HTMLButtonElement>("saved-filter-save").disabled = !filtersReady;
  element<HTMLButtonElement>("saved-filter-delete").disabled = !selectedID;
}

function clearSavedFilterSelection(): void {
  const select = element<HTMLSelectElement>("saved-filter-select");
  select.value = "";
  updateSavedFilterButtons();
}

function markSavedFilterDirty(): void {
  if (!applyingSavedFilter) clearSavedFilterSelection();
}

function openSaveQueryDialog(mode: SaveQueryMode): void {
  saveQueryMode = mode;
  const errorEl = element("save-query-error");
  errorEl.hidden = true;

  const select = element<HTMLSelectElement>("saved-filter-select");
  const existing = librarySavedFilters().find((p) => p.id === select.value);
  const input = element<HTMLInputElement>("save-query-name");

  if (mode === "zoteroSearch") {
    element("save-query-title").textContent = translate(
      "saveZoteroSearchTitle",
    );
    element("save-query-label").textContent = translate("saveZoteroSearchName");
    element("save-query-description").textContent = translate(
      "saveZoteroSearchDescription",
    );
    input.value = currentQueryHeading();
  } else {
    element("save-query-title").textContent = translate("saveView");
    element("save-query-label").textContent = translate("savedFilterName");
    element("save-query-description").textContent = translate(
      "saveViewDescription",
    );
    input.value = existing?.name || currentQueryHeading();
  }

  const dialog = element<HTMLDialogElement>("save-query-dialog");
  if (!dialog.open) dialog.showModal();
  window.setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
}

function closeSaveQueryDialog(): void {
  const dialog = element<HTMLDialogElement>("save-query-dialog");
  if (dialog.open) dialog.close();
}

async function submitSaveQueryDialog(): Promise<void> {
  if (!api) return;
  const name = element<HTMLInputElement>("save-query-name").value.trim();
  const errorEl = element("save-query-error");
  if (!name) {
    errorEl.textContent = translate("errorEmptySearchName");
    errorEl.hidden = false;
    return;
  }
  errorEl.hidden = true;

  if (saveQueryMode === "zoteroSearch") {
    try {
      suppressNotificationsUntil = Date.now() + 2000;
      const saved = await api.saveZoteroSearch(
        currentLibraryID,
        name,
        buildUnifiedQuery(),
      );
      closeSaveQueryDialog();
      savedSearches = await api.getSavedSearches(currentLibraryID);
      activeSavedSearchID = saved.id;
      activeCollectionID = null;
      unfiledOnly = false;
      populateScopeCollectionSelect();
      showToast(translate("zoteroSearchSaved", { name: saved.name }));
      await executeUnifiedQuery();
    } catch (error) {
      errorEl.textContent = friendlyError(error);
      errorEl.hidden = false;
    }
    return;
  }

  const select = element<HTMLSelectElement>("saved-filter-select");
  const presets = librarySavedFilters().slice();
  const existing = presets.find((preset) => preset.id === select.value);
  const id =
    existing?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const preset = currentFilterPreset(id, name);
  const index = presets.findIndex((entry) => entry.id === id);
  if (index >= 0) presets[index] = preset;
  else presets.push(preset);

  savedFilters = { ...savedFilters, [String(currentLibraryID)]: presets };
  api.savePreferences({ savedFilters });
  populateSavedFilterSelect(id);
  closeSaveQueryDialog();
  showToast(translate("savedFilterSaved", { name }));
}

function currentFilterPreset(id: string, name: string): SavedFilterPreset {
  const legacyScope = untaggedOnly
    ? ({ kind: "untagged" } as const)
    : includeTags.length === 1 && !excludeTags.length
      ? ({ kind: "tag", tagName: includeTags[0] } as const)
      : ({ kind: "library" } as const);

  const preset: SavedFilterPreset = {
    id,
    name,
    scope: legacyScope,
    query: element<HTMLInputElement>("item-search").value.trim(),
    author: element<HTMLSelectElement>("author-filter").value,
    secondTag: element<HTMLSelectElement>("second-tag-filter").value,
    yearMin: element<HTMLInputElement>("year-min").value,
    yearMax: element<HTMLInputElement>("year-max").value,
    dateAddedFrom: element<HTMLInputElement>("date-added-from").value,
    dateAddedTo: element<HTMLInputElement>("date-added-to").value,
    dateModifiedFrom: element<HTMLInputElement>("date-modified-from").value,
    dateModifiedTo: element<HTMLInputElement>("date-modified-to").value,
    hasPDF: element<HTMLInputElement>("filter-has-pdf").checked,
    hasNotes: element<HTMLInputElement>("filter-has-notes").checked,
  };

  if (includeTags.length) preset.includeTags = [...includeTags];
  if (excludeTags.length) preset.excludeTags = [...excludeTags];
  if (activeCollectionID !== null) preset.collectionID = activeCollectionID;
  if (unfiledOnly) preset.unfiledOnly = true;
  if (!includeSubcollections) preset.includeSubcollections = false;
  if (quickSearchMode !== "fields") preset.quickSearchMode = quickSearchMode;
  if (joinMode !== "all") preset.joinMode = joinMode;
  const activeConds = activeAdvancedConditions();
  if (activeConds.length) preset.advancedConditions = activeConds;

  return preset;
}

function deleteSavedFilter(): void {
  const select = element<HTMLSelectElement>("saved-filter-select");
  const current = librarySavedFilters().find(
    (preset) => preset.id === select.value,
  );
  if (!api || !current) return;
  const presets = librarySavedFilters().filter(
    (preset) => preset.id !== current.id,
  );
  const next = { ...savedFilters };
  if (presets.length) next[String(currentLibraryID)] = presets;
  else delete next[String(currentLibraryID)];
  savedFilters = next;
  api.savePreferences({ savedFilters });
  populateSavedFilterSelect();
  showToast(translate("savedFilterDeleted", { name: current.name }));
}

async function applySavedFilter(presetID: string): Promise<void> {
  const preset = librarySavedFilters().find((entry) => entry.id === presetID);
  if (!preset || !overview) return;
  const availableTags = new Set(overview.tags.map((tag) => tag.name));
  const checkTags = [
    ...(preset.includeTags || []),
    ...(preset.scope.kind === "tag" ? [preset.scope.tagName] : []),
    ...(preset.secondTag ? [preset.secondTag] : []),
  ];
  const missingTag = checkTags.find((t) => !availableTags.has(t)) || "";
  if (missingTag) {
    showToast(translate("savedFilterMissingTag", { tag: missingTag }), true);
    return;
  }

  applyingSavedFilter = true;
  try {
    untaggedOnly = preset.scope.kind === "untagged";
    includeTags = preset.includeTags?.length
      ? [...preset.includeTags]
      : preset.scope.kind === "tag"
        ? [preset.scope.tagName]
        : [];
    excludeTags = preset.excludeTags ? [...preset.excludeTags] : [];
    activeCollectionID = preset.collectionID ?? null;
    unfiledOnly = Boolean(preset.unfiledOnly);
    activeSavedSearchID = null;
    includeSubcollections = preset.includeSubcollections !== false;
    quickSearchMode = preset.quickSearchMode || "fields";
    joinMode = preset.joinMode || "all";
    advancedConditions = preset.advancedConditions
      ? preset.advancedConditions.map((c) => ({ ...c }))
      : [];

    element<HTMLSelectElement>("quicksearch-mode").value = quickSearchMode;
    element<HTMLInputElement>("item-search").value = preset.query;
    element("clear-item-search").hidden = !preset.query;
    populateScopeCollectionSelect();
    renderAdvancedConditionRows();
    updateAdvancedConditionBadge();

    await executeUnifiedQuery();

    const author = element<HTMLSelectElement>("author-filter");
    const secondTag = element<HTMLSelectElement>("second-tag-filter");
    if (
      preset.author &&
      !Array.from(author.options as unknown as HTMLOptionElement[]).some(
        (option) => option.value === preset.author,
      )
    ) {
      author.appendChild(createOption(preset.author, preset.author));
    }
    if (
      preset.secondTag &&
      !Array.from(secondTag.options as unknown as HTMLOptionElement[]).some(
        (option) => option.value === preset.secondTag,
      )
    ) {
      secondTag.appendChild(createOption(preset.secondTag, preset.secondTag));
    }

    author.value = preset.author;
    secondTag.value = preset.secondTag;
    element<HTMLInputElement>("year-min").value = preset.yearMin;
    element<HTMLInputElement>("year-max").value = preset.yearMax;
    element<HTMLInputElement>("date-added-from").value = preset.dateAddedFrom;
    element<HTMLInputElement>("date-added-to").value = preset.dateAddedTo;
    element<HTMLInputElement>("date-modified-from").value =
      preset.dateModifiedFrom;
    element<HTMLInputElement>("date-modified-to").value = preset.dateModifiedTo;
    element<HTMLInputElement>("filter-has-pdf").checked = preset.hasPDF;
    element<HTMLInputElement>("filter-has-notes").checked = preset.hasNotes;

    const bar = element("filters-bar");
    bar.hidden = false;
    element("filters-toggle").setAttribute("aria-expanded", "true");
    applyItemFilters();
    element<HTMLSelectElement>("saved-filter-select").value = preset.id;
  } finally {
    applyingSavedFilter = false;
    updateSavedFilterButtons();
  }
}

function resetClientFilters(): void {
  element<HTMLSelectElement>("author-filter").value = "";
  element<HTMLSelectElement>("second-tag-filter").value = "";
  element<HTMLInputElement>("year-min").value = "";
  element<HTMLInputElement>("year-max").value = "";
  element<HTMLInputElement>("date-added-from").value = "";
  element<HTMLInputElement>("date-added-to").value = "";
  element<HTMLInputElement>("date-modified-from").value = "";
  element<HTMLInputElement>("date-modified-to").value = "";
  element<HTMLInputElement>("filter-has-pdf").checked = false;
  element<HTMLInputElement>("filter-has-notes").checked = false;
  updateActiveFilterCount();
}

function clearClientFilters(): void {
  markSavedFilterDirty();
  resetClientFilters();
  applyItemFilters();
}

function updateActiveFilterCount(): void {
  const values = [
    element<HTMLSelectElement>("author-filter").value,
    element<HTMLSelectElement>("second-tag-filter").value,
    element<HTMLInputElement>("year-min").value,
    element<HTMLInputElement>("year-max").value,
    element<HTMLInputElement>("date-added-from").value,
    element<HTMLInputElement>("date-added-to").value,
    element<HTMLInputElement>("date-modified-from").value,
    element<HTMLInputElement>("date-modified-to").value,
  ];
  let count = values.filter(Boolean).length;
  if (element<HTMLInputElement>("filter-has-pdf").checked) count++;
  if (element<HTMLInputElement>("filter-has-notes").checked) count++;
  const badge = element("active-filter-count");
  badge.textContent = String(count);
  badge.hidden = count === 0;
  element<HTMLButtonElement>("clear-filters").disabled = count === 0;
}

/* ==========================================================================
 * Empty States, Refresh, Error Handling & Toast
 * ========================================================================== */

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
  element("inspector-heading-title").textContent = translate("itemDetails");
  element("inspector-empty").hidden = false;
  element("inspector-empty").querySelector("p")!.textContent =
    translate("selectItem");
  element("inspector-content").hidden = true;
}

function setResultFilterControlsEnabled(enabled: boolean): void {
  for (const id of [
    "filters-toggle",
    "author-filter",
    "second-tag-filter",
    "year-min",
    "year-max",
    "date-added-from",
    "date-added-to",
    "date-modified-from",
    "date-modified-to",
    "filter-has-pdf",
    "filter-has-notes",
  ]) {
    (
      element(id) as HTMLInputElement | HTMLSelectElement | HTMLButtonElement
    ).disabled = !enabled;
  }
  if (!enabled) element<HTMLButtonElement>("clear-filters").disabled = true;
  else updateActiveFilterCount();
  updateSavedFilterButtons();
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
  const savedSelectedIDs = getSelectedItemIDs();
  setLoading(true, "loadingLibrary");
  hideError();
  try {
    api.invalidate();
    const [loadedOverview, loadedCollections, loadedSearches] =
      await Promise.all([
        api.getTagOverview(currentLibraryID),
        api.getCollections(currentLibraryID),
        api.getSavedSearches(currentLibraryID),
      ]);
    overview = loadedOverview;
    collections = loadedCollections;
    savedSearches = loadedSearches;
    populateScopeCollectionSelect();
    updateTagRows();
    await executeUnifiedQuery({ preserveItemIDs: savedSelectedIDs });
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
    EMPTY_SEARCH_NAME: "errorEmptySearchName",
    NO_SEARCH_CONDITIONS: "errorNoSearchConditions",
    MAX_COLORED_TAGS_REACHED: "errorMaxColoredTags",
    INVALID_TAG_COLOR: "errorInvalidColor",
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
