# Wisdom VS Code 可视化编辑器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `myplugings` 中实现 VS Code/Cursor 扩展，以 Custom Editor + React Webview 可视化编辑 gzip+JSON 的 `.wisdom` 申校文件，并保持与原软件兼容。

**Architecture:** Extension Host 负责 gzip 编解码、文档模型、Custom Editor 与保存；Webview（React+Vite）负责顶栏 Tab 业务 UI 与 CodeMirror JSON 编辑；双方通过 `postMessage` 同步单一文档模型。默认用可视化编辑器打开 `.wisdom`，另提供「以文本打开」命令写出临时 JSON。

**Tech Stack:** TypeScript、VS Code Extension API（Custom Editor）、Node `zlib`、Vitest、React 18、Vite、CodeMirror 6

**Spec:** `docs/superpowers/specs/2026-07-31-wisdom-vscode-editor-design.md`

---

## 文件结构（锁定职责）

| 路径 | 职责 |
| --- | --- |
| `package.json` | 扩展清单、贡献点、脚本 |
| `tsconfig.json` / `tsconfig.extension.json` | 扩展侧编译 |
| `esbuild.js` | 打包 `src/extension.ts` → `dist/extension.js` |
| `src/extension.ts` | `activate`/`deactivate`，注册 Provider 与命令 |
| `src/gzipJson.ts` | gzip ↔ JSON 编解码 |
| `src/types.ts` | Wisdom 顶层与列表项类型 |
| `src/defaults.ts` | 新增记录的默认字段模板 |
| `src/wisdomDocument.ts` | `CustomDocument`：读/写/脏状态/关联清理 |
| `src/wisdomEditorProvider.ts` | Custom Editor + Webview 生命周期与消息桥 |
| `src/openAsText.ts` | 「以文本打开」：解压到临时 `.json` |
| `src/messages.ts` | Host ↔ Webview 消息类型 |
| `src/test/gzipJson.test.ts` | gzip round-trip 测试 |
| `src/test/wisdomDocument.test.ts` | 文档模型/透传/关联清理测试 |
| `webview/package.json` | Webview 依赖 |
| `webview/vite.config.ts` | 产出到 `dist/webview/` |
| `webview/index.html` | Webview 入口 HTML |
| `webview/src/main.tsx` | React 挂载 |
| `webview/src/App.tsx` | Tab 壳 + 状态 |
| `webview/src/vscodeApi.ts` | `acquireVsCodeApi` 封装 |
| `webview/src/components/MeterTab.tsx` | 电表列表+表单 |
| `webview/src/components/SchemeTab.tsx` | 方案头+分组表 |
| `webview/src/components/TestItemTab.tsx` | 测试项表 |
| `webview/src/components/ResultTab.tsx` | 结果表明细+筛选 |
| `webview/src/components/MetaTab.tsx` | 证书/人员 |
| `webview/src/components/JsonTab.tsx` | CodeMirror JSON |
| `webview/src/components/DataTable.tsx` | 通用可编辑表格 |
| `webview/src/styles.css` | 使用 `--vscode-*` 变量 |
| `samples/sample.wisdom` | 从桌面样例复制供测试 |
| `README.md` | 安装与使用说明 |
| `.vscodeignore` | 打包排除 |
| `.gitignore` | 忽略 `node_modules`/`dist`/`.superpowers` |

实现选型（规格开放项已定）：

1. JSON 编辑器：**CodeMirror 6**
2. 以文本打开：**临时 `.json` 文件** + `vscode.window.showTextDocument`
3. 序列化：**`JSON.stringify(data, null, 2)`** + gzip

---

### Task 1: 扩展脚手架与样例文件

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.js`
- Create: `.gitignore`
- Create: `.vscodeignore`
- Create: `src/extension.ts`
- Create: `samples/sample.wisdom`（复制样例）
- Create: `README.md`

- [ ] **Step 1: 写入 `package.json`**

```json
{
  "name": "wisdom-editor",
  "displayName": "Wisdom Editor",
  "description": "可视化编辑 .wisdom（gzip+JSON）申校文件",
  "version": "0.1.0",
  "publisher": "local",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": ["onCustomEditor:wisdom.editor"],
  "main": "./dist/extension.js",
  "contributes": {
    "customEditors": [
      {
        "viewType": "wisdom.editor",
        "displayName": "Wisdom 可视化编辑器",
        "selector": [{ "filenamePattern": "*.wisdom" }],
        "priority": "default"
      }
    ],
    "commands": [
      {
        "command": "wisdom.openAsText",
        "title": "Wisdom: 以文本方式打开"
      }
    ],
    "menus": {
      "explorer/context": [
        {
          "command": "wisdom.openAsText",
          "when": "resourceExtname == .wisdom",
          "group": "navigation"
        }
      ],
      "editor/title": [
        {
          "command": "wisdom.openAsText",
          "when": "resourceExtname == .wisdom",
          "group": "navigation"
        }
      ]
    }
  },
  "scripts": {
    "build:ext": "node esbuild.js",
    "build:webview": "npm run build --prefix webview",
    "build": "npm run build:webview && npm run build:ext",
    "watch:ext": "node esbuild.js --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "package": "npm run build && vsce package"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/vscode": "^1.85.0",
    "esbuild": "^0.20.0",
    "typescript": "^5.3.0",
    "vitest": "^1.2.0"
  }
}
```

- [ ] **Step 2: 写入 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: 写入 `esbuild.js`**

```js
const esbuild = require("esbuild");

