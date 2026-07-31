import { useEffect, useMemo, useState } from "react";
import type { MeterInfo, MeterOtherInfo, WisdomRoot, WisdomTemplates } from "@wisdom/core";
import { newId } from "../clone";

type Props = {
  data: WisdomRoot;
  templates: WisdomTemplates;
  onChange: (next: WisdomRoot) => void;
};

type FieldDef = { key: string; label: string; kind?: "text" | "number" | "boolean" };

const METER_FIELDS: FieldDef[] = [
  { key: "isCheck", label: "是否检定", kind: "boolean" },
  { key: "MeterSeat", label: "表位" },
  { key: "MeterNo", label: "表号" },
  { key: "Name", label: "名称" },
  { key: "MeterAddr", label: "表地址" },
  { key: "MeterAssetCoding", label: "资产编码" },
  { key: "MeterBatch", label: "批次" },
  { key: "MeterTS", label: "条码/TS" },
  { key: "Factory", label: "制造厂" },
  { key: "MeterLevel", label: "等级" },
  { key: "Un", label: "额定电压 Un" },
  { key: "Imax", label: "Imax" },
  { key: "Imin", label: "Imin" },
  { key: "Ist", label: "Ist" },
  { key: "Itr", label: "Itr" },
  { key: "Freq", label: "频率" },
  { key: "CT", label: "CT" },
  { key: "PT", label: "PT" },
  { key: "ActivePulseConstant", label: "有功脉冲常数" },
  { key: "ReactivePulseConstant", label: "无功脉冲常数" },
  { key: "ActivePowerAccuracyClass", label: "有功准确度", kind: "number" },
  { key: "ReactivePowerAccuracyClass", label: "无功准确度", kind: "number" },
  { key: "Phase", label: "相别", kind: "number" },
  { key: "MeterProtocol", label: "协议", kind: "number" },
  { key: "MeterSort", label: "类别", kind: "number" },
  { key: "MeterType", label: "类型", kind: "number" },
];

const OTHER_FIELDS: FieldDef[] = [
  { key: "BarCode", label: "条码 BarCode" },
  { key: "LeadSealFirst", label: "铅封1" },
  { key: "LeadSealSecond", label: "铅封2" },
];

