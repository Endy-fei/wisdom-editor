import type { PaletteModeColors, ShapeTokens } from "./types";

function withAlpha(hexOrRgba: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hexOrRgba.trim());
  if (!m) {
    if (hexOrRgba.startsWith("rgba")) {
      return hexOrRgba.replace(/rgba?\(([^)]+)\)/, (_, inner) => {
        const parts = String(inner)
          .split(",")
          .map((p) => p.trim());
        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
      });
    }
    return hexOrRgba;
  }
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHint(accent: string): string {
  // brighter sibling for hover gradients
  return accent;
}

/** Map a palette mode + shape into CSS custom properties used by styles.css */
export function buildCssVars(
  colors: PaletteModeColors,
  shape: ShapeTokens,
  dark: boolean
): Record<string, string> {
  const accent = colors.accent;
  const secondary = colors.secondary;
  const danger = colors.danger;
  const warn = colors.warn;
  const ok = colors.ok;

  return {
    "--radius": shape.radius,
    "--radius-sm": shape.radiusSm,
    "--control-radius": shape.controlRadius,
    "--border-w": shape.borderW,
    "--surface-blur": shape.blur,
    "--font-ui": shape.fontUi,
    "--font-display": shape.fontDisplay,
    "--font-mono": shape.fontMono,

    "--ink": colors.bg,
    "--ink-2": colors.bg2,
    "--ink-3": colors.bg3,
    "--panel": colors.surface,
    "--panel-2": colors.surface2,
    "--panel-3": colors.surface3,
    "--panel-hover": dark ? colors.surface3 : colors.surface2,

    "--line": colors.line,
    "--line-strong": colors.lineStrong,

    "--text": colors.text,
    "--text-dim": colors.muted,
    "--text-mute": colors.faint,

    "--mint": accent,
    "--mint-solid": accent,
    "--mint-bright": mixHint(colors.accent2 || accent),
    "--on-accent": colors.accentText,
    "--mint-soft": withAlpha(accent, dark ? 0.16 : 0.12),
    "--mint-border": withAlpha(accent, dark ? 0.35 : 0.3),
    "--mint-glow": withAlpha(accent, dark ? 0.28 : 0.22),
    "--mint-hover-bg": withAlpha(accent, 0.08),
    "--mint-row": withAlpha(accent, dark ? 0.04 : 0.05),
    "--mint-focus": withAlpha(accent, 0.12),
    "--mint-focus-border": withAlpha(accent, dark ? 0.55 : 0.5),

    "--copper": secondary,
    "--copper-soft": withAlpha(secondary, dark ? 0.18 : 0.12),
    "--copper-border": withAlpha(secondary, dark ? 0.4 : 0.35),

    "--rose": danger,
    "--rose-soft": withAlpha(danger, dark ? 0.16 : 0.12),
    "--rose-border": withAlpha(danger, dark ? 0.4 : 0.35),
    "--rose-text": dark ? withAlpha(danger, 0.95) : danger,

    "--gold": warn,
    "--gold-soft": withAlpha(warn, dark ? 0.16 : 0.12),
    "--gold-border": withAlpha(warn, dark ? 0.35 : 0.3),
    "--warning-text": dark ? warn : colors.muted,
    "--warning-bg": `linear-gradient(90deg, ${withAlpha(warn, 0.14)}, ${withAlpha(secondary, 0.08)})`,

    "--shadow": "none",
    "--shadow-btn": "none",

    "--glow-mint": withAlpha(accent, dark ? 0.12 : 0.14),
    "--glow-copper": withAlpha(secondary, 0.1),
    "--grid-line": withAlpha(colors.muted, dark ? 0.08 : 0.1),
    "--grid-opacity": shape.gridOpacity,

    "--surface-header": colors.surface,
    "--surface-tabs": withAlpha(colors.surface, dark ? 0.72 : 0.85),
    "--surface-card": colors.surface,
    "--surface-side": colors.surface,
    "--surface-table": colors.surface,
    "--surface-th": colors.surface2,
    "--surface-input": dark ? withAlpha(colors.bg, 0.55) : withAlpha(colors.surface, 0.92),
    "--surface-input-focus": colors.surface,
    "--surface-input-readonly": withAlpha(colors.surface2, dark ? 0.5 : 0.85),
    "--surface-cell-edit": colors.surface,
    "--surface-cm": colors.surface,
    "--surface-welcome": colors.surface,
    "--brand-ring": withAlpha(colors.text, dark ? 0.35 : 0.25),
    "--brand-glow": `0 0 0 1px ${withAlpha(colors.text, 0.06)}, 0 6px 16px ${withAlpha(accent, 0.22)}`,
    "--selected-row": withAlpha(secondary, dark ? 0.14 : 0.1),

    "--ok": ok,
  };
}
