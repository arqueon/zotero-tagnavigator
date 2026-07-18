// Zotero TagNavigator - Frontend Script
/* global window, document, Components, setTimeout, console */
/* eslint-disable no-unused-vars */

// 1. Referencias globales a Zotero y addon (se resuelven al inicializar)
let Zotero = null;
let addon = null;

// 2. Variables de estado
let allTags = []; // [{ name: string, type: number, count: number }]
let currentTag = null; // Nombre de la tag seleccionada actualmente
let itemsInTag = []; // Objetos Zotero.Item originales de la tag actual
let itemsCache = []; // Caché de ítems ligera pre-extraída para velocidad máxima
let selectedItem = null; // Objeto Zotero.Item seleccionado actualmente
let installedStyles = []; // [{ id: string, title: string }]

// 3. Diccionario de localización (Inglés por defecto, Español si Zotero está en 'es')
const LOCALE_STRINGS = {
  es: {
    // Estáticos HTML
    "tag-explorer-title": "Explorador de Tags",
    "tag-search": { placeholder: "Buscar tags..." },
    "hide-automatic-tags-label": "Ocultar tags automáticas",
    "tree-loading": "Cargando tags...",
    "results-title": "Selecciona una tag para ver sus elementos",
    "results-count": "0 ítems",
    "item-search-label": "Buscar en textos/títulos",
    "item-search": { placeholder: "Escribe para buscar..." },
    "author-filter-label": "Autor",
    "author-filter-default": "Todos los autores",
    "second-tag-filter-label": "Cruzación (2da tag)",
    "second-tag-filter-default": "Cruce con tag...",
    "year-range-title": "Rango de Años: ",
    "filter-has-attachments-label": "Tiene PDF",
    "filter-has-notes-label": "Tiene Notas",
    "th-type": "Tipo",
    "th-title": "Título",
    "th-author": "Autor",
    "th-year": "Año",
    "table-empty-msg": "No hay elementos que coincidan con los filtros.",
    "right-panel-title": "Etiquetado y Copiado",
    "selected-item-title": "Elemento Seleccionado",
    "selected-item-card":
      "Selecciona un elemento de la lista para ver sus detalles, copiar metadatos o añadir etiquetas.",
    "quick-copy-title": "Copiado Rápido Académico",
    "csl-style-label": "Estilo de Cita (CSL)",
    "btn-copy-citekey": {
      text: "Copiar CiteKey",
      title: "Copiar Citation Key nativa (Atajo: C)",
    },
    "btn-copy-citation": {
      text: "Copiar Cita",
      title: "Copiar cita textual para texto (e.g. (Jay, 1973))",
    },
    "btn-copy-bibliography": {
      text: "Copiar Bibliografía",
      title: "Copiar referencia bibliográfica completa estructurada",
    },
    "assign-tags-title": "Asignar Etiquetas",
    "quick-tag-add": { placeholder: "Nueva tag... (Enter)" },
    "frequent-tags-title": "Tags Frecuentes (Atajo rápido)",

    // Dinámicos (JS)
    "tag-type-automatic": "Etiqueta automática",
    "tag-type-manual": "Etiqueta manual",
    "msg-items-in": "Elementos en: ",
    "msg-items-count": " ítems",
    "msg-untitled": "Sin título",
    "msg-unknown-author": "Autor desconocido",
    "msg-year-nd": "Año N/D",
    "msg-no-citekey": "[Sin CiteKey]",
    "msg-untagged": "[Sin etiquetas]",
    "msg-intersect-tag": "Cruce con tag...",
    "msg-all-authors": "Todos los autores",
    "msg-init-error": "Error al inicializar: ",
    "msg-db-error": "Error al cargar tags de SQLite.",
    "msg-citekey-copied": "CiteKey copiada!",
    "msg-citation-copied": "Cita copiada!",
    "msg-bib-copied": "Bibliografía copiada!",
    "msg-tag-added": "Tag agregada: ",
    "msg-no-frequent-tags": "No hay etiquetas frecuentes.",
    "msg-copying": "Copiando...",
    "msg-copy-error": "Error al copiar metadatos.",
    "msg-no-attachments": "Este ítem no tiene adjuntos.",
    "msg-no-citation-key": "Este ítem no tiene llave de citación.",
    "msg-save-tag-error": "Error al guardar la tag.",
  },
  en: {
    "tag-type-automatic": "Automatic tag",
    "tag-type-manual": "Manual tag",
    "msg-items-in": "Items in: ",
    "msg-items-count": " items",
    "msg-untitled": "Untitled",
    "msg-unknown-author": "Unknown Author",
    "msg-year-nd": "Year N/D",
    "msg-no-citekey": "[No CiteKey]",
    "msg-untagged": "[Untagged]",
    "msg-intersect-tag": "Intersect with tag...",
    "msg-all-authors": "All authors",
    "msg-init-error": "Initialization error: ",
    "msg-db-error": "Error loading tags from SQLite.",
    "msg-citekey-copied": "CiteKey copied!",
    "msg-citation-copied": "Citation copied!",
    "msg-bib-copied": "Bibliography copied!",
    "msg-tag-added": "Tag added: ",
    "msg-no-frequent-tags": "No frequent tags.",
    "msg-copying": "Copying...",
    "msg-copy-error": "Error copying metadata.",
    "msg-no-attachments": "This item has no attachments.",
    "msg-no-citation-key": "This item has no citation key.",
    "msg-save-tag-error": "Error saving tag.",
  },
};

