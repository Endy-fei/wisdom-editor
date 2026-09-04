import { useEffect, useState } from "react";
import type { WisdomRoot } from "@wisdom/core";
import { DeferredInput } from "./DeferredInput";
import { ConfirmDialog } from "./ConfirmDialog";

type Props = {
  data: WisdomRoot;
  onChange: (next: WisdomRoot) => void;
};

type CertRow = { key: string; value: string };

function certToRows(cert: Record<string, string> | undefined): CertRow[] {
  return Object.entries(cert ?? {}).map(([key, value]) => ({
    key,
    value: String(value ?? ""),
  }));
}

function rowsToCert(rows: CertRow[]): Record<string, string> {
  const CertificateCode: Record<string, string> = {};
  for (const row of rows) {
    const k = row.key.trim();
    if (!k) continue;
    CertificateCode[k] = row.value;
  }
  return CertificateCode;
}

function mergeMappedWithDrafts(
  cert: Record<string, string> | undefined,
  prev: CertRow[]
): CertRow[] {
  const mapped = certToRows(cert);
  const drafts = prev.filter((row) => !row.key.trim());
  return [...mapped, ...drafts];
}

/** 更新检定员/核验员，并同步 isCheck 表计的 User 为「检定员@核验员」 */
function applyPersonnel(
  data: WisdomRoot,
  patch: { Inspector?: string; Verifier?: string }
): WisdomRoot {
  const Inspector = patch.Inspector ?? data.Inspector ?? "";
  const Verifier = patch.Verifier ?? data.Verifier ?? "";
  const user = `${Inspector}@${Verifier}`;
  const MeterInfoList = (data.MeterInfoList ?? []).map((m) =>
    m.isCheck === true ? { ...m, User: user } : m
  );
  return { ...data, Inspector, Verifier, MeterInfoList };
}

export function MetaTab({ data, onChange }: Props) {
  const [rows, setRows] = useState<CertRow[]>(() => certToRows(data.CertificateCode));
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

  useEffect(() => {
    setRows((prev) => mergeMappedWithDrafts(data.CertificateCode, prev));
  }, [data.CertificateCode]);

  const commitRows = (nextRows: CertRow[]) => {
    setRows(nextRows);
    onChange({ ...data, CertificateCode: rowsToCert(nextRows) });
  };

  const updateLocalRow = (index: number, field: "key" | "value", raw: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: raw } : r)));
  };

  const commitRowAt = (index: number) => {
    setRows((prev) => {
      const row = prev[index];
      if (!row?.key.trim()) return prev;
      onChange({ ...data, CertificateCode: rowsToCert(prev) });
      return prev;
    });
  };

  const deleteRow = (index: number) => {
    const removed = rows[index];
    // Deleting a draft never needs a host commit.
    if (!removed?.key.trim()) {
      setRows((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    setPendingDeleteIndex(index);
  };

  const confirmDeleteRow = () => {
    if (pendingDeleteIndex === null) return;
    const next = rows.filter((_, i) => i !== pendingDeleteIndex);
    setPendingDeleteIndex(null);
    commitRows(next);
  };

  const pendingKey =
    pendingDeleteIndex === null ? "" : rows[pendingDeleteIndex]?.key ?? "";

  return (
    <div className="stack">
      <section>
        <h3 className="section-title">人员</h3>
        <div className="form-grid">
          <label className="field">
            <span>检定员 Inspector</span>
            <DeferredInput
              value={data.Inspector ?? ""}
              onCommit={(raw) => onChange(applyPersonnel(data, { Inspector: raw }))}
            />
          </label>
          <label className="field">
            <span>核验员 Verifier</span>
            <DeferredInput
              value={data.Verifier ?? ""}
              onCommit={(raw) => onChange(applyPersonnel(data, { Verifier: raw }))}
            />
          </label>
          <label className="field">
            <span>LastNum</span>
            <DeferredInput
              value={
                data.LastNum === undefined || data.LastNum === null
                  ? ""
                  : String(data.LastNum)
              }
              onCommit={(raw) => {
                const n = Number(raw);
                onChange({
                  ...data,
                  LastNum: raw.trim() === "" || Number.isNaN(n) ? 0 : n,
                });
              }}
            />
          </label>
          <label className="field">
            <span>文档 ID（只读）</span>
            <input value={data.ID ?? ""} readOnly className="readonly" />
          </label>
        </div>
      </section>

      <section>
        <div className="toolbar">
          <h3 className="section-title" style={{ margin: 0 }}>
            证书号映射（CertificateCode）
          </h3>
          <button
            type="button"
            className="btn"
            onClick={() => setRows((prev) => [...prev, { key: "", value: "" }])}
          >
            新增
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>表号（键）</th>
                <th>证书号（值）</th>
                <th className="col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty">
                    暂无证书映射
                  </td>
                </tr>
              )}
              {rows.map((row, index) => (
                <tr key={index}>
                  <td>
                    <input
                      className="cell-input"
                      value={row.key}
                      placeholder="表号"
                      onChange={(e) => updateLocalRow(index, "key", e.target.value)}
                      onBlur={() => commitRowAt(index)}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      value={row.value}
                      placeholder="证书号"
                      onChange={(e) => updateLocalRow(index, "value", e.target.value)}
                      onBlur={() => commitRowAt(index)}
                    />
                  </td>
                  <td className="col-actions">
                    <button
                      type="button"
                      className="btn danger small"
                      onClick={() => deleteRow(index)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={pendingDeleteIndex !== null}
        title="删除证书映射"
        message={`确认删除证书映射「${pendingKey}」？`}
        onConfirm={confirmDeleteRow}
        onCancel={() => setPendingDeleteIndex(null)}
      />
    </div>
  );
}
