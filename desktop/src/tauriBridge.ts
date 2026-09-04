import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  ensureWisdomShape,
  type WisdomRoot,
} from "@wisdom/core";
import type { HostBridge, HostMessage, RecentItem } from "@wisdom/editor-ui";
import { buildTemplates } from "./templates";

export type OpenResult = {
  path: string;
  fileName: string;
  data: Record<string, unknown>;
  warnings: string[];
};

export type StartupState = {
  recent: RecentItem[];
  openPath?: string;
};

export class TauriHost {
  private listeners = new Set<(msg: HostMessage) => void>();
  private currentData: WisdomRoot | null = null;
  private currentPath: string | null = null;
  private dirty = false;
  private started = false;
  private pathListeners = new Set<() => void>();

  get path(): string | null {
    return this.currentPath;
  }

  get isDirty(): boolean {
    return this.dirty;
  }

  get hasDocument(): boolean {
    return this.currentData !== null;
  }

  onPathChange(listener: () => void): () => void {
    this.pathListeners.add(listener);
    return () => this.pathListeners.delete(listener);
  }

  private notifyPath() {
    for (const l of this.pathListeners) l();
  }

  private emit(msg: HostMessage) {
    for (const handler of this.listeners) handler(msg);
  }

  createBridge(): HostBridge {
    return {
      ready: () => {
        void this.onReady();
      },
      commit: (data) => {
        this.currentData = data;
        const becameDirty = !this.dirty;
        this.dirty = true;
        // Avoid re-rendering the whole window on every keystroke.
        if (becameDirty) this.notifyPath();
      },
      subscribe: (handler) => {
        this.listeners.add(handler);
        return () => this.listeners.delete(handler);
      },
      openFile: () => {
        void this.openFile();
      },
      openRecent: (path) => {
        void this.openPath(path);
      },
      removeRecent: (path) => {
        void this.removeRecent(path);
      },
      restoreRecent: (path) => {
        void this.restoreRecent(path);
      },
    };
  }

  private async confirmDiscard(): Promise<boolean> {
    if (!this.dirty) return true;
    return ask("有未保存的修改，确定要放弃吗？", {
      title: "Wisdom 编辑器",
      kind: "warning",
    });
  }

  private applyOpen(result: OpenResult) {
    const data = ensureWisdomShape(result.data);
    this.currentData = data;
    this.currentPath = result.path;
    this.dirty = false;
    this.notifyPath();
    this.emit({
      type: "init",
      data,
      fileName: result.fileName,
      templates: buildTemplates(),
      warnings: result.warnings ?? [],
      filePath: result.path,
    });
  }

  private async onReady() {
    if (this.started) return;
    this.started = true;
    try {
      const state = await invoke<StartupState>("get_startup_state");
      if (state.openPath) {
        await this.openPath(state.openPath, true);
      } else {
        this.emit({ type: "welcome", recent: state.recent ?? [] });
      }
    } catch (e) {
      this.emit({
        type: "warning",
        text: `启动失败：${e instanceof Error ? e.message : String(e)}`,
      });
      this.emit({ type: "welcome", recent: [] });
    }
  }

  async openFile() {
    if (!(await this.confirmDiscard())) return;
    try {
      const result = await invoke<OpenResult | null>("open_wisdom_dialog");
      if (result) this.applyOpen(result);
    } catch (e) {
      this.emit({
        type: "warning",
        text: `打开失败：${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  async openPath(path: string, skipConfirm = false) {
    if (!skipConfirm && !(await this.confirmDiscard())) return;
    try {
      const result = await invoke<OpenResult>("open_wisdom_path", { path });
      this.applyOpen(result);
    } catch (e) {
      const recent = await invoke<RecentItem[]>("list_recent").catch(() => []);
      const missing = recent.some((item) => item.path === path && item.exists === false);
      if (missing) {
        this.emit({ type: "welcome", recent, missingPath: path });
        return;
      }
      this.emit({
        type: "warning",
        text: `打开失败：${e instanceof Error ? e.message : String(e)}`,
      });
      if (skipConfirm) {
        this.emit({ type: "welcome", recent });
      }
    }
  }

  async removeRecent(path: string) {
    try {
      const recent = await invoke<RecentItem[]>("remove_recent", { path });
      this.emit({ type: "welcome", recent });
    } catch (e) {
      this.emit({
        type: "warning",
        text: `移除失败：${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  async restoreRecent(oldPath: string) {
    if (!(await this.confirmDiscard())) return;
    try {
      const result = await invoke<OpenResult>("open_wisdom_path", { path: oldPath });
      this.applyOpen(result);
      return;
    } catch {
      // File is still missing; ask the user to locate it.
    }
    try {
      const result = await invoke<OpenResult | null>("open_wisdom_dialog");
      if (!result) return;
      if (result.path !== oldPath) {
        await invoke("remove_recent", { path: oldPath }).catch(() => undefined);
      }
      this.applyOpen(result);
    } catch (e) {
      this.emit({
        type: "warning",
        text: `恢复失败：${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  async save() {
    if (!this.currentData) return;
    try {
      if (this.currentPath) {
        await invoke("save_wisdom", {
          path: this.currentPath,
          data: this.currentData,
        });
        this.dirty = false;
        this.notifyPath();
        this.emit({ type: "saved" });
      } else {
        await this.saveAs();
      }
    } catch (e) {
      this.emit({
        type: "warning",
        text: `保存失败：${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  async saveAs() {
    if (!this.currentData) return;
    try {
      const path = await invoke<string | null>("save_wisdom_as", {
        data: this.currentData,
      });
      if (!path) return;
      this.currentPath = path;
      this.dirty = false;
      this.notifyPath();
      this.emit({ type: "saved" });
      const fileName = path.split(/[/\\]/).pop() ?? "file.wisdom";
      this.emit({
        type: "init",
        data: this.currentData,
        fileName,
        templates: buildTemplates(),
        warnings: [],
        filePath: path,
      });
    } catch (e) {
      this.emit({
        type: "warning",
        text: `另存为失败：${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }
}
