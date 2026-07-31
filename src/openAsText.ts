import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { decodeWisdom, encodeWisdom } from "./gzipJson";

/** tmp JSON path → source .wisdom URI */
const tmpToWisdom = new Map<string, vscode.Uri>();

async function resolveWisdomUri(uri?: vscode.Uri): Promise<vscode.Uri | undefined> {
  if (uri) return uri;

  const active = vscode.window.tabGroups.activeTabGroup.activeTab?.input as
    | { uri?: vscode.Uri }
    | undefined;
  if (active?.uri) return active.uri;

  const picked = await vscode.window.showOpenDialog({
    filters: { Wisdom: ["wisdom"] },
    canSelectMany: false,
  });
  return picked?.[0];
}

export async function openWisdomAsText(uri?: vscode.Uri): Promise<void> {
  const target = await resolveWisdomUri(uri);
  if (!target) return;

  const bytes = await vscode.workspace.fs.readFile(target);
  let data;
  try {
    data = decodeWisdom(Buffer.from(bytes));
  } catch (e) {
    void vscode.window.showErrorMessage(
      `无法解析 Wisdom：${e instanceof Error ? e.message : String(e)}`
    );
    return;
  }

  const tmp = path.join(
    os.tmpdir(),
    `${path.basename(target.fsPath, ".wisdom")}-${Date.now()}.json`
  );
  const tmpUri = vscode.Uri.file(tmp);
  await vscode.workspace.fs.writeFile(
    tmpUri,
    Buffer.from(JSON.stringify(data, null, 2), "utf8")
  );
  tmpToWisdom.set(tmp, target);

  const doc = await vscode.workspace.openTextDocument(tmpUri);
  await vscode.window.showTextDocument(doc, { preview: false });
  void vscode.window.showInformationMessage(
    "正在编辑临时 JSON。保存后请使用命令「Wisdom: 从 JSON 写回 .wisdom」写回。"
  );
}

export async function writeBackFromJson(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const wisdomUri = tmpToWisdom.get(editor.document.uri.fsPath);
  if (!wisdomUri) {
    void vscode.window.showErrorMessage("当前文件不是由 Wisdom 文本打开产生的临时 JSON");
    return;
  }

  try {
    const obj = JSON.parse(editor.document.getText());
    await vscode.workspace.fs.writeFile(wisdomUri, encodeWisdom(obj));
    void vscode.window.showInformationMessage(`已写回 ${wisdomUri.fsPath}`);
  } catch (e) {
    void vscode.window.showErrorMessage(String(e));
  }
}

export function registerWisdomTextCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("wisdom.openAsText", async (uri?: vscode.Uri) => {
      await openWisdomAsText(uri);
    }),
    vscode.commands.registerCommand("wisdom.writeBackFromJson", async () => {
      await writeBackFromJson();
    })
  );
}
