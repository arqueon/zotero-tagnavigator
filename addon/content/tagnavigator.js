// Zotero TagNavigator - Frontend Script

// 1. Obtener la referencia global de Zotero
const Zotero = window.arguments?.[0]?.Zotero || 
               Components.classes["@zotero.org/Zotero;1"]
                 .getService().wrappedJSObject;

const addon = window.arguments?.[0]?.addon;

// 2. Variables de estado
let allTags = [];         // [{ name: string, type: number, count: number }]
let currentTag = null;    // Nombre de la tag seleccionada actualmente
let itemsInTag = [];      // Objetos Zotero.Item originales de la tag actual
let selectedItem = null;  // Objeto Zotero.Item seleccionado actualmente
let installedStyles = []; // [{ id: string, title: string }]

// 3. Inicialización al cargar la ventana
window.addEventListener("load", async () => {
  try {
    Zotero.debug("[TagNavigator UI] Inicializando interfaz...");
    
    // Configurar manejadores de eventos
    setupEventListeners();

    // Cargar estilos de citas
    loadCitationsStyles();

    // Cargar la lista de tags
    await refreshTags();

    // Mostrar categoría "Sin etiquetas" por defecto o lista de tags
    renderTagTree();
  } catch (error) {
    Zotero.logError(error);
  }
});

// Configuración de escuchas de eventos de la UI
function setupEventListeners() {
  // Buscador de tags
  document.getElementById("tag-search").addEventListener("input", filterAndRenderTags);
  
  // Toggle de tags automáticas
  document.getElementById("hide-automatic-tags").addEventListener("change", filterAndRenderTags);

  // Buscador de ítems y filtros
  document.getElementById("item-search").addEventListener("input", applyFilters);
  document.getElementById("author-filter").addEventListener("change", applyFilters);
  document.getElementById("second-tag-filter").addEventListener("change", applyFilters);
  
  // Rango de años
  document.getElementById("year-min").addEventListener("input", applyFilters);
  document.getElementById("year-max").addEventListener("input", applyFilters);

  // Filtros de adjuntos y notas
  document.getElementById("filter-has-attachments").addEventListener("change", applyFilters);
  document.getElementById("filter-has-notes").addEventListener("change", applyFilters);

  // Botón de purgar automáticas
  document.getElementById("btn-purge-auto").addEventListener("click", purgeAutomaticTags);

  // Botones de copiado
  document.getElementById("btn-copy-citekey").addEventListener("click", () => copyMetadata("citekey"));
  document.getElementById("btn-copy-citation").addEventListener("click", () => copyMetadata("citation"));
  document.getElementById("btn-copy-bibliography").addEventListener("click", () => copyMetadata("bibliography"));

  // Entrada rápida de etiquetas (Quick Tagging)
  const tagInput = document.getElementById("quick-tag-add");
  tagInput.addEventListener("keydown", handleQuickTagInput);
  tagInput.addEventListener("input", handleTagAutocomplete);

  // Atajos de teclado en la ventana
  window.addEventListener("keydown", (e) => {
    // Si presiona 'C' y hay un ítem seleccionado, y no está escribiendo en inputs
    if (e.key.toLowerCase() === "c" && 
        selectedItem && 
        document.activeElement.tagName !== "INPUT" && 
        document.activeElement.tagName !== "SELECT") {
      copyMetadata("citekey");
      showToast("CiteKey copiado al portapapeles");
    }
  });
}

