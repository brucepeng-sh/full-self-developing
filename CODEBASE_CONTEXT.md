# CODEBASE_CONTEXT.md

> 本文件是给 AI 阅读的项目上下文文档，每次开发任务前请引用此文件。
> 维护原则：任何新增组件、页面、约定，都应同步更新此文档。

---

## 一、技术栈

- **框架**: React (Vite)
- **样式**: Tailwind CSS (核心) + `index.css` (CSS 变量与基础组件类)
- **图标**: `lucide-react`
- **通信**: Fetch API + Server-Sent Events (SSE) 用于流式响应
- **前端开发与构建**: Vite (`npm run dev`)。注意：后端（8033端口）现已纯粹作为 API Server，不再负责静态托管前端打包后的 `dist` 文件。前端界面请始终通过 Vite 端口（如 5173）访问。

---

## 二、设计 Token 与视觉规范

> 来源于 `tailwind.config.js` 和 `index.css`。目前项目正向纯 Tailwind 迁移，**禁止在内联样式或新的 CSS 中 hardcode 颜色值**。

### 颜色系统
- **主色 (Primary)**: `#1A56DB` (对应 Tailwind `primary`)
- **主色 Hover**: `#1E429F` (`primary-hover`)
- **页面背景**: `#0a0a0a` (暗黑) / `#ffffff` (明亮)，或使用 `--bg-base`
- **表面背景 (Surface)**: `#F9FAFB` (`surface`) 或 `--bg-surface`
- **主文字**: `#111827` (`text-main`) / `--fg-primary`
- **次要文字**: `#6B7280` (`text-muted`) / `--fg-secondary`
- **重音/标识色**: `--accent` (`#10a37f`)

### 字体规范
- **默认字体**: `Inter` / `Geist` 等无衬线字体 (`var(--font-sans)`)
- **等宽字体**: `Geist Mono` / `Fira Code` (`var(--font-mono)`)
- **页面/面板标题**: `14px font-medium` (`text-sm font-medium`)
- **正文**: `13px` (`text-[13px]`)
- **辅助/标签说明**: `11px font-medium text-muted uppercase tracking-wider`

### 间距与圆角
- **间距**: 遵循 Tailwind 的 4px 体系 (`p-2`, `p-4`, `gap-2`, `gap-4` 等)。
- **卡片/面板圆角**: `8px` (`rounded-lg` 或 `var(--radius-lg)`)
- **按钮/输入框圆角**: `6px` (`rounded-md` 或 `var(--radius-md)`)

---

## 三、全局布局结构 (`App.jsx`)

整个应用采用满屏不可滚动的 Tailwind Flex 布局 (`flex h-screen overflow-hidden`)，内部区域自行滚动：

```text
┌─────────────────────────────────────────────────────────┐
│ Sidebar (w-64/256px) │ Main Canvas (flex-1)             │
│ flex-col, border-r   │ ┌──────────────────────────────┐ │
│                      │ │ Header (h-48px)              │ │
│ - Logo / Controls    │ ├──────────────────────────────┤ │
│ - Nav Items          │ │                              │ │
│ - Settings Selectors │ │ ChatPanel / LoopPanel        │ │
│ - Past Conversations │ │ (overflow-y: auto)           │ │
│ - Quota Footer       │ └──────────────────────────────┘ │
└──────────────────────┴──────────────────────────────────┘
```

- **Sidebar** (`components/Sidebar.jsx`): 左侧侧边栏，采用标准 Tailwind UI Application Shell 设计规范，固定宽度 `w-64` (256px)。
- **Header** (`components/Header.jsx`): 顶部栏，显示当前会话、模型、工作区状态，以及 `Chat` 和 `Loop` 模式切换 Tab。
- **主功能区**: 
  - `ChatPanel.jsx`: AI 对话界面（包含流式消息展示、输入框、Token 消耗槽）。
  - `LoopPanel.jsx`: Agent 自动循环执行任务界面。
- **全局弹窗**: `FolderPicker.jsx`（工作区目录选择）。

---

## 四、核心组件与样式复用

项目从自定义 CSS（`.btn`, `.glass-card` 等）向 Tailwind 迁移。新代码应**优先使用 Tailwind 实用类**，如需使用旧版样式类，请遵循以下规范：

