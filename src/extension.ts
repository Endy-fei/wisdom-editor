import * as vscode from "vscode";
import { WisdomEditorProvider } from "./wisdomEditorProvider";
import { openWisdomAsText } from "./openAsText";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(WisdomEditorProvider.register(context));
  context.subscriptions.push(
    vscode.commands.registerCommand("wisdom.openAsText", async (uri?: vscode.Uri) => {
      await openWisdomAsText(uri);
    })
  );
}

export function deactivate(): void {}
