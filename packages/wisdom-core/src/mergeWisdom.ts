import { newId } from "./defaults";
import type { JsonObject, MeterInfo, WisdomRoot } from "./types";
import { ensureWisdomShape } from "./wisdomModel";

export type ConflictPolicy = "latest" | "preferFile";

export type MergeSource = {
  fileIndex: number;
  fromMeterNo: string;
  fromSeat?: string;
};

export type MergeInclude = {
  itemCode?: string;
  pointId?: string;
};

export type MergeGroup = {
  toMeterNo: string;
  toSeat?: string;
  sources: MergeSource[];
  include?: MergeInclude[];
};

export type MergeFileInput = {
  name: string;
  path?: string;
  data: WisdomRoot;
};

export type ConflictOverride = {
  toMeterNo: string;
  toSeat?: string;
  pointId: string;
  chosen: number | "base";
};

export type MergeRequest = {
  files: MergeFileInput[];
  baseIndex: number;
  groups: MergeGroup[];
  conflictPolicy: ConflictPolicy;
  preferFileIndex?: number;
  overrides?: ConflictOverride[];
};

export type MeterRef = {
  id: string;
  meterNo: string;
  seat: string;
  label: string;
};

export type MergeConflictCandidate = {
  fileIndex: number | "base";
  fileName: string;
  fromMeterNo: string;
  fromSeat: string;
  FinalResults: string;
  Result: string;
  AverageResult: string;
  StartTime: string;
  EndTime: string;
  result: JsonObject;
};

export type MergeConflict = {
  toMeterNo: string;
  toSeat: string;
  pointId: string;
  pointName: string;
  itemName: string;
  itemCode: string;
  candidates: MergeConflictCandidate[];
  suggested: number | "base";
};

export type MergeItemOption = {
  itemCode: string;
  itemName: string;
  pointIds: string[];
};

export type MergeOk = {
  ok: true;
  data: WisdomRoot;
  conflicts: MergeConflict[];
  warnings: string[];
};

export type MergeFail = {
  ok: false;
  error: string;
};

export type MergeOutcome = MergeOk | MergeFail;

function asString(v: unknown): string {
  return v == null ? "" : String(v);
}

export function suggestedMergedFileName(baseFileName: string, now = new Date()): string {
  const stem = baseFileName.replace(/\.wisdom$/i, "") || "merged";
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(
    now.getHours()
  )}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `${stem}-merged-${stamp}.wisdom`;
}

export function isSameFilePath(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return norm(a) === norm(b);
}

export function assertNewMergePath(savePath: string, sourcePaths: string[]): void {
  if (sourcePaths.some((p) => p && isSameFilePath(p, savePath))) {
    throw new Error("不能覆盖参与合并的原文件，请另存为新文件");
  }
}

export function listMeterRefs(data: WisdomRoot): MeterRef[] {
  return [...data.MeterInfoList]
    .sort((a, b) => Number(a.MeterSeat) - Number(b.MeterSeat) || a.MeterNo.localeCompare(b.MeterNo))
    .map((m) => ({
      id: m.ID,
      meterNo: m.MeterNo,
      seat: asString(m.MeterSeat),
      label: `表位 ${m.MeterSeat ?? "?"} · ${m.MeterNo || "(无表号)"}`,
    }));
}

export function schemeIdOf(data: WisdomRoot): string {
  return asString(data.Scheme?.ID);
}

/** 判断两个方案点是否相同。后期只改这个数组。 */
export const SCHEME_POINT_IDENTITY_KEYS = ["ItemCode", "TestData", "Remark"] as const;

export function schemePointIdentity(group: JsonObject): string {
  return SCHEME_POINT_IDENTITY_KEYS.map((k) => asString(group[k])).join("\0");
}

function identityIsBlank(ident: string): boolean {
  return ident.split("\0").every((part) => part === "");
}

function groupById(groups: JsonObject[], id: string): JsonObject | undefined {
  if (!id) return undefined;
  return groups.find((g) => asString(g.ID) === id);
}

