import { DEFAULT_UI_STYLE, getPalette, getStyle } from "./catalog";
import { buildCssVars } from "./tokens";

/** Apply Fluent blue tokens; colors follow host light/dark. */
export function applyUiStyle(dark: boolean): void {
  const style = getStyle(DEFAULT_UI_STYLE.styleId);
  const palette = getPalette(DEFAULT_UI_STYLE.styleId, DEFAULT_UI_STYLE.paletteId);
  const colors = dark ? palette.dark : palette.light;
  const vars = buildCssVars(colors, style.shape, dark);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  document.body.dataset.uiStyle = style.id;
  document.body.dataset.uiPalette = palette.id;
  document.body.dataset.uiMode = dark ? "dark" : "light";
}
