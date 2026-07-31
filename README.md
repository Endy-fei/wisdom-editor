# Wisdom Editor

VS Code / Cursor 扩展：以可视化方式编辑 `.wisdom`（gzip + JSON）申校文件，并与原申校软件保持兼容读写。

## 功能

- 双击 `.wisdom` 默认打开可视化 Custom Editor
- 六个业务 Tab：电表信息、检定方案、测试项目、结果明细、证书/人员、原始 JSON
- 列表增删改、未知字段透传、保存后仍可被原软件打开
- 「以文本方式打开」：解压为临时 JSON，编辑后可写回 `.wisdom`
- 打开失败时给出友好错误提示；结构不完整时顶栏显示警告

## 安装与开发

```bash
npm install
npm run build
```

### 用 F5 调试（重要）

1. 在本仓库按 **F5**（或运行配置 `Run Extension`）
2. 会**新开一个**「扩展开发主机」窗口；扩展**只在这个新窗口里生效**
3. 在新窗口中打开 `samples/sample.wisdom`（F5 会默认打开 `samples` 文件夹）
4. **当前这个开发项目窗口不会加载未安装的扩展**——在项目窗口里双击 `.wisdom` 仍会提示二进制/无法预览，这是正常现象

若希望在日常 Cursor / VS Code 窗口里也能打开 `.wisdom`，需要先打包并安装扩展（见下）。

### 打包并安装到当前编辑器

```bash
npm run build
npx @vscode/vsce package --no-dependencies
cursor --install-extension wisdom-editor-0.1.0.vsix
```

VS Code 则把上面最后一行换成：`code --install-extension wisdom-editor-0.1.0.vsix`  
安装后**重载窗口**，再在项目中双击 `.wisdom`。

## 命令

| 命令 | 说明 |
| --- | --- |
| `Wisdom: 以文本方式打开` | 将当前/选中的 `.wisdom` 解压为临时 JSON 并用文本编辑器打开 |
| `Wisdom: 从 JSON 写回 .wisdom` | 把临时 JSON 重新 gzip 写回对应的 `.wisdom` |

也可在资源管理器或编辑器标题栏右键 `.wisdom` 使用「以文本方式打开」。

## 兼容说明

- 文件格式：gzip 压缩的 UTF-8 JSON，根节点为对象
- 保存时使用 2 空格缩进序列化后再 gzip，便于文本模式 diff
- 未知字段在编辑过程中透传，不写入扩展私有元数据
- 需要 VS Code / Cursor `^1.85.0` 及以上

## 已知限制

**文本写回 vs 已打开的可视化编辑器：**  
若同一 `.wisdom` 已在可视化编辑器中打开，通过「从 JSON 写回」更新磁盘文件后，已打开的可视化编辑器**不会自动刷新**内存模型。请关闭该可视化标签页后重新打开，以免看到过期内容。
