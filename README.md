# Wisdom Editor

可视化编辑 `.wisdom`（gzip + JSON）申校文件，提供两种形态：

| 形态 | 说明 |
| --- | --- |
| **VS Code / Cursor 插件** | 在编辑器内双击打开 `.wisdom` |
| **Windows 桌面软件** | Tauri 2 独立应用，支持最近文件、拖拽打开、系统文件关联 |

两者共享 `packages/wisdom-core`（数据模型）与 `packages/editor-ui`（业务界面）。

## 功能

- 六个业务 Tab：电表信息、检定方案、测试项目、结果明细、证书/人员、原始 JSON
- 列表增删改、未知字段透传、保存后仍可被原申校软件打开
- 插件额外支持「以文本方式打开」与「从 JSON 写回」
- 桌面额外支持最近文件、拖拽打开、安装后关联 `.wisdom`

## 环境要求

- Node.js 18+
- VS Code / Cursor `^1.85.0`（仅插件）
- 桌面开发/打包另需：**Rust（cargo）**、Windows **WebView2**（Win10/11 一般已自带）

```bash
npm install
```

---

## 一、VS Code / Cursor 插件

### 1. 开发调试

```bash
npm run build
```

按 **F5**（或运行配置 `Run Extension`）：

1. 会**新开**「扩展开发主机」窗口，扩展**只在该窗口生效**
2. 新窗口会打开 `samples` 文件夹，可双击 `sample.wisdom` 测试
3. 当前开发用的项目窗口**不会**自动加载未安装的扩展

### 2. 打包（生成 `.vsix`）

```bash
npm run build
npx @vscode/vsce package --no-dependencies --allow-missing-repository
```

成功后在仓库根目录得到：

```text
wisdom-editor-1.0.0.vsix
```

版本号来自根目录 `package.json` 的 `version` 字段。发新版前请先改版本号再打包。

> `--no-dependencies`：依赖已由 esbuild / Vite 打进产物，无需再打包 `node_modules`。

也可用脚本（需本机已装 `@vscode/vsce`，且可能需补上同样的参数）：

```bash
npm run package
```

### 3. 本地安装（发布给同事 / 自己用）

**Cursor：**

```bash
cursor --install-extension wisdom-editor-1.0.0.vsix
```

**VS Code：**

```bash
code --install-extension wisdom-editor-1.0.0.vsix
```

安装后执行 **Developer: Reload Window**，再双击 `.wisdom`。

也可在扩展视图选择「从 VSIX 安装…」并选中该文件。

### 4. 发布到扩展市场（可选）

当前 `publisher` 为 `local`，仅适合本地/内部分发。若要上架：

1. 在 [Azure DevOps](https://dev.azure.com/) 创建 Publisher，并在 [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage) 注册发布者
2. 修改根目录 `package.json`：
   - `publisher`：改为你的发布者 ID
   - `version`：语义化版本
   - 建议补充 `repository`、`license` 等字段
3. 获取 Personal Access Token（Marketplace 发布权限）
4. 登录并发布：

```bash
npx @vscode/vsce login <你的publisher>
npx @vscode/vsce publish --no-dependencies
```

也可只打包后，在 Marketplace 网页手动上传 `.vsix`。

**Open VSX**（部分 Cursor / 开源市场）：

```bash
npx ovsx publish wisdom-editor-1.0.0.vsix -p <OpenVSX_Token>
```

---

## 二、Windows 桌面软件（Tauri）

### 1. 开发运行

```bash
npm run desktop:dev
```

会启动 Vite 前端 + Tauri 窗口，可打开 `samples/sample.wisdom` 验证。

### 2. 打包（生成安装包）

```bash
npm run desktop:build
```

等价于在 `desktop` 工作区执行 `tauri build`，产物一般为 **NSIS 安装程序**（见 `desktop/src-tauri/tauri.conf.json` 中 `bundle.targets`）。

常见输出路径：

```text
desktop/src-tauri/target/release/bundle/nsis/
```

其中会有类似：

```text
Wisdom Editor_1.0.0_x64-setup.exe
```

版本号由 `desktop/src-tauri/tauri.conf.json` 的 `version`（及必要时 `desktop/package.json`）控制，发版前请同步修改。

安装包默认会注册 **`.wisdom` 文件关联**（安装后可用本应用打开该类文件）。

未做完整安装、只想拿可执行文件时，也可在：

```text
desktop/src-tauri/target/release/Wisdom Editor.exe
```

（具体文件名以实际产物为准。）

### 3. 发布 / 分发

桌面端当前面向 **Windows 本机或内部分发**，没有强制应用商店流程。推荐：

1. 执行 `npm run desktop:build`
2. 将 `nsis` 目录下的 `*-setup.exe` 发给用户，或放到内网网盘 / GitHub Releases
3. 用户双击安装；如需文件关联，按安装向导完成安装即可
4. 发新版时：提高版本号 → 重新打包 → 上传新安装包（覆盖或并列发布均可）

**GitHub Releases 示例流程：**

```bash
# 1. 改版本号（tauri.conf.json / package.json）
# 2. 打包
npm run desktop:build

# 3. 用 gh 创建 Release 并上传安装包（需已登录 gh）
gh release create v1.0.0 "desktop/src-tauri/target/release/bundle/nsis/*.exe" --title "v1.0.0" --notes "Wisdom Editor Windows 安装包"
```

> 首次在本机打包若失败，请确认已安装 [Rust](https://rustup.rs/)、WebView2，以及 Tauri Windows 构建依赖（Visual Studio Build Tools / C++ 工作负载等）。详见 [Tauri 环境说明](https://v2.tauri.app/start/prerequisites/)。

---

## 命令（仅插件）

| 命令 | 说明 |
| --- | --- |
| `Wisdom: 以文本方式打开` | 将 `.wisdom` 解压为临时 JSON 并用文本编辑器打开 |
| `Wisdom: 从 JSON 写回 .wisdom` | 把临时 JSON 重新 gzip 写回对应的 `.wisdom` |

也可在资源管理器或编辑器标题栏右键 `.wisdom` 使用「以文本方式打开」。

## 兼容说明

- 文件格式：gzip 压缩的 UTF-8 JSON，根节点为对象
- 保存时使用 2 空格缩进序列化后再 gzip
- 未知字段透传，不写入扩展/应用私有元数据
- 插件需要 VS Code / Cursor `^1.85.0` 及以上

## 已知限制

**文本写回 vs 已打开的可视化编辑器：**  
若同一 `.wisdom` 已在可视化编辑器中打开，通过「从 JSON 写回」更新磁盘后，已打开的可视化标签页不会自动刷新。请关闭后重新打开。

**桌面与插件并行编辑同一文件：**  
两边不会实时同步；请避免同时保存覆盖。
