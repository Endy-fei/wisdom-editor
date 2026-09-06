import type { WisdomRoot, WisdomTemplates } from "@wisdom/core";

export type MergeFilePayload = {
  path: string;
  name: string;
  data: WisdomRoot;
};

/** Host → Webview */
export type HostToWebview =
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

/** Webview → Host */
export type WebviewToHost =
  | { type: "ready" }
  | { type: "edit"; data: WisdomRoot }
  | { type: "pickWisdomFiles"; requestId: number }
  | {
      type: "saveMerged";
      requestId: number;
      data: WisdomRoot;
      defaultName: string;
      sourcePaths: string[];
    }
  | { type: "openMerged"; path: string }
  | { type: "closeMerge" };
