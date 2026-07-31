import { useState } from "react";
import type { JsonObject } from "@wisdom/core";

export type Column = {
  key: string;
  label: string;
  width?: string;
};

type Props = {
  columns: Column[];
  rows: JsonObject[];
  onChange: (rows: JsonObject[]) => void;
  createRow: () => JsonObject;
  emptyText?: string;
};

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function parseCell(raw: string, previous: unknown): unknown {
  if (typeof previous === "number") {
    if (raw.trim() === "") return 0;
    const n = Number(raw);
    return Number.isNaN(n) ? previous : n;
  }
  if (typeof previous === "boolean") {
    const lower = raw.trim().toLowerCase();
    if (lower === "true" || lower === "1") return true;
    if (lower === "false" || lower === "0") return false;
    return previous;
  }
  return raw;
}

export function DataTable({
  columns,
  rows,
  onChange,
  createRow,
  emptyText = "暂无数据",
}: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((_, i) => i)));
    }
  };

  const updateCell = (rowIndex: number, key: string, raw: string) => {
    const next = rows.map((row, i) => {
      if (i !== rowIndex) return row;
      return { ...row, [key]: parseCell(raw, row[key]) };
    });
    onChange(next);
  };

  const addRow = () => {
    onChange([...rows, createRow()]);
  };

  const deleteSelected = () => {
    if (selected.size === 0) return;
    onChange(rows.filter((_, i) => !selected.has(i)));
    setSelected(new Set());
  };

  return (
    <div className="datatable">
      <div className="toolbar">
        <button type="button" className="btn" onClick={addRow}>
          新增
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={deleteSelected}
          disabled={selected.size === 0}
        >
          删除选中
        </button>
        <span className="muted">共 {rows.length} 行</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="col-check">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={toggleAll}
                  aria-label="全选"
                />
              </th>
              {columns.map((col) => (
                <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="empty">
                  {emptyText}
                </td>
              </tr>
            )}
            {rows.map((row, rowIndex) => (
              <tr key={String(row.ID ?? rowIndex)} className={selected.has(rowIndex) ? "selected" : ""}>
                <td className="col-check">
                  <input
                    type="checkbox"
                    checked={selected.has(rowIndex)}
                    onChange={() => toggle(rowIndex)}
                    aria-label={`选择第 ${rowIndex + 1} 行`}
                  />
                </td>
                {columns.map((col) => (
                  <td key={col.key}>
                    <input
                      className="cell-input"
                      value={cellToString(row[col.key])}
                      onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