const watch = process.argv.includes("--watch");

const ctx = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  platform: "node",
  format: "cjs",
  sourcemap: true,
  target: "node18",
};

if (watch) {
  esbuild.context(ctx).then((c) => c.watch());
} else {
  esbuild.build(ctx).catch(() => process.exit(1));
}
```

- [ ] **Step 4: 写入 `.gitignore` 与 `.vscodeignore`**

`.gitignore`:
```
node_modules/
dist/
webview/node_modules/
webview/dist/
.superpowers/
*.vsix
.vscode-test/
```

`.vscodeignore`:
```
.vscode/**
.superpowers/**
src/**
webview/src/**
webview/node_modules/**
webview/vite.config.ts
**/*.ts
**/tsconfig*.json
**/*.map
docs/**
samples/**
node_modules/**
!node_modules/（不需要，esbuild 已打包）
esbuild.js
vitest.config.ts
```

- [ ] **Step 5: 占位 `src/extension.ts`**

```ts
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("wisdom.openAsText", async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      vscode.window.showInformationMessage(
        `Wisdom openAsText placeholder: ${target?.fsPath ?? "(none)"}`
      );
    })
  );
}

export function deactivate(): void {}
```

- [ ] **Step 6: 复制样例并写 README**

```powershell
New-Item -ItemType Directory -Force -Path samples | Out-Null
Copy-Item "C:\Users\75176\Desktop\申校_20260731090059.wisdom" "samples\sample.wisdom"
```

`README.md` 写清：`npm install` → `npm run build` → F5 启动 Extension Development Host → 打开 `samples/sample.wisdom`。

- [ ] **Step 7: 安装依赖并验证编译**

```powershell
cd C:\Users\75176\Desktop\myplugings
npm install
npx tsc --noEmit
node esbuild.js
```

Expected: `dist/extension.js` 生成，无错误。

- [ ] **Step 8: Commit（若用户要求提交时再执行）**

```bash
git add package.json tsconfig.json esbuild.js .gitignore .vscodeignore src/extension.ts samples/sample.wisdom README.md
git commit -m "chore: scaffold wisdom-editor VS Code extension"
```

---

### Task 2: gzipJson 编解码（TDD）

**Files:**
- Create: `vitest.config.ts`
- Create: `src/gzipJson.ts`
- Create: `src/test/gzipJson.test.ts`

- [ ] **Step 1: 写入 `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 2: 写失败测试**

```ts
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { decodeWisdom, encodeWisdom } from "../gzipJson";

const samplePath = join(__dirname, "../../samples/sample.wisdom");

describe("gzipJson", () => {
  it("decodes sample.wisdom to object with MeterInfoList", () => {
    const buf = readFileSync(samplePath);
    const data = decodeWisdom(buf);
    expect(Array.isArray(data.MeterInfoList)).toBe(true);
    expect(data.ID).toBeTruthy();
  });

  it("round-trips preserving unknown top-level keys and nested values", () => {
    const original = {
      MeterInfoList: [],
      CustomUnknown: { nested: 1 },
      ID: "abc",
    };
    const encoded = encodeWisdom(original);
    const decoded = decodeWisdom(encoded);
    expect(decoded).toEqual(original);
  });

  it("throws on invalid gzip", () => {
    expect(() => decodeWisdom(Buffer.from("not-gzip"))).toThrow();
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

```powershell
npx vitest run src/test/gzipJson.test.ts
```

Expected: FAIL（模块不存在）

- [ ] **Step 4: 实现 `src/gzipJson.ts`**

```ts
import { gunzipSync, gzipSync } from "zlib";

export type WisdomData = Record<string, unknown>;

export function decodeWisdom(buffer: Buffer): WisdomData {
  const json = gunzipSync(buffer).toString("utf8");
  const data = JSON.parse(json) as unknown;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Wisdom JSON root must be an object");
  }
  return data as WisdomData;
}

export function encodeWisdom(data: WisdomData): Buffer {
  const json = JSON.stringify(data, null, 2);
  return gzipSync(Buffer.from(json, "utf8"));
}
```

- [ ] **Step 5: 运行测试确认通过**

```powershell
npx vitest run src/test/gzipJson.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit（用户要求时）**

```bash
git add vitest.config.ts src/gzipJson.ts src/test/gzipJson.test.ts
git commit -m "feat: add gzip+json encode/decode for .wisdom"
```

---

### Task 3: 类型、默认模板与文档模型（TDD）

**Files:**
- Create: `src/types.ts`
- Create: `src/defaults.ts`
- Create: `src/wisdomModel.ts`
- Create: `src/test/wisdomModel.test.ts`

说明：纯逻辑放在 `wisdomModel.ts`（不依赖 `vscode`），便于 Vitest；`wisdomDocument.ts` 在下一任务包装 VS Code API。

- [ ] **Step 1: 写失败测试 `src/test/wisdomModel.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  ensureWisdomShape,
  createEmptyMeter,
  removeMeter,
  applyJsonText,
} from "../wisdomModel";

describe("wisdomModel", () => {
  it("ensureWisdomShape fills missing arrays/objects without dropping unknowns", () => {
    const input = { ID: "x", Extra: 1 };
    const data = ensureWisdomShape(input);
    expect(Array.isArray(data.MeterInfoList)).toBe(true);
    expect(data.Extra).toBe(1);
    expect(data.ID).toBe("x");
  });

  it("createEmptyMeter returns MeterInfo + OtherInfo with same ID", () => {
    const { meter, other } = createEmptyMeter(3);
    expect(meter.ID).toBe(other.ID);
    expect(meter.MeterSeat).toBe("3");
    expect(other.MeterSeat).toBe(3);
  });

  it("removeMeter cleans MeterOtherInfoMap and CertificateCode", () => {
    const data = ensureWisdomShape({
      MeterInfoList: [
        { ID: "m1", MeterNo: "n1", MeterSeat: "1" },
        { ID: "m2", MeterNo: "n2", MeterSeat: "2" },
      ],
      MeterOtherInfoMap: {
        m1: { ID: "m1", BarCode: "a" },
        m2: { ID: "m2", BarCode: "b" },
      },
      CertificateCode: { n1: "c1", n2: "c2" },
    });
    removeMeter(data, "m1");
    expect(data.MeterInfoList).toHaveLength(1);
    expect((data.MeterOtherInfoMap as Record<string, unknown>).m1).toBeUndefined();
    expect((data.CertificateCode as Record<string, unknown>).n1).toBeUndefined();
    expect((data.CertificateCode as Record<string, unknown>).n2).toBe("c2");
  });

  it("applyJsonText rejects invalid JSON and keeps previous", () => {
    const prev = ensureWisdomShape({ ID: "keep" });
    const result = applyJsonText(prev, "{bad");
    expect(result.ok).toBe(false);
    expect(prev.ID).toBe("keep");
  });

  it("applyJsonText replaces model on valid JSON", () => {
    const prev = ensureWisdomShape({ ID: "old" });
    const result = applyJsonText(prev, JSON.stringify({ ID: "new", MeterInfoList: [] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ID).toBe("new");
    }
  });
});
```

- [ ] **Step 2: 运行确认失败**

```powershell
npx vitest run src/test/wisdomModel.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现类型与默认值**

`src/types.ts`：

```ts
export type JsonObject = Record<string, unknown>;

export interface MeterInfo extends JsonObject {
  ID: string;
  MeterNo: string;
  MeterSeat: string;
  MeterAddr?: string;
  Name?: string;
  isCheck?: boolean;
}

export interface MeterOtherInfo extends JsonObject {
  ID: string;
  BarCode: string;
  LeadSealFirst: string;
  LeadSealSecond: string;
  MeterSeat: number;
}

export interface WisdomRoot extends JsonObject {
  MeterInfoList: MeterInfo[];
  CertificateCode: Record<string, string>;
  LastNum: number;
  Scheme: JsonObject;
  SchemeGroupList: JsonObject[];
  ResultDetailList: JsonObject[];
  TestItemList: JsonObject[];
  MeterOtherInfoMap: Record<string, MeterOtherInfo>;
  Inspector: string;
  Verifier: string;
  ID: string;
}
```

`src/defaults.ts`（字段集合对齐样例；值为空默认）：

```ts
import { randomUUID } from "crypto";
import type { MeterInfo, MeterOtherInfo, JsonObject } from "./types";

export function newId(): string {
  return randomUUID().replace(/-/g, "");
}

export function emptyMeter(seat: number): MeterInfo {
  const id = newId();
  return {
    isCheck: true,
    MeterSeat: String(seat),
    Name: "",
    MeterNo: "",
    MeterTS: "",
    Factory: "",
    FactoryAddr: "",
    FactoryTel: "",
    MeterAssetCoding: "",
    MeterAddr: "",
    MeterBatch: "",
    MeterLevel: "",
    Un: "220",
    Imax: "",
    Imin: "",
    Ist: "",
    Itr: "",
    Freq: "50",
    ActivePulseConstant: "",
    ReactivePulseConstant: "",
    ActivePowerAccuracyClass: 0,
    ReactivePowerAccuracyClass: 0,
    EnergyDecimalDigits: 2,
    CT: "1",
    PT: "1",
    Phase: 0,
    MeterProtocol: 1,
    MeterSort: 1,
    MeterType: 0,
    Type: 1,
    ReactiveIb: "0",
    IP: "",
    User: "",
    InspectionUnit: "",
    InspectionUnitAddr: "",
    InspectionUnitTel: "",
    ProductionDate: "",
    RegistrationTime: "",
    TemperatureMax: "NaN",
    TemperatureMin: "NaN",
    ID: id,
  };
}

export function emptyOtherInfo(meterId: string, seat: number): MeterOtherInfo {
  return {
    ID: meterId,
    BarCode: "",
    LeadSealFirst: "",
    LeadSealSecond: "",
    MeterSeat: seat,
  };
}

export function emptySchemeGroup(): JsonObject {
  return {
    ID: newId(),
    BH: "",
    Name: "",
    ItemName: "",
    ItemCode: "",
    ItemBH: "",
    ItemID: "",
    ProID: "",
    ProBH: "",
    ProName: "",
    OrderIndex: 0,
    ItemOrderIndex: 0,
    DianYa: "",
    DianLiu: "",
    BDianYa: "",
    BDianLiu: "",
    CDianYa: "",
    CDianLiu: "",
    GLYS: "1.0",
    pinlv: "50",
    XiangBie: "",
    ErrorItem: "",
    CiShu: 2,
    RMax: 0.5,
    RMin: -0.5,
    TaiCha: 1.0,
    QDtime: 1.0,
    QuanShu: 0,
    Electricity: "0",
    DelFlag: 0,
    JCtype: 0,
    PID: "",
    PointID: "",
    DianliuDang: "",
    Remark: "",
    TestData: "",
  };
}

export function emptyTestItem(): JsonObject {
  return {
    ID: newId(),
    BH: "",
    Code: "",
    Name: "",
    OrderIndex: 0,
    DelFlage: 0,
    JCtype: 0,
    PID: "",
  };
}

export function emptyResultDetail(): JsonObject {
  return {
    ID: newId(),
    MeterID: "",
    MeterBh: "",
    MeterAddr: "",
    MeterSeat: "",
    MeterName: "",
    MeterAssetCoding: "",
    MeterBatch: "",
    MeterTS: "",
    Factory: "",
    ItemID: "",
    ItemCode: "",
    ItemName: "",
    PointID: "",
    PointCode: "",
    PointName: "",
    TestItem: "",
    Phase: "",
    PowerFactor: "",
    Freq: "50",
    VoltA: "",
    VoltB: "",
    VoltC: "",
    CurrA: "",
    CurrB: "",
    CurrC: "",
    Result: "",
    ResultLog: "",
    AverageResult: "",
    FinalResults: "",
    RMax: "",
    RMin: "",
    CiShu: "2",
    QuanShu: "0",
    Electricity: "0",
    StartTime: "",
    EndTime: "",
    ProID: "",
    ProBH: "",
    ProName: "",
    OrderIndex: 0,
    DgvIndex: 0,
    MeterSort: 0,
    IsSaveFlag: 0,
    Code: "",
    CreateUser: "",
    CreateUserID: "",
    TaiCha: "",
    Remark1: "",
    Remark2: "",
    Remark3: "",
    Remark4: "",
  };
}
```

- [ ] **Step 4: 实现 `src/wisdomModel.ts`**

```ts
import { emptyMeter, emptyOtherInfo } from "./defaults";
import type { MeterInfo, MeterOtherInfo, WisdomRoot, JsonObject } from "./types";

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asObject(v: unknown): JsonObject {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as JsonObject)
    : {};
}

export function ensureWisdomShape(input: JsonObject): WisdomRoot {
  const data = { ...input } as WisdomRoot;
  data.MeterInfoList = asArray(data.MeterInfoList) as MeterInfo[];
  data.SchemeGroupList = asArray(data.SchemeGroupList) as JsonObject[];
  data.ResultDetailList = asArray(data.ResultDetailList) as JsonObject[];
  data.TestItemList = asArray(data.TestItemList) as JsonObject[];
  data.CertificateCode = asObject(data.CertificateCode) as Record<string, string>;
  data.MeterOtherInfoMap = asObject(data.MeterOtherInfoMap) as Record<
    string,
    MeterOtherInfo
  >;
  data.Scheme = asObject(data.Scheme);
  if (typeof data.Inspector !== "string") data.Inspector = "";
  if (typeof data.Verifier !== "string") data.Verifier = "";
  if (typeof data.ID !== "string") data.ID = "";
  if (typeof data.LastNum !== "number") data.LastNum = data.MeterInfoList.length;
  return data;
}

export function createEmptyMeter(seat: number): {
  meter: MeterInfo;
  other: MeterOtherInfo;
} {
  const meter = emptyMeter(seat);
  const other = emptyOtherInfo(meter.ID, seat);
  return { meter, other };
}

export function removeMeter(data: WisdomRoot, meterId: string): void {
  const victim = data.MeterInfoList.find((m) => m.ID === meterId);
  data.MeterInfoList = data.MeterInfoList.filter((m) => m.ID !== meterId);
  delete data.MeterOtherInfoMap[meterId];
  if (victim?.MeterNo) {
    delete data.CertificateCode[victim.MeterNo];
  }
}

export type ApplyJsonResult =
  | { ok: true; data: WisdomRoot }
  | { ok: false; error: string };

export function applyJsonText(
  _previous: WisdomRoot,
  text: string
): ApplyJsonResult {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "根节点必须是 JSON 对象" };
    }
    return { ok: true, data: ensureWisdomShape(parsed as JsonObject) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
```

- [ ] **Step 5: 运行测试通过**

```powershell
npx vitest run src/test/wisdomModel.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit（用户要求时）**

```bash
git add src/types.ts src/defaults.ts src/wisdomModel.ts src/test/wisdomModel.test.ts
git commit -m "feat: add wisdom document model and defaults"
```

---

### Task 4: 消息协议与 Custom Document / Provider（可读可存）

**Files:**
- Create: `src/messages.ts`
- Create: `src/wisdomDocument.ts`
- Create: `src/wisdomEditorProvider.ts`
- Modify: `src/extension.ts`

- [ ] **Step 1: 定义 `src/messages.ts`**

```ts
import type { WisdomRoot } from "./types";

/** Host → Webview */
export type HostToWebview =
  | { type: "init"; data: WisdomRoot; fileName: string }
  | { type: "saved" };

