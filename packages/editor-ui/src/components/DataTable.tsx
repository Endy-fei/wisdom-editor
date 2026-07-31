import { useEffect, useState } from "react";
import type { JsonObject } from "@wisdom/core";
import { DeferredInput } from "./DeferredInput";

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
  const [localRows, setLocalRows] = useState(rows);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  const toggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === localRows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(localRows.map((_, i) => i)));
    }
  };

  const commitCell = (rowIndex: number, key: string, raw: string) => {
    const prev = localRows[rowIndex]?.[key];
    const parsed = parseCell(raw, prev);
    if (parsed === prev || String(parsed) === cellToString(prev)) {
      // restore display if parse rejected change
      setLocalRows(rows);
      return;
    }
    const next = localRows.map((row, i) =>
      i === rowIndex ? { ...row, [key]: parsed } : row
    );
    setLocalRows(next);
    onChange(next);
  };

  const addRow = () => {
    const next = [...localRows, createRow()];
    setLocalRows(next);
    onChange(next);
  };

  const deleteSelected = () => {
    if (selected.size === 0) return;
    if (!window.confirm(`确认删除选中的 ${selected.size} 行？`)) return;
    const next = localRows.filter((_, i) => !selected.has(i));
    setLocalRows(next);
    setSelected(new Set());
    onChange(next);
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
        <span className="muted">共 {localRows.length} 行 · 单元格失焦后保存</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="col-check">
                <input
                  type="checkbox"
                  checked={localRows.length > 0 && selected.size === localRows.length}
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
            {localRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="empty">
                  {emptyText}
                </td>
              </tr>
            )}
            {localRows.map((row, rowIndex) => (
              <tr
                key={String(row.ID ?? rowIndex)}
                className={selected.has(rowIndex) ? "selected" : ""}
              >
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
                    <DeferredInput
                      className="cell-input"
                      value={cellToString(row[col.key])}
                      onCommit={(raw) => commitCell(rowIndex, col.key, raw)}
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
