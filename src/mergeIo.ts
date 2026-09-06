import * as nodePath from "path";
import * as vscode from "vscode";
import { assertNewMergePath, ensureWisdomShape, type WisdomRoot } from "@wisdom/core";
import { decodeWisdom, encodeWisdom } from "./gzipJson";
import type { HostToWebview, MergeFilePayload, WebviewToHost } from "./messages";

export async function readMergeFile(uri: vscode.Uri): Promise<MergeFilePayload> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  const decoded = decodeWisdom(Buffer.from(bytes));
  return {
    path: uri.fsPath,
    name: uri.path.split("/").pop() ?? "file.wisdom",
    data: ensureWisdomShape(decoded),
  };
}

function uniqueWisdomUris(uris: vscode.Uri[]): vscode.Uri[] {
  const unique: vscode.Uri[] = [];
  const seen = new Set<string>();
  for (const uri of uris) {
    if (!uri.fsPath.toLowerCase().endsWith(".wisdom")) continue;
    const key = uri.fsPath.replace(/\\/g, "/").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(uri);
  }
  return unique;
}

function postMergeProgress(
  webview: vscode.Webview,
  text: string,
  current?: number,
  total?: number
): void {
  const msg: HostToWebview = { type: "mergeProgress", text, current, total };
  void webview.postMessage(msg);
}

async function readAndStreamFiles(
  webview: vscode.Webview,
  uris: vscode.Uri[]
): Promise<{ files: MergeFilePayload[]; errors: string[] }> {
  const files: MergeFilePayload[] = [];
  const errors: string[] = [];
  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];
    const name = uri.path.split("/").pop() ?? uri.fsPath;
    postMergeProgress(webview, `正在读取（${i + 1}/${uris.length}）${name}`, i, uris.length);
    try {
      const file = await readMergeFile(uri);
      files.push(file);
      const added: HostToWebview = { type: "mergeFilesAdded", files: [file] };
      void webview.postMessage(added);
    } catch (e) {
      errors.push(`「${name}」读取失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { files, errors };
}

function parseDroppedPath(raw: string): vscode.Uri | undefined {
  const text = raw.trim();
  if (!text || text.startsWith("#")) return undefined;
  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(text)) {
      return vscode.Uri.parse(text);
    }
  } catch {
    /* fall through */
  }
  return vscode.Uri.file(text);
}

export async function loadMergePaths(paths: string[]): Promise<MergeFilePayload[] | null> {
  const uris = paths
    .map(parseDroppedPath)
    .filter((uri): uri is vscode.Uri => Boolean(uri));
  const unique = uniqueWisdomUris(uris);
  if (unique.length === 0) return null;
  return Promise.all(unique.map(readMergeFile));
}

export async function pickMergeFiles(): Promise<MergeFilePayload[] | null> {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: true,
    canSelectFiles: true,
    canSelectFolders: false,
    filters: { Wisdom: ["wisdom"] },
    title: "选择要合并进来的 Wisdom 文件",
  });
  if (!uris) return null;
  return loadMergePaths(uris.map((u) => u.fsPath));
}

export async function saveMergedFile(
  data: WisdomRoot,
  defaultName: string,
  sourcePaths: string[]
): Promise<{ path: string; name: string } | null> {
  const folder = sourcePaths[0] ? nodePath.dirname(sourcePaths[0]) : undefined;
  const uri = await vscode.window.showSaveDialog({
    filters: { Wisdom: ["wisdom"] },
    defaultUri: folder
      ? vscode.Uri.joinPath(vscode.Uri.file(folder), defaultName)
      : vscode.Uri.file(defaultName),
    saveLabel: "另存为新文件",
    title: "合并结果另存为（不会覆盖原文件）",
  });
  if (!uri) return null;
  const path = uri.fsPath;
  assertNewMergePath(path, sourcePaths);
  await vscode.workspace.fs.writeFile(uri, encodeWisdom(data));
  return { path, name: uri.path.split("/").pop() ?? defaultName };
}

export async function handleMergeWebviewMessage(
  webview: vscode.Webview,
  raw: WebviewToHost
): Promise<boolean> {
  if (raw.type === "pickWisdomFiles") {
    try {
      postMergeProgress(webview, "请选择要合并进来的 .wisdom 文件…");
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        canSelectFiles: true,
        canSelectFolders: false,
        filters: { Wisdom: ["wisdom"] },
        title: "选择要合并进来的 Wisdom 文件",
      });
      if (!uris) {
        const msg: HostToWebview = {
          type: "mergeFilesPicked",
          requestId: raw.requestId,
          files: null,
        };
        void webview.postMessage(msg);
        return true;
      }
      const unique = uniqueWisdomUris(uris);
      if (unique.length === 0) {
        const msg: HostToWebview = {
          type: "mergeFilesPicked",
          requestId: raw.requestId,
          files: null,
          error: "没有选中有效的 .wisdom 文件",
        };
        void webview.postMessage(msg);
        return true;
      }
      postMergeProgress(webview, `已选择 ${unique.length} 个文件，开始读取…`, 0, unique.length);
      const { files, errors } = await readAndStreamFiles(webview, unique);
      postMergeProgress(
        webview,
        files.length ? "读取完成，正在更新列表…" : "没有成功读取任何文件"
      );
      const msg: HostToWebview = {
        type: "mergeFilesPicked",
        requestId: raw.requestId,
        files: [],
        error: errors.length
          ? `${errors.join("；")}${files.length ? `（已加入 ${files.length} 个）` : ""}`
          : undefined,
      };
      void webview.postMessage(msg);
    } catch (e) {
      const msg: HostToWebview = {
        type: "mergeFilesPicked",
        requestId: raw.requestId,
        files: null,
        error: e instanceof Error ? e.message : String(e),
      };
      void webview.postMessage(msg);
    }
    return true;
  }
  if (raw.type === "saveMerged") {
    try {
      postMergeProgress(webview, "正在打开另存为对话框…");
      const result = await saveMergedFile(raw.data, raw.defaultName, raw.sourcePaths);
      if (result) postMergeProgress(webview, `已写入 ${result.name}`);
      const msg: HostToWebview = {
        type: "mergeSaved",
        requestId: raw.requestId,
        result,
      };
      void webview.postMessage(msg);
    } catch (e) {
      const msg: HostToWebview = {
        type: "mergeSaved",
        requestId: raw.requestId,
        result: null,
        error: e instanceof Error ? e.message : String(e),
      };
      void webview.postMessage(msg);
    }
    return true;
  }
  if (raw.type === "openMerged") {
    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(raw.path));
    return true;
  }
  if (raw.type === "closeMerge") {
    return true;
  }
  return false;
}