/** Webview → Host */
export type WebviewToHost =
  | { type: "ready" }
  | { type: "edit"; data: WisdomRoot }
  | { type: "log"; message: string };
```

- [ ] **Step 2: 实现 `src/wisdomDocument.ts`**

```ts
import * as vscode from "vscode";
import { decodeWisdom, encodeWisdom } from "./gzipJson";
import { ensureWisdomShape } from "./wisdomModel";
import type { WisdomRoot } from "./types";

export class WisdomDocument extends vscode.Disposable implements vscode.CustomDocument {
  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  readonly onDidDispose = this._onDidDispose.event;

  private readonly _onDidChange = new vscode.EventEmitter<{
    readonly label: string;
  }>();
  readonly onDidChangeContent = this._onDidChange.event;

  private _data: WisdomRoot;
  private _dirty = false;

  private constructor(
    readonly uri: vscode.Uri,
    data: WisdomRoot
  ) {
    super(() => this._onDidDispose.fire());
    this._data = data;
  }

  static async create(uri: vscode.Uri): Promise<WisdomDocument> {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const decoded = decodeWisdom(Buffer.from(bytes));
    return new WisdomDocument(uri, ensureWisdomShape(decoded));
  }

  get data(): WisdomRoot {
    return this._data;
  }

  get isDirty(): boolean {
    return this._dirty;
  }

