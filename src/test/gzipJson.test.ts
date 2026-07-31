import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { decodeWisdom, encodeWisdom } from "../gzipJson";

const samplePath = join(__dirname, "../../samples/sample.wisdom");

describe("gzipJson", () => {
  it("decodes sample.wisdom to object with MeterInfoList", () => {
    const buf = readFileSync(samplePath);
    const data = decodeWisdom(buf);
    expect(Array.isArray(data.MeterInfoList)).toBe(true);
    expect(data.ID).toBeTruthy();
  });

  it("round-trips preserving unknown top-level keys and nested values", () => {
    const original = {
      MeterInfoList: [],
      CustomUnknown: { nested: 1 },
      ID: "abc",
    };
    const encoded = encodeWisdom(original);
    const decoded = decodeWisdom(encoded);
    expect(decoded).toEqual(original);
  });

  it("throws on invalid gzip", () => {
    expect(() => decodeWisdom(Buffer.from("not-gzip"))).toThrow();
  });
});
