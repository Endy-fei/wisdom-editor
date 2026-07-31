import * as vscode from "vscode";
import { registerWisdomTextCommands } from "./openAsText";
import { WisdomEditorProvider } from "./wisdomEditorProvider";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(WisdomEditorProvider.register(context));
  registerWisdomTextCommands(context);
}

export function deactivate(): void {}
