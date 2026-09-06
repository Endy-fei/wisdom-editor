import { describe, expect, it } from "vitest";
import {
  ensureWisdomShape,
  mergeWisdom,
  previewMerge,
  validateMergeSchemes,
  suggestedMergedFileName,
  assertNewMergePath,
  pointKeyOf,
  type JsonObject,
  type MeterInfo,
  type WisdomRoot,
} from "@wisdom/core";

function meter(id: string, no: string, seat: string): MeterInfo {
  return { ID: id, MeterNo: no, MeterSeat: seat };
}

function result(opts: {
  id: string;
  meterId: string;
  pointId: string;
  itemName?: string;
  value?: string;
  end?: string;
  final?: string;
}): JsonObject {
  return {
    ID: opts.id,
    MeterID: opts.meterId,
    PointID: opts.pointId,
    PointName: opts.pointId,
    ItemName: opts.itemName ?? "固有误差 [2601]",
    ItemCode: "2601",
    Result: opts.value ?? "0.1",
    FinalResults: opts.final ?? "合格",
    EndTime: opts.end ?? "2026-09-04 10:00:00",
  };
}

function file(opts: {
  name: string;
  docId: string;
  schemeId: string;
  meters: MeterInfo[];
  groupIds?: string[];
  groups?: JsonObject[];
  testItems?: JsonObject[];
  results: JsonObject[];
}): { name: string; data: WisdomRoot } {
  return {
    name: opts.name,
    data: ensureWisdomShape({
      ID: opts.docId,
      Scheme: { ID: opts.schemeId, Name: "方案A", BH: "BH-A" },
      SchemeGroupList:
        opts.groups ??
        (opts.groupIds ?? []).map((id) => ({
          ID: id,
          ItemCode: "2601",
          TestData: id,
        })),
      TestItemList: opts.testItems ?? [],
      MeterInfoList: opts.meters,
      ResultDetailList: opts.results,
    }),
  };
}

const GROUPS = ["p1", "p2", "p3", "p4"];

