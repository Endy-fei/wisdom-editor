import type { JsonObject } from "@wisdom/core";

/** 打开编辑时记住的定位：下标用于 O(1) 写回，ID 在列表变动后兜底。 */
export type ResultRowLocator = {
  index: number;
  id: string;
};

export function rowId(row: JsonObject): string {
  return String(row.ID ?? "").trim();
}

export function locateResultRow(
  list: JsonObject[],
  row: JsonObject
): ResultRowLocator | null {
  const id = rowId(row);
  let index = -1;
  if (id) {
    index = list.findIndex((item) => rowId(item) === id);
  }
  if (index < 0) {
    index = list.indexOf(row);
  }
  if (index < 0) return null;
  return { index, id };
}

export function resolveResultIndex(
  list: JsonObject[],
  loc: ResultRowLocator
): number {
  const at = list[loc.index];
  if (at && rowId(at) === loc.id) return loc.index;
  if (loc.id) {
    const found = list.findIndex((item) => rowId(item) === loc.id);
    if (found >= 0) return found;
  }
  return -1;
}

export function replaceResultRow(
  list: JsonObject[],
  loc: ResultRowLocator,
  next: JsonObject
): JsonObject[] | null {
  const index = resolveResultIndex(list, loc);
  if (index < 0) return null;
  const copy = [...list];
  copy[index] = next;
  return copy;
}

export function resultJsonPointer(loc: ResultRowLocator): string {
  return `/ResultDetailList/${loc.index}`;
}
