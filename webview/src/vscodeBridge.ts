import type { HostBridge, HostMessage } from "@wisdom/editor-ui";
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
    type === "welcome"
  );
}

export function createVsCodeBridge(): HostBridge {
  const vscode = getVsCodeApi();

  return {
    ready() {
      vscode.postMessage({ type: "ready" });
    },
    commit(data: WisdomRoot) {
      vscode.postMessage({ type: "edit", data });
    },
    subscribe(handler) {
      const listener = (event: MessageEvent) => {
        if (isHostMessage(event.data)) {
          handler(event.data);
        }
      };
      window.addEventListener("message", listener);
      return () => window.removeEventListener("message", listener);
    },
  };
}
