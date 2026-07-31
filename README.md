# Wisdom Editor

VS Code 扩展：可视化编辑 `.wisdom`（gzip + JSON）申校文件。

## 开发

```bash
npm install
npm run build
```

在 VS Code 中按 **F5** 启动 Extension Development Host，打开 `samples/sample.wisdom` 进行测试。

> **说明：** 完整 `npm run build` 会同时构建 webview，在 Task 5 完成前可能失败。当前阶段只需 `npm run build:ext` 即可验证扩展宿主编译。