function getUIString(key) {
  const lang =
    Zotero && Zotero.locale && Zotero.locale.startsWith("es") ? "es" : "en";
  return LOCALE_STRINGS[lang]?.[key] || LOCALE_STRINGS["en"]?.[key] || key;
}

function localizeUI() {
  const lang =
    Zotero && Zotero.locale && Zotero.locale.startsWith("es") ? "es" : "en";
  if (lang !== "es") return; // Natively in English in HTML

  const trans = LOCALE_STRINGS.es;
  Object.keys(trans).forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    const val = trans[id];
    if (typeof val === "string") {
      el.textContent = val;
    } else if (typeof val === "object") {
      if (val.placeholder) el.placeholder = val.placeholder;
      if (val.text) el.textContent = val.text;
      if (val.title) el.title = val.title;
    }
  });
}

// 3. Inicialización robusta al cargar la ventana
async function init() {
  try {
    // Resolver referencias globales de Zotero y addon
    if (window.arguments && window.arguments[0] && window.arguments[0].Zotero) {
      Zotero = window.arguments[0].Zotero;
    } else if (window.opener && window.opener.Zotero) {
      Zotero = window.opener.Zotero;
    } else if (window.parent && window.parent.Zotero) {
      Zotero = window.parent.Zotero;
    } else if (typeof Components !== "undefined") {
      try {
        Zotero =
          Components.classes["@zotero.org/Zotero;1"].getService()
            .wrappedJSObject;
      } catch (e) {
        console.warn(e);
      }
    }

    if (window.arguments && window.arguments[0] && window.arguments[0].addon) {
      addon = window.arguments[0].addon;
    } else if (window.opener && window.opener.addon) {
      addon = window.opener.addon;
    }

    if (!Zotero) {
      throw new Error(
        "Zotero global object not found. Ensure this window is opened within Zotero.",
      );
    }

    Zotero.debug("[TagNavigator UI] Inicializando interfaz...");

    // Traducir interfaz si es español
    localizeUI();

    // Obtener preferencia "enable" (Ocultar automáticas por defecto)
    const hideAutoByDefault = Zotero.Prefs.get(
      "extensions.zotero.tagnavigator.enable",
      true,
    );
    document.getElementById("hide-automatic-tags").checked = hideAutoByDefault;

    // Configurar manejadores de eventos
    setupEventListeners();

    // Cargar estilos de citas
    loadCitationsStyles();

    // Cargar la lista de tags
    await refreshTags();

    // Mostrar categoría "Sin etiquetas" por defecto o lista de tags
    filterAndRenderTags();
  } catch (error) {
    if (Zotero && Zotero.logError) {
      Zotero.logError(error);
    } else {
      console.error(error);
    }
    const treeList = document.getElementById("tag-tree");
    if (treeList) {
      treeList.innerHTML = `<li class="tree-error" style="padding: 10px; color: var(--accent-danger);">${getUIString("msg-init-error")}${error.message}</li>`;
    }
  }
}

