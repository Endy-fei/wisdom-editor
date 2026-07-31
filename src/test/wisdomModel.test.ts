import { describe, expect, it } from "vitest";
import {
  ensureWisdomShape,
  createEmptyMeter,
  removeMeter,
  applyJsonText,
} from "@wisdom/core";

describe("wisdomModel", () => {
  it("ensureWisdomShape fills missing arrays/objects without dropping unknowns", () => {
    const input = { ID: "x", Extra: 1 };
    const data = ensureWisdomShape(input);
    expect(Array.isArray(data.MeterInfoList)).toBe(true);
    expect(data.Extra).toBe(1);
    expect(data.ID).toBe("x");
  });

  it("createEmptyMeter returns MeterInfo + OtherInfo with same ID", () => {
    const { meter, other } = createEmptyMeter(3);
    expect(meter.ID).toBe(other.ID);
    expect(meter.MeterSeat).toBe("3");
    expect(other.MeterSeat).toBe(3);
  });

  it("removeMeter cleans MeterOtherInfoMap and CertificateCode", () => {
    const data = ensureWisdomShape({
      MeterInfoList: [
        { ID: "m1", MeterNo: "n1", MeterSeat: "1" },
        { ID: "m2", MeterNo: "n2", MeterSeat: "2" },
      ],
      MeterOtherInfoMap: {
        m1: { ID: "m1", BarCode: "a" },
        m2: { ID: "m2", BarCode: "b" },
      },
      CertificateCode: { n1: "c1", n2: "c2" },
    });
    removeMeter(data, "m1");
    expect(data.MeterInfoList).toHaveLength(1);
    expect((data.MeterOtherInfoMap as Record<string, unknown>).m1).toBeUndefined();
    expect((data.CertificateCode as Record<string, unknown>).n1).toBeUndefined();
    expect((data.CertificateCode as Record<string, unknown>).n2).toBe("c2");
  });

  it("applyJsonText rejects invalid JSON and keeps previous", () => {
    const prev = ensureWisdomShape({ ID: "keep" });
    const result = applyJsonText(prev, "{bad");
    expect(result.ok).toBe(false);
    expect(prev.ID).toBe("keep");
  });

  it("applyJsonText replaces model on valid JSON", () => {
    const prev = ensureWisdomShape({ ID: "old" });
    const result = applyJsonText(prev, JSON.stringify({ ID: "new", MeterInfoList: [] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ID).toBe("new");
    }
  });
});
