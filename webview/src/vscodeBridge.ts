import type { HostBridge, HostMessage, MergeFilePayload } from "@wisdom/editor-ui";
import type { WisdomRoot } from "@wisdom/core";

export type VsCodeApi = {
  postMessage: (msg: unknown) => void;
  getState: () => unknown;
  setState: (s: unknown) => void;
};

declare function acquireVsCodeApi(): VsCodeApi;

let api: VsCodeApi | undefined;

function getVsCodeApi(): VsCodeApi {
  if (!api) {
    api = acquireVsCodeApi();
  }
  return api;
}

function isHostMessage(msg: unknown): msg is HostMessage {
  if (!msg || typeof msg !== "object") return false;
  const type = (msg as { type?: unknown }).type;
  return (
    type === "init" ||
    type === "saved" ||
    type === "warning" ||
    type === "welcome" ||
    type === "openMerge" ||
    type === "mergeFilesAdded" ||
    type === "mergeProgress" ||
    type === "mergeFilesPicked" ||
    type === "mergeSaved"
  );
}

export function createVsCodeBridge(): HostBridge {
  const vscode = getVsCodeApi();
  let requestId = 0;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  function rpc<T>(payload: Record<string, unknown>, timeoutMs = 180000): Promise<T> {
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        reject(new Error("操作超时。请重试；若文件很大，请一次少选几份。"));
      }, timeoutMs);
      pending.set(id, {
        resolve: (value: unknown) => {
          window.clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error: Error) => {
          window.clearTimeout(timer);
          reject(error);
        },
      });
      vscode.postMessage({ ...payload, requestId: id });
    });
  }

  return {
    ready() {
      vscode.postMessage({ type: "ready" });
    },
    commit(data: WisdomRoot) {
      vscode.postMessage({ type: "edit", data });
    },
    subscribe(handler) {
      const listener = (event: MessageEvent) => {
        const msg = event.data;
        if (!isHostMessage(msg)) return;
        if (msg.type === "mergeFilesPicked") {
          const waiter = pending.get(msg.requestId);
          pending.delete(msg.requestId);
          if (msg.error) waiter?.reject(new Error(msg.error));
          else waiter?.resolve(msg.files);
        }
        if (msg.type === "mergeSaved") {
          const waiter = pending.get(msg.requestId);
          pending.delete(msg.requestId);
          if (msg.error) waiter?.reject(new Error(msg.error));
          else waiter?.resolve(msg.result);
        }
        handler(msg);
      };
      window.addEventListener("message", listener);
      return () => window.removeEventListener("message", listener);
    },
    async pickWisdomFiles(): Promise<MergeFilePayload[] | null> {
      return rpc({ type: "pickWisdomFiles" });
    },
    saveMerged(args) {
      return rpc({
        type: "saveMerged",
        data: args.data,
        defaultName: args.defaultName,
        sourcePaths: args.sourcePaths,
      });
    },
    openMerged(path) {
      vscode.postMessage({ type: "openMerged", path });
    },
    closeMerge() {
      vscode.postMessage({ type: "closeMerge" });
    },
  };
}
