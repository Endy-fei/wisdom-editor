# Wisdom Editor

在 VS Code / Cursor 中可视化编辑 `.wisdom`（gzip + JSON）申校文件：双击即可打开，保存后仍可被原申校软件读取。

## 功能

- **六个业务页签**：电表信息、检定方案、测试项目、结果明细、证书/人员、原始 JSON
- **安全编辑**：列表增删改；未知字段原样保留，不写入扩展私有元数据
- **文本互通**：支持解压为 JSON 查看，再 gzip 写回 `.wisdom`

## 快速开始

1. 安装扩展后，在资源管理器中双击 `.wisdom` 文件
2. 在可视化页签中编辑，按 `Ctrl+S` / `Cmd+S` 保存

也可在资源管理器或编辑器标题栏右键 `.wisdom`，选择「以文本方式打开」。

### 命令面板

| 命令 | 说明 |
| --- | --- |
| `Wisdom: 以文本方式打开` | 将 `.wisdom` 解压为临时 JSON，用文本编辑器打开 |
| `Wisdom: 从 JSON 写回 .wisdom` | 把临时 JSON 重新 gzip 写回对应的 `.wisdom` |

## 兼容说明

- 需要 VS Code / Cursor `1.85.0` 及以上
- 文件格式：gzip 压缩的 UTF-8 JSON，根节点为对象
- 保存时使用 2 空格缩进序列化后再 gzip
- 未知字段透传，便于与原申校软件互通

## 已知限制

若同一 `.wisdom` 已在可视化编辑器中打开，通过「从 JSON 写回」更新磁盘后，已打开的可视化标签页不会自动刷新。请关闭后重新打开。

## 反馈与源码

- 问题反馈：[GitHub Issues](https://github.com/Endy-fei/wisdom-editor/issues)
- 源码与 Windows 桌面版：[GitHub 仓库](https://github.com/Endy-fei/wisdom-editor)