  replaceData(data: WisdomRoot, label = "Edit"): void {
    this._data = data;
    this._dirty = true;
    this._onDidChange.fire({ label });
  }

  async save(): Promise<void> {
    const encoded = encodeWisdom(this._data);
    await vscode.workspace.fs.writeFile(this.uri, encoded);
    this._dirty = false;
  }

  async saveAs(target: vscode.Uri): Promise<void> {
    const encoded = encodeWisdom(this._data);
    await vscode.workspace.fs.writeFile(target, encoded);
  }

  dispose(): void {
    this._onDidDispose.dispose();
    this._onDidChange.dispose();
    super.dispose();
  }
}
```

- [ ] **Step 3: 实现最小可保存 Provider（先用简单 HTML 占位，下一任务换 React）**

`src/wisdomEditorProvider.ts`：

```ts
import * as vscode from "vscode";
import { WisdomDocument } from "./wisdomDocument";
import type { HostToWebview, WebviewToHost } from "./messages";
import { ensureWisdomShape } from "./wisdomModel";
import type { WisdomRoot } from "./types";

export class WisdomEditorProvider implements vscode.CustomEditorProvider<WisdomDocument> {
  private readonly _onDidChangeCustomDocument =
    new vscode.EventEmitter<vscode.CustomDocumentEditEvent<WisdomDocument>>();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new WisdomEditorProvider(context);
    return vscode.window.registerCustomEditorProvider("wisdom.editor", provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    });
  }

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<WisdomDocument> {
    return WisdomDocument.create(uri);
  }

  async resolveCustomEditor(
    document: WisdomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview"),
      ],
    };

    const updateWebviewHtml = () => {
      // Task 5 完成后改为加载 dist/webview/index.html
      webviewPanel.webview.html = this.getPlaceholderHtml(document);
    };
    updateWebviewHtml();

    const changeSub = document.onDidChangeContent(() => {
      this._onDidChangeCustomDocument.fire({
        document,
        undo: () => undefined,
        redo: () => undefined,
      });
    });

    webviewPanel.webview.onDidReceiveMessage((raw: WebviewToHost) => {
      if (raw.type === "ready") {
        const msg: HostToWebview = {
          type: "init",
          data: document.data,
          fileName: document.uri.path.split("/").pop() ?? "file.wisdom",
        };
        void webviewPanel.webview.postMessage(msg);
        return;
      }
      if (raw.type === "edit") {
        document.replaceData(ensureWisdomShape(raw.data as WisdomRoot));
      }
    });

    webviewPanel.onDidDispose(() => changeSub.dispose());
  }

  async saveCustomDocument(
    document: WisdomDocument,
    _cancellation: vscode.CancellationToken
  ): Promise<void> {
    await document.save();
  }

  async saveCustomDocumentAs(
    document: WisdomDocument,
    destination: vscode.Uri,
    _cancellation: vscode.CancellationToken
  ): Promise<void> {
    await document.saveAs(destination);
  }

  async revertCustomDocument(
    document: WisdomDocument,
    _cancellation: vscode.CancellationToken
  ): Promise<void> {
    const fresh = await WisdomDocument.create(document.uri);
    document.replaceData(fresh.data, "Revert");
    // dirty 应在 save 后清除；revert 场景在后续可增强
  }

  async backupCustomDocument(
    document: WisdomDocument,
    context: vscode.CustomDocumentBackupContext,
    _cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    await document.saveAs(context.destination);
    return {
      id: context.destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(context.destination);
        } catch {
          /* ignore */
        }
      },
    };
  }

  private getPlaceholderHtml(document: WisdomDocument): string {
    const name = document.uri.fsPath;
    return `<!DOCTYPE html><html><body style="background:#1e1e1e;color:#ccc;font-family:sans-serif;padding:16px">
      <h2>Wisdom Editor</h2>
      <p>${name}</p>
      <p>电表数量: ${document.data.MeterInfoList.length}</p>
      <p>React Webview 将在下一任务接入</p>
    </body></html>`;
  }
}
```

注意：`CustomEditorProvider` 的完整 dirty 集成需要 `onDidChangeCustomDocument` 配合；占位阶段先能打开/显示计数。若 F5 打开报错，对照 VS Code `CustomEditorProvider` 文档补齐 `Disposable` 订阅。

- [ ] **Step 4: 更新 `src/extension.ts` 注册 Provider**

```ts
import * as vscode from "vscode";
import { WisdomEditorProvider } from "./wisdomEditorProvider";
import { openWisdomAsText } from "./openAsText";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(WisdomEditorProvider.register(context));
  context.subscriptions.push(
    vscode.commands.registerCommand("wisdom.openAsText", async (uri?: vscode.Uri) => {
      await openWisdomAsText(uri);
    })
  );
}

