import { useCallback, useEffect, useState } from "react";
import { getVsCodeApi } from "./vscodeApi";
import type { WisdomRoot, WisdomTemplates } from "./types";
import { MeterTab } from "./components/MeterTab";
import { SchemeTab } from "./components/SchemeTab";
import { TestItemTab } from "./components/TestItemTab";
import { ResultTab } from "./components/ResultTab";
import { MetaTab } from "./components/MetaTab";
import { JsonTab } from "./components/JsonTab";

const TABS = [
  "电表信息",
  "检定方案",
  "测试项目",
  "结果明细",
  "证书/人员",
  "原始 JSON",
] as const;

type TabName = (typeof TABS)[number];

export function App() {
  const [tab, setTab] = useState<TabName>("电表信息");
  const [data, setData] = useState<WisdomRoot | null>(null);
  const [templates, setTemplates] = useState<WisdomTemplates | null>(null);
  const [fileName, setFileName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    const vscode = getVsCodeApi();
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === "init") {
        setData(msg.data);
        setFileName(msg.fileName ?? "");
        if (msg.templates) setTemplates(msg.templates);
        setWarnings(Array.isArray(msg.warnings) ? msg.warnings : []);
        setDirty(false);
      } else if (msg?.type === "warning" && typeof msg.text === "string") {
        setWarnings((prev) => [...prev, msg.text]);
      } else if (msg?.type === "saved") {
        setDirty(false);
      }
    };
    window.addEventListener("message", handler);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  const commit = useCallback((next: WisdomRoot) => {
    setData(next);
    setDirty(true);
    getVsCodeApi().postMessage({ type: "edit", data: next });
  }, []);

  if (!data || !templates) {
    return <div className="page">加载中…</div>;
  }

  return (
    <div className="page">
      <header className="top">
        <span className="title">{fileName || "未命名.wisdom"}</span>
        {dirty && <span className="dirty-badge">已修改</span>}
      </header>
      {warnings.length > 0 && (
        <div className="warning-banner" role="alert">
          {warnings.map((w, i) => (
            <div key={`${i}-${w}`}>{w}</div>
          ))}
        </div>
      )}
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={t === tab ? "tab active" : "tab"}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <main className="main">
        {tab === "电表信息" && (
          <MeterTab data={data} templates={templates} onChange={commit} />
        )}
        {tab === "检定方案" && (
          <SchemeTab data={data} templates={templates} onChange={commit} />
        )}
        {tab === "测试项目" && (
          <TestItemTab data={data} templates={templates} onChange={commit} />
        )}
        {tab === "结果明细" && (
          <ResultTab data={data} templates={templates} onChange={commit} />
        )}
        {tab === "证书/人员" && <MetaTab data={data} onChange={commit} />}
        {tab === "原始 JSON" && <JsonTab data={data} onApply={commit} />}
      </main>
    </div>
  );
}
