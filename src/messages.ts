import type { JsonObject, MeterInfo, MeterOtherInfo, WisdomRoot } from "./types";

export type WisdomTemplates = {
  meter: MeterInfo;
  other: MeterOtherInfo;
  schemeGroup: JsonObject;
  testItem: JsonObject;
  result: JsonObject;
};

/** Host → Webview */
export type HostToWebview =
  | {
      type: "init";
      data: WisdomRoot;
      fileName: string;
      templates: WisdomTemplates;
      warnings?: string[];
    }
  | { type: "saved" }
  | { type: "warning"; text: string };

/** Webview → Host */
export type WebviewToHost =
  | { type: "ready" }
  | { type: "edit"; data: WisdomRoot }
  | { type: "log"; message: string };
