import { gunzipSync, gzipSync } from "zlib";

export type WisdomData = Record<string, unknown>;

export function decodeWisdom(buffer: Buffer): WisdomData {
  const json = gunzipSync(buffer).toString("utf8");
  const data = JSON.parse(json) as unknown;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Wisdom JSON root must be an object");
  }
  return data as WisdomData;
}

export function encodeWisdom(data: WisdomData): Buffer {
  const json = JSON.stringify(data, null, 2);
  return gzipSync(Buffer.from(json, "utf8"));
}
