import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { JsonObject } from "@wisdom/core";
import { DeferredInput } from "./DeferredInput";

export type Column = {
  key: string;
  label: string;
  /** 固定默认宽度；开启 autoWidth 时作为最小宽度 */
  width?: string;
  /** 按表头与单元格内容估算初始列宽 */
  autoWidth?: boolean;
  /** 自适应时的最大宽度（默认 420） */
  maxWidth?: number;
  /** 是/否下拉；存 1/0，1 表示是 */
  kind?: "text" | "yesNo";
};

type Props = {
  columns: Column[];
  rows: JsonObject[];
  onChange: (rows: JsonObject[]) => void;
  createRow: () => JsonObject;
  emptyText?: string;
  /** 表格区域占满父容器剩余高度，随窗口自适应 */
  fillHeight?: boolean;
};

const MIN_COL_WIDTH = 56;
const CHECK_COL_WIDTH = 40;
const DEFAULT_AUTO_MAX = 420;
const AUTO_SAMPLE_ROWS = 300;
const CELL_PAD = 28;
const HEADER_PAD = 36;

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function parseWidth(width?: string): number {
  if (!width) return 120;
  const n = Number.parseInt(width, 10);
  return Number.isNaN(n) ? 120 : Math.max(MIN_COL_WIDTH, n);
}

let measureCanvas: HTMLCanvasElement | null = null;

function measureTextWidth(text: string, font: string): number {
  if (!text) return 0;
  if (typeof document === "undefined") {
    return Math.ceil(text.length * 8);
  }
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return Math.ceil(text.length * 8);
  ctx.font = font;
  return Math.ceil(ctx.measureText(text).width);
}

function resolveColumnWidth(
  col: Column,
  rows: JsonObject[],
  headerFont: string,
  cellFont: string
): number {
  const minW = parseWidth(col.width);
  if (!col.autoWidth) return minW;

  const maxW = col.maxWidth ?? DEFAULT_AUTO_MAX;
  let best = measureTextWidth(col.label, headerFont) + HEADER_PAD;
  const limit = Math.min(rows.length, AUTO_SAMPLE_ROWS);
  for (let i = 0; i < limit; i++) {
    const text = cellToString(rows[i]?.[col.key]);
    if (!text) continue;
    best = Math.max(best, measureTextWidth(text, cellFont) + CELL_PAD);
  }
  return Math.min(maxW, Math.max(minW, best));
}

function buildWidths(columns: Column[], rows: JsonObject[]): Record<string, number> {
  const headerFont = '600 11px "Sora", "IBM Plex Sans", "PingFang SC", sans-serif';
  const cellFont = '12px "IBM Plex Mono", Consolas, monospace';
  const init: Record<string, number> = {};
  for (const col of columns) {
    init[col.key] = resolveColumnWidth(col, rows, headerFont, cellFont);
  }
  return init;
}

function isYesValue(value: unknown): boolean {
  return value === 1 || value === "1";
}

