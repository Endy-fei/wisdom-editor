export type StyleId = "fluent";

export type PaletteModeColors = {
  bg: string;
  bg2: string;
  bg3: string;
  surface: string;
  surface2: string;
  surface3: string;
  text: string;
  muted: string;
  faint: string;
  line: string;
  lineStrong: string;
  accent: string;
  accent2: string;
  accentText: string;
  secondary: string;
  ok: string;
  warn: string;
  danger: string;
};

export type ShapeTokens = {
  radius: string;
  radiusSm: string;
  controlRadius: string;
  borderW: string;
  blur: string;
  shadow: string;
  shadowBtn: string;
  fontUi: string;
  fontDisplay: string;
  fontMono: string;
  gridOpacity: string;
};

export type PaletteDef = {
  id: string;
  name: string;
  tag: string;
  light: PaletteModeColors;
  dark: PaletteModeColors;
};

export type StyleDef = {
  id: StyleId;
  name: string;
  blurb: string;
  shape: ShapeTokens;
  palettes: PaletteDef[];
};

export type UiStylePreference = {
  styleId: StyleId;
  paletteId: string;
};