/** 结论分桶键：优先按方案点身份对上基准 SchemeGroup.ID，对不上再用身份或原 PointID。 */
export function resultBucketKey(
  row: JsonObject,
  srcGroups: JsonObject[],
  baseGroups: JsonObject[]
): string {
  const pid = asString(row.PointID).trim();
  const srcGroup = pid ? groupById(srcGroups, pid) : undefined;
  if (srcGroup) {
    const ident = schemePointIdentity(srcGroup);
    if (!identityIsBlank(ident)) {
      const hit = baseGroups.find((g) => schemePointIdentity(g) === ident);
      if (hit) return asString(hit.ID);
      return `ident:${ident}`;
    }
    if (groupById(baseGroups, asString(srcGroup.ID))) return asString(srcGroup.ID);
    return `gid:${asString(srcGroup.ID)}`;
  }
  return pointKeyOf(row);
}

export function validateMergeSchemes(
  files: MergeFileInput[],
  baseIndex: number
): string | null {
  if (files.length < 2) return "请至少选择两个 wisdom 文件";
  if (baseIndex < 0 || baseIndex >= files.length) return "基准文件无效";
  return null;
}

export function schemeMismatchWarnings(
  files: MergeFileInput[],
  baseIndex: number
): string[] {
  const base = files[baseIndex]?.data;
  if (!base) return [];
  const sid = schemeIdOf(base);
  const out: string[] = [];
  for (let i = 0; i < files.length; i++) {
    if (i === baseIndex) continue;
    if (schemeIdOf(files[i].data) !== sid) {
      out.push(`「${files[i].name}」与基准方案不同，将按试验点把结论贴到基准方案上`);
    }
  }
  return out;
}

function findMeter(
  data: WisdomRoot,
  meterNo: string,
  seat?: string
): MeterInfo | undefined {
  const hits = data.MeterInfoList.filter((m) => m.MeterNo === meterNo);
  if (seat != null && seat !== "") {
    return hits.find((m) => asString(m.MeterSeat) === asString(seat));
  }
  return hits.length === 1 ? hits[0] : hits[0];
}

function meterMatchesCount(data: WisdomRoot, meterNo: string, seat?: string): number {
  const hits = data.MeterInfoList.filter((m) => m.MeterNo === meterNo);
  if (seat != null && seat !== "") {
    return hits.filter((m) => asString(m.MeterSeat) === asString(seat)).length;
  }
  return hits.length;
}

export function pointKeyOf(row: JsonObject): string {
  const pid = asString(row.PointID).trim();
  if (pid) return pid;
  return `${asString(row.ItemID)}::${asString(row.PointName)}`;
}

function inferItemCode(row: JsonObject, groups: JsonObject[]): string {
  if (asString(row.ItemCode)) return asString(row.ItemCode);
  const byPoint = groups.find((g) => asString(g.ID) === asString(row.PointID));
  const byItem = groups.find((g) => asString(g.ID) === asString(row.ItemID));
  const g = byPoint ?? byItem;
  if (g && asString(g.ItemCode)) return asString(g.ItemCode);
  const name = asString(row.ItemName);
  const m = name.match(/\[(\d+)\]\s*$/);
  return m ? m[1] : "";
}

function resultTime(row: JsonObject): number {
  const raw = asString(row.EndTime) || asString(row.StartTime);
  const n = Date.parse(raw);
  return Number.isFinite(n) ? n : 0;
}

function matchesInclude(
  row: JsonObject,
  include: MergeInclude[] | undefined,
  groups: JsonObject[]
): boolean {
  if (!include || include.length === 0) return true;
  const pid = pointKeyOf(row);
  const itemCode = inferItemCode(row, groups);
  return include.some((inc) => {
    if (inc.pointId) return inc.pointId === pid || inc.pointId === asString(row.PointID);
    if (inc.itemCode) return inc.itemCode === itemCode;
    return false;
  });
}

function resultsForMeter(data: WisdomRoot, meter: MeterInfo): JsonObject[] {
  return data.ResultDetailList.filter((r) => asString(r.MeterID) === meter.ID);
}

