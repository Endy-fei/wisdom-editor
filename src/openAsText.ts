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

/** Drop prior tmp mappings that point at the same .wisdom file. */
function pruneMappingsForWisdom(wisdomUri: vscode.Uri): void {
  const key = wisdomUri.toString();
  for (const [tmpPath, mapped] of tmpToWisdom) {
    if (mapped.toString() === key) {
      tmpToWisdom.delete(tmpPath);
    }
  }
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

  pruneMappingsForWisdom(target);

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

  const tmpPath = editor.document.uri.fsPath;
  const wisdomUri = tmpToWisdom.get(tmpPath);
  if (!wisdomUri) {
    void vscode.window.showErrorMessage("当前文件不是由 Wisdom 文本打开产生的临时 JSON");
    return;
  }

  try {
    const obj = JSON.parse(editor.document.getText());
    await vscode.workspace.fs.writeFile(wisdomUri, encodeWisdom(obj));
    tmpToWisdom.delete(tmpPath);
    void vscode.window.showInformationMessage(
      `已写回 ${wisdomUri.fsPath}。若可视化编辑器仍打开，请关闭后重新打开以加载最新内容。`
    );
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
