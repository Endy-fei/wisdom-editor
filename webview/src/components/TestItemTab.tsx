import type { JsonObject, WisdomRoot, WisdomTemplates } from "../types";
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
  { key: "DelFlage", label: "删除标记", width: "80px" },
  { key: "PID", label: "PID", width: "160px" },
  { key: "ID", label: "ID", width: "200px" },
];

export function TestItemTab({ data, templates, onChange }: Props) {
  return (
    <div className="stack">
      <h3 className="section-title">测试项目（TestItemList）</h3>
      <DataTable
        columns={COLUMNS}
        rows={(data.TestItemList ?? []) as JsonObject[]}
        onChange={(rows) => onChange({ ...data, TestItemList: rows })}
        createRow={() => cloneWithNewId(templates.testItem)}
      />
    </div>
  );
}
