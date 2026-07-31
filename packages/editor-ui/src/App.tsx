import { useCallback, useEffect, useState } from "react";
import type { WisdomRoot, WisdomTemplates } from "@wisdom/core";
import type { HostBridge, RecentItem } from "./bridge";
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

export function WisdomEditorApp({ bridge }: { bridge: HostBridge }) {
  const [tab, setTab] = useState<TabName>("电表信息");
  const [data, setData] = useState<WisdomRoot | null>(null);
  const [templates, setTemplates] = useState<WisdomTemplates | null>(null);
  const [fileName, setFileName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [welcome, setWelcome] = useState(false);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  useEffect(() => {
    const unsubscribe = bridge.subscribe((msg) => {
      if (msg.type === "init") {
        setData(msg.data);
        setFileName(msg.fileName ?? "");
        if (msg.templates) setTemplates(msg.templates);
        setWarnings(Array.isArray(msg.warnings) ? msg.warnings : []);
        setDirty(false);
        setWelcome(false);
      } else if (msg.type === "welcome") {
        setWelcome(true);
        setRecent(Array.isArray(msg.recent) ? msg.recent : []);
        setData(null);
        setTemplates(null);
        setDirty(false);
      } else if (msg.type === "warning" && typeof msg.text === "string") {
        setWarnings((prev) => [...prev, msg.text]);
      } else if (msg.type === "saved") {
        setDirty(false);
      }
    });
    bridge.ready();
    return unsubscribe;
  }, [bridge]);

  const commit = useCallback(
    (next: WisdomRoot) => {
      setData(next);
      setDirty(true);
      bridge.commit(next);
    },
    [bridge]
  );

  if (welcome) {
    return (
      <div className="page welcome-page">
        <div className="welcome">
          <h1 className="welcome-title">Wisdom 编辑器</h1>
          <p className="welcome-text">请打开 .wisdom 文件</p>
          {bridge.openFile && (
            <button type="button" className="btn primary" onClick={() => bridge.openFile?.()}>
              打开文件…
            </button>
          )}
          {recent.length > 0 && (
            <div className="welcome-recent">
              <h2 className="section-title">最近打开</h2>
              <ul className="welcome-recent-list">
                {recent.map((item) => (
                  <li key={item.path}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => bridge.openRecent?.(item.path)}
                    >
                      {item.name || item.path}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

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
