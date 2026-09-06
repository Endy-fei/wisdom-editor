import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultMergeGroups,
  listGroupItemOptions,
  listMeterRefs,
  mergeWisdom,
  previewMerge,
  suggestedMergedFileName,
  validateMergeSchemes,
  schemeMismatchWarnings,
  type ConflictOverride,
  type ConflictPolicy,
  type MergeGroup,
  type MergeSource,
} from "@wisdom/core";
import type { HostBridge, MergeFilePayload } from "../bridge";

function meterValue(no: string, seat: string): string {
  return `${no}@@${seat}`;
}

function parseMeterValue(v: string): { meterNo: string; seat: string } {
  const i = v.indexOf("@@");
  if (i < 0) return { meterNo: v, seat: "" };
  return { meterNo: v.slice(0, i), seat: v.slice(i + 2) };
}

function conflictKey(toMeterNo: string, toSeat: string, pointId: string): string {
  return `${toMeterNo}@@${toSeat}::${pointId}`;
}

function emptySources(fileCount: number, baseIndex: number): MergeSource[] {
  const sources: MergeSource[] = [];
  for (let i = 0; i < fileCount; i++) {
    if (i === baseIndex) continue;
    sources.push({ fileIndex: i, fromMeterNo: "" });
  }
  return sources;
}

