import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("wisdom.openAsText", async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      vscode.window.showInformationMessage(
        `Wisdom openAsText placeholder: ${target?.fsPath ?? "(none)"}`
      );
    })
  );
}

export function deactivate(): void {}
