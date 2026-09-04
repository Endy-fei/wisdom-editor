import { useCallback, useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { search } from "@codemirror/search";
import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { applyJsonText, type WisdomRoot } from "@wisdom/core";
import { createZhSearchPanel } from "../cmSearchPanel";
import { isDarkTheme } from "../theme";

type Props = {
  data: WisdomRoot;
  onApply: (next: WisdomRoot) => void;
  /** When false, editor stays mounted but hidden (preserves unsaved buffer). */
  active?: boolean;
};

/** CodeMirror 内置公告等剩余英文短语 */
const CM_PHRASES_ZH: Record<string, string> = {
  "current match": "当前匹配",
  "on line": "位于行",
  "Go to line": "转到行",
  go: "跳转",
  "replaced match on line $": "已替换第 $ 行的匹配",
  "replaced $ matches": "已替换 $ 处匹配",
};

function pretty(data: WisdomRoot): string {
  return JSON.stringify(data, null, 2);
}

export function JsonTab({ data, onApply, active = true }: Props) {
  const [text, setText] = useState(() => pretty(data));
  const [error, setError] = useState<string | null>(null);
  const [bufferDirty, setBufferDirty] = useState(false);
  const [isDark, setIsDark] = useState(isDarkTheme);

  // Sync from document when visible, buffer clean — skip stringify while hidden
  useEffect(() => {
    if (!active || bufferDirty) return;
    const next = pretty(data);
    setText((prev) => (prev === next ? prev : next));
    setError(null);
  }, [data, bufferDirty, active]);

  useEffect(() => {
    const update = () => setIsDark(isDarkTheme());
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
      // 关闭自动换行：统一行高，避免虚拟滚动在拖动滚动条时高度估算漂移导致「拖不动/偏慢」
      EditorState.phrases.of(CM_PHRASES_ZH),
      search({ top: true, createPanel: createZhSearchPanel }),
      // 避开 VS Code / CodeMirror 默认键位冲突：
      // Ctrl+Enter = 插入空行；Ctrl+Shift+F = VS Code「在文件中查找」
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Alt-Enter",
            run: () => {
              apply();
              return true;
            },
          },
          {
            key: "Mod-Alt-l",
            run: () => {
              format();
              return true;
            },
          },
        ])
      ),
      EditorView.theme({
        "&": {
          height: "100%",
          fontSize: "13px",
          backgroundColor: "transparent",
        },
        ".cm-scroller": {
          fontFamily: 'var(--font-mono), "IBM Plex Mono", Consolas, monospace',
          lineHeight: "1.55",
          overflowAnchor: "none",
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          borderRight: "1px solid var(--line)",
          color: "var(--text-mute)",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "var(--mint-hover-bg)",
        },
        ".cm-content": { caretColor: "var(--mint)" },
        "&.cm-focused .cm-cursor": {
          borderLeftColor: "var(--mint)",
        },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
          backgroundColor: "var(--mint-soft) !important",
        },
      }),
    ],
    [apply, format]
  );

  return (
    <div className={`json-tab${active ? "" : " tab-panel-hidden"}`}>
      <div className="toolbar">
        <button type="button" className="btn primary" onClick={apply} title="Ctrl+Alt+Enter">
          应用到文档
        </button>
        <button type="button" className="btn" onClick={format} title="Ctrl+Alt+L">
          格式化
        </button>
        {bufferDirty && <span className="dirty-badge">未应用</span>}
        <span className="muted">
          Ctrl+F 查找 · Ctrl+Alt+Enter 应用 · Ctrl+Alt+L 格式化 · 实时语法检查
        </span>
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
