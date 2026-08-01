# Wisdom Editor

在 VS Code / Cursor 中可视化编辑 `.wisdom`（gzip + JSON）申校文件。

## 功能

- 六个业务页签：电表信息、检定方案、测试项目、结果明细、证书/人员、原始 JSON
- 列表增删改；未知字段原样保留，保存后仍可被原申校软件打开
- 支持以纯文本（JSON）方式查看与写回

## 使用

1. 安装本扩展后，在资源管理器中双击 `.wisdom` 文件即可打开可视化编辑器
2. 编辑完成后按正常方式保存（`Ctrl+S` / `Cmd+S`）

### 命令

| 命令 | 说明 |
| --- | --- |
| `Wisdom: 以文本方式打开` | 将 `.wisdom` 解压为临时 JSON，用文本编辑器打开 |
| `Wisdom: 从 JSON 写回 .wisdom` | 把临时 JSON 重新 gzip 写回对应的 `.wisdom` |

也可在资源管理器或编辑器标题栏右键 `.wisdom`，选择「以文本方式打开」。

## 兼容说明

- 需要 VS Code / Cursor `1.85.0` 及以上
- 文件格式：gzip 压缩的 UTF-8 JSON，根节点为对象
- 保存时使用 2 空格缩进序列化后再 gzip
- 不写入扩展私有元数据，未知字段透传

## 已知限制

若同一 `.wisdom` 已在可视化编辑器中打开，通过「从 JSON 写回」更新磁盘后，已打开的可视化标签页不会自动刷新。请关闭后重新打开。

## 更多

- 问题反馈：[GitHub Issues](https://github.com/Endy-fei/wisdom-editor/issues)
- 源码与 Windows 桌面版：[GitHub 仓库](https://github.com/Endy-fei/wisdom-editor)
