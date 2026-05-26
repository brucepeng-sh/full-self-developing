# Design System — Codex Style

> 参考 OpenAI Codex 桌面端视觉语言提炼。适用于 Electron / Web / React 项目。

---

## 一、设计哲学

| 原则 | 说明 |
|------|------|
| **极简克制** | 界面服务于内容，装饰为零。每一个元素必须有存在的理由 |
| **暗色优先** | 默认深色主题，浅色主题为辅，跟随系统偏好 |
| **密度感** | 信息密集但不拥挤，适合长时间开发工作场景 |
| **内容即 UI** | 代码、终端、文件差异是一等公民，配色围绕它们设计 |
| **无干扰** | 无圆润卡通感，无霓虹辉光，无多余动效 |

---

## 二、色彩系统

### 2.1 基础语义变量（CSS Custom Properties）

```css
:root {
  /* ── 背景层级（深色模式） ── */
  --bg-base:       #0a0a0a;   /* 最底层，应用背景 */
  --bg-surface:    #111111;   /* 主面板、内容区 */
  --bg-elevated:   #1a1a1a;   /* 悬浮卡片、下拉菜单 */
  --bg-overlay:    #222222;   /* 模态框、弹出层 */
  --bg-subtle:     #161616;   /* 侧边栏、次要区域 */

  /* ── 前景 / 文字 ── */
  --fg-primary:    #ececec;   /* 主要正文 */
  --fg-secondary:  #a0a0a0;   /* 次要说明、元信息 */
  --fg-tertiary:   #5c5c5c;   /* 占位符、禁用态 */
  --fg-inverse:    #0a0a0a;   /* 亮色背景上的文字 */

  /* ── 边框 ── */
  --border-subtle:  rgba(255, 255, 255, 0.06);  /* 最轻分割线 */
  --border-default: rgba(255, 255, 255, 0.10);  /* 普通边框 */
  --border-strong:  rgba(255, 255, 255, 0.18);  /* 强调边框、聚焦环 */

  /* ── 强调色（OpenAI 品牌绿） ── */
  --accent:        #10a37f;   /* 主操作按钮、链接、活跃态 */
  --accent-hover:  #0d8c6d;
  --accent-subtle: rgba(16, 163, 127, 0.12);   /* 轻背景高亮 */
  --accent-fg:     #ffffff;   /* 强调色上的文字 */

  /* ── 语义状态 ── */
  --color-success:         #22c55e;
  --color-success-subtle:  rgba(34, 197, 94, 0.12);
  --color-warning:         #f59e0b;
  --color-warning-subtle:  rgba(245, 158, 11, 0.12);
  --color-danger:          #ef4444;
  --color-danger-subtle:   rgba(239, 68, 68, 0.12);
  --color-info:            #3b82f6;
  --color-info-subtle:     rgba(59, 130, 246, 0.12);

  /* ── 代码 / 终端（Syntax Highlight 基础） ── */
  --syntax-bg:       #0d0d0d;
  --syntax-comment:  #6a6a6a;
  --syntax-string:   #98c379;
  --syntax-keyword:  #c678dd;
  --syntax-function: #61afef;
  --syntax-number:   #d19a66;
  --syntax-operator: #56b6c2;
  --syntax-variable: #e06c75;
  --syntax-type:     #e5c07b;

  /* ── Diff 颜色 ── */
  --diff-add-bg:    rgba(34, 197, 94,  0.10);
  --diff-add-line:  rgba(34, 197, 94,  0.40);
  --diff-del-bg:    rgba(239, 68,  68, 0.10);
  --diff-del-line:  rgba(239, 68,  68, 0.40);
}
```

### 2.2 浅色模式覆盖

```css
[data-theme="light"],
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg-base:       #ffffff;
    --bg-surface:    #f9f9f8;
    --bg-elevated:   #f2f2f0;
    --bg-overlay:    #ffffff;
    --bg-subtle:     #f4f4f2;

    --fg-primary:    #0d0d0d;
    --fg-secondary:  #5c5c5c;
    --fg-tertiary:   #b0b0b0;
    --fg-inverse:    #ffffff;

    --border-subtle:  rgba(0, 0, 0, 0.06);
    --border-default: rgba(0, 0, 0, 0.10);
    --border-strong:  rgba(0, 0, 0, 0.18);

    --syntax-bg:      #f6f6f4;
    --syntax-comment: #a0a0a0;
  }
}
```

