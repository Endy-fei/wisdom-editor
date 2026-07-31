# Wisdom 桌面端（Tauri 2）设计规格

**日期：** 2026-07-31  
**状态：** 已确认  
**范围：** 同仓库增加 Windows 独立桌面应用，与 VS Code 插件共享编辑 UI 与业务模型

---

## 1. 目标

在保留 VS Code/Cursor 插件的同时，提供可单独安装的 Windows 桌面软件：

- 同等编辑能力（六个 Tab、CRUD、原始 JSON、gzip 兼容）
- 额外：最近文件、拖拽打开、系统关联 `.wisdom`
- 代码共享，避免两套业务 UI

## 2. 架构

```
packages/wisdom-core   → 类型、defaults、wisdomModel（纯逻辑）
packages/editor-ui     → React 编辑器 + HostBridge
src/ + webview/        → VS Code 扩展（HostBridge = postMessage）
desktop/               → Tauri 2（HostBridge = invoke/事件）
```

**gzip：**

- 插件：扩展主机 Node `zlib`（现有）
- 桌面：Rust `flate2`（读/写命令内完成）
- 前端只处理 JSON 对象，不直接碰压缩

## 3. HostBridge

```ts
export type HostBridge = {
  ready(): void;
  commit(data: WisdomRoot): void;
  subscribe(handler: (msg: HostMessage) => void): () => void;
};

export type HostMessage =
  | { type: "init"; data: WisdomRoot; fileName: string; templates: WisdomTemplates; warnings?: string[]; filePath?: string }
  | { type: "saved" }
  | { type: "warning"; text: string }
  | { type: "welcome"; recent: RecentItem[] };
```

## 4. 桌面专有

- 欢迎页：打开、最近列表、拖拽提示
- 菜单：打开 / 保存 / 另存为 / 退出
- 拖拽 `.wisdom` 打开（dirty 时确认）
- 启动参数 / 文件关联传入路径则直接打开
- 最近文件最多 10 条（本地 store）
- 打包目标：Windows（msi/nsis）

## 5. 非目标（第一版）

- macOS / Linux 打包
- 自动更新
- 与原申校软件联机
