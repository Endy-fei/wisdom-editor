# Wisdom 可视化编辑器（VS Code 插件）设计规格

**日期：** 2026-07-31  
**状态：** 待用户审阅  
**范围：** 在 `myplugings` 中新建 VS Code/Cursor 扩展，可视化编辑 `.wisdom` 文件

---

## 1. 背景与目标

`.wisdom` 是 **gzip 压缩的 UTF-8 JSON**，内容为电能表申校/检定业务数据（电表信息、方案、测试项、结果明细等）。

插件目标：

1. 以现代 VS Code 风格的业务界面查看并完整编辑该文件；
2. 提供原始 JSON 高级编辑入口；
3. 保存后仍可被原有申校/检定软件正常打开（结构兼容）。

成功标准：

- 双击 `.wisdom` 即可用可视化编辑器打开；
- 可增删改全部业务分区中的记录与字段；
- Ctrl+S 写回 gzip JSON，原软件可再打开；
- 可用命令以文本/JSON 方式打开同一文件。

---

## 2. 决策摘要

| 项 | 选择 |
| --- | --- |
| 产品形态 | 业务 UI + 原始 JSON 高级编辑 |
| 编辑范围 | 全量业务分区可编辑 |
| 打开方式 | 默认 Custom Editor +「以文本打开」备用 |
| 编辑深度 | 字段可改，且支持增删整条记录 |
| 兼容性 | 必须兼容原软件（不破坏结构） |
| UI 风格 | 现代 VS Code/Cursor 插件风格 |
| 实现路线 | Custom Editor + React Webview |

---

## 3. 架构

### 3.1 组件

1. **Extension Host（`extension/`）**
   - 激活插件、注册 Custom Editor Provider
   - 注册命令：以文本方式打开 Wisdom
   - 与 Webview 的 `postMessage` 桥接
   - 文件读写、保存、脏状态对接 VS Code

2. **Core（`core/`）**
   - gzip 解压/压缩（Node `zlib`）
   - JSON 解析/序列化
   - 文档模型（单一内存对象）
   - 未知字段透传、关联清理、基础结构兜底

3. **Webview（`webview/`）**
   - React + Vite 打包
   - 顶栏 Tab 业务界面 + 原始 JSON 编辑页
   - 将用户编辑通过消息回传 Extension Host

### 3.2 数据流

```
打开 .wisdom
  → Custom Editor Provider
  → gzip 解压 → JSON.parse → Document Model
  → 推送到 Webview 渲染

编辑（业务 Tab 或 JSON Tab）
  → 更新 Document Model → 标记 dirty

保存（Ctrl+S / 保存命令）
  → JSON.stringify → gzip → 写回原 URI
  → 清除 dirty
```

### 3.3 项目脚手架（建议）

```
myplugings/
  package.json              # 扩展清单与贡献点
  tsconfig.json
  src/
    extension.ts
    wisdomEditorProvider.ts
    wisdomDocument.ts
    gzipJson.ts
  webview/
    package.json
    vite.config.ts
    src/
      App.tsx
      tabs/...
  docs/superpowers/specs/...
  media/                    # 图标等（可选）
```

具体目录名可在实现计划中微调，但职责边界保持不变。

---

## 4. 界面设计

### 4.1 导航

采用 **顶栏水平 Tab**（非左侧导航）。

Tab 列表（顺序固定）：

1. 电表信息  
2. 检定方案  
3. 测试项目  
4. 结果明细  
5. 证书/人员  
6. 原始 JSON  

顶栏展示文件名与 dirty 状态（如「已修改」）。

### 4.2 各 Tab 行为

**电表信息**

- 左侧：`MeterInfoList` 列表（显示表位、表号等摘要）
- 右侧：选中电表的字段表单（中文标签），并包含该表在 `MeterOtherInfoMap` 中的附加字段（如条码、铅封等）
- 支持新增/删除电表
- 新增电表时同时创建对应 `MeterOtherInfoMap` 条目（同一 Meter `ID`）
- 删除时同步清理 `MeterOtherInfoMap`、`CertificateCode` 中对应关联（按 Meter ID / 表号）

**检定方案**

- 上部：`Scheme` 头字段表单
- 下部：`SchemeGroupList` 表格，支持增删行、单元格编辑

**测试项目**

- `TestItemList` 表格，支持增删改

**结果明细**

- `ResultDetailList` 表格
- 支持按表号/项目关键字筛选
- 支持增删改行

**证书/人员**

- `CertificateCode` 键值映射编辑
- `Inspector`、`Verifier` 文本字段
- 展示/视需要编辑 `LastNum`、`ID`（`ID` 默认只读，避免无故破坏文档身份；若用户明确需要可在 JSON Tab 改）

