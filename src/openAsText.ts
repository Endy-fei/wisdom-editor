import * as vscode from "vscode";

export async function openWisdomAsText(uri?: vscode.Uri): Promise<void> {
  const target =
    uri ??
    vscode.window.activeTextEditor?.document.uri ??
    (await vscode.window.showOpenDialog({
      filters: { Wisdom: ["wisdom"] },
      canSelectMany: false,
    }))?.[0];
  if (!target) return;
  vscode.window.showInformationMessage(`将在 Task 7 实现: ${target.fsPath}`);
}