### 2.3 颜色使用规则

- 背景层级严格递增，不跨层使用（`base` 上直接放 `overlay` 是错误的）
- 强调色 `--accent` 只用于**主要可操作元素**（CTA 按钮、激活状态、链接）
- 状态色（success / warning / danger）只用于**反馈信息**，不做装饰
- 严禁在界面中大面积使用彩色，Codex 整体色调接近中性灰

---

## 三、排版

### 3.1 字体栈

```css
:root {
  /* UI 字体：干净的等线体，适合长时间阅读 */
  --font-sans: "Geist", "SF Pro Text", -apple-system, BlinkMacSystemFont,
               "Segoe UI", system-ui, sans-serif;

  /* 代码字体：等宽、清晰、区分度高 */
  --font-mono: "Geist Mono", "SF Mono", "Fira Code", "Cascadia Code",
               "JetBrains Mono", ui-monospace, monospace;

  /* 数字（可选）：lining 数字，适合数据展示 */
  --font-numeric: var(--font-sans);
  font-variant-numeric: tabular-nums;
}
```

> **选字原则**：优先 Geist / SF Pro，这是 OpenAI 产品线实际使用的字体族。

### 3.2 字阶（Type Scale）

| Token | Size | Line Height | Weight | 用途 |
|-------|------|-------------|--------|------|
| `--text-xs`  | 11px | 1.5 | 400 | 角标、状态标签 |
| `--text-sm`  | 12px | 1.6 | 400 | 辅助说明、元信息 |
| `--text-base`| 13px | 1.7 | 400 | 正文（UI 默认） |
| `--text-md`  | 14px | 1.6 | 400 | 侧边栏、列表 |
| `--text-lg`  | 15px | 1.5 | 500 | 面板标题 |
| `--text-xl`  | 17px | 1.4 | 500 | 页面主标题 |
| `--text-2xl` | 20px | 1.3 | 500 | 模态标题 |
| `--text-code`| 12px | 1.7 | 400 | 代码块（等宽） |

```css
:root {
  --text-xs:   11px;
  --text-sm:   12px;
  --text-base: 13px;
  --text-md:   14px;
  --text-lg:   15px;
  --text-xl:   17px;
  --text-2xl:  20px;
  --text-code: 12px;
}
```

### 3.3 排版规则

- **字重只用 400 / 500**，不用 600 / 700（过重，与整体低调风格冲突）
- UI 正文默认 **13px / 400**，比大多数 Web 应用稍小——这是开发者工具的惯例
- 代码字体始终 12px，行高 1.7，字间距 `-0.01em`
- 标题不做全大写（`text-transform: none`），保持 sentence case

---

## 四、间距系统

基于 4px 基准格（Base-4 Grid）：

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

### 使用规则

| 场景 | 推荐值 |
|------|--------|
| 图标与文字间距 | `--space-2` (8px) |
| 列表项内边距（垂直） | `--space-2` ~ `--space-3` |
| 面板内边距 | `--space-4` ~ `--space-6` |
| 区块之间间距 | `--space-6` ~ `--space-8` |
| 侧边栏宽度 | 240px |
| 最小触控目标 | 32px（桌面端，非移动端） |

---

## 五、圆角与边框

```css
:root {
  --radius-sm:   4px;   /* 输入框、标签、代码 token */
  --radius-md:   6px;   /* 按钮、选项卡、小卡片 */
  --radius-lg:   8px;   /* 面板、下拉菜单 */
  --radius-xl:  12px;   /* 模态框、浮层 */
  --radius-full: 9999px; /* 药丸形、头像 */

  --border-width: 1px;
}
```

**规则**：
- 整体圆角倾向于**小而克制**，与专业工具感一致
- 同一层级内的元素圆角保持统一
- 禁止在有单侧边框的元素（如 `border-left` 高亮行）上设置 `border-radius`

---

## 六、阴影与层叠

