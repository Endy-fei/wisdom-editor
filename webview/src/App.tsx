import { useEffect, useState } from "react";
import { getVsCodeApi } from "./vscodeApi";

type WisdomRoot = {
  MeterInfoList: unknown[];
  [key: string]: unknown;
};

const TABS = [
  "电表信息",
  "检定方案",
  "测试项目",
  "结果明细",
  "证书/人员",
  "原始 JSON",
] as const;

export function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("电表信息");
  const [data, setData] = useState<WisdomRoot | null>(null);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    const vscode = getVsCodeApi();
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === "init") {
        setData(msg.data);
        setFileName(msg.fileName ?? "");
      }
    };
    window.addEventListener("message", handler);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  if (!data) {
    return <div className="page">加载中…</div>;
  }

  return (
    <div className="page">
      <header className="top">
        <span className="title">{fileName}</span>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={t === tab ? "tab active" : "tab"}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <main className="main">
        {tab === "电表信息" && <p>电表数量：{data.MeterInfoList.length}</p>}
        {tab !== "电表信息" && <p>{tab}（下一任务实现）</p>}
      </main>
    </div>
  );
}
