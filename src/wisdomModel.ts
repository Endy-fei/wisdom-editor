import { emptyMeter, emptyOtherInfo } from "./defaults";
import type { MeterInfo, MeterOtherInfo, WisdomRoot, JsonObject } from "./types";

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asObject(v: unknown): JsonObject {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as JsonObject)
    : {};
}

export function ensureWisdomShape(input: JsonObject): WisdomRoot {
  const data = { ...input } as WisdomRoot;
  data.MeterInfoList = asArray(data.MeterInfoList) as MeterInfo[];
  data.SchemeGroupList = asArray(data.SchemeGroupList) as JsonObject[];
  data.ResultDetailList = asArray(data.ResultDetailList) as JsonObject[];
  data.TestItemList = asArray(data.TestItemList) as JsonObject[];
  data.CertificateCode = asObject(data.CertificateCode) as Record<string, string>;
  data.MeterOtherInfoMap = asObject(data.MeterOtherInfoMap) as Record<
    string,
    MeterOtherInfo
  >;
  data.Scheme = asObject(data.Scheme);
  if (typeof data.Inspector !== "string") data.Inspector = "";
  if (typeof data.Verifier !== "string") data.Verifier = "";
  if (typeof data.ID !== "string") data.ID = "";
  if (typeof data.LastNum !== "number") data.LastNum = data.MeterInfoList.length;
  return data;
}

export function createEmptyMeter(seat: number): {
  meter: MeterInfo;
  other: MeterOtherInfo;
} {
  const meter = emptyMeter(seat);
  const other = emptyOtherInfo(meter.ID, seat);
  return { meter, other };
}

export function removeMeter(data: WisdomRoot, meterId: string): void {
  const victim = data.MeterInfoList.find((m) => m.ID === meterId);
  data.MeterInfoList = data.MeterInfoList.filter((m) => m.ID !== meterId);
  delete data.MeterOtherInfoMap[meterId];
  if (victim?.MeterNo) {
    delete data.CertificateCode[victim.MeterNo];
  }
}

export type ApplyJsonResult =
  | { ok: true; data: WisdomRoot }
  | { ok: false; error: string };

export function applyJsonText(
  _previous: WisdomRoot,
  text: string
): ApplyJsonResult {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "根节点必须是 JSON 对象" };
    }
    return { ok: true, data: ensureWisdomShape(parsed as JsonObject) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
