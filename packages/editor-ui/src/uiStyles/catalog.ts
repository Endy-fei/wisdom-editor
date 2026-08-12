import type { StyleDef, StyleId } from "./types";

const FONT_UI = 'Inter, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
const FONT_DISPLAY = 'Outfit, "Noto Sans SC", "PingFang SC", sans-serif';
const FONT_MONO = '"IBM Plex Mono", "Cascadia Mono", Consolas, monospace';

/** Single product theme: Fluent · fluent-blue (light/dark follow host). */
export const UI_STYLES: StyleDef[] = [
  {
    id: "fluent",
    name: "Fluent 现代",
    blurb: "亚克力 · 柔和几何 · Win 感",
    shape: {
      radius: "10px",
      radiusSm: "6px",
      controlRadius: "6px",
      borderW: "1px",
      blur: "16px",
      shadow: "0 8px 24px rgba(0,0,0,.12)",
      shadowBtn: "0 2px 8px rgba(0,0,0,.1)",
      fontUi: FONT_UI,
      fontDisplay: FONT_DISPLAY,
      fontMono: FONT_MONO,
      gridOpacity: "0.22",
    },
    palettes: [
      {
        id: "fluent-blue",
        name: "Fluent 蓝",
        tag: "默认",
        light: {
          bg: "#f3f3f3",
          bg2: "#ebebeb",
          bg3: "#e3e3e3",
          surface: "#ffffff",
          surface2: "#e9e9e9",
          surface3: "#ddd",
          text: "#1a1a1a",
          muted: "#616161",
          faint: "#8a8a8a",
          line: "rgba(0,0,0,.08)",
          lineStrong: "rgba(0,0,0,.14)",
          accent: "#0078d4",
          accent2: "#2899f5",
          accentText: "#ffffff",
          secondary: "#9d5d00",
          ok: "#0f7b0f",
          warn: "#9d5d00",
          danger: "#c42b1c",
        },
        dark: {
          bg: "#202020",
          bg2: "#272727",
          bg3: "#2c2c2c",
          surface: "#2c2c2c",
          surface2: "#353535",
          surface3: "#3f3f3f",
          text: "#ffffff",
          muted: "#c8c8c8",
          faint: "#8a8a8a",
          line: "rgba(255,255,255,.08)",
          lineStrong: "rgba(255,255,255,.14)",
          accent: "#60cdff",
          accent2: "#99dfff",
          accentText: "#00354d",
          secondary: "#fce100",
          ok: "#6ccb5f",
          warn: "#fce100",
          danger: "#ff99a4",
        },
      },
    ],
  },
];

export const DEFAULT_UI_STYLE: { styleId: StyleId; paletteId: string } = {
  styleId: "fluent",
  paletteId: "fluent-blue",
};

export function getStyle(id: StyleId = "fluent"): StyleDef {
  return UI_STYLES.find((s) => s.id === id) ?? UI_STYLES[0];
}

export function getPalette(styleId: StyleId = "fluent", paletteId = "fluent-blue") {
  const style = getStyle(styleId);
  return style.palettes.find((p) => p.id === paletteId) ?? style.palettes[0];
}
