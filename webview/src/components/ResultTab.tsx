import { useMemo, useState } from "react";
import type { JsonObject, WisdomRoot, WisdomTemplates } from "../types";
import { cloneWithNewId } from "../clone";
import { DataTable, type Column } from "./DataTable";

type Props = {
  data: WisdomRoot;
  templates: WisdomTemplates;
  onChange: (next: WisdomRoot) => void;
};

const COLUMNS: Column[] = [
  { key: "MeterSeat", label: "表位", width: "60px" },
  { key: "MeterBh", label: "表号", width: "120px" },
  { key: "ItemName", label: "项目", width: "100px" },
  { key: "PointName", label: "点名", width: "120px" },
  { key: "TestItem", label: "测试项", width: "100px" },
  { key: "Phase", label: "相别", width: "60px" },
  { key: "Result", label: "结果", width: "80px" },
  { key: "AverageResult", label: "平均", width: "80px" },
  { key: "FinalResults", label: "最终", width: "80px" },
  { key: "PowerFactor", label: "功率因数", width: "80px" },
  { key: "Freq", label: "频率", width: "60px" },
  { key: "RMax", label: "RMax", width: "70px" },
  { key: "RMin", label: "RMin", width: "70px" },
  { key: "ProName", label: "方案", width: "100px" },
];

function matchesFilter(row: JsonObject, q: string): boolean {
  if (!q) return true;
  const hay = [
    row.MeterBh,
    row.MeterSeat,
    row.ItemName,
    row.ItemCode,
    row.PointName,
    row.TestItem,
    row.MeterName,
    row.ProName,
  ]
    .map((v) => (v === undefined || v === null ? "" : String(v)))
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function ResultTab({ data, templates, onChange }: Props) {
  const [filter, setFilter] = useState("");
  const rows = (data.ResultDetailList ?? []) as JsonObject[];
  const q = filter.trim().toLowerCase();

  const visibleRows = useMemo(
    () => rows.filter((row) => matchesFilter(row, q)),
    [rows, q]
  );

  const handleChange = (nextVisible: JsonObject[]) => {
    if (!q) {
      onChange({ ...data, ResultDetailList: nextVisible });
      return;
    }

    const visibleIdSet = new Set(visibleRows.map((r) => String(r.ID ?? "")));
    const nextById = new Map(nextVisible.map((r) => [String(r.ID ?? ""), r]));
    const nextIdSet = new Set(nextById.keys());
    const originalIds = new Set(rows.map((r) => String(r.ID ?? "")));

    const merged: JsonObject[] = [];
    for (const row of rows) {
      const id = String(row.ID ?? "");
      if (!visibleIdSet.has(id)) {
        merged.push(row);
      } else if (nextIdSet.has(id)) {
        merged.push(nextById.get(id)!);
      }
      // else: deleted while filtered
    }
    for (const row of nextVisible) {
      const id = String(row.ID ?? "");
      if (!originalIds.has(id)) {
        merged.push(row);
      }
    }

    onChange({ ...data, ResultDetailList: merged });
  };

  return (
    <div className="stack">
      <div className="toolbar">
        <label className="filter-field">
          <span>筛选</span>
          <input
            placeholder="表号 / 项目 / 关键字…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
        <span className="muted">
          显示 {visibleRows.length} / {rows.length}
        </span>
      </div>
      <h3 className="section-title">结果明细（ResultDetailList）</h3>
      <DataTable
        columns={COLUMNS}
        rows={visibleRows}
        onChange={handleChange}
        createRow={() => cloneWithNewId(templates.result)}
      />
    </div>
  );
}