if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  init();
} else {
  window.addEventListener("load", init);
}

// Configuración de escuchas de eventos de la UI
function setupEventListeners() {
  // Buscador de tags
  document
    .getElementById("tag-search")
    .addEventListener("input", filterAndRenderTags);

  // Toggle de tags automáticas
  document
    .getElementById("hide-automatic-tags")
    .addEventListener("change", filterAndRenderTags);

  // Buscador de ítems y filtros
  document
    .getElementById("item-search")
    .addEventListener("input", applyFilters);
  document
    .getElementById("author-filter")
    .addEventListener("change", applyFilters);
  document
    .getElementById("second-tag-filter")
    .addEventListener("change", applyFilters);

  // Rango de años
  document.getElementById("year-min").addEventListener("input", applyFilters);
  document.getElementById("year-max").addEventListener("input", applyFilters);

  // Filtros de adjuntos y notas
  document
    .getElementById("filter-has-attachments")
    .addEventListener("change", applyFilters);
  document
    .getElementById("filter-has-notes")
    .addEventListener("change", applyFilters);

  // Botones de copiado
  document
    .getElementById("btn-copy-citekey")
    .addEventListener("click", () => copyMetadata("citekey"));
  document
    .getElementById("btn-copy-citation")
    .addEventListener("click", () => copyMetadata("citation"));
  document
    .getElementById("btn-copy-bibliography")
    .addEventListener("click", () => copyMetadata("bibliography"));

  // Entrada rápida de etiquetas (Quick Tagging)
  const tagInput = document.getElementById("quick-tag-add");
  tagInput.addEventListener("keydown", handleQuickTagInput);
  tagInput.addEventListener("input", handleTagAutocomplete);

  // Atajos de teclado en la ventana
  window.addEventListener("keydown", (e) => {
    // Si presiona 'C' y hay un ítem seleccionado, y no está escribiendo en inputs
    if (
      e.key.toLowerCase() === "c" &&
      selectedItem &&
      document.activeElement.tagName !== "INPUT" &&
      document.activeElement.tagName !== "SELECT"
    ) {
      copyMetadata("citekey");
      showToast("CiteKey copiado al portapapeles");
    }
  });
}