function parseCell(raw: string, previous: unknown, kind?: Column["kind"]): unknown {
  if (kind === "yesNo") {
    return raw === "1" ? 1 : 0;
  }
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

function sumWidths(columns: Column[], widths: Record<string, number>): number {
  return (
    CHECK_COL_WIDTH +
    columns.reduce((sum, col) => sum + (widths[col.key] ?? 120), 0)
  );
}

export function DataTable({
  columns,
  rows,
  onChange,
  createRow,
  emptyText = "暂无数据",
  fillHeight = false,
}: Props) {
  const [localRows, setLocalRows] = useState(rows);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    buildWidths(columns, rows)
  );

  const widthsRef = useRef(widths);
  widthsRef.current = widths;
  const userResizedRef = useRef<Set<string>>(new Set());
  const tableRef = useRef<HTMLTableElement | null>(null);
  const colElsRef = useRef<Map<string, HTMLTableColElement>>(new Map());
  const dragRef = useRef<{
    key: string;
    startX: number;
    startW: number;
    pointerId: number;
  } | null>(null);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  useEffect(() => {
    setWidths((prev) => {
      const auto = buildWidths(columns, rows);
      const next = { ...prev };
      let changed = false;
      for (const col of columns) {
        if (userResizedRef.current.has(col.key)) {
          if (next[col.key] === undefined) {
            next[col.key] = auto[col.key];
            changed = true;
          }
          continue;
        }
        if (next[col.key] !== auto[col.key]) {
          next[col.key] = auto[col.key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [columns, rows]);

  const setColEl = useCallback((key: string, el: HTMLTableColElement | null) => {
    if (el) colElsRef.current.set(key, el);
    else colElsRef.current.delete(key);
  }, []);

  const paintWidth = useCallback(
    (key: string, width: number) => {
      const el = colElsRef.current.get(key);
      if (el) el.style.width = `${width}px`;
      if (tableRef.current) {
        const next = { ...widthsRef.current, [key]: width };
        const total = sumWidths(columns, next);
        tableRef.current.style.minWidth = `${total}px`;
        tableRef.current.style.width = "100%";
      }
    },
    [columns]
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const nextW = Math.max(MIN_COL_WIDTH, drag.startW + (e.clientX - drag.startX));
      paintWidth(drag.key, nextW);
      widthsRef.current = { ...widthsRef.current, [drag.key]: nextW };
    },
    [paintWidth]
  );

  const endResize = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      document.body.classList.remove("col-resizing");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endResize);
      window.removeEventListener("pointercancel", endResize);
      userResizedRef.current.add(drag.key);
      setWidths({ ...widthsRef.current });
    },
    [onPointerMove]
  );

  const startResize = (key: string, e: ReactPointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    dragRef.current = {
      key,
      startX: e.clientX,
      startW: widthsRef.current[key] ?? 120,
      pointerId: e.pointerId,
    };
    document.body.classList.add("col-resizing");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endResize);
    window.addEventListener("pointercancel", endResize);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endResize);
      window.removeEventListener("pointercancel", endResize);
      document.body.classList.remove("col-resizing");
    };
  }, [onPointerMove, endResize]);

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

  const commitCell = (rowIndex: number, key: string, raw: string, kind?: Column["kind"]) => {
    const prev = localRows[rowIndex]?.[key];
    const parsed = parseCell(raw, prev, kind);
    if (parsed === prev || String(parsed) === cellToString(prev)) {
      if (kind !== "yesNo") {
        setLocalRows(rows);
      }
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

  const tableWidth = sumWidths(columns, widths);

  return (
    <div className={fillHeight ? "datatable datatable-fill" : "datatable"}>
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
        <span className="muted">
          共 {localRows.length} 行 · 拖表头分隔线调列宽 · 单元格失焦后保存
        </span>
      </div>
      <div className="table-scroll">
        <table ref={tableRef} style={{ width: "100%", minWidth: tableWidth }}>
          <colgroup>
            <col style={{ width: CHECK_COL_WIDTH }} />
            {columns.map((col) => (
              <col
                key={col.key}
                ref={(el) => setColEl(col.key, el)}
                style={{ width: widths[col.key] ?? 120 }}
              />
            ))}
          </colgroup>
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
                <th key={col.key}>
                  <span className="th-label">{col.label}</span>
                  <span
                    className="col-resizer"
                    onPointerDown={(e) => startResize(col.key, e)}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`拖动调整「${col.label}」列宽`}
                    title="拖动调整列宽"
                  />
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
                    {col.kind === "yesNo" ? (
                      <select
                        className="cell-input"
                        value={isYesValue(row[col.key]) ? "1" : "0"}
                        onChange={(e) =>
                          commitCell(rowIndex, col.key, e.target.value, "yesNo")
                        }
                      >
                        <option value="1">是</option>
                        <option value="0">否</option>
                      </select>
                    ) : (
                      <DeferredInput
                        className="cell-input"
                        value={cellToString(row[col.key])}
                        onCommit={(raw) => commitCell(rowIndex, col.key, raw)}
                      />
                    )}
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