```css
:root {
  /* 几乎不用阴影——用背景层级差异替代 */
  --shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md:  0 2px 8px rgba(0, 0, 0, 0.5);
  --shadow-lg:  0 8px 24px rgba(0, 0, 0, 0.6);

  /* Z-index 层叠 */
  --z-base:    0;
  --z-raised:  10;
  --z-overlay: 100;
  --z-modal:   200;
  --z-toast:   300;
  --z-tooltip: 400;
}
```

**规则**：
- 深色主题中，**优先用背景色层级来区分层次**，少用 box-shadow
- 阴影颜色只用黑色（rgba(0,0,0,...)），禁用彩色阴影

---

## 七、组件规范

### 7.1 按钮（Button）

```css
/* 主按钮 */
.btn-primary {
  background: var(--accent);
  color: var(--accent-fg);
  height: 32px;
  padding: 0 var(--space-4);
  font-size: var(--text-base);
  font-weight: 500;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}
.btn-primary:hover  { background: var(--accent-hover); }
.btn-primary:active { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

/* 幽灵按钮 */
.btn-ghost {
  background: transparent;
  color: var(--fg-secondary);
  height: 32px;
  padding: 0 var(--space-3);
  font-size: var(--text-base);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.btn-ghost:hover {
  background: var(--bg-elevated);
  color: var(--fg-primary);
  border-color: var(--border-strong);
}

/* 危险按钮 */
.btn-danger {
  background: transparent;
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
  /* ... 其余同 ghost */
}
.btn-danger:hover {
  background: var(--color-danger-subtle);
}

/* 图标按钮（无标签） */
.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--fg-tertiary);
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.btn-icon:hover {
  background: var(--bg-elevated);
  color: var(--fg-primary);
}
```

**尺寸规格**：

| 尺寸 | 高度 | 水平内边距 | 使用场景 |
|------|------|-----------|---------|
| sm   | 26px | 10px | 内联操作、标签栏 |
| md   | 32px | 14px | 默认（最常用） |
| lg   | 38px | 18px | 主要对话框操作 |

---

### 7.2 输入框（Input）

```css
.input {
  width: 100%;
  height: 32px;
  padding: 0 var(--space-3);
  background: var(--bg-surface);
  color: var(--fg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-family: var(--font-sans);
  outline: none;
  transition: border-color 0.15s;
}
.input::placeholder { color: var(--fg-tertiary); }
.input:hover  { border-color: var(--border-strong); }
.input:focus  { border-color: var(--accent); }
.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--bg-subtle);
}

/* 代码输入框 / 搜索框 */
.input-code {
  font-family: var(--font-mono);
  font-size: var(--text-code);
  background: var(--syntax-bg);
}
```

---

### 7.3 侧边栏（Sidebar）

```css
.sidebar {
  width: 240px;
  height: 100vh;
  background: var(--bg-subtle);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

/* 侧边栏导航项 */
.sidebar-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 32px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  margin: 1px var(--space-2);
  color: var(--fg-secondary);
  font-size: var(--text-base);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  user-select: none;
}
.sidebar-item:hover {
  background: var(--bg-elevated);
  color: var(--fg-primary);
}
.sidebar-item.active {
  background: var(--bg-overlay);
  color: var(--fg-primary);
  font-weight: 500;
}

/* 侧边栏分组标签 */
.sidebar-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--fg-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: var(--space-4) var(--space-4) var(--space-1);
}
```

---

### 7.4 代码块（Code Block）

```css
.code-block {
  background: var(--syntax-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: auto;
}

.code-block pre {
  margin: 0;
  padding: var(--space-4) var(--space-5);
  font-family: var(--font-mono);
  font-size: var(--text-code);
  line-height: 1.7;
  color: var(--fg-primary);
  white-space: pre;
}

/* 代码块顶栏 */
.code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}
.code-block-lang {
  font-size: var(--text-xs);
  color: var(--fg-tertiary);
  font-family: var(--font-mono);
}

/* 行号 */
.line-number {
  display: inline-block;
  width: 2.5ch;
  margin-right: var(--space-4);
  color: var(--fg-tertiary);
  text-align: right;
  user-select: none;
}
```

---

### 7.5 Diff 视图