// Cargar los estilos bibliográficos instalados en Zotero
function loadCitationsStyles() {
  try {
    const styles = Zotero.Styles.getVisible();
    installedStyles = styles.map((s) => ({ id: s.id, title: s.title }));

    const select = document.getElementById("csl-style");
    select.innerHTML = "";

    installedStyles.forEach((style) => {
      const option = document.createElement("option");
      option.value = style.id;
      option.textContent = style.title;
      // Preseleccionar APA por defecto si existe
      if (style.id.includes("/apa")) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    Zotero.debug(
      `[TagNavigator UI] Cargados ${installedStyles.length} estilos bibliográficos.`,
    );
  } catch (error) {
    Zotero.logError(error);
  }
}

// Cargar la lista completa de tags y sus estadísticas desde SQLite
async function refreshTags() {
  try {
    const libraryID = Zotero.Libraries.userLibraryID;

    // Consulta directa a la base de datos de Zotero usando ID numérico
    // Se cambia items.key por items.itemID para usar índices primarios en bases de datos grandes (1GB)
    // Se remueve el filtro de libraryID para soportar bibliotecas compartidas y de grupos automáticamente
    const rows = await Zotero.DB.queryAsync(
      `
      SELECT tags.name as name, itemTags.type as type, COUNT(*) as count
      FROM tags
      JOIN itemTags USING (tagID)
      JOIN items USING (itemID)
      WHERE items.itemID NOT IN (SELECT itemID FROM deletedItems)
      GROUP BY tags.name, itemTags.type
      ORDER BY count DESC, tags.name ASC
    `,
    );

    // Combinar duplicados si una tag aparece como manual y automática en diferentes ítems
    const merged = new Map();
    rows.forEach((row) => {
      const name = row.name;
      if (merged.has(name)) {
        const existing = merged.get(name);
        existing.count += row.count;
        // Si tiene algún tipo manual (0), la tratamos como manual
        if (row.type === 0) existing.type = 0;
      } else {
        merged.set(name, { name: name, type: row.type, count: row.count });
      }
    });

    allTags = Array.from(merged.values());
    Zotero.debug(
      `[TagNavigator UI] Recuperadas ${allTags.length} tags de la base de datos.`,
    );
  } catch (error) {
    Zotero.logError(error);
    const treeList = document.getElementById("tag-tree");
    if (treeList) {
      treeList.innerHTML = `<li class="tree-error" style="padding: 10px; color: var(--accent-danger);">${getUIString("msg-db-error")}</li>`;
    }
  }
}

// Renderizar el árbol de tags en la barra lateral
function renderTagTree(tagsToRender = allTags) {
  const treeList = document.getElementById("tag-tree");
  treeList.innerHTML = "";

  // Categorías fijas de cabecera
  const untaggedNode = document.createElement("li");
  untaggedNode.className = `tag-node ${currentTag === "[Untagged]" ? "active" : ""}`;
  untaggedNode.innerHTML = `
    <span class="tag-dot" style="background-color: var(--text-muted)"></span>
    <span class="tag-name"><strong>${getUIString("msg-untagged")}</strong></span>
    <span class="tag-count" id="count-untagged">-</span>
  `;
  untaggedNode.addEventListener("click", () => selectTag("[Untagged]"));
  treeList.appendChild(untaggedNode);

  // Renderizar la lista de tags estándar
  tagsToRender.forEach((tag) => {
    const li = document.createElement("li");
    li.className = `tag-node ${currentTag === tag.name ? "active" : ""}`;

    const dotClass = tag.type === 1 ? "automatic" : "manual";
    const typeTitle =
      tag.type === 1
        ? getUIString("tag-type-automatic")
        : getUIString("tag-type-manual");

    li.innerHTML = `
      <span class="tag-dot ${dotClass}" title="${typeTitle}"></span>
      <span class="tag-name" title="${tag.name}">${tag.name}</span>
      <span class="tag-count">${tag.count}</span>
    `;

    li.addEventListener("click", () => selectTag(tag.name));
    treeList.appendChild(li);
  });

  // Cargar el conteo de elementos sin tags en segundo plano
  loadUntaggedCount();
}

// Cargar el número de ítems sin etiquetas
async function loadUntaggedCount() {
  try {
    // Consulta directa optimizada para evitar instanciar todos los ítems de Zotero en memoria
    const rows = await Zotero.DB.queryAsync(
      `
      SELECT COUNT(*) as count
      FROM items
      WHERE itemID NOT IN (SELECT itemID FROM deletedItems)
        AND itemID NOT IN (SELECT itemID FROM itemTags)
        AND itemTypeID NOT IN (
          SELECT itemTypeID FROM itemTypes WHERE typeName IN ('attachment', 'note', 'annotation')
        )
      `,
    );
    const count = rows?.[0]?.count || 0;

    const badge = document.getElementById("count-untagged");
    if (badge) badge.textContent = count;
  } catch (e) {
    Zotero.logError(e);
  }
}

// Filtrar las tags por el input de búsqueda y el toggle
function filterAndRenderTags() {
  const query = document
    .getElementById("tag-search")
    .value.toLowerCase()
    .trim();
  const hideAuto = document.getElementById("hide-automatic-tags").checked;

  let filtered = allTags;

  if (hideAuto) {
    filtered = filtered.filter((tag) => tag.type !== 1);
  }

  if (query) {
    filtered = filtered.filter((tag) => tag.name.toLowerCase().includes(query));
  }

  renderTagTree(filtered);
}

// Seleccionar una tag de la lista lateral y cargar sus elementos
async function selectTag(tagName) {
  currentTag = tagName;

  // Actualizar clase activa en la UI
  const nodes = document.querySelectorAll(".tag-node");
  nodes.forEach((n) => n.classList.remove("active"));

  // Buscar y marcar el nodo seleccionado
  const activeNode = Array.from(nodes).find((n) => {
    const textNode = n.querySelector(".tag-name");
    return textNode && textNode.textContent === tagName;
  });
  if (activeNode) activeNode.classList.add("active");

  document.getElementById("results-title").textContent =
    `${getUIString("msg-items-in")}${tagName}`;

  try {
    if (tagName === "[Untagged]") {
      // Obtener ítems sin etiquetas vía SQLite de forma directa
      const rows = await Zotero.DB.queryAsync(
        `
        SELECT itemID
        FROM items
        WHERE itemID NOT IN (SELECT itemID FROM deletedItems)
          AND itemID NOT IN (SELECT itemID FROM itemTags)
          AND itemTypeID NOT IN (
            SELECT itemTypeID FROM itemTypes WHERE typeName IN ('attachment', 'note', 'annotation')
          )
        `,
      );
      const itemIDs = rows.map((r) => r.itemID);
      itemsInTag = await Zotero.Items.getAsync(itemIDs);
    } else {
      // Obtener IDs de ítems asociados a la tag filtrando no regulares vía SQL
      const tagID = Zotero.Tags.getID(tagName);
      if (tagID) {
        const rows = await Zotero.DB.queryAsync(
          `
          SELECT itemID
          FROM itemTags
          JOIN items USING (itemID)
          WHERE tagID = ?
            AND itemID NOT IN (SELECT itemID FROM deletedItems)
            AND itemTypeID NOT IN (
              SELECT itemTypeID FROM itemTypes WHERE typeName IN ('attachment', 'note', 'annotation')
            )
          `,
          [tagID],
        );
        const itemIDs = rows.map((r) => r.itemID);
        itemsInTag = await Zotero.Items.getAsync(itemIDs);
      } else {
        itemsInTag = [];
      }
    }

    Zotero.debug(
      `[TagNavigator UI] Cargados ${itemsInTag.length} elementos bajo la tag: ${tagName}`,
    );

    // Crear la caché ligera de los ítems de esta etiqueta para velocidad extrema al filtrar
    itemsCache = itemsInTag.map((item) => {
      const creators = item.getCreators();
      const creatorNames = creators
        .map((c) => (c.lastName + " " + c.firstName).toLowerCase())
        .join(" ");
      const firstCreatorName =
        creators[0]?.lastName ||
        creators[0]?.firstName ||
        getUIString("msg-unknown-author");

      const dateStr = item.getField("date") || "";
      const yearMatch = dateStr.match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : null;

      return {
        item: item,
        id: item.id,
        title: item.getField("title") || getUIString("msg-untitled"),
        abstract: item.getField("abstractNote") || "",
        creators: creatorNames,
        firstCreator: firstCreatorName,
        citekey: item.citationKey || "",
        year: year,
        date: dateStr,
        itemType: item.itemType || "",
        tags: item.getTags().map((t) => t.tag),
        attachmentsCount: item.getAttachments().length,
        notesCount: item.getNotes().length,
      };
    });

    // Llenar selectores de filtros basados en la nueva lista de elementos de forma directa
    populateFilterOptions();

    // Aplicar filtros y renderizar tabla
    applyFilters();
  } catch (error) {
    Zotero.logError(error);
  }
}

// Llenar selectores de filtros de autores y cruce de tags secundarias
function populateFilterOptions() {
  const authorSelect = document.getElementById("author-filter");
  const tagSelect = document.getElementById("second-tag-filter");

  const prevAuthor = authorSelect.value;
  const prevTag = tagSelect.value;

  authorSelect.innerHTML = `<option value="">${getUIString("msg-all-authors")}</option>`;
  tagSelect.innerHTML = `<option value="">${getUIString("msg-intersect-tag")}</option>`;

  const authors = new Set();
  const secondaryTags = new Set();

  itemsCache.forEach((cached) => {
    // Autores desde la caché
    const creators = cached.item.getCreators();
    creators.forEach((c) => {
      const name = c.lastName || c.firstName;
      if (name) authors.add(name);
    });

    // Tags secundarias (excluyendo la tag actual)
    cached.tags.forEach((t) => {
      if (t !== currentTag) {
        secondaryTags.add(t);
      }
    });
  });

  // Agregar autores ordenados
  Array.from(authors)
    .sort()
    .forEach((author) => {
      const opt = document.createElement("option");
      opt.value = author;
      opt.textContent = author;
      if (author === prevAuthor) opt.selected = true;
      authorSelect.appendChild(opt);
    });

  // Agregar tags secundarias ordenadas
  Array.from(secondaryTags)
    .sort()
    .forEach((tag) => {
      const opt = document.createElement("option");
      opt.value = tag;
      opt.textContent = tag;
      if (tag === prevTag) opt.selected = true;
      tagSelect.appendChild(opt);
    });
}

// Aplicar los filtros de texto, autor, año y adjuntos sobre los elementos cargados
function applyFilters() {
  const textQuery = document
    .getElementById("item-search")
    .value.toLowerCase()
    .trim();
  const authorQuery = document.getElementById("author-filter").value;
  const secondTagQuery = document.getElementById("second-tag-filter").value;

  const minYearInput = document.getElementById("year-min").value;
  const maxYearInput = document.getElementById("year-max").value;
  const minYear = minYearInput ? parseInt(minYearInput) : null;
  const maxYear = maxYearInput ? parseInt(maxYearInput) : null;

  const hasAttachments = document.getElementById(
    "filter-has-attachments",
  ).checked;
  const hasNotes = document.getElementById("filter-has-notes").checked;

  // Filtrar usando la caché en memoria para velocidad máxima e instantánea al teclear
  const filtered = itemsCache.filter((cached) => {
    // 1. Texto libre
    if (textQuery) {
      if (
        !cached.title.toLowerCase().includes(textQuery) &&
        !cached.abstract.toLowerCase().includes(textQuery) &&
        !cached.creators.includes(textQuery) &&
        !cached.citekey.toLowerCase().includes(textQuery)
      ) {
        return false;
      }
    }

    // 2. Autor
    if (authorQuery && cached.firstCreator !== authorQuery) {
      if (!cached.creators.includes(authorQuery.toLowerCase())) return false;
    }

    // 3. Segunda Tag (Intersección)
    if (secondTagQuery && !cached.tags.includes(secondTagQuery)) {
      return false;
    }

    // 4. Años
    if (minYear || maxYear) {
      if (cached.year) {
        if (minYear && cached.year < minYear) return false;
        if (maxYear && cached.year > maxYear) return false;
      } else {
        return false;
      }
    }

    // 5. Adjuntos
    if (hasAttachments && cached.attachmentsCount === 0) {
      return false;
    }

    // 6. Notas
    if (hasNotes && cached.notesCount === 0) {
      return false;
    }

    return true;
  });

  document.getElementById("results-count").textContent =
    `${filtered.length}${getUIString("msg-items-count")}`;
  renderResultsTable(filtered);
}

// Renderizar la lista de elementos en la tabla central
function renderResultsTable(cachedItems) {
  const tbody = document.getElementById("results-list");
  tbody.innerHTML = "";

  if (cachedItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="table-empty">${getUIString("table-empty-msg")}</td>
      </tr>
    `;
    return;
  }

  cachedItems.forEach((cached) => {
    const tr = document.createElement("tr");
    if (selectedItem && selectedItem.id === cached.id) {
      tr.className = "selected";
    }

    const typeLabel = cached.itemType
      ? `<span class="item-type-badge">${cached.itemType}</span>`
      : "";
    const title = cached.title;
    const author = cached.firstCreator;
    const yearDisplay = cached.year
      ? cached.year.toString()
      : getUIString("msg-year-nd");

    tr.innerHTML = `
      <td>${typeLabel}</td>
      <td class="col-title" title="${title}">${title}</td>
      <td title="${author}">${author}</td>
      <td>${yearDisplay}</td>
    `;

    // Un solo clic selecciona el elemento en el panel derecho y en la ventana principal
    tr.addEventListener("click", () => {
      selectItem(cached.item, tr);
      selectInMainWindow(cached.id);
    });

    // Doble clic abre el lector de PDF de Zotero
    tr.addEventListener("dblclick", () => {
      openItemAttachment(cached.item);
    });

    tbody.appendChild(tr);
  });
}

// Seleccionar un elemento para la barra derecha
function selectItem(item, rowElement) {
  selectedItem = item;

  // Actualizar clases seleccionadas en la tabla
  const rows = document.querySelectorAll("#results-list tr");
  rows.forEach((r) => r.classList.remove("selected"));
  if (rowElement) rowElement.classList.add("selected");

  // Habilitar paneles derechos
  document.getElementById("copy-section").classList.remove("disabled");
  document.getElementById("tag-input-section").classList.remove("disabled");

  // Renderizar la tarjeta de detalles del elemento
  const card = document.getElementById("selected-item-card");
  card.className = "item-card";

  const title = item.getField("title") || getUIString("msg-untitled");
  const creators =
    item
      .getCreators()
      .map((c) => `${c.firstName} ${c.lastName}`)
      .join(", ") || getUIString("msg-unknown-author");
  const date = item.getField("date") || getUIString("msg-year-nd");
  const citeKey = item.citationKey || getUIString("msg-no-citekey");

  let tagsBadgeHtml = item
    .getTags()
    .map((t) => `<span class="tag-badge">${t.tag}</span>`)
    .join(" ");

  card.innerHTML = `
    <div class="item-card-title">${title}</div>
    <div class="item-card-meta">${creators} (${date})</div>
    <div class="item-card-meta"><strong>CiteKey:</strong> ${citeKey}</div>
    <div class="item-card-tags">${tagsBadgeHtml}</div>
  `;

  // Renderizar tags frecuentes
  renderFrequentTags();
}

// Seleccionar un documento en la ventana de Zotero principal
function selectInMainWindow(itemID) {
  try {
    const mainWin = Zotero.getActiveWindow();
    if (mainWin && mainWin.ZoteroPane) {
      mainWin.focus();
      mainWin.ZoteroPane.selectItem(itemID);
    }
  } catch (e) {
    Zotero.logError(e);
  }
}

// Abrir el adjunto de un elemento (PDF/anotaciones)
async function openItemAttachment(item) {
  try {
    const attachments = await item.getAttachments();
    if (attachments.length > 0) {
      // Tomamos el primer archivo
      const attachment = await Zotero.Items.getAsync(attachments[0]);
      const mainWin = Zotero.getActiveWindow();
      if (mainWin && mainWin.ZoteroPane) {
        mainWin.focus();
        mainWin.ZoteroPane.openViewerForAttachment(attachment.id);
      }
    } else {
      showToast(getUIString("msg-no-attachments"));
    }
  } catch (e) {
    Zotero.logError(e);
  }
}

// Copiar metadatos del elemento seleccionado al portapapeles
function copyMetadata(type) {
  if (!selectedItem) return;

  try {
    if (type === "citekey") {
      const citekey = selectedItem.citationKey || "";
      if (citekey) {
        Zotero.Utilities.Internal.copyTextToClipboard(citekey);
        showToast(getUIString("msg-citekey-copied"));
      } else {
        showToast(getUIString("msg-no-citation-key"));
      }
    } else if (type === "citation" || type === "bibliography") {
      const styleSelect = document.getElementById("csl-style");
      const styleID = styleSelect.value;
      const asCitation = type === "citation";

      // Usar la API QuickCopy nativa de Zotero
      // que escribe automáticamente texto enriquecido (HTML/RTF) y texto plano en el portapapeles
      Zotero.QuickCopy.copyToClipboard(
        [selectedItem],
        `style=${styleID}`,
        false,
        asCitation,
      );

      showToast(
        asCitation
          ? getUIString("msg-citation-copied")
          : getUIString("msg-bib-copied"),
      );
    }
  } catch (error) {
    Zotero.logError(error);
    showToast(getUIString("msg-copy-error"));
  }
}

// Agregar o quitar etiquetas en caliente (Quick Tagging)
async function handleQuickTagInput(e) {
  if (e.key === "Enter" && selectedItem) {
    const input = document.getElementById("quick-tag-add");
    const tagName = input.value.trim();
    if (!tagName) return;

    try {
      selectedItem.addTag(tagName, 0); // Tipo 0 = Manual
      await selectedItem.saveTx();

      // Recargar datos
      input.value = "";
      document.getElementById("autocomplete-tags-list").classList.add("hidden");
      selectItem(selectedItem); // Actualizar tarjeta lateral
      await refreshTags(); // Recargar árbol de tags
      filterAndRenderTags();
      showToast(getUIString("msg-tag-added") + tagName);
    } catch (err) {
      Zotero.logError(err);
      showToast(getUIString("msg-save-tag-error"));
    }
  }
}

// Mostrar autocompletado para etiquetas
function handleTagAutocomplete() {
  const input = document.getElementById("quick-tag-add");
  const val = input.value.toLowerCase().trim();
  const dropdown = document.getElementById("autocomplete-tags-list");

  if (!val) {
    dropdown.classList.add("hidden");
    return;
  }

  // Buscar en las tags existentes
  const matches = allTags
    .filter((t) => t.name.toLowerCase().includes(val))
    .slice(0, 5);

  if (matches.length === 0) {
    dropdown.classList.add("hidden");
    return;
  }

  dropdown.innerHTML = "";
  dropdown.classList.remove("hidden");

  matches.forEach((tag) => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    item.textContent = tag.name;
    item.addEventListener("click", () => {
      input.value = tag.name;
      dropdown.classList.add("hidden");
      input.focus();
    });
    dropdown.appendChild(item);
  });
}

// Renderizado de las tags más frecuentes asignadas al ítem
function renderFrequentTags() {
  const container = document.getElementById("frequent-tags-list");
  container.innerHTML = "";

  // Filtrar las tags manuales del total
  const manualTags = allTags
    .filter((t) => t.type !== 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (manualTags.length === 0) {
    container.innerHTML = `<span style="font-size: 0.85em; color: var(--text-muted);">${getUIString("msg-no-frequent-tags")}</span>`;
    return;
  }

  manualTags.forEach((tag, index) => {
    const btn = document.createElement("button");
    btn.className = "tag-shortcut-btn";
    btn.innerHTML = `
      <span class="tag-shortcut-label">Ctrl+${index + 1}</span>
      <span class="tag-shortcut-text">${tag.name}</span>
    `;

    btn.addEventListener("click", async () => {
      if (selectedItem) {
        selectedItem.addTag(tag.name, 0);
        await selectedItem.saveTx();
        selectItem(selectedItem);
        showToast(getUIString("msg-tag-added") + tag.name);
      }
    });

    container.appendChild(btn);
  });
}

// Pequeña utilidad de notificaciones flotantes (toast)
function showToast(message) {
  const toast = document.createElement("div");
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.right = "20px";
  toast.style.backgroundColor = "var(--bg-secondary)";
  toast.style.border = "1px solid var(--accent-teal)";
  toast.style.color = "var(--text-primary)";
  toast.style.padding = "10px 20px";
  toast.style.borderRadius = "6px";
  toast.style.boxShadow = "var(--shadow-lg)";
  toast.style.zIndex = "9999";
  toast.style.fontSize = "0.85rem";
  toast.style.pointerEvents = "none";
  toast.textContent = message;

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.5s";
    setTimeout(() => toast.remove(), 500);
  }, 2500);
}
