# UI Spec — 项目名

然后在 Spec 里写："只允许使用 theme 中定义的 token，禁止 hardcode 颜色值"。C:\asitela\full-self-developing\tailwind.config.js

## 设计系统
### 颜色
- 主色: `#1A56DB`
- 背景: `#F9FAFB`
- 文字主色: `#111827`
- 文字次要: `#6B7280`

### 字体
- 标题: `Inter 600, 24px`
- 正文: `Inter 400, 14px, line-height 1.5`

### 圆角 / 间距
- 卡片圆角: `8px`
- 按钮: `rounded-md, px-4 py-2`
- 间距单位: `4px base (Tailwind: gap-4 = 16px)`

## 组件规范

### Button (Primary)
- 背景: `#1A56DB`, hover: `#1E429F`
- 字色: white, 字重: 500
- 尺寸: `h-9 px-4 text-sm`
- 禁用态: `opacity-50 cursor-not-allowed`

### Card
- 背景: white
- 阴影: `shadow-sm`
- 边框: `1px solid #E5E7EB`
- Padding: `p-6`

## 页面结构

### App Shell 布局
- 整体架构: Tailwind Application Shell (`flex h-screen overflow-hidden bg-white dark:bg-zinc-950`)
- 左侧 Sidebar: 固定宽度 256px (`w-64`), 采用 `flex-col`, `shrink-0` 及自适应滚动
- 主内容区: 伸缩自适应 (`flex-1 min-w-0`), 内部采用 Grid 或者 Flex 自行管理内部布局


## 已有组件清单（不要重新实现）

| 组件         | 文件路径                        | 用途         |
|--------------|-------------------------------|--------------|
| Button       | components/ui/Button.tsx       | 所有按钮     |
| Modal        | components/ui/Modal.tsx        | 弹窗         |
| DataTable    | components/DataTable.tsx       | 数据表格     |


## Review Checklist
- [ ] 颜色全部来自设计 token
- [ ] 没有 hardcode 的 px 值（用 Tailwind 类）
- [ ] 响应式断点符合规范
- [ ] 复用了已有组件，没有新建重复组件
- [ ] 字号、字重与规范一致