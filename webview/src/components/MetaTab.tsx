import { useEffect, useState } from "react";
import type { WisdomRoot } from "../types";

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

export function MetaTab({ data, onChange }: Props) {
  const [rows, setRows] = useState<CertRow[]>(() => certToRows(data.CertificateCode));

  useEffect(() => {
    setRows((prev) => mergeMappedWithDrafts(data.CertificateCode, prev));
  }, [data.CertificateCode]);

  const commitRows = (nextRows: CertRow[]) => {
    setRows(nextRows);
    onChange({ ...data, CertificateCode: rowsToCert(nextRows) });
  };

  const updateRow = (index: number, field: "key" | "value", raw: string) => {
    const next = rows.map((r, i) => (i === index ? { ...r, [field]: raw } : r));
    const row = next[index];
    const hasKey = Boolean(row.key.trim());

    // Draft rows (empty key): keep local only until a key is entered.
    if (!hasKey) {
      setRows(next);
      return;
    }

    commitRows(next);
  };

  const deleteRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    const removed = rows[index];
    // Deleting a draft never needs a host commit.
    if (!removed.key.trim()) {
      setRows(next);
      return;
    }
    commitRows(next);
  };

  return (
    <div className="stack">
      <section>
        <h3 className="section-title">人员</h3>
        <div className="form-grid">
          <label className="field">
            <span>检定员 Inspector</span>
            <input
              value={data.Inspector ?? ""}
              onChange={(e) => onChange({ ...data, Inspector: e.target.value })}
            />
          </label>
          <label className="field">
            <span>核验员 Verifier</span>
            <input
              value={data.Verifier ?? ""}
              onChange={(e) => onChange({ ...data, Verifier: e.target.value })}
            />
          </label>
          <label className="field">
            <span>LastNum</span>
            <input
              value={data.LastNum === undefined || data.LastNum === null ? "" : String(data.LastNum)}
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange({
                  ...data,
                  LastNum: e.target.value.trim() === "" || Number.isNaN(n) ? 0 : n,
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
                      onChange={(e) => updateRow(index, "key", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      value={row.value}
                      placeholder="证书号"
                      onChange={(e) => updateRow(index, "value", e.target.value)}
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
    </div>
  );
}
