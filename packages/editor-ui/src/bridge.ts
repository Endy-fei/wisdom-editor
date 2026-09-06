import type { WisdomRoot, WisdomTemplates } from "@wisdom/core";

export type RecentItem = { path: string; name: string; exists?: boolean };

export type MergeFilePayload = {
  path: string;
  name: string;
  data: WisdomRoot;
};

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
  | { type: "welcome"; recent: RecentItem[]; missingPath?: string }
  | { type: "openMerge"; files?: MergeFilePayload[] }
  | { type: "mergeFilesAdded"; files: MergeFilePayload[] }
  | {
      type: "mergeProgress";
      text: string;
      current?: number;
      total?: number;
    }
  | { type: "mergeFilesPicked"; requestId: number; files: MergeFilePayload[] | null; error?: string }
  | {
      type: "mergeSaved";
      requestId: number;
      result: { path: string; name: string } | null;
      error?: string;
    };

export type HostBridge = {
  ready(): void;
  commit(data: WisdomRoot): void;
  subscribe(handler: (msg: HostMessage) => void): () => void;
  openRecent?(path: string): void;
  openFile?(): void;
  removeRecent?(path: string): void;
  restoreRecent?(path: string): void;
  pickWisdomFiles?(): Promise<MergeFilePayload[] | null>;
  loadWisdomFiles?(paths: string[]): Promise<MergeFilePayload[] | null>;
  /** Desktop only: the merge overlay can accept dropped .wisdom files. */
  supportsMergeDrop?: boolean;
  saveMerged?(args: {
    data: WisdomRoot;
    defaultName: string;
    sourcePaths: string[];
  }): Promise<{ path: string; name: string } | null>;
  openMerged?(path: string): void;
  openMerge?(): void;
  closeMerge?(): void;
  setMergeSession?(active: boolean, basePath?: string): void;
};
