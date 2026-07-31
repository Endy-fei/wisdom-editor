import type { WisdomRoot } from "./types";

/** Host → Webview */
export type HostToWebview =
  | { type: "init"; data: WisdomRoot; fileName: string }
  | { type: "saved" };

/** Webview → Host */
export type WebviewToHost =
  | { type: "ready" }
  | { type: "edit"; data: WisdomRoot }
  | { type: "log"; message: string };
