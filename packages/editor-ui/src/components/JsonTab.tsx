import { useEffect, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import type { WisdomRoot } from "@wisdom/core";

type Props = {
  data: WisdomRoot;
  onApply: (next: WisdomRoot) => void;
};

function pretty(data: WisdomRoot): string {
  return JSON.stringify(data, null, 2);
}

export function JsonTab({ data, onApply }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [textVersion, setTextVersion] = useState(0);

  // Create editor once
  useEffect(() => {
    if (!hostRef.current || viewRef.current) return;

    const state = EditorState.create({
      doc: pretty(data),
      extensions: [
        lineNumbers(),
        history(),
        json(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "var(--vscode-editor-font-size, 13px)",
          },
          ".cm-scroller": {
            fontFamily: "var(--vscode-editor-font-family, Consolas, monospace)",
            overflow: "auto",
          },
          "&.cm-editor": {
            backgroundColor: "var(--vscode-editor-background)",
            color: "var(--vscode-editor-foreground)",
            border: "1px solid var(--vscode-panel-border, var(--vscode-widget-border))",
          },
          ".cm-gutters": {
            backgroundColor: "var(--vscode-editorGutter-background, var(--vscode-editor-background))",
            color: "var(--vscode-editorLineNumber-foreground)",
            borderRight: "1px solid var(--vscode-panel-border, transparent)",
          },
          ".cm-activeLineGutter, .cm-activeLine": {
            backgroundColor: "var(--vscode-editor-lineHighlightBackground, transparent)",
          },
          ".cm-cursor": {
            borderLeftColor: "var(--vscode-editorCursor-foreground, currentColor)",
          },
          "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
            backgroundColor: "var(--vscode-editor-selectionBackground) !important",
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setError(null);
          }
        }),
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: hostRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  // Sync from document model when data changes externally (after apply or other tabs)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const next = pretty(data);
    const current = view.state.doc.toString();
    if (current === next) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: next },
    });
    setError(null);
    setTextVersion((v) => v + 1);
  }, [data]);

  const apply = () => {
    const view = viewRef.current;
    if (!view) return;
    const text = view.state.doc.toString();
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        setError("根节点必须是 JSON 对象");
        return;
      }
      onApply(parsed as WisdomRoot);
      setError(null);
      setTextVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="json-tab">
      <div className="toolbar">
        <button type="button" className="btn primary" onClick={apply}>
          应用到文档
        </button>
        <span className="muted">非法 JSON 不会覆盖当前数据</span>
        <span className="sr-only">{textVersion}</span>
      </div>
      {error && <div className="error-banner">JSON 解析错误：{error}</div>}
      <div className="cm-host" ref={hostRef} />
    </div>
  );
}
