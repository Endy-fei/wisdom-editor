import type { WisdomRoot, WisdomTemplates } from "@wisdom/core";

export type { WisdomTemplates };

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