describe("mergeWisdom", () => {
  it("allows different schemes and pastes matching points", () => {
    const a = file({
      name: "a.wisdom",
      docId: "A",
      schemeId: "scheme-1",
      meters: [meter("m1", "001", "1")],
      groupIds: GROUPS,
      results: [result({ id: "base-p1", meterId: "m1", pointId: "p1", value: "BASE" })],
    });
    const b = file({
      name: "b.wisdom",
      docId: "B",
      schemeId: "scheme-2",
      meters: [meter("m2", "002", "2")],
      groupIds: ["p2", "p9"],
      results: [
        result({ id: "src-p2", meterId: "m2", pointId: "p2", value: "FROM-B" }),
        result({ id: "src-p9", meterId: "m2", pointId: "p9", value: "EXTRA" }),
      ],
    });
    expect(validateMergeSchemes([a, b], 0)).toBeNull();
    const merged = mergeWisdom({
      files: [a, b],
      baseIndex: 0,
      groups: [{ toMeterNo: "001", sources: [{ fileIndex: 1, fromMeterNo: "002" }] }],
      conflictPolicy: "latest",
    });
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.data.Scheme?.ID).toBe("scheme-1");
    expect(merged.warnings.some((w) => w.includes("方案不同"))).toBe(true);
    const of001 = merged.data.ResultDetailList.filter((r) => r.MeterID === "m1");
    expect(of001.some((r) => r.Result === "BASE" && pointKeyOf(r) === "p1")).toBe(true);
    expect(of001.some((r) => r.Result === "FROM-B" && pointKeyOf(r) === "p2")).toBe(true);
    expect(of001.some((r) => r.Result === "EXTRA" && pointKeyOf(r) === "p9")).toBe(true);
  });

  it("pastes two groups at once and leaves unmapped meters unchanged", () => {
    const base = file({
      name: "base.wisdom",
      docId: "BASE",
      schemeId: "scheme-1",
      meters: [
        meter("b001", "001", "1"),
        meter("b002", "002", "2"),
        meter("b007", "007", "7"),
      ],
      groupIds: GROUPS,
      results: [
        result({ id: "keep-002", meterId: "b002", pointId: "p1", value: "KEEP" }),
        result({ id: "old-001", meterId: "b001", pointId: "p1", value: "OLD" }),
      ],
    });
    const w2 = file({
      name: "w2.wisdom",
      docId: "W2",
      schemeId: "scheme-1",
      meters: [meter("s002", "002", "13"), meter("s008", "008", "14")],
      groupIds: GROUPS,
      results: [
        result({ id: "w2-002-p2", meterId: "s002", pointId: "p2", value: "FROM-002" }),
        result({ id: "w2-008-p3", meterId: "s008", pointId: "p3", value: "FROM-008" }),
      ],
    });
    const w3 = file({
      name: "w3.wisdom",
      docId: "W3",
      schemeId: "scheme-1",
      meters: [meter("s003", "003", "15"), meter("s009", "009", "16")],
      groupIds: GROUPS,
      results: [
        result({ id: "w3-003-p4", meterId: "s003", pointId: "p4", value: "FROM-003" }),
        result({ id: "w3-009-p3", meterId: "s009", pointId: "p3", value: "FROM-009", end: "2026-09-04 12:00:00" }),
      ],
    });

    const merged = mergeWisdom({
      files: [base, w2, w3],
      baseIndex: 0,
      groups: [
        {
          toMeterNo: "001",
          sources: [
            { fileIndex: 1, fromMeterNo: "002" },
            { fileIndex: 2, fromMeterNo: "003" },
          ],
        },
        {
          toMeterNo: "007",
          sources: [
            { fileIndex: 1, fromMeterNo: "008" },
            { fileIndex: 2, fromMeterNo: "009" },
          ],
        },
      ],
      conflictPolicy: "latest",
    });
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;

    expect(merged.data.ID).not.toBe("BASE");
    expect(merged.data.MeterInfoList.map((m) => m.MeterNo)).toEqual(["001", "002", "007"]);
    expect(merged.data.MeterInfoList.find((m) => m.ID === "b001")?.MeterSeat).toBe("1");

    const of = (meterId: string) =>
      merged.data.ResultDetailList.filter((r) => r.MeterID === meterId);

    const keep = of("b002");
    expect(keep).toHaveLength(1);
    expect(keep[0].Result).toBe("KEEP");
    expect(keep[0].ID).toBe("keep-002");

    const m001 = of("b001");
    expect(m001.some((r) => r.Result === "OLD" && pointKeyOf(r) === "p1")).toBe(true);
    const pasted001 = m001.filter((r) => r.Result === "FROM-002" || r.Result === "FROM-003");
    expect(pasted001).toHaveLength(2);
    expect(pasted001.every((r) => r.MeterBh === "001" && r.MeterSeat === "1")).toBe(true);
    expect(pasted001.find((r) => r.Result === "FROM-002")?.ID).toBe("w2-002-p2");
    expect(pasted001.find((r) => r.Result === "FROM-003")?.ID).toBe("w3-003-p4");

    const m007 = of("b007");
    expect(m007.some((r) => pointKeyOf(r) === "p3")).toBe(true);
    expect(m007.every((r) => r.MeterBh === "007")).toBe(true);
  });

  it("reports conflicts when two sources share a point and respects override", () => {
    const base = file({
      name: "base.wisdom",
      docId: "BASE",
      schemeId: "scheme-1",
      meters: [meter("b001", "001", "1")],
      groupIds: GROUPS,
      results: [result({ id: "base-p1", meterId: "b001", pointId: "p1", value: "BASE" })],
    });
    const w2 = file({
      name: "w2.wisdom",
      docId: "W2",
      schemeId: "scheme-1",
      meters: [meter("s002", "002", "2")],
      groupIds: GROUPS,
      results: [
        result({
          id: "w2-p1",
          meterId: "s002",
          pointId: "p1",
          value: "W2",
          end: "2026-09-04 11:00:00",
        }),
      ],
    });
    const w3 = file({
      name: "w3.wisdom",
      docId: "W3",
      schemeId: "scheme-1",
      meters: [meter("s003", "003", "3")],
      groupIds: GROUPS,
      results: [
        result({
          id: "w3-p1",
          meterId: "s003",
          pointId: "p1",
          value: "W3",
          end: "2026-09-04 09:00:00",
        }),
      ],
    });
    const req = {
      files: [base, w2, w3],
      baseIndex: 0,
      groups: [
        {
          toMeterNo: "001",
          sources: [
            { fileIndex: 1, fromMeterNo: "002" },
            { fileIndex: 2, fromMeterNo: "003" },
          ],
        },
      ],
      conflictPolicy: "latest" as const,
    };
    const preview = previewMerge(req);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.conflicts).toHaveLength(1);
    expect(preview.conflicts[0].suggested).toBe(1);

    const latest = mergeWisdom(req);
    expect(latest.ok).toBe(true);
    if (!latest.ok) return;
    expect(latest.data.ResultDetailList.find((r) => r.MeterID === "b001")?.Result).toBe("W2");

    const keepBase = mergeWisdom({
      ...req,
      overrides: [{ toMeterNo: "001", toSeat: "1", pointId: "p1", chosen: "base" }],
    });
    expect(keepBase.ok).toBe(true);
    if (!keepBase.ok) return;
    expect(keepBase.data.ResultDetailList.find((r) => r.MeterID === "b001")?.Result).toBe("BASE");

    const preferW3 = mergeWisdom({
      ...req,
      conflictPolicy: "preferFile",
      preferFileIndex: 2,
    });
    expect(preferW3.ok).toBe(true);
    if (!preferW3.ok) return;
    expect(preferW3.data.ResultDetailList.find((r) => r.MeterID === "b001")?.Result).toBe("W3");
  });

  it("filters by include itemCode", () => {
    const base = file({
      name: "base.wisdom",
      docId: "BASE",
      schemeId: "scheme-1",
      meters: [meter("b001", "001", "1")],
      groupIds: GROUPS,
      results: [],
    });
    const w2 = file({
      name: "w2.wisdom",
      docId: "W2",
      schemeId: "scheme-1",
      meters: [meter("s002", "002", "2")],
      groupIds: GROUPS,
      results: [
        result({ id: "a", meterId: "s002", pointId: "p1", itemName: "固有误差 [2601]" }),
        {
          ID: "b",
          MeterID: "s002",
          PointID: "p2",
          PointName: "p2",
          ItemName: "潜动 [2602]",
          ItemCode: "2602",
          Result: "QD",
          FinalResults: "合格",
        },
      ],
    });
    const merged = mergeWisdom({
      files: [base, w2],
      baseIndex: 0,
      groups: [
        {
          toMeterNo: "001",
          sources: [{ fileIndex: 1, fromMeterNo: "002" }],
          include: [{ itemCode: "2602" }],
        },
      ],
      conflictPolicy: "latest",
    });
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.data.ResultDetailList).toHaveLength(1);
    expect(merged.data.ResultDetailList[0].ItemCode).toBe("2602");
  });

  it("refuses saving onto a source path", () => {
    expect(() =>
      assertNewMergePath("C:\\data\\a.wisdom", ["C:\\data\\A.wisdom", "C:\\data\\b.wisdom"])
    ).toThrow(/不能覆盖/);
    expect(() =>
      assertNewMergePath("C:\\data\\merged.wisdom", ["C:\\data\\a.wisdom"])
    ).not.toThrow();
  });

  it("builds a new merged file name from the base stem", () => {
    const name = suggestedMergedFileName("三相方案.wisdom", new Date("2026-09-06T01:02:03"));
    expect(name).toBe("三相方案-merged-20260906010203.wisdom");
  });

  it("maps same-identity scheme points onto the base IDs and does not append groups", () => {
    const base = file({
      name: "base.wisdom",
      docId: "BASE",
      schemeId: "scheme-base",
      meters: [meter("b001", "001", "1")],
      groups: [
        {
          ID: "item-base",
          Name: "固有误差",
          ItemCode: "2601",
          TestData: "item",
          Remark: "",
        },
        {
          ID: "pt-base",
          Name: "I=5A",
          ItemCode: "2601",
          TestData: "I=5A",
          Remark: "",
          OrderIndex: 1,
        },
      ],
      results: [],
    });
    const src = file({
      name: "src.wisdom",
      docId: "SRC",
      schemeId: "scheme-src",
      meters: [meter("s002", "002", "2")],
      groups: [
        {
          ID: "item-src",
          Name: "固有误差(源)",
          ItemCode: "2601",
          TestData: "item",
          Remark: "",
        },
        {
          ID: "pt-src",
          Name: "I=5A(源)",
          ItemCode: "2601",
          TestData: "I=5A",
          Remark: "",
          OrderIndex: 99,
        },
      ],
      results: [
        {
          ...result({ id: "src-row", meterId: "s002", pointId: "pt-src", value: "FROM-SRC" }),
          ItemID: "item-src",
          PointName: "I=5A(源)",
          ProID: "scheme-src",
          ProBH: "SRC-BH",
        },
      ],
    });

    const merged = mergeWisdom({
      files: [base, src],
      baseIndex: 0,
      groups: [{ toMeterNo: "001", sources: [{ fileIndex: 1, fromMeterNo: "002" }] }],
      conflictPolicy: "latest",
    });
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;

    expect(merged.data.SchemeGroupList.map((g) => g.ID)).toEqual(["item-base", "pt-base"]);
    const row = merged.data.ResultDetailList.find((r) => r.MeterID === "b001");
    expect(row?.Result).toBe("FROM-SRC");
    expect(row?.PointID).toBe("pt-base");
    expect(row?.ItemID).toBe("item-base");
    expect(row?.ProID).toBe("scheme-base");
    expect(row?.ProBH).toBe("BH-A");
    expect(row?.PointName).toBe("I=5A");
  });

  it("appends missing scheme points and rewrites result IDs to the new groups", () => {
    const base = file({
      name: "base.wisdom",
      docId: "BASE",
      schemeId: "scheme-base",
      meters: [meter("b001", "001", "1")],
      groups: [{ ID: "keep", ItemCode: "2601", TestData: "keep", Name: "保留点" }],
      results: [],
    });
    const src = file({
      name: "src.wisdom",
      docId: "SRC",
      schemeId: "scheme-src",
      meters: [meter("s002", "002", "2")],
      groups: [
        {
          ID: "new-pt",
          Name: "新点",
          ItemCode: "2601",
          TestData: "new-point",
          Remark: "r1",
          ItemID: "ti-1",
          ProID: "scheme-src",
          ProBH: "SRC-BH",
          ProName: "源方案",
        },
      ],
      testItems: [{ ID: "ti-1", Name: "固有误差" }],
      results: [
        {
          ...result({ id: "src-row", meterId: "s002", pointId: "new-pt", value: "NEW" }),
          ItemID: "new-pt",
        },
      ],
    });

    const merged = mergeWisdom({
      files: [base, src],
      baseIndex: 0,
      groups: [{ toMeterNo: "001", sources: [{ fileIndex: 1, fromMeterNo: "002" }] }],
      conflictPolicy: "latest",
    });
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;

    expect(merged.data.SchemeGroupList.map((g) => g.ID)).toEqual(["keep", "new-pt"]);
    const added = merged.data.SchemeGroupList.find((g) => g.ID === "new-pt");
    expect(added?.Name).toBe("新点");
    expect(added?.ProID).toBe("scheme-base");
    expect(added?.ProBH).toBe("BH-A");
    expect(added?.ProName).toBe("方案A");
    expect(merged.data.TestItemList.some((t) => t.ID === "ti-1")).toBe(true);

    const row = merged.data.ResultDetailList.find((r) => r.MeterID === "b001");
    expect(row?.Result).toBe("NEW");
    expect(row?.PointID).toBe("new-pt");
    expect(row?.ItemID).toBe("new-pt");
    expect(row?.ProBH).toBe("BH-A");
  });

  it("allocates a new scheme group ID when the source ID already exists with a different identity", () => {
    const base = file({
      name: "base.wisdom",
      docId: "BASE",
      schemeId: "scheme-base",
      meters: [meter("b001", "001", "1")],
      groups: [{ ID: "same-id", ItemCode: "2601", TestData: "base-only" }],
      results: [],
    });
    const src = file({
      name: "src.wisdom",
      docId: "SRC",
      schemeId: "scheme-src",
      meters: [meter("s002", "002", "2")],
      groups: [{ ID: "same-id", ItemCode: "2601", TestData: "src-only", Name: "源独有点" }],
      results: [result({ id: "src-row", meterId: "s002", pointId: "same-id", value: "SRC" })],
    });

    const merged = mergeWisdom({
      files: [base, src],
      baseIndex: 0,
      groups: [{ toMeterNo: "001", sources: [{ fileIndex: 1, fromMeterNo: "002" }] }],
      conflictPolicy: "latest",
    });
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;

    expect(merged.data.SchemeGroupList).toHaveLength(2);
    expect(merged.data.SchemeGroupList[0].ID).toBe("same-id");
    const added = merged.data.SchemeGroupList[1];
    expect(added.ID).not.toBe("same-id");
    expect(added.TestData).toBe("src-only");
    const row = merged.data.ResultDetailList.find((r) => r.MeterID === "b001");
    expect(row?.PointID).toBe(added.ID);
    expect(row?.Result).toBe("SRC");
  });
});
