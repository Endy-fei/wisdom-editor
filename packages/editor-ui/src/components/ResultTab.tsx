import { useMemo, useState } from "react";
import type { JsonObject, WisdomRoot, WisdomTemplates } from "@wisdom/core";
import { cloneWithNewId } from "../clone";
import { DataTable, type Column } from "./DataTable";

type Props = {
  data: WisdomRoot;
  templates: WisdomTemplates;
  onChange: (next: WisdomRoot) => void;
};

const COLUMNS: Column[] = [
  { key: "MeterSeat", label: "表位", width: "60px" },
  { key: "MeterBh", label: "表号", width: "120px", autoWidth: true, maxWidth: 240 },
  { key: "ItemName", label: "试验项目", width: "120px", autoWidth: true, maxWidth: 280 },
  { key: "PointName", label: "检测点名称", width: "160px", autoWidth: true, maxWidth: 480 },
  { key: "TestItem", label: "功率方向", width: "100px", autoWidth: true, maxWidth: 200 },
  { key: "Phase", label: "相别", width: "60px" },
  { key: "Result", label: "结果", width: "80px", autoWidth: true, maxWidth: 160 },
  { key: "AverageResult", label: "平均", width: "80px" },
  { key: "FinalResults", label: "结论", width: "80px" },
  { key: "PowerFactor", label: "功率因数", width: "80px" },
  { key: "Freq", label: "频率", width: "60px" },
  { key: "RMax", label: "RMax", width: "70px" },
  { key: "RMin", label: "RMin", width: "70px" },
  { key: "StartTime", label: "开始时间", width: "150px", autoWidth: true, maxWidth: 220 },
  { key: "EndTime", label: "结束时间", width: "150px", autoWidth: true, maxWidth: 220 },
];

function cellText(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

/** 编号去掉前导 0 后转 int；空/非数字排末尾 */
function codeToInt(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return Number.POSITIVE_INFINITY;
  const stripped = raw.replace(/^0+/, "") || "0";
  const n = Number.parseInt(stripped, 10);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

function uniqueSortedSeats(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b, "zh");
  });
}

/** 试验项目去重，按测试项目编号 BH 转 int 排序（无匹配则回退 ItemCode） */
function uniqueItemsByCode(
  rows: JsonObject[],
  testItems: JsonObject[]
): string[] {
  const bhByName = new Map<string, number>();
  for (const item of testItems) {
    const name = cellText(item.Name);
    if (!name) continue;
    const key = codeToInt(item.BH);
    const prev = bhByName.get(name);
    if (prev === undefined || key < prev) bhByName.set(name, key);
  }

  const best = new Map<string, number>();
  for (const row of rows) {
    const name = cellText(row.ItemName);
    if (!name) continue;
    const code = bhByName.get(name) ?? codeToInt(row.ItemCode);
    const prev = best.get(name);
    if (prev === undefined || code < prev) best.set(name, code);
  }
  return [...best.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], "zh"))
    .map(([name]) => name);
}

export function ResultTab({ data, templates, onChange }: Props) {
  const [itemName, setItemName] = useState("");
  const [meterSeat, setMeterSeat] = useState("");
  const rows = (data.ResultDetailList ?? []) as JsonObject[];
  const testItems = (data.TestItemList ?? []) as JsonObject[];
  const filtered = Boolean(itemName || meterSeat);

  const itemOptions = useMemo(
    () => uniqueItemsByCode(rows, testItems),
    [rows, testItems]
  );
  const seatOptions = useMemo(
    () => uniqueSortedSeats(rows.map((row) => cellText(row.MeterSeat))),
    [rows]
  );

  const visibleRows = useMemo(
    () =>
      rows.filter((row) => {
        if (itemName && cellText(row.ItemName) !== itemName) return false;
        if (meterSeat && cellText(row.MeterSeat) !== meterSeat) return false;
        return true;
      }),
    [rows, itemName, meterSeat]
  );

  const handleChange = (nextVisible: JsonObject[]) => {
    if (!filtered) {
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
    <div className="stack stack-fill">
      <div className="toolbar">
        <label className="filter-field">
          <span>试验项目</span>
          <select value={itemName} onChange={(e) => setItemName(e.target.value)}>
            <option value="">全部</option>
            {itemOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>表位</span>
          <select value={meterSeat} onChange={(e) => setMeterSeat(e.target.value)}>
            <option value="">全部</option>
            {seatOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <span className="muted">
          显示 {visibleRows.length} / {rows.length} 条
        </span>
      </div>
      <h3 className="section-title">结果明细（ResultDetailList）</h3>
      <DataTable
        columns={COLUMNS}
        rows={visibleRows}
        onChange={handleChange}
        createRow={() => cloneWithNewId(templates.result)}
        fillHeight
      />
    </div>
  );
}
