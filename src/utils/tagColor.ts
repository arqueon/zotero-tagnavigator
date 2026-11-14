/** Zotero's 9 built-in tag color swatches (positions 0..8 -> keys 1..9). */
export const ZOTERO_TAG_PALETTE: readonly string[] = [
  "#ff6666",
  "#ffa700",
  "#ffd400",
  "#5fb236",
  "#2ea8e5",
  "#a28ae5",
  "#e56eee",
  "#f19837",
  "#aaaaaa",
];

export const MAX_COLORED_TAG_SLOTS = 9;

export function normalizeHexColor(value: string): string | null {
  const trimmed = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [, r, g, b] = trimmed.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

function srgbChannelLuminance(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * Computes WCAG 2.1 contrasting foreground (`#000000` vs `#ffffff`) for any
 * hex tag background color, ensuring legible chips in both light & dark themes.
 */
export function getContrastingTextColor(
  hexColor: string,
): "#000000" | "#ffffff" {
  const normalized = normalizeHexColor(hexColor);
  if (!normalized) return "#ffffff";
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const luminance =
    0.2126 * srgbChannelLuminance(r) +
    0.7152 * srgbChannelLuminance(g) +
    0.0722 * srgbChannelLuminance(b);
  const contrastWithWhite = (1.0 + 0.05) / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / (0.0 + 0.05);
  return contrastWithBlack >= contrastWithWhite ? "#000000" : "#ffffff";
}
