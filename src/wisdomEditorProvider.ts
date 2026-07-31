import * as vscode from "vscode";
import { WisdomDocument } from "./wisdomDocument";
import type { HostToWebview, WebviewToHost } from "./messages";
import { ensureWisdomShape } from "./wisdomModel";
import type { WisdomRoot } from "./types";

export class WisdomEditorProvider implements vscode.CustomEditorProvider<WisdomDocument> {
  private readonly _onDidChangeCustomDocument =
    new vscode.EventEmitter<vscode.CustomDocumentEditEvent<WisdomDocument>>();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new WisdomEditorProvider(context);
    return vscode.window.registerCustomEditorProvider("wisdom.editor", provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    });
  }

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<WisdomDocument> {
    return WisdomDocument.create(uri);
  }

  async resolveCustomEditor(
    document: WisdomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview"),
      ],
    };

    const updateWebviewHtml = () => {
      // Task 5 完成后改为加载 dist/webview/index.html
      webviewPanel.webview.html = this.getPlaceholderHtml(document);
    };
    updateWebviewHtml();

    const changeSub = document.onDidChangeContent(() => {
      this._onDidChangeCustomDocument.fire({
        document,
        undo: () => undefined,
        redo: () => undefined,
      });
    });

    webviewPanel.webview.onDidReceiveMessage((raw: WebviewToHost) => {
      if (raw.type === "ready") {
        const msg: HostToWebview = {
          type: "init",
          data: document.data,
          fileName: document.uri.path.split("/").pop() ?? "file.wisdom",
        };
        void webviewPanel.webview.postMessage(msg);
        return;
      }
      if (raw.type === "edit") {
        document.replaceData(ensureWisdomShape(raw.data as WisdomRoot));
      }
    });

    webviewPanel.onDidDispose(() => changeSub.dispose());
  }

  async saveCustomDocument(
    document: WisdomDocument,
    _cancellation: vscode.CancellationToken
  ): Promise<void> {
    await document.save();
  }

  async saveCustomDocumentAs(
    document: WisdomDocument,
    destination: vscode.Uri,
    _cancellation: vscode.CancellationToken
  ): Promise<void> {
    await document.saveAs(destination);
  }

  async revertCustomDocument(
    document: WisdomDocument,
    _cancellation: vscode.CancellationToken
  ): Promise<void> {
    const fresh = await WisdomDocument.create(document.uri);
    document.replaceData(fresh.data, "Revert");
    // dirty 应在 save 后清除；revert 场景在后续可增强
  }

  async backupCustomDocument(
    document: WisdomDocument,
    context: vscode.CustomDocumentBackupContext,
    _cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    await document.saveAs(context.destination);
    return {
      id: context.destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(context.destination);
        } catch {
          /* ignore */
        }
      },
    };
  }

  private getPlaceholderHtml(document: WisdomDocument): string {
    const name = document.uri.fsPath;
    return `<!DOCTYPE html><html><body style="background:#1e1e1e;color:#ccc;font-family:sans-serif;padding:16px">
      <h2>Wisdom Editor</h2>
      <p>${name}</p>
      <p>电表数量: ${document.data.MeterInfoList.length}</p>
      <p>React Webview 将在下一任务接入</p>
    </body></html>`;
  }
}
