import * as vscode from "vscode";
import { decodeWisdom, encodeWisdom } from "./gzipJson";
import { ensureWisdomShape } from "./wisdomModel";
import type { WisdomRoot } from "./types";

export class WisdomDocument implements vscode.CustomDocument {
  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  readonly onDidDispose = this._onDidDispose.event;

  private readonly _onDidChange = new vscode.EventEmitter<{
    readonly label: string;
  }>();
  readonly onDidChangeContent = this._onDidChange.event;

  private _data: WisdomRoot;
  private _dirty = false;

  private constructor(
    readonly uri: vscode.Uri,
    data: WisdomRoot
  ) {
    this._data = data;
  }

  static async create(uri: vscode.Uri): Promise<WisdomDocument> {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const decoded = decodeWisdom(Buffer.from(bytes));
    return new WisdomDocument(uri, ensureWisdomShape(decoded));
  }

  get data(): WisdomRoot {
    return this._data;
  }

  get isDirty(): boolean {
    return this._dirty;
  }

  replaceData(data: WisdomRoot, label = "Edit"): void {
    this._data = data;
    this._dirty = true;
    this._onDidChange.fire({ label });
  }

  async save(): Promise<void> {
    const encoded = encodeWisdom(this._data);
    await vscode.workspace.fs.writeFile(this.uri, encoded);
    this._dirty = false;
  }

  async saveAs(target: vscode.Uri): Promise<void> {
    const encoded = encodeWisdom(this._data);
    await vscode.workspace.fs.writeFile(target, encoded);
  }

  dispose(): void {
    this._onDidDispose.fire();
    this._onDidDispose.dispose();
    this._onDidChange.dispose();
  }
}
