import * as vscode from "vscode";

export function buildWisdomWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  cacheBust?: number
): string {
  const base = vscode.Uri.joinPath(extensionUri, "dist", "webview");
  const bust = cacheBust ? `t=${cacheBust}` : "";
  const scriptUri = webview
    .asWebviewUri(vscode.Uri.joinPath(base, "assets", "index.js"))
    .with({ query: bust });
  const styleUri = webview
    .asWebviewUri(vscode.Uri.joinPath(base, "assets", "index.css"))
    .with({ query: bust });
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `script-src ${webview.cspSource}`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource} data:`,
  ].join("; ");
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