export function deactivate(): void {}
```

同时创建占位 `src/openAsText.ts`：

```ts
import * as vscode from "vscode";

export async function openWisdomAsText(uri?: vscode.Uri): Promise<void> {
  const target =
    uri ??
    vscode.window.activeTextEditor?.document.uri ??
    (await vscode.window.showOpenDialog({
      filters: { Wisdom: ["wisdom"] },
      canSelectMany: false,
    }))?.[0];
  if (!target) return;
  vscode.window.showInformationMessage(`将在 Task 7 实现: ${target.fsPath}`);
}
```

- [ ] **Step 5: 构建并手工验证**

```powershell
npm run build:ext
```

按 F5（需 `.vscode/launch.json`）：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ]
}
```

Expected: 打开 `samples/sample.wisdom` 看到占位页与电表数量 ≥ 1。Ctrl+S 暂可不测完整 UI，但 `document.save()` 应可在后续接入后验证。

- [ ] **Step 6: Commit（用户要求时）**

```bash
git add src/messages.ts src/wisdomDocument.ts src/wisdomEditorProvider.ts src/extension.ts src/openAsText.ts .vscode/launch.json
git commit -m "feat: register custom editor provider for .wisdom"
```

---

### Task 5: Webview React + Vite 脚手架并接入 Provider

