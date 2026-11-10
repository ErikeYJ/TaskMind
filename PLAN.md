# TaskMind 开发计划

> Windows 桌面任务管理应用。核心链路：微信截图 → `Ctrl+V` → AI 提取任务 → 人工确认 → 按紧急度排序 → 桌面浮球 Top 3 → 点击直达任务和原截图。

当前状态：需求质询已完成，等待确认后开始实现。

---

## 1. 已确认决策

| 项目 | 决定 |
|---|---|
| 技术栈 | Electron + React + TypeScript + Vite（electron-vite）+ Tailwind CSS |
| 数据库 | SQLite（`better-sqlite3`），截图作为文件存储，不进数据库 |
| 列表模型 | 总览式：`未完成` 包含所有没做完的任务，允许在不同标签重复出现 |
| 标签顺序 | 今日待办 → 未完成 → 进行中 → 已完成 → **挂起（最后）** |
| 状态 | `待办` / `进行中` / `挂起` / `已完成` |
| 进行中 | 允许同时多个任务处于进行中 |
| 挂起 | 独立标签；任何未完成任务都可挂起；不参与浮球 Top 3 和提醒；恢复后回到挂起前状态 |
| AI 服务 | OpenCode Go（OpenAI 兼容接口），模型 `deepseek-v4.1-flash` |
| AI Key | 用户在本机设置页填写，Windows 加密保存；不写进代码、安装包或仓库 |
| 截图 | 一个任务可多张；支持 Ctrl+V、拖拽、选择文件；原图存本地，可随时放大查看 |
| 任务提取 | 一张截图 = 一个任务；AI 结果先进入可编辑表单，必须人工点「添加任务」才保存 |
| 浮球 | 可拖动、记忆位置；悬停/点击展开最紧急 3 条；点任务打开主界面并定位详情 |
| 提醒 | 到期当天 09:00 汇总；设了具体时间则到点再提醒；逾期任务每天 09:00 汇总；可关闭 |
| 数据 | 纯本地；提供导出/导入备份；不做账号和云同步 |
| 交付 | NSIS 安装包（可选绿色版）；首次启动询问是否开机自启；关闭主窗口进入托盘 |
| 分享 | 后续同事各自安装、各自填 Key、各自本地数据 |

---

## 2. 状态与列表模型

### 2.1 状态

- `todo`：待办，未开始
- `in_progress`：进行中
- `suspended`：挂起
- `done`：已完成

### 2.2 标签归属

| 标签 | 查询规则 | 说明 |
|---|---|---|
| 今日待办 | `status = todo` 且 `due_date <= 今天` | 包含逾期未开始的任务，标红 |
| 未完成 | `status IN (todo, in_progress, suspended)` | 总收件箱，任务会与其他标签重复出现 |
| 进行中 | `status = in_progress` | 允许多个 |
| 已完成 | `status = done` | 按完成时间倒序 |
| 挂起 | `status = suspended` | 放在标签最后 |

> 「未完成」是总览，重复出现是刻意设计，不是 bug。

### 2.3 状态流转

| 操作 | 允许的当前状态 | 结果 |
|---|---|---|
| 开始 | `todo` | `in_progress`，记录 `started_at` |
| 挂起 | `todo` / `in_progress` | `suspended`，记录 `status_before_suspend`、`suspended_at` |
| 恢复 | `suspended` | 回到 `status_before_suspend`（默认 `todo`） |
| 完成 | `todo` / `in_progress` / `suspended` | `done`，记录 `status_before_done`、`completed_at` |
| 还原 | `done` | 回到 `status_before_done`（默认 `todo`），清空 `completed_at` |
| 删除 | 任意 | 删除任务及其截图文件，二次确认 |

- 挂起后即使到期，也不进入「今日待办」（它在「未完成」和「挂起」里）。
- 进行中且到期的任务不进入「今日待办」（它在「未完成」和「进行中」里）。
- 已完成任务只出现在「已完成」。
- 日期变更不自动改状态；通过查询规则自动完成列表迁移。

### 2.4 排序

- 今日待办 / 未完成 / 进行中 / 挂起：按截止日期升序，无日期排最后；同日期按时间升序，无时间排最后；再按创建时间升序。
- 已完成：完成时间倒序。
- 浮球 Top 3：所有未完成且不是挂起、且有截止日期的任务，按截止时间升序取前 3；无具体时间按当天结束处理。
- 逾期标记：截止日期早于今天，或今天且已过具体时间。