function isWisdomPath(path: string): boolean {
  return path.toLowerCase().split(/[?#]/)[0].endsWith(".wisdom");
}

function fileUrlToPath(value: string): string {
  const text = value.trim();
  if (!text || text.startsWith("#")) return "";
  try {
    if (text.startsWith("file:")) {
      const url = new URL(text);
      let p = decodeURIComponent(url.pathname);
      if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
      return p.replace(/\//g, "\\");
    }
  } catch {
    /* ignore */
  }
  return text;
}

function remapGroupsAfterRemove(groups: MergeGroup[], removedIndex: number): MergeGroup[] {
  return groups.map((group) => ({
    ...group,
    sources: group.sources
      .filter((source) => source.fileIndex !== removedIndex)
      .map((source) =>
        source.fileIndex > removedIndex
          ? { ...source, fileIndex: source.fileIndex - 1 }
          : source
      ),
  }));
}

function extendGroupSources(
  groups: MergeGroup[],
  newCount: number,
  baseIndex: number
): MergeGroup[] {
  if (groups.length === 0) return groups;
  return groups.map((group) => ({
    ...group,
    sources: emptySources(newCount, baseIndex).map((slot) => {
      const existing = group.sources.find((s) => s.fileIndex === slot.fileIndex);
      return existing ?? slot;
    }),
  }));
}

function pathsFromDrop(dt: DataTransfer | null): string[] {
  if (!dt) return [];
  const out: string[] = [];
  const uriList =
    dt.getData("text/uri-list") ||
    dt.getData("application/vnd.code.uri-list") ||
    dt.getData("text/plain");
  for (const line of uriList.split(/\r?\n/)) {
    const path = fileUrlToPath(line);
    if (path) out.push(path);
  }
  for (const file of Array.from(dt.files ?? [])) {
    const path = (file as File & { path?: string }).path;
    if (path) out.push(path);
    else if (file.name) out.push(file.name);
  }
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const path of out) {
    if (!isWisdomPath(path)) continue;
    const key = path.replace(/\\/g, "/").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(path);
  }
  return unique;
}

type Props = {
  bridge: HostBridge;
  initialFiles?: MergeFilePayload[];
  lockedBase?: boolean;
  onClose: () => void;
};

function samePath(a: string, b: string): boolean {
  return a.replace(/\\/g, "/").toLowerCase() === b.replace(/\\/g, "/").toLowerCase();
}

function mergeFileLists(base: MergeFilePayload[], extra: MergeFilePayload[]): MergeFilePayload[] {
  const out = [...base];
  for (const file of extra) {
    if (out.some((x) => samePath(x.path, file.path))) continue;
    out.push(file);
  }
  return out;
}

export function MergeWizard({ bridge, initialFiles, lockedBase = false, onClose }: Props) {
  const [files, setFiles] = useState<MergeFilePayload[]>(initialFiles ?? []);
  const [baseIndex, setBaseIndex] = useState(0);
  const [groups, setGroups] = useState<MergeGroup[]>(() =>
    initialFiles && initialFiles.length >= 2
      ? defaultMergeGroups(initialFiles, 0)
      : []
  );
  const [expanded, setExpanded] = useState<number | null>(null);
  const [policy, setPolicy] = useState<ConflictPolicy>("latest");
  const [preferFileIndex, setPreferFileIndex] = useState(1);
  const [overrides, setOverrides] = useState<Record<string, number | "base">>({});
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyKind, setBusyKind] = useState<"pick" | "save" | "">("");
  const [status, setStatus] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const canDrop = Boolean(bridge.supportsMergeDrop);
  const filesRef = useRef(files);
  const groupsRef = useRef(groups);
  const baseIndexRef = useRef(baseIndex);
  filesRef.current = files;
  groupsRef.current = groups;
  baseIndexRef.current = baseIndex;

  const schemeError =
    files.length >= 2 ? validateMergeSchemes(files, baseIndex) : null;
  const schemeWarnings = useMemo(
    () => (files.length >= 2 ? schemeMismatchWarnings(files, baseIndex) : []),
    [files, baseIndex]
  );

  const preview = useMemo(() => {
    if (files.length < 2 || schemeError || busy) {
      return null;
    }
    const usable = groups.filter((g) => g.toMeterNo && g.sources.some((s) => s.fromMeterNo));
    if (usable.length === 0) return null;
    return previewMerge({
      files,
      baseIndex,
      groups: usable,
      conflictPolicy: policy,
      preferFileIndex: policy === "preferFile" ? preferFileIndex : undefined,
    });
  }, [files, baseIndex, groups, policy, preferFileIndex, schemeError, busy]);

  const conflicts = preview && preview.ok ? preview.conflicts : [];

  const applyFiles = (next: MergeFilePayload[], nextBase = 0) => {
    setFiles(next);
    setBaseIndex(nextBase);
    setGroups(next.length >= 2 ? defaultMergeGroups(next, nextBase) : []);
    setOverrides({});
    setExpanded(null);
    setError("");
    setInfo("");
    if (next.length >= 2) {
      const err = validateMergeSchemes(next, nextBase);
      if (err) setError(err);
    }
  };

  const ingestExtra = useCallback(
    (extra: MergeFilePayload[]): MergeFilePayload[] => {
      const current = filesRef.current;
      if (extra.length === 0) return current;
      const next =
        lockedBase && current[0]
          ? mergeFileLists([current[0], ...current.slice(1)], extra)
          : mergeFileLists(current, extra);
      if (next.length === current.length) return next;
      filesRef.current = next;
      const existingGroups = groupsRef.current;
      const nextBase = lockedBase ? 0 : baseIndexRef.current;
      if (existingGroups.length === 0 || current.length < 2) {
        applyFiles(next, nextBase);
        return next;
      }
      setFiles(next);
      const nextGroups = extendGroupSources(existingGroups, next.length, nextBase);
      groupsRef.current = nextGroups;
      setGroups(nextGroups);
      setError("");
      setInfo("");
      const err = next.length >= 2 ? validateMergeSchemes(next, nextBase) : null;
      if (err) setError(err);
      return next;
    },
    [lockedBase]
  );

  const removeFile = (index: number) => {
    if (index === baseIndex || (lockedBase && index === 0)) return;
    const current = filesRef.current;
    if (index < 0 || index >= current.length) return;
    const nextFiles = current.filter((_, i) => i !== index);
    const nextBase = index < baseIndex ? baseIndex - 1 : baseIndexRef.current;
    filesRef.current = nextFiles;
    baseIndexRef.current = nextBase;
    setFiles(nextFiles);
    setBaseIndex(nextBase);
    setOverrides({});
    setExpanded(null);
    setInfo("");
    if (nextFiles.length < 2) {
      groupsRef.current = [];
      setGroups([]);
      setError("");
      return;
    }
    const nextGroups = remapGroupsAfterRemove(groupsRef.current, index);
    groupsRef.current = nextGroups;
    setGroups(nextGroups);
    setPreferFileIndex((prev) => {
      if (prev === index) return nextBase === 0 ? 1 : 0;
      if (prev > index) return prev - 1;
      return prev;
    });
    setError(validateMergeSchemes(nextFiles, nextBase) ?? "");
  };

  const pickFiles = async () => {
    if (!bridge.pickWisdomFiles) {
      setError("当前环境不支持选择文件");
      return;
    }
    setBusy(true);
    setBusyKind("pick");
    setError("");
    setStatus("请选择要合并进来的 .wisdom 文件…");
    try {
      const picked = await bridge.pickWisdomFiles();
      if (picked && picked.length > 0) ingestExtra(picked);
      setStatus("正在整理映射…");
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setBusyKind("");
      setStatus("");
    }
  };

  const loadDroppedPaths = useCallback(
    async (dropped: string[]) => {
      if (!canDrop || !bridge.loadWisdomFiles) return;
      const usable = dropped.filter((path) => /[/\\]/.test(path) || /^[A-Za-z]:/.test(path));
      if (usable.length === 0) return;
      setBusy(true);
      setBusyKind("pick");
      setError("");
      setStatus("正在读取拖入的文件…");
      try {
        const loaded = await bridge.loadWisdomFiles(usable);
        ingestExtra(loaded ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
        setBusyKind("");
        setStatus("");
      }
    },
    [bridge, canDrop, ingestExtra]
  );

  const onDropFiles = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    await loadDroppedPaths(pathsFromDrop(event.dataTransfer));
  };

  useEffect(() => {
    const unsubscribe = bridge.subscribe((msg) => {
      if (msg.type === "mergeProgress") {
        setBusy(true);
        setStatus(msg.text);
      }
      if (msg.type === "mergeFilesAdded") ingestExtra(msg.files ?? []);
    });
    return unsubscribe;
  }, [bridge, ingestExtra]);

  const loadDroppedPathsRef = useRef(loadDroppedPaths);
  loadDroppedPathsRef.current = loadDroppedPaths;

  useEffect(() => {
    if (!canDrop) return;
    const prevent = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      void loadDroppedPathsRef.current(pathsFromDrop(e.dataTransfer));
    };
    const onWindowDragEnter = (e: DragEvent) => {
      prevent(e);
      setDragOver(true);
    };
    window.addEventListener("dragover", prevent, true);
    window.addEventListener("dragenter", onWindowDragEnter, true);
    window.addEventListener("drop", onWindowDrop, true);
    return () => {
      window.removeEventListener("dragover", prevent, true);
      window.removeEventListener("dragenter", onWindowDragEnter, true);
      window.removeEventListener("drop", onWindowDrop, true);
    };
  }, [canDrop]);

  const changeBase = (index: number) => {
    if (lockedBase) return;
    setBaseIndex(index);
    setGroups(defaultMergeGroups(files, index));
    setOverrides({});
    setPreferFileIndex(index === 0 ? 1 : 0);
    const err = validateMergeSchemes(files, index);
    setError(err ?? "");
  };

  const updateGroup = (index: number, next: MergeGroup) => {
    setGroups((prev) => prev.map((g, i) => (i === index ? next : g)));
    setOverrides({});
  };

  const onPickBaseMeter = (index: number, value: string) => {
    const { meterNo, seat } = parseMeterValue(value);
    const sources = emptySources(files.length, baseIndex).map((src) => {
      const hit = files[src.fileIndex]?.data.MeterInfoList.find((m) => m.MeterNo === meterNo);
      return hit
        ? { fileIndex: src.fileIndex, fromMeterNo: hit.MeterNo, fromSeat: String(hit.MeterSeat) }
        : src;
    });
    updateGroup(index, { ...groups[index], toMeterNo: meterNo, toSeat: seat, sources });
  };

  const onPickSource = (groupIndex: number, fileIndex: number, value: string) => {
    const group = groups[groupIndex];
    const nextSources = emptySources(files.length, baseIndex).map((slot) => {
      const existing = group.sources.find((s) => s.fileIndex === slot.fileIndex);
      if (slot.fileIndex !== fileIndex) {
        return existing ?? slot;
      }
      if (!value) return { fileIndex, fromMeterNo: "" };
      const { meterNo, seat } = parseMeterValue(value);
      return { fileIndex, fromMeterNo: meterNo, fromSeat: seat };
    });
    updateGroup(groupIndex, { ...group, sources: nextSources });
  };

  const toggleItem = (groupIndex: number, itemCode: string, checked: boolean) => {
    const group = groups[groupIndex];
    const options = listGroupItemOptions(files, group);
    const current = new Set(
      (group.include ?? [])
        .map((i) => i.itemCode)
        .filter((c): c is string => Boolean(c) && c !== "__none__")
    );
    const noneOn = group.include?.some((i) => i.itemCode === "__none__");
    const selected = noneOn || current.size > 0 ? current : new Set(options.map((o) => o.itemCode));
    if (checked) selected.add(itemCode);
    else selected.delete(itemCode);
    if (selected.size === 0) {
      updateGroup(groupIndex, { ...group, include: [{ itemCode: "__none__" }] });
      return;
    }
    const include =
      selected.size === options.length
        ? undefined
        : [...selected].map((code) => ({ itemCode: code }));
    updateGroup(groupIndex, { ...group, include });
  };

  const save = async () => {
    setError("");
    setInfo("");
    if (files.length < 2) {
      setError("请至少选择两个 .wisdom 文件");
      return;
    }
    if (schemeError) {
      setError(schemeError);
      return;
    }
    if (!bridge.saveMerged) {
      setError("当前环境不支持另存为");
      return;
    }
    const usable = groups.filter((g) => g.toMeterNo && g.sources.some((s) => s.fromMeterNo));
    if (usable.length === 0) {
      setError("请至少配置一条基准电表映射");
      return;
    }
    const overrideList: ConflictOverride[] = Object.entries(overrides).map(([key, chosen]) => {
      const [target, pointId] = key.split("::");
      const { meterNo, seat } = parseMeterValue(target);
      return { toMeterNo: meterNo, toSeat: seat, pointId, chosen };
    });
    setBusy(true);
    setBusyKind("save");
    setStatus("正在合并结论…");
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const result = mergeWisdom({
        files,
        baseIndex,
        groups: usable,
        conflictPolicy: policy,
        preferFileIndex: policy === "preferFile" ? preferFileIndex : undefined,
        overrides: overrideList,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const unresolved = result.conflicts.filter((c) => {
        const key = conflictKey(c.toMeterNo, c.toSeat, c.pointId);
        return overrides[key] == null && c.suggested == null;
      });
      if (unresolved.length) {
        setError("请先处理冲突点");
        return;
      }
      setStatus("正在另存为新文件…");
      const saved = await bridge.saveMerged({
        data: result.data,
        defaultName: suggestedMergedFileName(files[baseIndex].name),
        sourcePaths: files.map((f) => f.path).filter(Boolean),
      });
      if (!saved) {
        setInfo("已取消保存，原文件未改动");
        return;
      }
      setInfo(`已写入新文件：${saved.name}`);
      onClose();
      bridge.openMerged?.(saved.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setBusyKind("");
      setStatus("");
    }
  };

  const baseMeters = files[baseIndex] ? listMeterRefs(files[baseIndex].data) : [];

  return (
    <div
      className={canDrop && dragOver ? "merge-overlay merge-overlay-drag" : "merge-overlay"}
      role="presentation"
      onDragEnter={
        canDrop
          ? (e) => {
              e.preventDefault();
              setDragOver(true);
            }
          : undefined
      }
      onDragOver={
        canDrop
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDragOver(true);
            }
          : undefined
      }
      onDragLeave={
        canDrop
          ? (e) => {
              if (e.currentTarget === e.target) setDragOver(false);
            }
          : undefined
      }
      onDrop={canDrop ? (e) => void onDropFiles(e) : undefined}
    >
      <div
        className="merge-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="merge-header">
          <div>
            <h2 id="merge-title" className="merge-title">
              合并 Wisdom 文件
            </h2>
            <p className="merge-lead">
              当前打开的文件是基准。再添加其它 .wisdom，把指定电表的结论贴到基准电表下面。未映射的电表保持不变，结果另存为新文件。
            </p>
          </div>
          <button type="button" className="btn" onClick={onClose} disabled={busyKind === "save"}>
            关闭
          </button>
        </div>

        <section className="merge-section">
          <div className="merge-section-head">
            <h3>1. 选择文件</h3>
            <button type="button" className="btn primary" onClick={() => void pickFiles()} disabled={busy}>
              {files.length > 1 ? "继续添加文件…" : "添加要合并的文件…"}
            </button>
          </div>
          {files.length < 2 && (
            <p className="merge-drop-hint">
              {canDrop
                ? "把要合并进来的 .wisdom 拖到这里，或点右上角添加文件"
                : "点右上角添加要合并进来的 .wisdom 文件"}
            </p>
          )}
          {files.length > 0 && (
            <ul className="merge-file-list">
              {files.map((file, i) => (
                <li key={`${file.path}-${i}`} className="merge-file-item">
                  <label className="merge-file-row">
                    <input
                      type="radio"
                      name="merge-base"
                      checked={i === baseIndex}
                      disabled={lockedBase}
                      onChange={() => changeBase(i)}
                    />
                    <span>
                      <strong>
                        {i === baseIndex ? (lockedBase ? "基准（当前打开）· " : "基准 · ") : ""}
                        {file.name}
                      </strong>
                      <span className="merge-file-path">{file.path}</span>
                    </span>
                  </label>
                  {i !== baseIndex && (
                    <button
                      type="button"
                      className="btn small merge-file-remove"
                      disabled={busy}
                      onClick={() => removeFile(i)}
                    >
                      移除
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {schemeWarnings.length > 0 && (
            <div className="warning-banner">
              {schemeWarnings.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
          )}
        </section>

        {files.length >= 2 && !schemeError && (
          <>
            <section className="merge-section">
              <div className="merge-section-head">
                <h3>2. 基准电表映射</h3>
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setGroups((prev) => [
                      ...prev,
                      { toMeterNo: "", sources: emptySources(files.length, baseIndex) },
                    ])
                  }
                >
                  添加映射
                </button>
              </div>
              <div className="merge-table-wrap">
                <table className="merge-table">
                  <thead>
                    <tr>
                      <th>基准电表</th>
                      {files.map((file, i) =>
                        i === baseIndex ? null : <th key={file.path}>来自 {file.name}</th>
                      )}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group, gi) => (
                      <FragmentRow
                        key={gi}
                        group={group}
                        gi={gi}
                        files={files}
                        baseIndex={baseIndex}
                        baseMeters={baseMeters}
                        expanded={expanded === gi}
                        onPickBaseMeter={onPickBaseMeter}
                        onPickSource={onPickSource}
                        onToggleItem={toggleItem}
                        onExpand={() => setExpanded(expanded === gi ? null : gi)}
                        onRemove={() => {
                          setGroups((prev) => prev.filter((_, i) => i !== gi));
                          setOverrides({});
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {groups.length === 0 && (
                <p className="merge-hint">没有默认同表号映射。点击「添加映射」手动指定。</p>
              )}
            </section>

            <section className="merge-section">
              <h3>3. 冲突策略</h3>
              <div className="merge-policy">
                <label>
                  <input
                    type="radio"
                    name="merge-policy"
                    checked={policy === "latest"}
                    onChange={() => setPolicy("latest")}
                  />
                  取最新一次（按结束时间）
                </label>
                <label>
                  <input
                    type="radio"
                    name="merge-policy"
                    checked={policy === "preferFile"}
                    onChange={() => setPolicy("preferFile")}
                  />
                  指定文件优先
                </label>
                {policy === "preferFile" && (
                  <select
                    value={preferFileIndex}
                    onChange={(e) => setPreferFileIndex(Number(e.target.value))}
                  >
                    {files.map((file, i) =>
                      i === baseIndex ? null : (
                        <option key={file.path} value={i}>
                          {file.name}
                        </option>
                      )
                    )}
                  </select>
                )}
              </div>
              {conflicts.length > 0 && (
                <div className="merge-table-wrap">
                  <p className="merge-hint">同一试验点在多份源里都有结论，可逐条改选（含保留基准原值）。</p>
                  <table className="merge-table">
                    <thead>
                      <tr>
                        <th>基准表</th>
                        <th>试验 / 点</th>
                        <th>采用</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conflicts.map((c) => {
                        const key = conflictKey(c.toMeterNo, c.toSeat, c.pointId);
                        const value = overrides[key] ?? c.suggested;
                        return (
                          <tr key={key}>
                            <td>
                              {c.toMeterNo}
                              <div className="merge-file-path">表位 {c.toSeat}</div>
                            </td>
                            <td>
                              {c.itemName || c.itemCode}
                              <div className="merge-file-path">{c.pointName || c.pointId}</div>
                            </td>
                            <td>
                              <select
                                value={String(value)}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  setOverrides((prev) => ({
                                    ...prev,
                                    [key]: raw === "base" ? "base" : Number(raw),
                                  }));
                                }}
                              >
                                {c.candidates.map((cand) => (
                                  <option
                                    key={`${cand.fileIndex}-${cand.fromMeterNo}`}
                                    value={String(cand.fileIndex)}
                                  >
                                    {cand.fileName} · {cand.fromMeterNo} · {cand.FinalResults || cand.Result || "空"} · {cand.EndTime || cand.StartTime || "无时间"}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {preview && !preview.ok && (
                <p className="merge-error">{preview.error}</p>
              )}
            </section>
          </>
        )}

        <div className="merge-footer">
          {status && (
            <div className="merge-status" role="status" aria-live="polite">
              <span className="merge-status-spinner" aria-hidden />
              <span className="merge-status-text">{status}</span>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          {info && <div className="merge-info">{info}</div>}
          {preview && preview.ok && preview.warnings.filter((w) => !schemeWarnings.includes(w)).length > 0 && (
            <div className="warning-banner">
              {preview.warnings
                .filter((w) => !schemeWarnings.includes(w))
                .map((w) => (
                  <div key={w}>{w}</div>
                ))}
            </div>
          )}
          <div className="merge-actions">
            <button type="button" className="btn" onClick={onClose} disabled={busyKind === "save"}>
              取消
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={busy || files.length < 2 || Boolean(schemeError)}
              onClick={() => void save()}
            >
              {busyKind === "save" ? status || "正在保存…" : "合并并另存为新文件"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FragmentRow(props: {
  group: MergeGroup;
  gi: number;
  files: MergeFilePayload[];
  baseIndex: number;
  baseMeters: ReturnType<typeof listMeterRefs>;
  expanded: boolean;
  onPickBaseMeter: (index: number, value: string) => void;
  onPickSource: (groupIndex: number, fileIndex: number, value: string) => void;
  onToggleItem: (groupIndex: number, itemCode: string, checked: boolean) => void;
  onExpand: () => void;
  onRemove: () => void;
}) {
  const {
    group,
    gi,
    files,
    baseIndex,
    baseMeters,
    expanded,
    onPickBaseMeter,
    onPickSource,
    onToggleItem,
    onExpand,
    onRemove,
  } = props;
  const options = listGroupItemOptions(files, group);
  const selected = new Set(
    (group.include ?? []).map((i) => i.itemCode).filter((c): c is string => Boolean(c) && c !== "__none__")
  );
  const noneOn = group.include?.some((i) => i.itemCode === "__none__");
  const allOn = !group.include || group.include.length === 0;
  const colSpan = files.length + 1;

  return (
    <>
      <tr>
        <td>
          <select
            value={group.toMeterNo ? meterValue(group.toMeterNo, group.toSeat ?? "") : ""}
            onChange={(e) => onPickBaseMeter(gi, e.target.value)}
          >
            <option value="">选择基准电表</option>
            {baseMeters.map((m) => (
              <option key={m.id} value={meterValue(m.meterNo, m.seat)}>
                {m.label}
              </option>
            ))}
          </select>
        </td>
        {files.map((file, i) => {
          if (i === baseIndex) return null;
          const src = group.sources.find((s) => s.fileIndex === i);
          const meters = listMeterRefs(file.data);
          return (
            <td key={file.path}>
              <select
                value={
                  src?.fromMeterNo ? meterValue(src.fromMeterNo, src.fromSeat ?? "") : ""
                }
                onChange={(e) => onPickSource(gi, i, e.target.value)}
              >
                <option value="">不拷贝</option>
                {meters.map((m) => (
                  <option key={m.id} value={meterValue(m.meterNo, m.seat)}>
                    {m.label}
                  </option>
                ))}
              </select>
            </td>
          );
        })}
        <td className="merge-row-actions">
          <button type="button" className="btn small" onClick={onExpand} disabled={!options.length}>
            {expanded ? "收起试验" : "筛选试验"}
          </button>
          <button type="button" className="btn small danger" onClick={onRemove}>
            删除
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="merge-expand-row">
          <td colSpan={colSpan}>
            {options.length === 0 ? (
              <p className="merge-hint">该映射下还没有可拷贝的结论。</p>
            ) : (
              <div className="merge-items">
                {options.map((opt) => {
                  const checked = !noneOn && (allOn || selected.has(opt.itemCode));
                  return (
                    <label key={opt.itemCode} className="merge-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onToggleItem(gi, opt.itemCode, e.target.checked)}
                      />
                      <span>
                        {opt.itemName}
                        <span className="merge-file-path">{opt.pointIds.length} 个试验点</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
