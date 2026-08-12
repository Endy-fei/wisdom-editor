import { useMemo } from "react";
import type { JsonObject, WisdomRoot, WisdomTemplates } from "@wisdom/core";
import { cloneWithNewId } from "../clone";
import { DataTable, type Column } from "./DataTable";

type Props = {
  data: WisdomRoot;
  templates: WisdomTemplates;
  onChange: (next: WisdomRoot) => void;
};

const COLUMNS: Column[] = [
  { key: "BH", label: "编号 BH", width: "100px" },
  { key: "Code", label: "代码 Code", width: "100px" },
  { key: "Name", label: "名称", width: "180px" },
  { key: "OrderIndex", label: "顺序", width: "70px" },
  { key: "JCtype", label: "检定类型", width: "80px" },
  { key: "DelFlage", label: "删除标记", width: "80px", kind: "yesNo" },
  { key: "PID", label: "PID", width: "160px" },
  { key: "ID", label: "ID", width: "200px" },
];

/** BH 去掉前导 0 后转为数字；空值/非数字排到末尾 */
function bhNumericKey(bh: unknown): number {
  const raw = String(bh ?? "").trim();
  if (!raw) return Number.POSITIVE_INFINITY;
  const stripped = raw.replace(/^0+/, "") || "0";
  const n = Number(stripped);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

function sortByBh(rows: JsonObject[]): JsonObject[] {
  return [...rows].sort((a, b) => bhNumericKey(a.BH) - bhNumericKey(b.BH));
}

export function TestItemTab({ data, templates, onChange }: Props) {
  const rows = useMemo(
    () => sortByBh((data.TestItemList ?? []) as JsonObject[]),
    [data.TestItemList]
  );

  return (
    <div className="stack stack-fill">
      <h3 className="section-title">测试项目（TestItemList）</h3>
      <DataTable
        columns={COLUMNS}
        rows={rows}
        onChange={(next) => onChange({ ...data, TestItemList: next })}
        createRow={() => cloneWithNewId(templates.testItem)}
        fillHeight
      />
    </div>
  );
}