### 通用 UI 类 (定义在 `index.css`)
- **卡片背景**: `.glass-card` (包含背景色和 subtle 边框)
- **主要按钮**: `.btn .btn-primary` (背景为 accent 或 primary)
- **次要按钮**: `.btn .btn-secondary`
- **危险按钮**: `.btn .btn-danger`
- **表单选择框**: `.glass-select`
- **徽章/标签**: `.badge` (组合 `.badge-safety`, `.badge-auto` 等)

### 常用图标
统一使用 `lucide-react`，常用如：`FolderOpen`, `Sun`, `Moon`, `Plus`, `X`, `Server`, `Activity`。尺寸一般为 `size={14}` 或 `size={16}`。

---

## 五、状态管理与 API 规范

- **状态层**: 大量使用 React 的 `useState` 和 `useEffect` (集中在 `App.jsx` 作为单一事实来源向下传递 props)。
- **网络请求**:
  - 普通请求: 封装的 `apiFetch('/api/...', { method: '...' })` (见 `api.js`)。
  - 流式响应: 使用 `EventSource` (`SSE`) 处理 `/api/chat/stream` 和 `/api/loop/stream`。
- **轮询/心跳**: 
  - `App.jsx` 中有每 5 秒一次的 `/api/heartbeat` 轮询检查 Server 连通状态。

---

## 六、UI 交互约定

1. **加载状态 (Loading)**: 
   - 切换模型或引擎时，Select 会短暂显示 `Loading models...`。
   - 对话生成中：发送按钮被禁用 (`disabled={isStreaming}`)，并显示 Stop 按钮。
2. **列表高亮 (Active Item)**:
   - Sidebar 的当前会话需添加 `.active` 类。
   - Header 的当前 Tab 需添加 `.active` 类。
3. **滚动条**:
   - `index.css` 中重写了 `::-webkit-scrollbar`，隐藏原生丑陋滚动条，保持 6px 纤细宽度。必须确保滚动容器加上 `overflow-y: auto`。
4. **消息框布局**:
   - 用户输入: 靠左，带灰色/暗色气泡底色和对应头像。
   - AI 消息: 靠左，支持 Markdown 渲染 (`.msg-content-md`)，紧密排版。

---

## 七、开发约束（必须遵守）

1. **响应式与高度限制**: `ChatPanel` 必须通过 `min-height: 0` 和 `overflow: hidden` 来约束 flex 子项，确保底部的 `input-deck` (输入框) 永远固定在视口底部，不会被无限撑开的长消息挤出屏幕。
2. **渐进式 Tailwind**: 新增的组件必须 100% 使用 Tailwind (`className="flex flex-col gap-4 p-4"` 等)，不要在 `index.css` 新增自定义 class。
3. **安全操作**: 如删除会话等危险操作，Hover 时才显示删除按钮，且建议后续补充二次确认机制。
4. **SSE 处理**: 注意监听 `done` 和 `error` 事件并正确调用 `sse.close()` 以防止内存泄漏和连接挂起。

---

## 八、Prompt 使用模板

每次让 AI 开发新功能时，在 Prompt 开头引用：

```text
请先阅读以下项目上下文，严格按照规范实现，不要偏离：

[粘贴 CODEBASE_CONTEXT.md 相关章节]

任务：实现 XXX 功能

要求：
1. 只使用设计系统允许的 token (Tailwind)
2. 遵循现有的 Flex/Grid 布局嵌套逻辑，确保不破坏视口高度限制 (100vh)
3. 新增 UI 组件必须具备明暗主题兼容性（使用 CSS 变量或 Tailwind `dark:`）
4. 完成后列出你做了哪些设计决定
```

---

## 九、Review Checklist

每次提交前自查：

- [ ] 新增样式是否 100% 使用了 Tailwind 类，或合理复用了旧的 `.btn` / `.glass-card`？
- [ ] 颜色有无 hardcode（如直接写 `#ccc`，应替换为 `text-muted` 或 `var(--fg-secondary)`）？
- [ ] `flex` 容器内长列表滚动是否正常？（是否有子元素超出了 100vh 导致页面出现整体滚动条？）
- [ ] 按钮点击是否在异步/流式请求期间被正确禁用了防抖？
- [ ] 代码是否通过了 `eslint` 校验？
