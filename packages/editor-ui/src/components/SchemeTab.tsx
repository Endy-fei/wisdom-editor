import { useMemo, useState } from "react";
import type { JsonObject, WisdomRoot, WisdomTemplates } from "@wisdom/core";
import { cloneWithNewId } from "../clone";
import { DataTable, type Column } from "./DataTable";
import { DeferredInput } from "./DeferredInput";

type Props = {
  data: WisdomRoot;
  templates: WisdomTemplates;
  onChange: (next: WisdomRoot) => void;
};

const YES_NO_KEYS = new Set(["IsDefalut", "DelFlage"]);

const SCHEME_FIELDS: { key: string; label: string }[] = [
  { key: "BH", label: "方案编号 BH" },
  { key: "Name", label: "方案名称" },
  { key: "type", label: "类型 type" },
  { key: "CreateDate", label: "创建日期" },
  { key: "LineWay", label: "接线方式" },
  { key: "JCType", label: "检定类型 JCType" },
  { key: "ErrorAccuracy", label: "误差精度" },
  { key: "IsDefalut", label: "是否默认" },
  { key: "CreateUser", label: "创建人" },
  { key: "DelFlage", label: "删除标记" },
];

const GROUP_COLUMNS: Column[] = [
  { key: "BH", label: "编号 BH", width: "120px" },
  { key: "Name", label: "名称", width: "220px" },
  { key: "ItemName", label: "试验项目", width: "120px" },
  { key: "ItemCode", label: "项目代码", width: "90px" },
  { key: "ErrorItem", label: "功率方向", width: "100px" },
  { key: "DianYa", label: "电压", width: "80px" },
  { key: "DianLiu", label: "电流", width: "80px" },
  { key: "GLYS", label: "功率因数", width: "80px" },
  { key: "pinlv", label: "频率", width: "70px" },
  { key: "XiangBie", label: "相别", width: "70px" },
  { key: "OrderIndex", label: "顺序", width: "60px" },
  { key: "RMax", label: "RMax", width: "70px" },
  { key: "RMin", label: "RMin", width: "70px" },
];

function cellText(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function isYesValue(value: unknown): boolean {
  return value === 1 || value === "1";
}

function codeToInt(code: unknown): number {
  const raw = String(code ?? "").trim();
  if (!raw) return Number.POSITIVE_INFINITY;
  const stripped = raw.replace(/^0+/, "") || "0";
  const n = Number(stripped);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

type ItemFilterOption = { name: string; code: string; label: string };

/** 试验项目去重；下拉展示「编号 · 名称」，按编号数值排序 */
function uniqueItemOptions(rows: JsonObject[], testItems: JsonObject[]): ItemFilterOption[] {
  const bhByName = new Map<string, string>();
  for (const item of testItems) {
    const name = cellText(item.Name);
    const bh = cellText(item.BH);
    if (!name || !bh) continue;
    const prev = bhByName.get(name);
    if (prev === undefined || codeToInt(bh) < codeToInt(prev)) {
      bhByName.set(name, bh);
    }
  }

  const best = new Map<string, string>();
  for (const row of rows) {
    const name = cellText(row.ItemName);
    if (!name) continue;
    const code =
      cellText(row.ItemBH) ||
      cellText(row.ItemCode) ||
      bhByName.get(name) ||
      "";
    const prev = best.get(name);
    if (prev === undefined || codeToInt(code) < codeToInt(prev)) {
      best.set(name, code);
    }
  }

  return [...best.entries()]
    .sort(
      (a, b) =>
        codeToInt(a[1]) - codeToInt(b[1]) || a[0].localeCompare(b[0], "zh")
    )
    .map(([name, code]) => ({
      name,
      code,
      label: code ? `${code} · ${name}` : name,
    }));
}

export function SchemeTab({ data, templates, onChange }: Props) {
  const scheme = data.Scheme ?? {};
  const rows = (data.SchemeGroupList ?? []) as JsonObject[];
  const testItems = (data.TestItemList ?? []) as JsonObject[];
  const [itemName, setItemName] = useState("");
  const filtered = Boolean(itemName);

  const itemOptions = useMemo(
    () => uniqueItemOptions(rows, testItems),
    [rows, testItems]
  );
  const visibleRows = useMemo(
    () =>
      itemName
        ? rows.filter((row) => cellText(row.ItemName) === itemName)
        : rows,
    [rows, itemName]
  );

  const updateScheme = (key: string, value: string) => {
    const prev = scheme[key];
    let nextVal: unknown = value;
    if (YES_NO_KEYS.has(key)) {
      nextVal = value === "1" ? 1 : 0;
    } else if (typeof prev === "number") {
      const n = Number(value);
      nextVal = value.trim() === "" || Number.isNaN(n) ? prev : n;
    }
    onChange({
      ...data,
      Scheme: { ...scheme, [key]: nextVal },
    });
  };

  const handleGroupChange = (nextVisible: JsonObject[]) => {
    if (!filtered) {
      onChange({ ...data, SchemeGroupList: nextVisible });
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
    }
    for (const row of nextVisible) {
      const id = String(row.ID ?? "");
      if (!originalIds.has(id)) {
        merged.push(row);
      }
    }

    onChange({ ...data, SchemeGroupList: merged });
  };

  return (
    <div className="stack stack-fill">
      <section className="scheme-header">
        <h3 className="section-title">方案头（Scheme）</h3>
        <div className="form-grid">
          {SCHEME_FIELDS.map((f) => (
            <label key={f.key} className="field">
              <span>{f.label}</span>
              {YES_NO_KEYS.has(f.key) ? (
                <select
                  value={isYesValue(scheme[f.key]) ? "1" : "0"}
                  onChange={(e) => updateScheme(f.key, e.target.value)}
                >
                  <option value="1">是</option>
                  <option value="0">否</option>
                </select>
              ) : (
                <DeferredInput
                  value={
                    scheme[f.key] === undefined || scheme[f.key] === null
                      ? ""
                      : String(scheme[f.key])
                  }
                  onCommit={(raw) => updateScheme(f.key, raw)}
                />
              )}
            </label>
          ))}
          <label className="field">
            <span>ID（只读）</span>
            <input
              value={scheme.ID === undefined || scheme.ID === null ? "" : String(scheme.ID)}
              readOnly
              className="readonly"
            />
          </label>
        </div>
      </section>
      <section className="scheme-group-section">
        <h3 className="section-title">方案分组（SchemeGroupList）</h3>
        <div className="toolbar">
          <label className="filter-field">
            <span>试验项目</span>
            <select
              className="item-filter-select"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            >
              <option value="">全部</option>
              {itemOptions.map((opt) => (
                <option key={opt.name} value={opt.name}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <span className="muted">
            显示 {visibleRows.length} / {rows.length} 条
          </span>
        </div>
        <DataTable
          columns={GROUP_COLUMNS}
          rows={visibleRows}
          onChange={handleGroupChange}
          createRow={() => cloneWithNewId(templates.schemeGroup)}
          fillHeight
        />
      </section>
    </div>
  );
}
