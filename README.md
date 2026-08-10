# Wisdom Editor

可视化编辑 `.wisdom`（gzip + JSON）申校文件。本仓库是**源码与开发说明**；扩展市场展示文案见 [`marketplace/README.md`](marketplace/README.md)。

| 形态 | 说明 |
| --- | --- |
| **VS Code / Cursor 插件** | 双击打开 `.wisdom`；发布到 Open VSX 与 VS Marketplace |
| **Windows 桌面软件** | Tauri 2 独立应用；最近文件、拖拽打开、系统文件关联 |

共享包：`packages/wisdom-core`（数据模型）、`packages/editor-ui`（业务界面）。

## 仓库结构

```text
marketplace/README.md # 插件市场展示说明（打进 VSIX）
packages/             # 共享核心与编辑 UI
webview/              # 插件 webview 构建
desktop/              # Tauri 桌面端
.github/workflows/    # 发版 CI
samples/              # 样例 .wisdom
```

## 环境要求

- Node.js 18+
- 插件调试：VS Code / Cursor `^1.85.0`
- 桌面开发/打包：**Rust（cargo）**、Windows **WebView2**（Win10/11 一般已自带）

```bash
npm install
```

---

## 一、VS Code / Cursor 插件

### 开发调试

```bash
npm run build
```

按 **F5**（或配置 `Run Extension`）：

1. 新开「扩展开发主机」窗口，扩展只在该窗口生效
2. 会打开 `samples`，可双击 `sample.wisdom` 测试

### 打包

```bash
npm run package
```

会使用 `marketplace/README.md` 作为市场说明（`--readme-path`），在仓库根目录生成 `wisdom-editor-<version>.vsix`。

### 本地安装

```bash
cursor --install-extension wisdom-editor-1.0.2.vsix
# 或
code --install-extension wisdom-editor-1.0.2.vsix
```

安装后执行 **Developer: Reload Window**。

### 发布

打 `v*` 标签或手动运行 **Release** workflow 后，CI 会自动发布到：

- **Open VSX / Cursor**（Secret `OVSX_PAT`）
- **VS Marketplace**（Secret `VSCE_PAT`）

本地手动发布：

```bash
npx ovsx publish wisdom-editor-<version>.vsix -p <OVSX_PAT>
npx @vscode/vsce publish --packagePath wisdom-editor-<version>.vsix -p <VSCE_PAT>
```

管理页：https://marketplace.visualstudio.com/manage/publishers/endy-fei

---

## 二、Windows 桌面软件（Tauri）

```bash
npm run desktop:dev      # 开发
npm run desktop:build    # 打包 NSIS
```

产物一般在：

```text
desktop/src-tauri/target/release/bundle/nsis/Wisdom Editor_<version>_x64-setup.exe
```

安装包会注册 `.wisdom` 文件关联。发版推荐走第三节 CI。

> 首次打包请确认 [Rust](https://rustup.rs/)、WebView2、VS Build Tools（C++）等，见 [Tauri 环境说明](https://v2.tauri.app/start/prerequisites/)。

---

## 三、GitHub Actions 自动发版

打 `v*` 标签或手动运行 **Release** workflow 后：

1. 同步各包版本号（`npm run version:set`）
2. 测试、打包 VSIX，发布到 **Open VSX** 与 **VS Marketplace**
3. 构建 Windows 安装包
4. 上传到 GitHub **Releases**

| Secret | 用途 |
| --- | --- |
| `OVSX_PAT` | [Open VSX Access Token](https://open-vsx.org/user-settings/tokens) |
| `VSCE_PAT` | [Azure DevOps PAT](https://dev.azure.com/)（`Marketplace (Manage)` + `All accessible organizations`）。须用**创建 Marketplace 发布者**的同一 Microsoft 帐户签发；在 Entra「默认目录」下建的组织签发通常会 Access Denied |

```bash
npm run version:set -- 1.0.2
git add -A
git commit -m "release: v1.0.2"
git tag v1.0.2
git push origin main --tags
```

产物：`wisdom-editor-<version>.vsix`、`Wisdom Editor_<version>_x64-setup.exe`。

---

## 插件命令（开发备忘）

| 命令 | 说明 |
| --- | --- |
| `Wisdom: 以文本方式打开` | 解压为临时 JSON 并用文本编辑器打开 |
| `Wisdom: 从 JSON 写回 .wisdom` | 将临时 JSON gzip 写回 |

## 兼容与限制

- 格式：gzip + UTF-8 JSON；保存 2 空格缩进；未知字段透传
- 文本写回后，已打开的可视化标签页不会自动刷新
- 桌面与插件并行编辑同一文件不会实时同步，请避免同时保存