// Cargar los estilos bibliográficos instalados en Zotero
function loadCitationsStyles() {
  try {
    const styles = Zotero.Styles.getVisible();
    installedStyles = styles.map(s => ({ id: s.id, title: s.title }));
    
    const select = document.getElementById("csl-style");
    select.innerHTML = "";
    
    installedStyles.forEach(style => {
      const option = document.createElement("option");
      option.value = style.id;
      option.textContent = style.title;
      // Preseleccionar APA por defecto si existe
      if (style.id.includes("/apa")) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    
    Zotero.debug(`[TagNavigator UI] Cargados ${installedStyles.length} estilos bibliográficos.`);
  } catch (error) {
    Zotero.logError(error);
  }
}

// Cargar la lista completa de tags y sus estadísticas desde SQLite
async function refreshTags() {
  try {
    const libraryID = Zotero.Libraries.userLibraryID;
    
    // Consulta directa a la base de datos de Zotero (muy rápida)
    const rows = await Zotero.DB.queryAsync(`
      SELECT tags.name as name, itemTags.type as type, COUNT(*) as count
      FROM tags
      JOIN itemTags USING (tagID)
      JOIN items USING (itemID)
      WHERE items.libraryID = ? AND items.key NOT IN (SELECT key FROM deletedItems)
      GROUP BY tags.name, itemTags.type
      ORDER BY count DESC, tags.name ASC
    `, [libraryID]);

    // Combinar duplicados si una tag aparece como manual y automática en diferentes ítems
    const merged = new Map();
    rows.forEach(row => {
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
    Zotero.debug(`[TagNavigator UI] Recuperadas ${allTags.length} tags de la base de datos.`);
  } catch (error) {
    Zotero.logError(error);
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
    <span class="tag-name"><strong>[Sin etiquetas]</strong></span>
    <span class="tag-count" id="count-untagged">-</span>
  `;
  untaggedNode.addEventListener("click", () => selectTag("[Untagged]"));
  treeList.appendChild(untaggedNode);

  // Renderizar la lista de tags estándar
  tagsToRender.forEach(tag => {
    const li = document.createElement("li");
    li.className = `tag-node ${currentTag === tag.name ? "active" : ""}`;
    
    const dotClass = tag.type === 1 ? "automatic" : "manual";
    const typeTitle = tag.type === 1 ? "Etiqueta automática" : "Etiqueta manual";

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
    const libraryID = Zotero.Libraries.userLibraryID;
    const items = await Zotero.Items.getAll(libraryID, false, false, false);
    const count = items.filter(item => item.isRegularItem() && item.getTags().length === 0).length;
    
    const badge = document.getElementById("count-untagged");
    if (badge) badge.textContent = count;
  } catch (e) {
    Zotero.logError(e);
  }
}

// Filtrar las tags por el input de búsqueda y el toggle
function filterAndRenderTags() {
  const query = document.getElementById("tag-search").value.toLowerCase().trim();
  const hideAuto = document.getElementById("hide-automatic-tags").checked;

  let filtered = allTags;

  if (hideAuto) {
    filtered = filtered.filter(tag => tag.type !== 1);
  }

  if (query) {
    filtered = filtered.filter(tag => tag.name.toLowerCase().includes(query));
  }

  renderTagTree(filtered);
}

// Seleccionar una tag de la lista lateral y cargar sus elementos
async function selectTag(tagName) {
  currentTag = tagName;
  
  // Actualizar clase activa en la UI
  const nodes = document.querySelectorAll(".tag-node");
  nodes.forEach(n => n.classList.remove("active"));
  
  // Buscar y marcar el nodo seleccionado
  const activeNode = Array.from(nodes).find(n => {
    const textNode = n.querySelector(".tag-name");
    return textNode && textNode.textContent === tagName;
  });
  if (activeNode) activeNode.classList.add("active");

  document.getElementById("results-title").textContent = `Elementos en: ${tagName}`;

  try {
    const libraryID = Zotero.Libraries.userLibraryID;
    
    if (tagName === "[Untagged]") {
      // Cargar ítems sin etiquetas
      const allItems = await Zotero.Items.getAll(libraryID, false, false, false);
      itemsInTag = allItems.filter(item => item.isRegularItem() && item.getTags().length === 0);
    } else {
      // Cargar ítems asociados a la tag
      const tagID = Zotero.Tags.getID(tagName);
      if (tagID) {
        const itemIDs = await Zotero.Tags.getItemIDsForTag(tagID);
        const rawItems = await Zotero.Items.getAsync(itemIDs);
        itemsInTag = rawItems.filter(item => item.isRegularItem());
      } else {
        itemsInTag = [];
      }
    }

    Zotero.debug(`[TagNavigator UI] Cargados ${itemsInTag.length} elementos bajo la tag: ${tagName}`);
    
    // Llenar selectores de filtros basados en la nueva lista de elementos
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
  
  authorSelect.innerHTML = '<option value="">Todos los autores</option>';
  tagSelect.innerHTML = '<option value="">Cruce con tag...</option>';

  const authors = new Set();
  const secondaryTags = new Set();

  itemsInTag.forEach(item => {
    // Autores
    item.getCreators().forEach(c => {
      const name = c.lastName || c.firstName;
      if (name) authors.add(name);
    });

    // Tags secundarias (excluyendo la tag actual)
    item.getTags().forEach(t => {
      if (t.tag !== currentTag) {
        secondaryTags.add(t.tag);
      }
    });
  });

  // Agregar autores ordenados
  Array.from(authors).sort().forEach(author => {
    const opt = document.createElement("option");
    opt.value = author;
    opt.textContent = author;
    authorSelect.appendChild(opt);
  });

  // Agregar tags secundarias ordenadas
  Array.from(secondaryTags).sort().forEach(tag => {
    const opt = document.createElement("option");
    opt.value = tag;
    opt.textContent = tag;
    tagSelect.appendChild(opt);
  });
}

// Aplicar los filtros de texto, autor, año y adjuntos sobre los elementos cargados
function applyFilters() {
  const textQuery = document.getElementById("item-search").value.toLowerCase().trim();
  const authorQuery = document.getElementById("author-filter").value;
  const secondTagQuery = document.getElementById("second-tag-filter").value;
  
  const minYearInput = document.getElementById("year-min").value;
  const maxYearInput = document.getElementById("year-max").value;
  const minYear = minYearInput ? parseInt(minYearInput) : null;
  const maxYear = maxYearInput ? parseInt(maxYearInput) : null;

  const hasAttachments = document.getElementById("filter-has-attachments").checked;
  const hasNotes = document.getElementById("filter-has-notes").checked;

  // Filtrar en memoria para velocidad máxima
  const filteredItems = itemsInTag.filter(item => {
    // 1. Filtro de Texto libre
    if (textQuery) {
      const title = item.getField("title")?.toLowerCase() || "";
      const abstract = item.getField("abstractNote")?.toLowerCase() || "";
      const creators = item.getCreators().map(c => (c.lastName + " " + c.firstName).toLowerCase()).join(" ");
      const citekey = item.citationKey?.toLowerCase() || "";
      
      if (!title.includes(textQuery) && 
          !abstract.includes(textQuery) && 
          !creators.includes(textQuery) && 
          !citekey.includes(textQuery)) {
        return false;
      }
    }

    // 2. Filtro de Autor
    if (authorQuery) {
      const matchAuthor = item.getCreators().some(c => (c.lastName === authorQuery || c.firstName === authorQuery));
      if (!matchAuthor) return false;
    }

    // 3. Filtro de Segunda Tag (Intersección)
    if (secondTagQuery) {
      const hasTag = item.getTags().some(t => t.tag === secondTagQuery);
      if (!hasTag) return false;
    }

    // 4. Filtro de Años
    if (minYear || maxYear) {
      const dateStr = item.getField("date") || "";
      const matchYear = dateStr.match(/\d{4}/);
      if (matchYear) {
        const itemYear = parseInt(matchYear[0]);
        if (minYear && itemYear < minYear) return false;
        if (maxYear && itemYear > maxYear) return false;
      } else {
        // Si no tiene año estructurado y pusimos un filtro de año, lo excluimos
        return false;
      }
    }

    // 5. Filtro de Adjuntos (PDF)
    if (hasAttachments && !item.getAttachments().length) {
      return false;
    }

    // 6. Filtro de Notas
    if (hasNotes && !item.getNotes().length) {
      return false;
    }

    return true;
  });

  document.getElementById("results-count").textContent = `${filteredItems.length} ítems`;
  renderResultsTable(filteredItems);
}

// Renderizar la lista de elementos en la tabla central
function renderResultsTable(items) {
  const tbody = document.getElementById("results-list");
  tbody.innerHTML = "";

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="table-empty">No hay elementos que coincidan con los filtros.</td>
      </tr>
    `;
    return;
  }

  items.forEach(item => {
    const tr = document.createElement("tr");
    if (selectedItem && selectedItem.id === item.id) {
      tr.className = "selected";
    }

    const typeLabel = item.itemType ? `<span class="item-type-badge">${item.itemType}</span>` : "";
    const title = item.getField("title") || "Sin título";
    const author = item.getCreators()[0]?.lastName || item.getCreators()[0]?.firstName || "Anon.";
    
    const dateStr = item.getField("date") || "";
    const yearMatch = dateStr.match(/\d{4}/);
    const year = yearMatch ? yearMatch[0] : "";

    tr.innerHTML = `
      <td class="item-title-col">${typeLabel}${title}</td>
      <td>${author}</td>
      <td>${year}</td>
      <td>
        <div class="item-actions">
          <button class="btn btn-icon btn-copy-row-key" title="Copiar CiteKey (Atajo: C)">🔑</button>
          <button class="btn btn-icon btn-select-zotero" title="Ver en Zotero principal">↗</button>
        </div>
      </td>
    `;

    // Selección al hacer click
    tr.addEventListener("click", (e) => {
      // Evitar que el click en los botones dispare solo la fila
      if (e.target.tagName === "BUTTON" || e.target.classList.contains("btn")) return;
      selectItem(item, tr);
    });

    // Copiar llave en caliente
    tr.querySelector(".btn-copy-row-key").addEventListener("click", (e) => {
      e.stopPropagation();
      Zotero.Utilities.Internal.copyTextToClipboard(item.citationKey || "");
      showToast(`CiteKey copiada: ${item.citationKey}`);
    });

    // Enfocar en Zotero principal
    tr.querySelector(".btn-select-zotero").addEventListener("click", (e) => {
      e.stopPropagation();
      selectInMainWindow(item.id);
    });

    // Doble click: abrir el PDF o adjunto
    tr.addEventListener("dblclick", () => {
      openItemAttachment(item);
    });

    tbody.appendChild(tr);
  });
}

// Seleccionar un elemento para la barra derecha
function selectItem(item, rowElement) {
  selectedItem = item;

  // Actualizar clases seleccionadas en la tabla
  const rows = document.querySelectorAll("#results-list tr");
  rows.forEach(r => r.classList.remove("selected"));
  if (rowElement) rowElement.classList.add("selected");

  // Habilitar paneles derechos
  document.getElementById("copy-section").classList.remove("disabled");
  document.getElementById("tag-input-section").classList.remove("disabled");

  // Renderizar la tarjeta de detalles del elemento
  const card = document.getElementById("selected-item-card");
  card.className = "item-card";

  const title = item.getField("title") || "Sin título";
  const creators = item.getCreators().map(c => `${c.firstName} ${c.lastName}`).join(", ") || "Autor desconocido";
  const date = item.getField("date") || "Año N/D";
  const citeKey = item.citationKey || "[Sin CiteKey]";

  let tagsBadgeHtml = item.getTags().map(t => `<span class="tag-badge">${t.tag}</span>`).join(" ");

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
      showToast("Este ítem no tiene adjuntos.");
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
        showToast("CiteKey copiada!");
      } else {
        showToast("Este ítem no tiene llave de citación.");
      }
    } else if (type === "citation" || type === "bibliography") {
      const styleSelect = document.getElementById("csl-style");
      const styleID = styleSelect.value;
      const asCitation = (type === "citation");

      // Usar la API QuickCopy nativa de Zotero
      // que escribe automáticamente texto enriquecido (HTML/RTF) y texto plano en el portapapeles
      Zotero.QuickCopy.copyToClipboard([selectedItem], `style=${styleID}`, false, asCitation);
      
      showToast(asCitation ? "Cita copiada!" : "Bibliografía copiada!");
    }
  } catch (error) {
    Zotero.logError(error);
    showToast("Error al copiar metadatos.");
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
      await refreshTags();      // Recargar árbol de tags
      filterAndRenderTags();
      showToast(`Tag agregada: ${tagName}`);
    } catch (err) {
      Zotero.logError(err);
      showToast("Error al guardar la tag.");
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
  const matches = allTags.filter(t => t.name.toLowerCase().includes(val)).slice(0, 5);
  
  if (matches.length === 0) {
    dropdown.classList.add("hidden");
    return;
  }

  dropdown.innerHTML = "";
  dropdown.classList.remove("hidden");

  matches.forEach(tag => {
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

// Renderizar atajos para agregar tags frecuentes
function renderFrequentTags() {
  const container = document.getElementById("frequent-tags-list");
  container.innerHTML = "";

  // Tomamos las 5 tags manuales más frecuentes del usuario
  const topTags = allTags.filter(t => t.type === 0).slice(0, 5);

  topTags.forEach((tag, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn-tag-shortcut";
    btn.textContent = `${tag.name} (Ctrl+${idx+1})`;
    
    btn.addEventListener("click", async () => {
      if (selectedItem) {
        selectedItem.addTag(tag.name, 0);
        await selectedItem.saveTx();
        selectItem(selectedItem);
        showToast(`Tag agregada: ${tag.name}`);
      }
    });

    container.appendChild(btn);
  });
}

// Purgar en bloque todas las tags automáticas del usuario
async function purgeAutomaticTags() {
  const autoTags = allTags.filter(t => t.type === 1);
  if (autoTags.length === 0) {
    showToast("No se encontraron tags automáticas para purgar.");
    return;
  }

  const confirmPurge = confirm(`¿Estás seguro de que quieres eliminar las ${autoTags.length} tags automáticas en lote? Esta acción modificará todos los documentos que las contengan.`);
  if (!confirmPurge) return;

  try {
    Zotero.debug("[TagNavigator UI] Iniciando purga de tags automáticas...");
    
    // Ejecutar en lote de base de datos
    await Zotero.DB.executeTransaction(async () => {
      for (let tag of autoTags) {
        const tagID = Zotero.Tags.getID(tag.name);
        if (tagID) {
          // El método nativo de Zotero elimina la tag de todos los ítems y de la BD
          await Zotero.Tags.removeFromAllItems(tagID);
        }
      }
    });

    showToast("Purga de tags automáticas completada.");
    await refreshTags();
    filterAndRenderTags();
    if (currentTag) selectTag(currentTag);
  } catch (error) {
    Zotero.logError(error);
    showToast("Error al purgar tags.");
  }
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