```css
.diff-line {
  display: flex;
  align-items: stretch;
  min-height: 22px;
  font-family: var(--font-mono);
  font-size: var(--text-code);
  line-height: 1.7;
}

.diff-line.added   { background: var(--diff-add-bg); }
.diff-line.removed { background: var(--diff-del-bg); }

.diff-gutter {
  width: 2.5ch;
  padding: 0 var(--space-2);
  flex-shrink: 0;
  user-select: none;
  color: var(--fg-tertiary);
}
.diff-line.added   .diff-gutter { color: var(--color-success); border-left: 2px solid var(--diff-add-line); }
.diff-line.removed .diff-gutter { color: var(--color-danger);  border-left: 2px solid var(--diff-del-line); }
```

---

### 7.6 标签 / Badge

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 var(--space-2);
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
}

/* 变体 */
.badge-default  { background: var(--bg-elevated);  color: var(--fg-secondary); border-color: var(--border-default); }
.badge-success  { background: var(--color-success-subtle); color: var(--color-success); }
.badge-warning  { background: var(--color-warning-subtle); color: var(--color-warning); }
.badge-danger   { background: var(--color-danger-subtle);  color: var(--color-danger);  }
.badge-info     { background: var(--color-info-subtle);    color: var(--color-info);    }
.badge-accent   { background: var(--accent-subtle); color: var(--accent); }
```

---

### 7.7 Toast / 通知

```css
.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 280px;
  max-width: 400px;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-overlay);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-base);
  color: var(--fg-primary);

  /* 动画 */
  animation: toast-in 0.2s ease;
}
@keyframes toast-in {
  from { opacity: 0; transform: translateY(8px) scale(0.97); }
  to   { opacity: 1; transform: none; }
}
```

---

### 7.8 模态框（Modal）

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.modal {
  background: var(--bg-overlay);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  width: 480px;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 96px);
  overflow: hidden;
  display: flex;
  flex-direction: column;

  animation: modal-in 0.2s ease;
}
@keyframes modal-in {
  from { opacity: 0; transform: scale(0.96) translateY(4px); }
  to   { opacity: 1; transform: none; }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--fg-primary);
}

.modal-body {
  padding: var(--space-5) var(--space-6);
  flex: 1;
  overflow-y: auto;
  color: var(--fg-secondary);
  font-size: var(--text-base);
  line-height: 1.7;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--border-subtle);
}
```

---

## 八、布局结构

### 8.1 典型三栏布局

```
┌─────────────────────────────────────────────┐
│  titlebar (32px, macOS traffic light / win buttons) │
├──────────┬──────────────────────┬────────────┤
│          │                      │            │
│ sidebar  │    main content      │  detail /  │
│ 240px    │    flex: 1           │  inspector │
│          │                      │  280px     │
│          │                      │            │
└──────────┴──────────────────────┴────────────┘
│  statusbar (24px)                            │
└─────────────────────────────────────────────┘
```

```css
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-base);
  color: var(--fg-primary);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  -webkit-font-smoothing: antialiased;
}

.titlebar {
  height: 32px;                       /* macOS 拖拽区域 */
  flex-shrink: 0;
  -webkit-app-region: drag;           /* Electron 拖拽 */
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
}

.main-area {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.content-area {
  flex: 1;
  overflow: auto;
  background: var(--bg-surface);
}

.statusbar {
  height: 24px;
  flex-shrink: 0;
  background: var(--bg-subtle);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  gap: var(--space-4);
  font-size: var(--text-xs);
  color: var(--fg-tertiary);
}
```

---

## 九、图标