**原始 JSON**

- 嵌入式代码编辑器（Monaco 或 CodeMirror）
- 语法高亮；非法 JSON 时显示错误，不覆盖文档模型
- 合法应用后刷新全部业务 Tab

### 4.3 视觉

- 跟随 VS Code 主题变量（`--vscode-*`），避免独立花哨皮肤
- 表格与表单偏简洁，留白适中
- 中文 UI 文案

---

## 5. 数据模型与兼容契约

### 5.1 格式

- 磁盘：gzip(UTF-8 JSON)
- 解压后为单个 JSON object

### 5.2 已知顶层字段（以样例为准）

- `MeterInfoList`：array  
- `CertificateCode`：object（表号 → 证书号）  
- `LastNum`：number  
- `Scheme`：object  
- `SchemeGroupList`：array  
- `ResultDetailList`：array  
- `TestItemList`：array  
- `MeterOtherInfoMap`：object（MeterID → 附加信息）  
- `Inspector`：string  
- `Verifier`：string  
- `ID`：string  

### 5.3 兼容规则（硬约束）

1. **不新增、不删除、不重命名**顶层键（相对打开时的结构：打开时已有的键必须写回；插件不主动引入私有顶层键）。
2. **未知字段透传**：任意层级在打开时存在、编辑未触及的字段，保存时必须保留。
3. **增删记录**时，新行字段集合对齐同类型已有记录的常见字段；缺省值为 `""` / `0` / `false` / 新 UUID；不发明原软件不认识的键名。
4. **不做**插件私有元数据写入、不做与原软件联机通信、第一版不做批量多文件编辑。

### 5.4 同步策略

- 内存中仅一份 Document Model。
- 业务编辑直接改模型。
- JSON Tab：在「应用」或失焦且内容合法时 parse → 替换模型 → 刷新 UI；非法则报错并保留旧模型。

### 5.5 序列化

- 实现时固定一种 stringify 风格（推荐 2 空格缩进，便于文本模式 diff；若验收发现原软件对空白敏感则改为紧凑）。
- 使用标准 gzip；不额外包裹自定义头。

---

## 6. 扩展贡献点与命令

- `customEditors`：`*.wisdom` → Wisdom 可视化编辑器（默认）
- 命令：`wisdom.openAsText`（名称可调整）—— 解压为临时 JSON 或使用只读/可写文本编辑器打开内容（实现计划中选定一种：临时文件 vs 自定义文本文档）
- 语言/图标（可选）：为 `.wisdom` 提供文件图标

「以文本打开」必须可用，即使默认已是 Custom Editor。

---

## 7. 错误处理

| 场景 | 行为 |
| --- | --- |
| 非 gzip / 解压失败 | 错误提示；不进入半残编辑会话；可引导用其他方式打开 |
| JSON 非法（打开时） | 打开失败，尽量指出错误信息 |
| 结构不完整（缺数组等） | 仍可打开；缺失部分用空结构兜底；状态提示「结构不完整」 |
| JSON Tab 内容非法 | 错误提示；不应用到模型；业务 Tab 仍可用 |
| 保存失败 | VS Code 错误通知；保持 dirty |

---

## 8. 测试计划

**单元测试（core）：**

- gzip ↔ JSON round-trip
- 未知字段保留
- 删除电表时关联清理（`MeterOtherInfoMap` / `CertificateCode`）

**手工验收：**

- 使用样例 `申校_20260731090059.wisdom`
- 打开 → 修改字段 → 增删行 → 保存
- 用原申校软件再打开验证

**第一版不做：**

- 完整 Webview E2E 自动化
- 原软件自动化对接

---

## 9. 非目标（YAGNI）

- 检定流程自动化、设备通信
- 证书 PDF 生成
- 多文件批量编辑
- 云同步/账号体系
- 完整复刻原桌面软件的每一个对话框细节

---

## 10. 开放实现细节（计划阶段确定即可）

以下不影响本规格的产品决策，留给实现计划选型：

1. JSON 编辑器组件：Monaco vs CodeMirror  
2. 「以文本打开」：临时 `.json` 文件 vs `TextDocumentContentProvider`  
3. Webview 与 Host 的消息协议字段命名  
4. 新记录默认字段模板的精确字段列表（从样例推导）

---

## 11. 验收清单

- [x] 双击 `.wisdom` 打开可视化编辑器  
- [x] 六个 Tab 均可查看与编辑  
- [x] 电表/方案点/测试项/结果行可增删  
- [x] 原始 JSON 可编辑且与业务视图同步  
- [x] 保存为可被原软件打开的 `.wisdom`  
- [x] 「以文本打开」可用  
- [x] 脏状态与关闭未保存提示正常  