function nextSeat(list: MeterInfo[]): number {
  let max = 0;
  for (const m of list) {
    const n = Number(m.MeterSeat);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function parseValue(raw: string, kind: FieldDef["kind"], previous: unknown): unknown {
  if (kind === "boolean") {
    return raw === "true" || raw === "1";
  }
  if (kind === "number") {
    if (raw.trim() === "") return 0;
    const n = Number(raw);
    return Number.isNaN(n) ? previous : n;
  }
  return raw;
}

export function MeterTab({ data, templates, onChange }: Props) {
  const meters = data.MeterInfoList ?? [];
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (!selectedId && meters[0]?.ID) {
      setSelectedId(meters[0].ID);
      return;
    }
    if (selectedId && !meters.some((m) => m.ID === selectedId)) {
      setSelectedId(meters[0]?.ID ?? "");
    }
  }, [meters, selectedId]);

  const selected = useMemo(
    () => meters.find((m) => m.ID === selectedId) ?? null,
    [meters, selectedId]
  );

  const other: MeterOtherInfo | null = selected
    ? data.MeterOtherInfoMap?.[selected.ID] ?? null
    : null;

  const updateMeter = (key: string, value: unknown) => {
    if (!selected) return;
    const MeterInfoList = meters.map((m) =>
      m.ID === selected.ID ? ({ ...m, [key]: value } as MeterInfo) : m
    );
    onChange({ ...data, MeterInfoList });
  };

  const updateOther = (key: string, value: unknown) => {
    if (!selected) return;
    const base =
      data.MeterOtherInfoMap?.[selected.ID] ??
      ({ ...structuredClone(templates.other), ID: selected.ID } as MeterOtherInfo);
    const MeterOtherInfoMap = {
      ...data.MeterOtherInfoMap,
      [selected.ID]: { ...base, [key]: value } as MeterOtherInfo,
    };
    onChange({ ...data, MeterOtherInfoMap });
  };

  const addMeter = () => {
    const seat = nextSeat(meters);
    const id = newId();
    const meter = {
      ...structuredClone(templates.meter),
      ID: id,
      MeterSeat: String(seat),
      MeterNo: "",
      Name: "",
    } as MeterInfo;
    const otherInfo = {
      ...structuredClone(templates.other),
      ID: id,
      MeterSeat: seat,
      BarCode: "",
      LeadSealFirst: "",
      LeadSealSecond: "",
    } as MeterOtherInfo;
    onChange({
      ...data,
      MeterInfoList: [...meters, meter],
      MeterOtherInfoMap: {
        ...data.MeterOtherInfoMap,
        [id]: otherInfo,
      },
      LastNum: typeof data.LastNum === "number" ? Math.max(data.LastNum, seat) : seat,
    });
    setSelectedId(id);
  };

  const deleteMeter = () => {
    if (!selected) return;
    const id = selected.ID;
    const meterNo = selected.MeterNo;
    const MeterInfoList = meters.filter((m) => m.ID !== id);
    const MeterOtherInfoMap = { ...data.MeterOtherInfoMap };
    delete MeterOtherInfoMap[id];
    const CertificateCode = { ...data.CertificateCode };
    if (meterNo) delete CertificateCode[meterNo];
    onChange({ ...data, MeterInfoList, MeterOtherInfoMap, CertificateCode });
  };

  return (
    <div className="split">
      <aside className="split-left">
        <div className="toolbar">
          <button type="button" className="btn" onClick={addMeter}>
            新增电表
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={deleteMeter}
            disabled={!selected}
          >
            删除
          </button>
        </div>
        <ul className="meter-list">
          {meters.map((m) => (
            <li key={m.ID}>
              <button
                type="button"
                className={m.ID === selectedId ? "list-item active" : "list-item"}
                onClick={() => setSelectedId(m.ID)}
              >
                <span className="list-primary">
                  表位 {m.MeterSeat || "-"} · {m.MeterNo || "(无表号)"}
                </span>
                <span className="list-secondary">
                  {String(m.Name || m.Factory || m.ID.slice(0, 8))}
                </span>
              </button>
            </li>
          ))}
          {meters.length === 0 && <li className="muted pad">暂无电表，请新增</li>}
        </ul>
      </aside>
      <section className="split-right">
        {!selected && <p className="muted">请选择左侧电表</p>}
        {selected && (
          <>
            <h3 className="section-title">基本信息</h3>
            <div className="form-grid">
              {METER_FIELDS.map((f) => (
                <label key={f.key} className="field">
                  <span>{f.label}</span>
                  {f.kind === "boolean" ? (
                    <select
                      value={selected[f.key] ? "true" : "false"}
                      onChange={(e) =>
                        updateMeter(f.key, parseValue(e.target.value, "boolean", selected[f.key]))
                      }
                    >
                      <option value="true">是</option>
                      <option value="false">否</option>
                    </select>
                  ) : (
                    <input
                      value={
                        selected[f.key] === undefined || selected[f.key] === null
                          ? ""
                          : String(selected[f.key])
                      }
                      onChange={(e) =>
                        updateMeter(
                          f.key,
                          parseValue(e.target.value, f.kind, selected[f.key])
                        )
                      }
                    />
                  )}
                </label>
              ))}
              <label className="field">
                <span>ID（只读）</span>
                <input value={selected.ID} readOnly className="readonly" />
              </label>
            </div>

            <h3 className="section-title">附加信息（MeterOtherInfo）</h3>
            <div className="form-grid">
              {OTHER_FIELDS.map((f) => (
                <label key={f.key} className="field">
                  <span>{f.label}</span>
                  <input
                    value={
                      other?.[f.key] === undefined || other?.[f.key] === null
                        ? ""
                        : String(other[f.key])
                    }
                    onChange={(e) => updateOther(f.key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <p className="hint">其余冷门字段可在「原始 JSON」Tab 中编辑。</p>
          </>
        )}
      </section>
    </div>
  );
}
