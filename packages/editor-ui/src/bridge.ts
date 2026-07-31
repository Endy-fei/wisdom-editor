import type { WisdomRoot, WisdomTemplates } from "@wisdom/core";

export type RecentItem = { path: string; name: string };

export type HostMessage =
  | {
      type: "init";
      data: WisdomRoot;
      fileName: string;
      templates: WisdomTemplates;
      warnings?: string[];
      filePath?: string;
    }
  | { type: "saved" }
  | { type: "warning"; text: string }
  | { type: "welcome"; recent: RecentItem[] };

export type HostBridge = {
  ready(): void;
  commit(data: WisdomRoot): void;
  subscribe(handler: (msg: HostMessage) => void): () => void;
  openRecent?(path: string): void;
  openFile?(): void;
};
