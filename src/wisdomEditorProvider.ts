import * as vscode from "vscode";
import {
  createEmptyMeter,
  ensureWisdomShape,
  emptyResultDetail,
  emptySchemeGroup,
  emptyTestItem,
  type WisdomRoot,
  type WisdomTemplates,
} from "@wisdom/core";
import { WisdomDocument } from "./wisdomDocument";
import { buildWisdomWebviewHtml } from "./webviewHtml";
import { handleMergeWebviewMessage } from "./mergeIo";
import type { HostToWebview, MergeFilePayload, WebviewToHost } from "./messages";

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
  private readonly documents = new Map<string, WisdomDocument>();
  /** development: force webview asset cache bust on reload */
  private webviewCacheBust = Date.now();

  constructor(private readonly context: vscode.ExtensionContext) {}

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new WisdomEditorProvider(context);
    const disposables: vscode.Disposable[] = [
      vscode.window.registerCustomEditorProvider("wisdom.editor", provider, {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }),
      vscode.commands.registerCommand("wisdom.mergeFiles", () => provider.startMerge()),
    ];

    if (context.extensionMode === vscode.ExtensionMode.Development) {
      disposables.push(provider.watchWebviewAssets());
    }

    return vscode.Disposable.from(...disposables);
  }

  /** Watch dist/webview and hot-reload open panels while debugging. */
  private watchWebviewAssets(): vscode.Disposable {
    const pattern = new vscode.RelativePattern(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview"),
      "**/*"
    );
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        this.webviewCacheBust = Date.now();
        for (const panel of this.panels.values()) {
          panel.webview.html = this.getReactHtml(panel.webview);
        }
      }, 200);
    };

    watcher.onDidChange(scheduleReload);
    watcher.onDidCreate(scheduleReload);
    watcher.onDidDelete(scheduleReload);

    return vscode.Disposable.from(watcher, {
      dispose: () => {
        if (timer) clearTimeout(timer);
      },
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
    this.documents.set(docKey, document);

    const updateWebviewHtml = () => {
      webviewPanel.webview.html = this.getReactHtml(webviewPanel.webview);
    };
    updateWebviewHtml();

    const changeSub = document.onDidChangeContent(() => {
      this._onDidChangeCustomDocument.fire({ document });
    });

    webviewPanel.webview.onDidReceiveMessage(async (raw: WebviewToHost) => {
      if (raw.type === "ready") {
        const msg: HostToWebview = {
          type: "init",
          data: document.data,
          fileName: document.uri.path.split("/").pop() ?? "file.wisdom",
          templates: buildTemplates(),
          warnings: [...document.warnings],
          filePath: document.uri.fsPath,
        };
        void webviewPanel.webview.postMessage(msg);
        return;
      }
      if (raw.type === "edit") {
        document.replaceData(ensureWisdomShape(raw.data as WisdomRoot));
        return;
      }
      await handleMergeWebviewMessage(webviewPanel.webview, raw);
    });

    webviewPanel.onDidDispose(() => {
      changeSub.dispose();
      if (this.panels.get(docKey) === webviewPanel) {
        this.panels.delete(docKey);
      }
      if (this.documents.get(docKey) === document) {
        this.documents.delete(docKey);
      }
    });
  }

  startMerge(): void {
    const key = this.activeDocumentKey();
    const panel = key ? this.panels.get(key) : undefined;
    const document = key ? this.documents.get(key) : undefined;
    if (!panel || !document) {
      void vscode.window.showInformationMessage(
        "请先打开一份作为基准的 .wisdom 文件，再进行合并。"
      );
      return;
    }
    const files: MergeFilePayload[] = [
      {
        path: document.uri.fsPath,
        name: document.uri.path.split("/").pop() ?? "file.wisdom",
        data: document.data,
      },
    ];
    const msg: HostToWebview = { type: "openMerge", files };
    void panel.webview.postMessage(msg);
  }

  private activeDocumentKey(): string | undefined {
    const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
    const input = tab?.input;
    if (input instanceof vscode.TabInputCustom && input.viewType === "wisdom.editor") {
      return input.uri.toString();
    }
    return this.panels.keys().next().value;
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
    const panel = this.panels.get(document.uri.toString());
    if (panel) {
      const msg: HostToWebview = { type: "saved" };
      void panel.webview.postMessage(msg);
    }
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
        filePath: document.uri.fsPath,
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
    return buildWisdomWebviewHtml(
      webview,
      this.context.extensionUri,
      this.context.extensionMode === vscode.ExtensionMode.Development
        ? this.webviewCacheBust
        : undefined
    );
  }
}
