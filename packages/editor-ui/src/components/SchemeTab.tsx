import type { JsonObject, WisdomRoot, WisdomTemplates } from "@wisdom/core";
import { cloneWithNewId } from "../clone";
import { DataTable, type Column } from "./DataTable";
import { DeferredInput } from "./DeferredInput";

type Props = {
  data: WisdomRoot;
  templates: WisdomTemplates;
  onChange: (next: WisdomRoot) => void;
};

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
  { key: "ItemName", label: "项目名称", width: "120px" },
  { key: "ItemCode", label: "项目代码", width: "90px" },
  { key: "ErrorItem", label: "误差项", width: "100px" },
  { key: "DianYa", label: "电压", width: "80px" },
  { key: "DianLiu", label: "电流", width: "80px" },
  { key: "GLYS", label: "功率因数", width: "80px" },
  { key: "pinlv", label: "频率", width: "70px" },
  { key: "XiangBie", label: "相别", width: "70px" },
  { key: "OrderIndex", label: "顺序", width: "60px" },
  { key: "RMax", label: "RMax", width: "70px" },
  { key: "RMin", label: "RMin", width: "70px" },
];

export function SchemeTab({ data, templates, onChange }: Props) {
  const scheme = data.Scheme ?? {};

  const updateScheme = (key: string, value: string) => {
    const prev = scheme[key];
    let nextVal: unknown = value;
    if (typeof prev === "number") {
      const n = Number(value);
      nextVal = value.trim() === "" || Number.isNaN(n) ? prev : n;
    }
    onChange({
      ...data,
      Scheme: { ...scheme, [key]: nextVal },
    });
  };

  return (
    <div className="stack">
      <section>
        <h3 className="section-title">方案头（Scheme）</h3>
        <div className="form-grid">
          {SCHEME_FIELDS.map((f) => (
            <label key={f.key} className="field">
              <span>{f.label}</span>
              <DeferredInput
                value={
                  scheme[f.key] === undefined || scheme[f.key] === null
                    ? ""
                    : String(scheme[f.key])
                }
                onCommit={(raw) => updateScheme(f.key, raw)}
              />
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
      <section>
        <h3 className="section-title">方案分组（SchemeGroupList）</h3>
        <DataTable
          columns={GROUP_COLUMNS}
          rows={(data.SchemeGroupList ?? []) as JsonObject[]}
          onChange={(rows) => onChange({ ...data, SchemeGroupList: rows })}
          createRow={() => cloneWithNewId(templates.schemeGroup)}
        />
      </section>
    </div>
  );
}
