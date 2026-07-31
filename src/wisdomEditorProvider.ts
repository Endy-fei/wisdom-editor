import * as vscode from "vscode";
import { WisdomDocument } from "./wisdomDocument";
import type { HostToWebview, WebviewToHost, WisdomTemplates } from "./messages";
import { createEmptyMeter, ensureWisdomShape } from "./wisdomModel";
import {
  emptyResultDetail,
  emptySchemeGroup,
  emptyTestItem,
} from "./defaults";
import type { WisdomRoot } from "./types";

function buildTemplates(): WisdomTemplates {
  const { meter, other } = createEmptyMeter(0);
  return {
    meter,
    other,
    schemeGroup: emptySchemeGroup(),
    testItem: emptyTestItem(),
    result: emptyResultDetail(),
  };
}

export class WisdomEditorProvider implements vscode.CustomEditorProvider<WisdomDocument> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    | vscode.CustomDocumentEditEvent<WisdomDocument>
    | vscode.CustomDocumentContentChangeEvent<WisdomDocument>
  >();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  /** document URI → active webview panel */
  private readonly panels = new Map<string, vscode.WebviewPanel>();

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
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<WisdomDocument> {
    const backupUri = openContext.backupId
      ? vscode.Uri.parse(openContext.backupId)
      : undefined;
    return WisdomDocument.create(uri, backupUri);
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

    const docKey = document.uri.toString();
    this.panels.set(docKey, webviewPanel);

    const updateWebviewHtml = () => {
      webviewPanel.webview.html = this.getReactHtml(webviewPanel.webview);
    };
    updateWebviewHtml();

    const changeSub = document.onDidChangeContent(() => {
      this._onDidChangeCustomDocument.fire({ document });
    });

    webviewPanel.webview.onDidReceiveMessage((raw: WebviewToHost) => {
      if (raw.type === "ready") {
        const msg: HostToWebview = {
          type: "init",
          data: document.data,
          fileName: document.uri.path.split("/").pop() ?? "file.wisdom",
          templates: buildTemplates(),
          warnings: [...document.warnings],
        };
        void webviewPanel.webview.postMessage(msg);
        return;
      }
      if (raw.type === "edit") {
        document.replaceData(ensureWisdomShape(raw.data as WisdomRoot));
      }
    });

    webviewPanel.onDidDispose(() => {
      changeSub.dispose();
      if (this.panels.get(docKey) === webviewPanel) {
        this.panels.delete(docKey);
      }
    });
  }

  async saveCustomDocument(
    document: WisdomDocument,
    _cancellation: vscode.CancellationToken
  ): Promise<void> {
    await document.save();
    const panel = this.panels.get(document.uri.toString());
    if (panel) {
      const msg: HostToWebview = { type: "saved" };
      void panel.webview.postMessage(msg);
    }
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
    document.replaceData(fresh.data, "Revert", false);
    const panel = this.panels.get(document.uri.toString());
    if (panel) {
      const msg: HostToWebview = {
        type: "init",
        data: document.data,
        fileName: document.uri.path.split("/").pop() ?? "file.wisdom",
        templates: buildTemplates(),
        warnings: [...fresh.warnings],
      };
      void panel.webview.postMessage(msg);
    }
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

  private getReactHtml(webview: vscode.Webview): string {
    const base = vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview");
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(base, "assets", "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(base, "assets", "index.css")
    );
    const csp = `default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';`;
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <link rel="stylesheet" href="${styleUri}" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
