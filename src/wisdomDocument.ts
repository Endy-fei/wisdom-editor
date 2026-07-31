import * as vscode from "vscode";
import { ensureWisdomShape, type WisdomRoot } from "@wisdom/core";
import { decodeWisdom, encodeWisdom } from "./gzipJson";

export class WisdomDocument implements vscode.CustomDocument {
  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  readonly onDidDispose = this._onDidDispose.event;

  private readonly _onDidChange = new vscode.EventEmitter<{
    readonly label: string;
  }>();
  readonly onDidChangeContent = this._onDidChange.event;

  private _data: WisdomRoot;
  private _dirty = false;
  private readonly _warnings: string[];

  private constructor(
    readonly uri: vscode.Uri,
    data: WisdomRoot,
    warnings: string[] = []
  ) {
    this._data = data;
    this._warnings = warnings;
  }

  static async create(
    uri: vscode.Uri,
    backupUri?: vscode.Uri
  ): Promise<WisdomDocument> {
    const readUri = backupUri ?? uri;
    try {
      const bytes = await vscode.workspace.fs.readFile(readUri);
      const decoded = decodeWisdom(Buffer.from(bytes));
      const warnings: string[] = [];
      if (!Array.isArray(decoded.MeterInfoList)) {
        warnings.push("结构不完整，已用空值兜底（MeterInfoList 非数组）");
      }
      return new WisdomDocument(uri, ensureWisdomShape(decoded), warnings);
    } catch (e) {
      throw new Error(
        `无法打开 Wisdom 文件（需为 gzip+JSON）：${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  get data(): WisdomRoot {
    return this._data;
  }

  get warnings(): readonly string[] {
    return this._warnings;
  }

  get isDirty(): boolean {
    return this._dirty;
  }

  replaceData(
    data: WisdomRoot,
    label = "Edit",
    markDirty = true
  ): void {
    this._data = data;
    this._dirty = markDirty;
    if (markDirty) {
      this._onDidChange.fire({ label });
    }
  }

  async save(): Promise<void> {
    const encoded = encodeWisdom(this._data);
    await vscode.workspace.fs.writeFile(this.uri, encoded);
    this._dirty = false;
  }

  async saveAs(target: vscode.Uri): Promise<void> {
    const encoded = encodeWisdom(this._data);
    await vscode.workspace.fs.writeFile(target, encoded);
    this._dirty = false;
  }

  dispose(): void {
    this._onDidDispose.fire();
    this._onDidDispose.dispose();
    this._onDidChange.dispose();
  }
}
