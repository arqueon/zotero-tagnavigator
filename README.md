# Zotero TagNavigator

**Zotero TagNavigator** es un complemento nativo para **Zotero 7, 8 y 9** diseñado como una ventana flotante ágil para explorar, buscar y gestionar etiquetas a máxima velocidad, ideal para bibliotecas con taxonomías planas y gran volumen de ítems (~28k+).

---

## 🚀 Características Clave

- **Explorador de Tags (Árbol Virtual):** Navegación jerárquica con carga perezosa (_lazy-loading_) para un rendimiento instantáneo.
- **Manuales vs. Automáticas:** Código de color (verde para manuales, naranja para automáticas). Permite filtrar las automáticas de la vista u ocultarlas, e incluye un botón para **purgarlas en lote**.
- **Buscador Híbrido:** Caja de búsqueda de texto libre que filtra dinámicamente combinándose con las tags seleccionadas.
- **Copiado Rápido Académico:**
  - **CiteKey:** Copia la clave de citación nativa de Zotero 8/9 presionando la tecla **`C`** sobre el ítem seleccionado o con un clic.
  - **Citas y Bibliografía CSL:** Copia citas textuales (ej: _(Adorno, 1973)_) o referencias completas formateadas usando estilos CSL nativos. Copia en formato **texto enriquecido (HTML/RTF)**, preservando cursivas y negritas al pegar en editores visuales.
- **Etiquetado Rápido (Quick Tagging):** Entrada con autocompletado y atajos asignables (`Ctrl + 1` a `Ctrl + 5`) para tus 5 etiquetas manuales más frecuentes.

---

## ⌨️ Integración con Wayland / Niri (Escritorio CachyOS)

El plugin expone un endpoint HTTP local dentro de Zotero (`http://127.0.0.1:23119/tagnavigator/open`) para poder invocar la ventana flotante desde cualquier espacio de trabajo de tu sistema operativo.

Agrega la siguiente regla a tu archivo de configuración de Niri (`~/.config/niri/config.kdl`):

```kdl
binds {
    // Abre o enfoca TagNavigator desde cualquier lugar del escritorio
    Mod+Shift+T { spawn "curl" "-s" "http://127.0.0.1:23119/tagnavigator/open"; }
}
```

---

## 📦 Instalación

1.  Descarga el instalador empaquetado: **`zotero-tag-navigator.xpi`** (ubicado en `.scaffold/build/` o en los [Releases de GitHub](https://github.com/arqueon/zotero-tagnavigator/releases)).
2.  En Zotero, ve a **Herramientas > Complementos** (_Tools > Add-ons_).
3.  Haz clic en el engranaje ⚙️ (arriba a la derecha) > **Instalar complemento desde archivo...** (_Install Add-on From File..._).
4.  Selecciona el archivo `.xpi` y reinicia Zotero.

---

## 🛠️ Desarrollo Local

Para compilar y empaquetar cambios:

```bash
# Instalar dependencias
npm install --allow-git=all

# Compilar en caliente
npm run build

# Generar empaquetado release .xpi
npm run release
```

---

## 📄 Licencia

Este proyecto está bajo la licencia **GNU GPL v3**. Ver el archivo `LICENSE` para más detalles.
