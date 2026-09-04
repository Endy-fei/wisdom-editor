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

type ItemFilterOption = { code: string; label: string };

function uniqueSortedSeats(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b, "zh");
  });
}

/** 按结论 Code 去重；下拉文案任取该 Code 下一条 ItemName */
function uniqueItemsByCode(rows: JsonObject[]): ItemFilterOption[] {
  const best = new Map<string, ItemFilterOption>();
  for (const row of rows) {
    const code = cellText(row.Code).trim();
    if (!code || best.has(code)) continue;
    best.set(code, { code, label: cellText(row.ItemName) || code });
  }
  return [...best.values()].sort(
    (a, b) =>
      codeToInt(a.code) - codeToInt(b.code) ||
      a.label.localeCompare(b.label, "zh")
  );
}

function sortResultRows(rows: JsonObject[]): JsonObject[] {
  return [...rows].sort((a, b) => {
    const codeCmp = codeToInt(a.Code) - codeToInt(b.Code);
    if (codeCmp !== 0) return codeCmp;
    const seatA = Number(cellText(a.MeterSeat));
    const seatB = Number(cellText(b.MeterSeat));
    if (!Number.isNaN(seatA) && !Number.isNaN(seatB) && seatA !== seatB) {
      return seatA - seatB;
    }
    const nameCmp = cellText(a.ItemName).localeCompare(cellText(b.ItemName), "zh");
    if (nameCmp !== 0) return nameCmp;
    return cellText(a.PointName).localeCompare(cellText(b.PointName), "zh");
  });
}

export function ResultTab({ data, templates, onChange }: Props) {
  const [itemCode, setItemCode] = useState("");
  const [meterSeat, setMeterSeat] = useState("");
  const rows = (data.ResultDetailList ?? []) as JsonObject[];
  const filtered = Boolean(itemCode || meterSeat);

  const itemOptions = useMemo(() => uniqueItemsByCode(rows), [rows]);
  const seatOptions = useMemo(
    () => uniqueSortedSeats(rows.map((row) => cellText(row.MeterSeat))),
    [rows]
  );

  const visibleRows = useMemo(() => {
    const filteredRows = rows.filter((row) => {
      if (itemCode && cellText(row.Code).trim() !== itemCode) return false;
      if (meterSeat && cellText(row.MeterSeat) !== meterSeat) return false;
      return true;
    });
    return sortResultRows(filteredRows);
  }, [rows, itemCode, meterSeat]);


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
          <select value={itemCode} onChange={(e) => setItemCode(e.target.value)}>
            <option value="">全部</option>
            {itemOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
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