---

## 3. 数据设计

### 3.1 数据目录

`app.getPath('userData')`，Windows 下大致为：

```text
%APPDATA%\TaskMind\
  taskmind.db
  images/
    2026/11/<uuid>.png
    2026/11/<uuid>.thumb.jpg
  settings.json
```

### 3.2 SQLite 表

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  client TEXT,
  notes TEXT NOT NULL DEFAULT '',
  due_date TEXT,                 -- YYYY-MM-DD 本地日期
  due_time TEXT,                 -- HH:mm，可空
  status TEXT NOT NULL CHECK (status IN ('todo','in_progress','suspended','done')),
  status_before_suspend TEXT,
  status_before_done TEXT,
  started_at TEXT,
  suspended_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_tasks_status_due ON tasks(status, due_date, due_time);
CREATE INDEX idx_tasks_due ON tasks(due_date, due_time);

CREATE TABLE screenshots (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  thumb_name TEXT,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_screenshots_task ON screenshots(task_id);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### 3.3 设置

`settings.json` 保存非敏感设置：

- 主题：`system` / `light` / `dark`
- 通知开关、早间汇总时间（默认 `09:00`）、到点提醒开关
- 开机自启
- 主窗口尺寸/位置、浮球位置、大小（`size`）和贴边状态（`dock`）
- AI 配置：provider、baseUrl、model、稳定的 `x-opencode-session` UUID
- 是否已完成首次引导

API Key 单独用 Electron `safeStorage` 加密后存放；渲染进程只能得到「是否已配置」，不能读取 Key 原文。

### 3.4 备份

- 导出 zip：数据库快照 + `images/` + 非敏感设置。
- **不导出 API Key**；换机/重装后需要重新填写。
- 导入前先备份当前数据，确认后替换并重启应用。

---

## 4. AI 识别

### 4.1 已实测通过的配置

- Provider：OpenCode Go
- Base URL：`https://opencode.ai/inference/go/openai/v1`
- 模型：`deepseek-v4.1-flash`
- 请求：OpenAI 兼容 `POST /chat/completions`
- 必需请求头：
  - `Authorization: Bearer <用户 Key>`
  - `x-opencode-session: <稳定的 UUID>`
  - `User-Agent: TaskMind/<版本>`
- 已实测：纯文本请求 200；带中文微信聊天截图的视觉请求 200；能正确输出任务标题、内容、客户、日期、时间、备注、置信度。
- 注意：`response_format: json_object` 实测返回空内容，**不使用 JSON mode**；用严格提示词 + 容错 JSON 解析。

### 4.2 请求与提示词

- 输入：当前截图（压缩副本）+ 当前本地日期、时间、时区。
- 提示词要求只输出 JSON 对象：

```json
{
  "title": "短标题",
  "content": "任务详情",
  "client": "客户/来源，可空",
  "dueDate": "YYYY-MM-DD 或 null",
  "dueTime": "HH:mm 或 null",
  "notes": "备注/提醒",
  "confidence": 0.0
}
```

- 明确要求：识别不到日期就返回 `null`，不要猜；一张截图只提取一个任务；截图不是任务时返回空标题。
- 参数：`temperature: 0`、`max_tokens: 2000`、非流式、45 秒超时。
- 解析：先尝试直接 JSON，再尝试去掉 Markdown 代码块、截取首尾大括号；用 zod 校验。
- 失败处理：自动重试一次；仍失败则保留截图、显示错误、允许手动填写，不阻塞添加任务。
- 图片请求：最长边压到 1600px、JPEG 85 左右；原图另存，不发给 AI。

### 4.3 Key 安全

- Key 只在主进程使用，渲染进程不接触。
- `safeStorage.encryptString` 加密后落盘；日志和错误信息不输出请求头。
- 开发联调使用用户提供的 Key，但**不写入源码、不写入 PLAN.md、不提交仓库**。
- 交付/分享时安装包内无 Key，每台机器首次启动自行配置。

---

## 5. 界面与交互

### 5.1 主窗口

- 默认 1200×800，最小 980×640；中文界面。
- 左侧导航：今日待办 / 未完成 / 进行中 / 已完成 / 挂起（挂起最后），带数量角标。
- 顶部：TaskMind 标识、「添加任务」主按钮、设置入口、主题切换。
- 主区域：卡片列表；卡片显示标题、客户、截止时间、逾期/今天/明天标签、内容摘要、截图数量。
- 点击卡片打开右侧详情抽屉；详情中可查看/编辑字段、查看截图、开始/挂起/完成/还原/恢复/删除。
- 今日和逾期用颜色区分；已完成显示完成时间；挂起显示挂起时间。
- 空列表有明确空状态和「添加任务」入口。

### 5.2 添加任务

1. 点击「添加任务」或直接在主界面按 `Ctrl+V`。
2. 粘贴区支持微信截图、拖拽图片、选择文件。
3. 有图时自动调用 AI，显示识别中；识别完成后填充表单。
4. 表单字段：任务名称、客户/来源、任务内容、截止日期、时间（可选）、备注。
5. 日期支持「今天 / 明天 / 后天 / 下周」快捷项、日期选择器、中文自然语言输入（如“明天下午3点”）。
6. 所有 AI 字段可编辑；点击「添加任务」才保存；可「重新识别」。
7. 无图也可手动添加；AI 失败不影响手动保存。
8. 新增任务后截图随任务保存，列表按截止时间自动排序。

### 5.3 截图查看

- 详情页缩略图网格；点击打开全屏查看器。
- 查看器支持缩放、切换上一张/下一张、点击背景关闭。
- 详情页按 `Ctrl+V` 可继续给当前任务追加截图。
- 删除任务或截图时同步删除本地文件。

### 5.4 桌面浮球

- 独立透明无边框窗口，置顶、不占任务栏、始终显示（可隐藏）。
- 平时是小球；悬停或点击展开最紧急 3 条；点击某条打开主窗口并定位到任务详情和截图。
- 排序：逾期 > 今天 > 最近到期；包含进行中；不包含挂起、已完成、无截止日期的任务。
- 可拖动并记忆位置；拖动由主进程跟随系统光标，避免透明窗口丢失鼠标移动。
- 浮球大小可设置（56–120px）；拖到屏幕边缘会自动吸附并缩小贴边，拖离后恢复大小。
- 球体使用干净的实心渐变，不加光晕或投影，避免透明窗口出现虚影。
- 多显示器切换时自动夹取到可见区域。
- 右键菜单：打开主界面 / 隐藏浮球 / 退出。
- 无紧急任务时显示安静的完成态，不显示空面板。
- 主窗口关闭到托盘后，浮球继续工作。

### 5.5 托盘、通知、启动

- 托盘菜单：打开主界面、显示/隐藏浮球、开机自启开关、退出。
- 关闭主窗口 = 收进托盘；退出只能从托盘/菜单触发。
- 通知：
  - 每天 09:00：今天到期 + 逾期未完成任务的汇总提醒。
  - 有具体时间的任务：到点再提醒一次。
  - 点击通知打开对应任务。
  - 挂起任务和被关闭的通知类型不发送。
- 首次启动询问是否开机自启，默认不擅自开启。
- 自启动时以 `--hidden` 启动：只显示托盘和浮球，不弹出主窗口。
- 单实例运行；重复启动时唤起已有主窗口。

### 5.6 设置页

- AI 识别：Provider、Base URL、模型、API Key（密码框）、测试连接。
- 通知：开关、早间汇总时间、到点提醒开关、发送测试通知。
- 外观：跟随系统 / 浅色 / 深色。
- 浮球：显示/隐藏、重置位置。
- 数据：导出备份、导入备份、打开数据目录。
- 关于：版本号、数据位置、无 Key 说明。

---

## 6. 技术架构

```text
src/
  main/                 Electron 主进程
    db/                 SQLite、迁移、任务/截图仓储
    services/           AI、提醒调度、托盘、浮球、备份、设置
    windows/            主窗口、浮球窗口
    ipc/                IPC 注册与校验
    protocol.ts         本地图片自定义协议
  preload/              contextBridge 类型化 API
  renderer/             React 界面（主窗口 + 浮球两套入口）
    features/tasks/
    features/ball/
    features/settings/
    components/
    stores/
    styles/
  shared/               类型、状态规则、日期工具、zod schema
tests/                  Vitest 单元/集成测试
resources/              应用图标
```

- 主进程负责数据库、AI 请求、文件、通知、窗口；渲染进程只做 UI。
- IPC 使用 TypeScript 类型和 zod 校验；渲染进程不直接读文件系统。
- 本地截图通过 `taskmind-media://` 自定义协议加载，校验路径必须在数据目录内。
- 安全：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`、CSP、禁止外部导航。
- 状态刷新：任务变更后广播事件，主列表和浮球同步更新。
- 日期工具和状态规则放 `shared/`，便于单元测试。

---

## 7. 打包与交付

- `electron-builder` 生成 Windows x64 NSIS 安装包；可选 portable 绿色版。
- `appId: com.taskmind.app`，`productName: TaskMind`，版本 `0.1.3`。
- 安装包内不包含任何 API Key。
- 卸载默认不删除任务数据；数据在 `%APPDATA%\TaskMind`。
- 第一版不做代码签名和自动更新；分享给同事时可能出现 SmartScreen 提示，需手动允许。
- 未来若需要统一分发，再考虑签名、自动更新和共享 Key 代理。

---

## 8. 测试与验收

### 8.1 自动化

- 状态流转测试：开始、挂起、恢复、完成、还原、删除。
- 列表归属测试：今日、未完成总览、进行中、挂起、已完成。
- 排序测试：逾期、今天、无时间、无日期、已完成倒序。
- Top 3 测试：排除挂起/已完成/无日期，包含进行中。
- 日期解析测试：今天/明天/后天/下周X/具体日期/下午3点。
- 数据库仓储测试：CRUD、截图关联、迁移。
- AI 响应解析测试：正常 JSON、Markdown 包裹、缺字段、非法 JSON。

### 8.2 手工验收

- 从微信截图 `Ctrl+V`，AI 填充名称/内容/客户/日期/备注，人工修改后保存。
- 任务进入正确列表；开始、挂起、恢复、完成、还原全部正确。
- 多个任务可同时进行中；挂起标签在最后。
- 浮球显示最紧急 3 条，点击打开主窗口并定位任务和截图。
- 关闭主窗口后托盘和浮球继续运行；重新启动数据还在。
- 通知：09:00 汇总、到点提醒、点击通知打开任务。
- 首次启动询问开机自启；自启动不弹主窗口。
- 导出备份、导入备份后可恢复任务和截图。
- 打包后的安装包在 Windows 11 上可安装、运行、卸载。

---

## 9. 实施阶段

1. **脚手架**：Electron + Vite + React + TS + Tailwind；主窗口能启动；基础 IPC。
2. **数据层**：SQLite、迁移、设置、任务仓储、状态规则和单元测试。
3. **主界面**：五个标签、卡片列表、详情抽屉、手动新增/编辑/删除。
4. **截图链路**：Ctrl+V、拖拽、文件选择、图片保存、缩略图、自定义协议、全屏查看。
5. **AI 链路**：OpenCode Go 配置、Key 加密、截图识别、可编辑确认、失败重试、测试连接。
6. **浮球与托盘**：Top 3、拖动、位置记忆、点击跳转、托盘菜单、关闭到托盘。
7. **提醒与启动**：09:00 汇总、到点提醒、逾期汇总、通知点击、开机自启、单实例、跨天刷新。
8. **设置与备份**：设置页、首次引导、导出/导入备份。
9. **打包验收**：图标、NSIS 安装包、Windows 11 安装测试、完整验收清单。

---

## 10. 第一版不做

- 云同步、账号体系、手机端
- 同事之间共享任务或实时协作
- 一张截图自动拆成多个任务
- AI 自动保存任务、不经过人工确认
- 搜索、标签、子任务、重复任务（后续需要再加）
- 代码签名、自动更新、共享 API Key 代理
- 全局快捷键快速添加（后续可加）

---

## 11. 需要你最后确认的 4 个细节

1. **挂起放在最后**：标签顺序为 `今日待办 → 未完成 → 进行中 → 已完成 → 挂起`，对吗？
2. **未完成是总览**：进行中的任务也会出现在未完成里，这种重复你接受吗？
3. **一张截图只提取一个任务**：第一版按这个做，对吗？
4. **AI 提取使用主截图**：创建任务时如果贴了多张图，AI 默认识别第一张/当前选中的那张，其余作为附件保存，不自动识别。可以吗？

确认后按第 9 节开始实现。