**Files:**
- Create: `webview/package.json`
- Create: `webview/vite.config.ts`
- Create: `webview/tsconfig.json`
- Create: `webview/index.html`
- Create: `webview/src/main.tsx`
- Create: `webview/src/App.tsx`
- Create: `webview/src/vscodeApi.ts`
- Create: `webview/src/styles.css`
- Modify: `src/wisdomEditorProvider.ts`（加载打包后的 HTML/JS/CSS）
- Modify: 根 `package.json` scripts（若需）

- [ ] **Step 1: 初始化 webview 包**

`webview/package.json`:

```json
{
  "name": "wisdom-webview",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch"
  },
  "dependencies": {
    "@codemirror/lang-json": "^6.0.1",
    "@codemirror/state": "^6.4.0",
    "@codemirror/view": "^6.23.0",
    "codemirror": "^6.0.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

`webview/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: path.resolve(__dirname, "../dist/webview"),
    emptyOutDir: true,
    assetsDir: "assets",
  },
});
```

`webview/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Wisdom Editor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: 实现 vscode API 与最小 App**

`webview/src/vscodeApi.ts`:

```ts
export type VsCodeApi = {
  postMessage: (msg: unknown) => void;
  getState: () => unknown;
  setState: (s: unknown) => void;
};

declare function acquireVsCodeApi(): VsCodeApi;

let api: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi {
  if (!api) {
    api = acquireVsCodeApi();
  }
  return api;
}
```

`webview/src/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`webview/src/App.tsx`（先做 Tab 壳 + 收到 init 显示电表数）：

```tsx
import { useEffect, useState } from "react";
import { getVsCodeApi } from "./vscodeApi";

type WisdomRoot = {
  MeterInfoList: unknown[];
  [key: string]: unknown;
};

const TABS = [
  "电表信息",
  "检定方案",
  "测试项目",
  "结果明细",
  "证书/人员",
  "原始 JSON",
] as const;

export function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("电表信息");
  const [data, setData] = useState<WisdomRoot | null>(null);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    const vscode = getVsCodeApi();
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === "init") {
        setData(msg.data);
        setFileName(msg.fileName ?? "");
      }
    };
    window.addEventListener("message", handler);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  if (!data) {
    return <div className="page">加载中…</div>;
  }

  return (
    <div className="page">
      <header className="top">
        <span className="title">{fileName}</span>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={t === tab ? "tab active" : "tab"}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <main className="main">
        {tab === "电表信息" && <p>电表数量：{data.MeterInfoList.length}</p>}
        {tab !== "电表信息" && <p>{tab}（下一任务实现）</p>}
      </main>
    </div>
  );
}
```

`webview/src/styles.css`：使用 `var(--vscode-foreground)`、`var(--vscode-editor-background)`、`var(--vscode-button-background)` 等。

- [ ] **Step 3: Provider 改为注入打包资源**

在 `wisdomEditorProvider.ts` 中实现：

```ts
private getReactHtml(webview: vscode.Webview): string {
  const base = vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview");
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(base, "assets", /* 实际文件名从 readdir 或固定 vite 配置 */ "index.js"));
  // 推荐：vite 配置 rollupOptions.output.entryFileNames = 'assets/index.js' 与 assetFileNames 固定名
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(base, "assets", "index.css"));
  const csp = `default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <link rel="stylesheet" href="${styleUri}" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
}
```

同步修改 `webview/vite.config.ts`：

```ts
build: {
  outDir: path.resolve(__dirname, "../dist/webview"),
  emptyOutDir: true,
  rollupOptions: {
    output: {
      entryFileNames: "assets/index.js",
      chunkFileNames: "assets/[name].js",
      assetFileNames: "assets/[name][extname]",
    },
  },
},
```

- [ ] **Step 4: 安装并构建**