- 优先使用 **[Lucide](https://lucide.dev/)** 或 **[Phosphor](https://phosphoricons.com/)** 的 outline 风格
- 尺寸：`14px`（行内）/ `16px`（按钮）/ `20px`（导航）
- 颜色继承父元素（`color: inherit`），禁止给图标单独上色
- 禁止使用 emoji 代替图标

```tsx
// React 示例（Lucide）
import { GitBranch, Terminal, Settings } from "lucide-react"

<GitBranch size={16} />
```

---

## 十、动效

### 原则

- **功能性动效**：仅用于状态反馈（loading、展开/收起、提交成功）
- **时长**：短而干脆。`100ms`（即时反馈）/ `200ms`（过渡）/ `300ms`（上下文切换，上限）
- **缓动**：进入用 `ease-out`，退出用 `ease-in`，状态切换用 `ease-in-out`
- **禁止**：装饰性循环动画、视差效果、粒子系统

```css
:root {
  --duration-fast:   100ms;
  --duration-base:   200ms;
  --duration-slow:   300ms;
  --ease-in:         cubic-bezier(0.4, 0, 1, 1);
  --ease-out:        cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out:     cubic-bezier(0.4, 0, 0.2, 1);
}

/* 通用过渡 */
.transition-base {
  transition: background var(--duration-fast) var(--ease-in-out),
              color      var(--duration-fast) var(--ease-in-out),
              border-color var(--duration-fast) var(--ease-in-out),
              opacity    var(--duration-base) var(--ease-out);
}
```

### 减弱动效（无障碍）

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 十一、无障碍（A11y）

```css
/* 键盘聚焦环 */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
/* 用 :focus-visible 而非 :focus，避免鼠标点击时显示 */
:focus:not(:focus-visible) {
  outline: none;
}
```

- 文字与背景最低对比度：正文 ≥ **4.5:1**（WCAG AA），大号文字 ≥ **3:1**
- 所有图标按钮必须提供 `aria-label`
- 颜色不能是唯一信息载体（状态图标 + 颜色并用）
- 表单字段必须有关联的 `<label>`

---

## 十二、主题切换实现

```ts
// theme.ts
type Theme = "dark" | "light" | "system"

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    root.setAttribute("data-theme", prefersDark ? "dark" : "light")
  } else {
    root.setAttribute("data-theme", theme)
  }
  localStorage.setItem("theme", theme)
}

// 监听系统主题变化
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (localStorage.getItem("theme") === "system") {
    document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light")
  }
})
```

---

## 十三、Tailwind 配置（可选）

如果项目使用 Tailwind CSS：

```js
// tailwind.config.js
module.exports = {
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          base:     "var(--bg-base)",
          surface:  "var(--bg-surface)",
          elevated: "var(--bg-elevated)",
          overlay:  "var(--bg-overlay)",
          subtle:   "var(--bg-subtle)",
        },
        fg: {
          primary:   "var(--fg-primary)",
          secondary: "var(--fg-secondary)",
          tertiary:  "var(--fg-tertiary)",
        },
        border: {
          subtle:  "var(--border-subtle)",
          default: "var(--border-default)",
          strong:  "var(--border-strong)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover:   "var(--accent-hover)",
          subtle:  "var(--accent-subtle)",
          fg:      "var(--accent-fg)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
        xs:   ["11px", { lineHeight: "1.5" }],
        sm:   ["12px", { lineHeight: "1.6" }],
        base: ["13px", { lineHeight: "1.7" }],
        md:   ["14px", { lineHeight: "1.6" }],
        lg:   ["15px", { lineHeight: "1.5" }],
        xl:   ["17px", { lineHeight: "1.4" }],
        "2xl":["20px", { lineHeight: "1.3" }],
      },
      borderRadius: {
        sm:   "4px",
        md:   "6px",
        lg:   "8px",
        xl:   "12px",
      },
      spacing: {
        1: "4px",  2: "8px",  3: "12px", 4: "16px",
        5: "20px", 6: "24px", 8: "32px", 10: "40px",
        12: "48px", 16: "64px",
      },
      transitionDuration: {
        fast: "100ms",
        base: "200ms",
        slow: "300ms",
      },
    },
  },
}
```

---

## 十四、禁忌清单

以下设计模式**不符合**本风格，应严格避免：

| 禁止 | 原因 |
|------|------|
| 彩虹色渐变、霓虹辉光 | 过于浮夸，不符合专业工具定位 |
| `border-radius > 12px` 的大圆角卡片 | 卡通感，影响专业性 |
| `font-weight: 700` 的粗体标题 | 与整体低调风格冲突 |
| `font-size > 20px` 的大号正文 | 不适合信息密集的开发者工具 |
| `box-shadow` 彩色阴影 | 增加视觉噪音 |
| 全大写标题 (`text-transform: uppercase`) | 破坏可读性，过于强硬 |
| 大面积纯白 / 纯黑背景 | 缺乏层次感 |
| 无意义的循环动画（loading 除外） | 分散注意力 |
| 每个图标都上不同颜色 | 造成视觉噪音 |

---

*最后更新：2026-05*
