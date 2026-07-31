import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { WisdomEditorApp } from "@wisdom/editor-ui";
import { TauriHost } from "./tauriBridge";

export function App() {
  const host = useMemo(() => new TauriHost(), []);
  const bridge = useMemo(() => host.createBridge(), [host]);
  const [, setTick] = useState(0);

  useEffect(() => host.onPathChange(() => setTick((n) => n + 1)), [host]);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    void listen("menu-open", () => {
      void host.openFile();
    }).then((u) => unlisteners.push(u));

    void listen("menu-save", () => {
      void host.save();
    }).then((u) => unlisteners.push(u));

    void listen("menu-save-as", () => {
      void host.saveAs();
    }).then((u) => unlisteners.push(u));

    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return;
        const wisdom = event.payload.paths.find((p) =>
          p.toLowerCase().endsWith(".wisdom")
        );
        if (wisdom) void host.openPath(wisdom);
      })
      .then((u) => unlisteners.push(u));

    return () => {
      for (const u of unlisteners) u();
    };
  }, [host]);

  const pathLabel = host.path
    ? host.path.split(/[/\\]/).pop() ?? host.path
    : "未打开文件";

  return (
    <div className="desktop-shell">
      <div className="desktop-toolbar">
        <button type="button" className="btn" onClick={() => void host.openFile()}>
          打开
        </button>
        <button
          type="button"
          className="btn"
          disabled={!host.hasDocument}
          onClick={() => void host.save()}
        >
          保存
        </button>
        <button
          type="button"
          className="btn"
          disabled={!host.hasDocument}
          onClick={() => void host.saveAs()}
        >
          另存为
        </button>
        <span className="desktop-toolbar-path" title={host.path ?? undefined}>
          {pathLabel}
          {host.isDirty ? " *" : ""}
        </span>
      </div>
      <div className="desktop-editor">
        <WisdomEditorApp bridge={bridge} />
      </div>
    </div>
  );
}
