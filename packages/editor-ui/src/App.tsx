import { useCallback, useEffect, useState } from "react";
import type { WisdomRoot, WisdomTemplates } from "@wisdom/core";
import type { HostBridge, RecentItem } from "./bridge";
import { isDarkTheme, observeHostTheme, syncHostThemeClass } from "./theme";
import { applyUiStyle } from "./uiStyles";
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

function isMissingRecent(item: RecentItem): boolean {
  return item.exists === false;
}

export function WisdomEditorApp({ bridge }: { bridge: HostBridge }) {
  const [tab, setTab] = useState<TabName>("电表信息");
  const [data, setData] = useState<WisdomRoot | null>(null);
  const [templates, setTemplates] = useState<WisdomTemplates | null>(null);
  const [fileName, setFileName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [welcome, setWelcome] = useState(false);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [missingItem, setMissingItem] = useState<RecentItem | null>(null);

  useEffect(() => syncHostThemeClass(), []);

  useEffect(() => {
    applyUiStyle(isDarkTheme());
    return observeHostTheme(() => applyUiStyle(isDarkTheme()));
  }, []);

  useEffect(() => {
    const unsubscribe = bridge.subscribe((msg) => {
      if (msg.type === "init") {
        setData(msg.data);
        setFileName(msg.fileName ?? "");
        if (msg.templates) setTemplates(msg.templates);
        setWarnings(Array.isArray(msg.warnings) ? msg.warnings : []);
        setDirty(false);
        setWelcome(false);
        setMissingItem(null);
      } else if (msg.type === "welcome") {
        setWelcome(true);
        const list = Array.isArray(msg.recent) ? msg.recent : [];
        setRecent(list);
        setData(null);
        setTemplates(null);
        setDirty(false);
        if (msg.missingPath) {
          const found = list.find((item) => item.path === msg.missingPath);
          setMissingItem(
            found ?? {
              path: msg.missingPath,
              name: msg.missingPath.split(/[/\\]/).pop() || msg.missingPath,
              exists: false,
            }
          );
        } else {
          setMissingItem(null);
        }
        setWarnings([]);
      } else if (msg.type === "warning" && typeof msg.text === "string") {
        setWarnings((prev) => [...prev, msg.text]);
      } else if (msg.type === "saved") {
        setDirty(false);
        setSavedFlash(true);
      }
    });
    bridge.ready();
    return unsubscribe;
  }, [bridge]);

  useEffect(() => {
    if (!missingItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMissingItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [missingItem]);

  useEffect(() => {
    if (!savedFlash) return;
    const t = window.setTimeout(() => setSavedFlash(false), 2000);
    return () => window.clearTimeout(t);
  }, [savedFlash]);

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
          <div className="brand-mark" aria-hidden />
          <p className="welcome-kicker">Wisdom Lab</p>
          <h1 className="welcome-title">Wisdom 编辑器</h1>
          <p className="welcome-text">打开 .wisdom 申校文件，开始编辑电表、方案与结果明细。</p>
          {warnings.length > 0 && (
            <div className="error-banner" role="alert">
              {warnings.map((w, i) => (
                <div key={`${i}-${w}`}>{w}</div>
              ))}
            </div>
          )}
          {bridge.openFile && (
            <button type="button" className="btn primary" onClick={() => bridge.openFile?.()}>
              打开文件…
            </button>
          )}
          {recent.length > 0 && (
            <div className="welcome-recent">
              <h2 className="section-title">最近打开</h2>
              <ul className="welcome-recent-list">
                {recent.map((item) => {
                  const missing = isMissingRecent(item);
                  return (
                    <li key={item.path}>
                      <button
                        type="button"
                        className={
                          missing
                            ? "btn welcome-recent-item welcome-recent-item-missing"
                            : "btn welcome-recent-item"
                        }
                        onClick={() => {
                          if (missing) setMissingItem(item);
                          else bridge.openRecent?.(item.path);
                        }}
                      >
                        <span className="welcome-recent-row">
                          <span className="welcome-recent-name">{item.name || item.path}</span>
                          {missing && <span className="welcome-recent-badge">文件不存在</span>}
                        </span>
                        <span className="welcome-recent-path">{item.path}</span>
                        {missing && (
                          <span className="welcome-recent-hint">点击以恢复文件或从列表移除</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        {missingItem && (
          <div
            className="welcome-missing-overlay"
            role="presentation"
            onClick={() => setMissingItem(null)}
          >
            <div
              className="welcome-missing-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="welcome-missing-title"
              aria-describedby="welcome-missing-text"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="welcome-missing-title" className="welcome-missing-title">
                找不到文件
              </h3>
              <p id="welcome-missing-text" className="welcome-missing-text">
                「{missingItem.name || missingItem.path}」已不在原路径。请恢复文件，或从最近打开列表中移除。
              </p>
              <p className="welcome-missing-path">{missingItem.path}</p>
              <div className="welcome-missing-actions">
                {bridge.restoreRecent && (
                  <button
                    type="button"
                    className="btn primary"
                    autoFocus
                    onClick={() => {
                      const path = missingItem.path;
                      setMissingItem(null);
                      bridge.restoreRecent?.(path);
                    }}
                  >
                    恢复文件…
                  </button>
                )}
                {bridge.removeRecent && (
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => {
                      const path = missingItem.path;
                      setMissingItem(null);
                      bridge.removeRecent?.(path);
                    }}
                  >
                    从列表移除
                  </button>
                )}
                <button type="button" className="btn" onClick={() => setMissingItem(null)}>
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!data || !templates) {
    return <div className="page loading-page">加载中</div>;
  }

  return (
    <div className="page">
      <header className="top">
        <div className="brand-mark" aria-hidden />
        <span className="title">{fileName || "未命名.wisdom"}</span>
        {dirty && <span className="dirty-badge">已修改</span>}
        {savedFlash && <span className="saved-badge">已保存</span>}
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
          <div className="tab-panel">
            <MeterTab data={data} templates={templates} onChange={commit} />
          </div>
        )}
        {tab === "检定方案" && (
          <div className="tab-panel">
            <SchemeTab data={data} templates={templates} onChange={commit} />
          </div>
        )}
        {tab === "测试项目" && (
          <div className="tab-panel">
            <TestItemTab data={data} templates={templates} onChange={commit} />
          </div>
        )}
        {tab === "结果明细" && (
          <div className="tab-panel">
            <ResultTab data={data} templates={templates} onChange={commit} />
          </div>
        )}
        {tab === "证书/人员" && (
          <div className="tab-panel">
            <MetaTab data={data} onChange={commit} />
          </div>
        )}
        <JsonTab data={data} onApply={commit} active={tab === "原始 JSON"} />
      </main>
    </div>
  );
}