```powershell
cd webview; npm install; npm run build; cd ..
npm run build:ext
```

Expected: `dist/webview/assets/index.js` 存在；F5 打开样例可见 Tab 与电表数量。

- [ ] **Step 5: Commit（用户要求时）**

```bash
git add webview src/wisdomEditorProvider.ts package.json
git commit -m "feat: scaffold React webview and wire custom editor"
```

---

### Task 6: 业务 Tab 完整编辑 + 回传 dirty

**Files:**
- Create: `webview/src/components/DataTable.tsx`
- Create: `webview/src/components/MeterTab.tsx`
- Create: `webview/src/components/SchemeTab.tsx`
- Create: `webview/src/components/TestItemTab.tsx`
- Create: `webview/src/components/ResultTab.tsx`
- Create: `webview/src/components/MetaTab.tsx`
- Create: `webview/src/components/JsonTab.tsx`
- Modify: `webview/src/App.tsx`
- Modify: `src/defaults.ts` 导出供 webview？**不要**：默认模板在 Host 侧生成。Webview 发送 `{ type:'addMeter' }` 等命令，或 Webview 内复制同一默认字段表。

**选定策略（避免两份逻辑漂移）：** Webview 只发送完整 `edit` 数据；新增行时 Webview 调用 Host：

扩展消息：

```ts
| { type: "requestNew"; kind: "meter" | "schemeGroup" | "testItem" | "result" }
```

Host 回复：

```ts
| { type: "newItem"; kind: string; item: unknown; extra?: unknown }
```

实现时把该联合类型补进 `src/messages.ts`，并在 Provider 中用 `defaults.ts` 生成。

- [ ] **Step 1: 扩展消息类型并在 Provider 处理 `requestNew` / `edit`**

Host 对 `requestNew`：

- `meter` → `createEmptyMeter(nextSeat)`，把 meter 推进 `MeterInfoList`，other 写入 map，再 `init` 全量推送或回 `newItem`
- 其他 kind → 对应 `empty*` 推入数组

简化实现：**每次 edit 都 post 全量 `WisdomRoot`**，新增也在 Webview 完成但字段模板从 Host 拉取一次缓存。更简单：App 挂载后 Host `init` 附带 `templates` 字段。

在 `HostToWebview` init 增加：

```ts
templates: {
  meter: MeterInfo;
  other: MeterOtherInfo;
  schemeGroup: JsonObject;
  testItem: JsonObject;
  result: JsonObject;
}
```

Provider 发送 init 时用 `createEmptyMeter(0)` 等生成模板（发送前不要写入文档）。

- [ ] **Step 2: 实现 `DataTable`**

可编辑二维表：`columns: {key, label}[]`，`rows: JsonObject[]`，`onChange(rows)`，工具栏「新增」「删除选中」。

- [ ] **Step 3: 实现各业务 Tab**

- `MeterTab`：左列表右表单；表单含 Meter 字段分组 + OtherInfo（BarCode/铅封）；增删调用父级 `setData` + `postEdit`
- `SchemeTab`：Scheme 对象表单 + SchemeGroupList 表
- `TestItemTab`：TestItemList 表
- `ResultTab`：筛选 input + ResultDetailList 表
- `MetaTab`：CertificateCode 键值对编辑（可做成两列表格）、Inspector/Verifier、只读 ID、可编辑 LastNum
- `JsonTab`：CodeMirror；本地 state 文本；「应用到文档」按钮 parse 后 `setData`；非法显示 error

- [ ] **Step 4: App 统一 `commit(data)`**

```ts
function commit(next: WisdomRoot) {
  setData(next);
  getVsCodeApi().postMessage({ type: "edit", data: next });
}
```

顶部显示「已修改」：本地 `dirty` 标志，在收到 Host `saved` 时清除（Provider 在 `saveCustomDocument` 成功后 `postMessage({type:'saved'})`）。

- [ ] **Step 5: 手工验收清单**

1. 打开 sample → 六个 Tab 有数据  
2. 改表号 → Ctrl+S → 用 Python 解压确认变更  
3. 新增/删除电表 → map 与证书同步  
4. JSON Tab 改 `Inspector` → 应用 → 证书/人员 Tab 可见  
5. JSON Tab 输入非法 → 不破坏数据  

```powershell
python -c "import json,gzip; d=json.load(gzip.open(r'samples/sample.wisdom','rt',encoding='utf-8')); print(d['MeterInfoList'][0].get('MeterNo'), d.get('Inspector'))"
```

- [ ] **Step 6: Commit（用户要求时）**

```bash
git add webview src/messages.ts src/wisdomEditorProvider.ts src/defaults.ts
git commit -m "feat: implement business tabs and JSON editor for wisdom files"
```

---

### Task 7: 「以文本方式打开」命令

**Files:**
- Modify: `src/openAsText.ts`

- [ ] **Step 1: 实现临时 JSON 打开**

