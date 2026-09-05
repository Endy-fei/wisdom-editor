import { useCallback, useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import type { JsonObject } from "@wisdom/core";
import { isDarkTheme } from "../theme";

type Props = {
  open: boolean;
  title?: string;
  pointerLabel: string;
  value: JsonObject | null;
  onSave: (next: JsonObject) => void;
  onClose: () => void;
};

function pretty(value: JsonObject): string {
  return JSON.stringify(value, null, 2);
}

export function RowJsonDialog({
  open,
  title = "编辑结果 JSON",
  pointerLabel,
  value,
  onSave,
  onClose,
}: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [isDark, setIsDark] = useState(isDarkTheme);

  useEffect(() => {
    if (!open || !value) return;
    setText(pretty(value));
    setError(null);
    setDirty(false);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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

  const sourcePretty = value ? pretty(value) : "";

  const apply = useCallback(() => {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        setError("必须是 JSON 对象（不能是数组或基本类型）");
        return;
      }
      onSave(parsed as JsonObject);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [text, onSave]);

  const format = useCallback(() => {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        setError("必须是 JSON 对象，无法格式化");
        return;
      }
      const formatted = JSON.stringify(parsed, null, 2);
      setText(formatted);
      setDirty(formatted !== sourcePretty);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [text, sourcePretty]);

  const extensions = useMemo(
    () => [
      json(),
      lintGutter(),
      linter(jsonParseLinter()),
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
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          borderRight: "1px solid var(--line)",
          color: "var(--text-mute)",
        },
        ".cm-content": { caretColor: "var(--mint)" },
      }),
    ],
    [apply, format]
  );

  if (!open) return null;

  return (
    <div className="confirm-overlay" role="presentation" onClick={onClose}>
      <div
        className="row-json-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="row-json-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row-json-head">
          <h3 id="row-json-title" className="confirm-title">
            {title}
          </h3>
          <p className="row-json-pointer" title={pointerLabel}>
            {pointerLabel}
          </p>
        </div>
        <div className="toolbar">
          <button type="button" className="btn primary" onClick={apply} title="Ctrl+Alt+Enter">
            保存
          </button>
          <button type="button" className="btn" onClick={format} title="Ctrl+Alt+L">
            格式化
          </button>
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          {dirty && <span className="dirty-badge">未保存</span>}
        </div>
        {error && <div className="error-banner">JSON 错误：{error}</div>}
        <div className="cm-host row-json-cm">
          <CodeMirror
            value={text}
            height="100%"
            theme={isDark ? vscodeDark : vscodeLight}
            extensions={extensions}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLine: true,
              foldGutter: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              searchKeymap: true,
            }}
            onChange={(next) => {
              setText(next);
              setDirty(next !== sourcePretty);
              setError(null);
            }}
          />
        </div>
      </div>
    </div>
  );
}