function cloneRoot(data: WisdomRoot): WisdomRoot {
  return ensureWisdomShape(JSON.parse(JSON.stringify(data)) as JsonObject);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function remapGroupId(remap: Map<string, string>, fileIndex: number, oldId: string): string {
  if (!oldId) return oldId;
  return remap.get(`${fileIndex}:${oldId}`) ?? oldId;
}

function retargetResult(
  src: JsonObject,
  target: MeterInfo,
  fileIndex: number,
  remap: Map<string, string>,
  next: WisdomRoot
): JsonObject {
  const pointId = remapGroupId(remap, fileIndex, asString(src.PointID));
  const itemId = remapGroupId(remap, fileIndex, asString(src.ItemID));
  const pointGroup = groupById(next.SchemeGroupList, pointId);
  const scheme = next.Scheme ?? {};
  const keepId = asString(src.ID);
  return {
    ...src,
    ID: keepId || newId(),
    MeterID: target.ID,
    MeterSeat: target.MeterSeat,
    MeterBh: target.MeterNo,
    MeterAddr: target.MeterAddr ?? src.MeterAddr,
    MeterName: target.Name ?? src.MeterName,
    PointID: pointId || src.PointID,
    ItemID: itemId || src.ItemID,
    ProID: asString(scheme.ID) || src.ProID,
    ProBH: asString(scheme.BH) || src.ProBH,
    PointName: pointGroup ? asString(pointGroup.Name) || src.PointName : src.PointName,
  };
}

function candidateFromRow(
  fileIndex: number | "base",
  fileName: string,
  meterNo: string,
  seat: string,
  row: JsonObject
): MergeConflictCandidate {
  return {
    fileIndex,
    fileName,
    fromMeterNo: meterNo,
    fromSeat: seat,
    FinalResults: asString(row.FinalResults),
    Result: asString(row.Result),
    AverageResult: asString(row.AverageResult),
    StartTime: asString(row.StartTime),
    EndTime: asString(row.EndTime),
    result: row,
  };
}

function pickSuggested(
  cands: MergeConflictCandidate[],
  policy: ConflictPolicy,
  preferFileIndex: number | undefined
): number | "base" {
  const sources = cands.filter((c) => c.fileIndex !== "base");
  if (policy === "preferFile" && preferFileIndex != null) {
    const hit = sources.find((c) => c.fileIndex === preferFileIndex);
    if (hit && typeof hit.fileIndex === "number") return hit.fileIndex;
  }
  let best: MergeConflictCandidate | undefined;
  let bestTime = -1;
  let bestIndex = -1;
  for (const c of sources) {
    if (typeof c.fileIndex !== "number") continue;
    const t = resultTime(c.result);
    if (!best || t > bestTime || (t === bestTime && c.fileIndex > bestIndex)) {
      best = c;
      bestTime = t;
      bestIndex = c.fileIndex;
    }
  }
  return best && typeof best.fileIndex === "number" ? best.fileIndex : "base";
}

type PreparedGroup = {
  group: MergeGroup;
  target: MeterInfo;
  buckets: Map<string, MergeConflictCandidate[]>;
};

function groupTargetKey(toMeterNo: string, toSeat?: string): string {
  return `${toMeterNo}@@${toSeat ?? ""}`;
}

function sourceKey(fileIndex: number, fromMeterNo: string, fromSeat?: string): string {
  return `${fileIndex}@@${fromMeterNo}@@${fromSeat ?? ""}`;
}

function prepareGroups(req: MergeRequest): { error?: string; warnings: string[]; prepared: PreparedGroup[] } {
  const { files, baseIndex, groups } = req;
  const warnings: string[] = [];
  const schemeError = validateMergeSchemes(files, baseIndex);
  if (schemeError) return { error: schemeError, warnings, prepared: [] };
  warnings.push(...schemeMismatchWarnings(files, baseIndex));
  if (groups.length === 0) return { error: "请至少添加一条基准电表映射", warnings, prepared: [] };

  const base = files[baseIndex].data;
  const seenTargets = new Set<string>();
  const seenSources = new Set<string>();
  const prepared: PreparedGroup[] = [];

  for (const group of groups) {
    const tKey = groupTargetKey(group.toMeterNo, group.toSeat);
    if (seenTargets.has(tKey)) {
      return { error: `基准电表 ${group.toMeterNo} 在映射中重复`, warnings, prepared: [] };
    }
    seenTargets.add(tKey);

    const targetCount = meterMatchesCount(base, group.toMeterNo, group.toSeat);
    if (targetCount === 0) {
      return { error: `基准文件中找不到电表 ${group.toMeterNo}`, warnings, prepared: [] };
    }
    if (targetCount > 1 && (group.toSeat == null || group.toSeat === "")) {
      return {
        error: `基准文件中表号 ${group.toMeterNo} 出现多次，请指定表位`,
        warnings,
        prepared: [],
      };
    }
    const target = findMeter(base, group.toMeterNo, group.toSeat);
    if (!target) {
      return { error: `基准文件中找不到电表 ${group.toMeterNo}`, warnings, prepared: [] };
    }

    const sources = group.sources.filter(
      (s) => s.fromMeterNo && s.fileIndex !== baseIndex
    );
    if (sources.length === 0) {
      warnings.push(`基准电表 ${group.toMeterNo} 没有选择任何源电表，已跳过`);
      continue;
    }

    const buckets = new Map<string, MergeConflictCandidate[]>();
    for (const src of sources) {
      if (src.fileIndex < 0 || src.fileIndex >= files.length) {
        return { error: `源文件序号无效：${src.fileIndex}`, warnings, prepared: [] };
      }
      const sKey = sourceKey(src.fileIndex, src.fromMeterNo, src.fromSeat);
      if (seenSources.has(sKey)) {
        return {
          error: `「${files[src.fileIndex].name}」的电表 ${src.fromMeterNo} 被映射到多块基准表`,
          warnings,
          prepared: [],
        };
      }
      seenSources.add(sKey);

      const file = files[src.fileIndex];
      const meterCount = meterMatchesCount(file.data, src.fromMeterNo, src.fromSeat);
      if (meterCount === 0) {
        return {
          error: `「${file.name}」中找不到电表 ${src.fromMeterNo}`,
          warnings,
          prepared: [],
        };
      }
      if (meterCount > 1 && (src.fromSeat == null || src.fromSeat === "")) {
        return {
          error: `「${file.name}」中表号 ${src.fromMeterNo} 出现多次，请指定表位`,
          warnings,
          prepared: [],
        };
      }
      const meter = findMeter(file.data, src.fromMeterNo, src.fromSeat);
      if (!meter) {
        return {
          error: `「${file.name}」中找不到电表 ${src.fromMeterNo}`,
          warnings,
          prepared: [],
        };
      }
      for (const row of resultsForMeter(file.data, meter)) {
        if (!matchesInclude(row, group.include, file.data.SchemeGroupList)) continue;
        const key = resultBucketKey(row, file.data.SchemeGroupList, base.SchemeGroupList);
        const list = buckets.get(key) ?? [];
        list.push(
          candidateFromRow(
            src.fileIndex,
            file.name,
            meter.MeterNo,
            asString(meter.MeterSeat),
            row
          )
        );
        buckets.set(key, list);
      }
    }

    prepared.push({ group, target, buckets });
  }

  if (prepared.length === 0) {
    return { error: "没有可合并的源电表", warnings, prepared: [] };
  }
  return { warnings, prepared };
}

function attachBaseCandidates(
  prepared: PreparedGroup[],
  base: WisdomRoot,
  baseName: string
): void {
  for (const item of prepared) {
    const existing = resultsForMeter(base, item.target);
    const byKey = new Map(
      existing.map((r) => [resultBucketKey(r, base.SchemeGroupList, base.SchemeGroupList), r])
    );
    for (const [key, cands] of item.buckets) {
      if (cands.length < 2) continue;
      const baseRow = byKey.get(key);
      if (!baseRow) continue;
      cands.unshift(
        candidateFromRow(
          "base",
          `${baseName}（基准原值）`,
          item.target.MeterNo,
          asString(item.target.MeterSeat),
          baseRow
        )
      );
    }
  }
}

function buildConflicts(
  prepared: PreparedGroup[],
  req: MergeRequest
): MergeConflict[] {
  const conflicts: MergeConflict[] = [];
  for (const item of prepared) {
    for (const [pointId, candidates] of item.buckets) {
      const sources = candidates.filter((c) => c.fileIndex !== "base");
      if (sources.length < 2) continue;
      const sample = sources[0].result;
      conflicts.push({
        toMeterNo: item.target.MeterNo,
        toSeat: asString(item.target.MeterSeat),
        pointId,
        pointName: asString(sample.PointName),
        itemName: asString(sample.ItemName),
        itemCode: inferItemCode(sample, req.files[req.baseIndex].data.SchemeGroupList),
        candidates,
        suggested: pickSuggested(candidates, req.conflictPolicy, req.preferFileIndex),
      });
    }
  }
  return conflicts;
}

export function defaultMergeGroups(
  files: MergeFileInput[],
  baseIndex: number
): MergeGroup[] {
  const base = files[baseIndex]?.data;
  if (!base) return [];
  const groups: MergeGroup[] = [];
  for (const meter of listMeterRefs(base)) {
    const sources: MergeSource[] = [];
    files.forEach((file, i) => {
      if (i === baseIndex) return;
      const hit = file.data.MeterInfoList.find((m) => m.MeterNo === meter.meterNo);
      if (hit) {
        sources.push({
          fileIndex: i,
          fromMeterNo: hit.MeterNo,
          fromSeat: asString(hit.MeterSeat),
        });
      }
    });
    if (sources.length > 0) {
      groups.push({
        toMeterNo: meter.meterNo,
        toSeat: meter.seat,
        sources,
      });
    }
  }
  return groups;
}

export function listGroupItemOptions(
  files: MergeFileInput[],
  group: MergeGroup
): MergeItemOption[] {
  const byCode = new Map<string, MergeItemOption>();
  for (const src of group.sources) {
    const file = files[src.fileIndex];
    if (!file) continue;
    const meter = findMeter(file.data, src.fromMeterNo, src.fromSeat);
    if (!meter) continue;
    for (const row of resultsForMeter(file.data, meter)) {
      const code = inferItemCode(row, file.data.SchemeGroupList) || asString(row.ItemName) || "(未分类)";
      const name = asString(row.ItemName) || code;
      const pid = pointKeyOf(row);
      const cur = byCode.get(code) ?? { itemCode: code, itemName: name, pointIds: [] };
      if (!cur.pointIds.includes(pid)) cur.pointIds.push(pid);
      byCode.set(code, cur);
    }
  }
  return [...byCode.values()];
}

export function previewMerge(req: MergeRequest): MergeOutcome {
  const prep = prepareGroups(req);
  if (prep.error) return { ok: false, error: prep.error };
  attachBaseCandidates(prep.prepared, req.files[req.baseIndex].data, req.files[req.baseIndex].name);
  return {
    ok: true,
    data: req.files[req.baseIndex].data,
    conflicts: buildConflicts(prep.prepared, req),
    warnings: prep.warnings,
  };
}

function ensureSchemeGroups(
  next: WisdomRoot,
  files: MergeFileInput[],
  prepared: PreparedGroup[]
): Map<string, string> {
  const remap = new Map<string, string>();
  const scheme = next.Scheme ?? {};
  const byIdent = new Map<string, JsonObject>();
  const usedIds = new Set(next.SchemeGroupList.map((g) => asString(g.ID)));
  for (const g of next.SchemeGroupList) {
    const ident = schemePointIdentity(g);
    if (!identityIsBlank(ident) && !byIdent.has(ident)) byIdent.set(ident, g);
  }

  const adopt = (fileIndex: number, srcData: WisdomRoot, oldId: string): string => {
    const key = `${fileIndex}:${oldId}`;
    const cached = remap.get(key);
    if (cached) return cached;
    if (!oldId) return "";
    const srcGroup = groupById(srcData.SchemeGroupList, oldId);
    if (!srcGroup) {
      remap.set(key, oldId);
      return oldId;
    }
    const ident = schemePointIdentity(srcGroup);
    if (!identityIsBlank(ident)) {
      const hit = byIdent.get(ident);
      if (hit) {
        const canon = asString(hit.ID);
        remap.set(key, canon);
        return canon;
      }
    } else if (usedIds.has(oldId)) {
      remap.set(key, oldId);
      return oldId;
    }

    let nextId = oldId;
    if (usedIds.has(nextId)) nextId = newId();
    const copied = cloneJson(srcGroup);
    copied.ID = nextId;
    copied.ProID = asString(scheme.ID) || copied.ProID;
    copied.ProBH = asString(scheme.BH) || copied.ProBH;
    copied.ProName = asString(scheme.Name) || copied.ProName;
    next.SchemeGroupList.push(copied);
    usedIds.add(nextId);
    if (!identityIsBlank(ident)) byIdent.set(ident, copied);
    remap.set(key, nextId);

    const testItemId = asString(copied.ItemID);
    if (testItemId && !next.TestItemList.some((t) => asString(t.ID) === testItemId)) {
      const srcItem = srcData.TestItemList.find((t) => asString(t.ID) === testItemId);
      if (srcItem) next.TestItemList.push(cloneJson(srcItem));
    }
    return nextId;
  };

  for (const item of prepared) {
    for (const [, cands] of item.buckets) {
      for (const cand of cands) {
        if (typeof cand.fileIndex !== "number") continue;
        const file = files[cand.fileIndex];
        if (!file) continue;
        adopt(cand.fileIndex, file.data, asString(cand.result.PointID));
        adopt(cand.fileIndex, file.data, asString(cand.result.ItemID));
      }
    }
  }
  return remap;
}

export function mergeWisdom(req: MergeRequest): MergeOutcome {
  const prep = prepareGroups(req);
  if (prep.error) return { ok: false, error: prep.error };
  const baseFile = req.files[req.baseIndex];
  attachBaseCandidates(prep.prepared, baseFile.data, baseFile.name);
  const conflicts = buildConflicts(prep.prepared, req);

  const overrideMap = new Map<string, number | "base">();
  for (const o of req.overrides ?? []) {
    overrideMap.set(`${groupTargetKey(o.toMeterNo, o.toSeat)}::${o.pointId}`, o.chosen);
  }

  const next = cloneRoot(baseFile.data);
  next.ID = newId();
  const remap = ensureSchemeGroups(next, req.files, prep.prepared);
  const list = next.ResultDetailList;

  for (const item of prep.prepared) {
    const target = findMeter(next, item.target.MeterNo, asString(item.target.MeterSeat));
    if (!target) continue;
    for (const [pointId, candidates] of item.buckets) {
      const sources = candidates.filter((c) => c.fileIndex !== "base");
      let chosen: MergeConflictCandidate | undefined;
      if (sources.length === 0) continue;
      if (sources.length === 1) {
        chosen = sources[0];
      } else {
        const key = `${groupTargetKey(item.target.MeterNo, asString(item.target.MeterSeat))}::${pointId}`;
        const pick = overrideMap.has(key)
          ? overrideMap.get(key)!
          : pickSuggested(candidates, req.conflictPolicy, req.preferFileIndex);
        if (pick === "base") continue;
        chosen = sources.find((c) => c.fileIndex === pick) ?? sources[0];
      }
      if (!chosen || typeof chosen.fileIndex !== "number") continue;
      const rewritten = retargetResult(chosen.result, target, chosen.fileIndex, remap, next);
      const canonPoint = asString(rewritten.PointID);
      const existingIdx = list.findIndex(
        (r) => asString(r.MeterID) === target.ID && asString(r.PointID) === canonPoint
      );
      if (existingIdx >= 0) {
        rewritten.ID = list[existingIdx].ID;
        list[existingIdx] = rewritten;
      } else {
        const rid = asString(rewritten.ID);
        if (!rid || list.some((r) => asString(r.ID) === rid)) {
          rewritten.ID = newId();
        }
        list.push(rewritten);
      }
    }
  }

  return {
    ok: true,
    data: next,
    conflicts,
    warnings: prep.warnings,
  };
}