```ts
import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import { decodeWisdom, encodeWisdom } from "./gzipJson";

export async function openWisdomAsText(uri?: vscode.Uri): Promise<void> {
  let target = uri;
  if (!target) {
    const active = vscode.window.tabGroups.activeTabGroup.activeTab?.input as
      | { uri?: vscode.Uri }
      | undefined;
    target = active?.uri;
  }
  if (!target) {
    const picked = await vscode.window.showOpenDialog({
      filters: { Wisdom: ["wisdom"] },
      canSelectMany: false,
    });
    target = picked?.[0];
  }
  if (!target) return;

  const bytes = await vscode.workspace.fs.readFile(target);
  let data;
  try {
    data = decodeWisdom(Buffer.from(bytes));
  } catch (e) {
    void vscode.window.showErrorMessage(
      `无法解析 Wisdom：${e instanceof Error ? e.message : String(e)}`
    );
    return;
  }

  const tmp = path.join(
    os.tmpdir(),
    `${path.basename(target.fsPath, ".wisdom")}-${Date.now()}.json`
  );
  const tmpUri = vscode.Uri.file(tmp);
  await vscode.workspace.fs.writeFile(
    tmpUri,
    Buffer.from(JSON.stringify(data, null, 2), "utf8")
  );
  const doc = await vscode.workspace.openTextDocument(tmpUri);
  await vscode.window.showTextDocument(doc, { preview: false });
  void vscode.window.showInformationMessage(
    "正在编辑临时 JSON。保存后请使用命令「Wisdom: 从 JSON 写回 .wisdom」写回（见下一步）。"
  );
}
```

- [ ] **Step 2: 增加写回命令 `wisdom.writeBackFromJson`**

在 `package.json` contributes.commands 增加命令；实现：用户选择源临时 json + 目标 wisdom（或记住打开时的映射 `Map<tmpPath, wisdomUri>`）。

推荐：`openAsText` 时在模块级 `Map` 记录 `tmp → wisdomUri`；注册：

```ts
vscode.commands.registerCommand("wisdom.writeBackFromJson", async () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const wisdomUri = mapping.get(editor.document.uri.fsPath);
  if (!wisdomUri) {
    void vscode.window.showErrorMessage("当前文件不是由 Wisdom 文本打开产生的临时 JSON");
    return;
  }
  try {
    const obj = JSON.parse(editor.document.getText());
    await vscode.workspace.fs.writeFile(wisdomUri, encodeWisdom(obj));
    void vscode.window.showInformationMessage(`已写回 ${wisdomUri.fsPath}`);
  } catch (e) {
    void vscode.window.showErrorMessage(String(e));
  }
});
```

- [ ] **Step 3: 手工验证**

资源管理器右键 sample → 以文本打开 → 改字段 → 写回 → 再双击可视化打开看变更。

- [ ] **Step 4: Commit（用户要求时）**

```bash
git add src/openAsText.ts src/extension.ts package.json
git commit -m "feat: open wisdom as temp JSON and write back"
```

---

### Task 8: 错误处理打磨、README、打包自检

**Files:**
- Modify: `src/wisdomDocument.ts` / `src/wisdomEditorProvider.ts`（打开失败提示）
- Modify: `README.md`
- Modify: `.vscodeignore`（确保 `dist/webview` 打进 vsix）

- [x] **Step 1: `WisdomDocument.create` 错误上抛为友好信息**

```ts
try {
  const decoded = decodeWisdom(Buffer.from(bytes));
  return new WisdomDocument(uri, ensureWisdomShape(decoded));
} catch (e) {
  throw new Error(
    `无法打开 Wisdom 文件（需为 gzip+JSON）：${e instanceof Error ? e.message : String(e)}`
  );
}
```

- [x] **Step 2: 结构不完整时在 Webview 顶栏显示警告条**（`MeterInfoList` 曾缺失被兜底时，可在 `ensureWisdomShape` 返回 `{ data, warnings }`——若改动面大，可仅在 Host 检测 `!Array.isArray(raw.MeterInfoList)` 时 `postMessage({type:'warning', text:'结构不完整，已用空值兜底'})`）

- [x] **Step 3: 更新 README**（中文）：功能列表、开发、调试、兼容说明、命令列表

- [x] **Step 4: 全量测试**

```powershell
npx vitest run
npm run build
```

Expected: 全部 PASS；`dist/extension.js` 与 `dist/webview/assets/index.js` 存在。

- [x] **Step 5: 对照规格验收清单勾选**（见 design §11）

- [x] **Step 6: Commit（用户要求时）**

```bash
git add -A
git commit -m "docs: finalize wisdom editor README and error handling"
```

---

## Spec 覆盖自检

| 规格项 | 任务 |
| --- | --- |
| Custom Editor 默认打开 | Task 1/4 |
| 以文本打开 | Task 7 |
| gzip+JSON 兼容读写 | Task 2/4 |
| 未知字段透传 | Task 2/3 |
| 全量业务 Tab + CRUD | Task 6 |
| MeterOtherInfoMap 编辑与清理 | Task 3/6 |
| 原始 JSON 同步 | Task 6 |
| 现代 VS Code 主题风格 | Task 5/6 CSS |
| 错误处理 | Task 2/7/8 |
| 单元测试 + 样例手工验收 | Task 2/3/6/8 |
| 不写私有元数据 / 无批量多文件 | 全任务遵守 |

## Placeholder 扫描

已消除 TBD；开放项已在文件结构段落锁定（CodeMirror、临时 JSON、2 空格 stringify）。

## 类型一致性

- `WisdomRoot` / `WisdomData`：`gzipJson` 用 `WisdomData`，模型层用 `WisdomRoot`（`ensureWisdomShape` 连接）
- 消息：`edit` / `init` / `ready` / `saved` / `requestNew`（Task 6 扩展）
- 命令：`wisdom.openAsText`、`wisdom.writeBackFromJson`
