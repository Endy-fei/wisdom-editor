import { useCallback, useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { EditorView, keymap } from "@codemirror/view";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { applyJsonText, type WisdomRoot } from "@wisdom/core";

type Props = {
  data: WisdomRoot;
  onApply: (next: WisdomRoot) => void;
  /** When false, editor stays mounted but hidden (preserves unsaved buffer). */
  active?: boolean;
};

function pretty(data: WisdomRoot): string {
  return JSON.stringify(data, null, 2);
}

function detectDarkTheme(): boolean {
  const body = document.body;
  if (body.classList.contains("vscode-light")) return false;
  if (
    body.classList.contains("vscode-dark") ||
    body.classList.contains("vscode-high-contrast")
  ) {
    return true;
  }
  return (
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ??
    true
  );
}

export function JsonTab({ data, onApply, active = true }: Props) {
  const [text, setText] = useState(() => pretty(data));
  const [error, setError] = useState<string | null>(null);
  const [bufferDirty, setBufferDirty] = useState(false);
  const [isDark, setIsDark] = useState(detectDarkTheme);

  // Sync from document when visible, buffer clean — skip stringify while hidden
  useEffect(() => {
    if (!active || bufferDirty) return;
    const next = pretty(data);
    setText((prev) => (prev === next ? prev : next));
    setError(null);
  }, [data, bufferDirty, active]);

  useEffect(() => {
    const update = () => setIsDark(detectDarkTheme());
    update();
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", update);
    const obs = new MutationObserver(update);
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => {
      mq?.removeEventListener?.("change", update);
      obs.disconnect();
    };
  }, []);

  const apply = useCallback(() => {
    const result = applyJsonText(data, text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onApply(result.data);
    setText(pretty(result.data));
    setBufferDirty(false);
    setError(null);
  }, [data, text, onApply]);

  const format = useCallback(() => {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        setError("根节点必须是 JSON 对象，无法格式化");
        return;
      }
      const formatted = JSON.stringify(parsed, null, 2);
      setText(formatted);
      setBufferDirty(formatted !== pretty(data));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [text, data]);

  const extensions = useMemo(
    () => [
      json(),
      lintGutter(),
      linter(jsonParseLinter()),
      EditorView.lineWrapping,
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            apply();
            return true;
          },
        },
        {
          key: "Mod-Shift-f",
          run: () => {
            format();
            return true;
          },
        },
      ]),
      EditorView.theme({
        "&": { height: "100%", fontSize: "13px" },
        ".cm-scroller": {
          fontFamily:
            'var(--vscode-editor-font-family, Consolas, "Courier New", monospace)',
          lineHeight: "1.5",
        },
        ".cm-content": { caretColor: isDark ? "#aeafad" : "#000000" },
        "&.cm-focused .cm-cursor": {
          borderLeftColor: isDark ? "#aeafad" : "#000000",
        },
      }),
    ],
    [apply, format, isDark]
  );

  return (
    <div className={`json-tab${active ? "" : " tab-panel-hidden"}`}>
      <div className="toolbar">
        <button type="button" className="btn primary" onClick={apply}>
          应用到文档
        </button>
        <button type="button" className="btn" onClick={format}>
          格式化
        </button>
        {bufferDirty && <span className="dirty-badge">未应用</span>}
        <span className="muted">Ctrl/⌘+Enter 应用 · Ctrl/⌘+Shift+F 格式化 · 实时语法检查</span>
      </div>
      {error && <div className="error-banner">JSON 错误：{error}</div>}
      <div className="cm-host">
        <CodeMirror
          value={text}
          height="100%"
          theme={isDark ? vscodeDark : vscodeLight}
          extensions={extensions}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            foldGutter: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: false,
            highlightSelectionMatches: true,
            searchKeymap: true,
          }}
          onChange={(value) => {
            setText(value);
            setBufferDirty(value !== pretty(data));
            setError(null);
          }}
        />
      </div>
    </div>
  );
}
