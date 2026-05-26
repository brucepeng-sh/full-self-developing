# FSD — Full Self-Developing (全自主开发助手)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Engine: Gemini/AtomCode/OpenRouter](https://img.shields.io/badge/Engine-Configurable-blue.svg)](#)

[English](README.md)

> **直接驱动本地已授权 CLI 进行无缝编程与聊天；专为老旧及缺乏维护资源的项目设计，提供闭环全自动迭代与智能修复能力。**

FSD (Full Self-Developing) 是一个专为开发者和项目维护者打造的**高颜值、零登录、完全运行在本地的图形化 Agent 控制台**。它能够直接对接您本地已经预授权的 CLI 环境，并提供安全可控的自主循环编程体验。

---

## 🌟 核心优势与杀手级特性

### 1. 直接驱动本地已授权 CLI，零配置开箱即用
*   **无需配置 API Key**：直接绑定并调用本地已经登录 and 授权的命令行工具（如 `gemini-cli`、`atomcode-cli` 等）。系统自动继承您本地终端的安全凭证，免去了繁琐的 Web 登录及 API Key 密钥泄露风险。
*   **交互式 Prompt 拦截与确认**：在执行高风险系统命令、文件创建/修改或第三方依赖安装时，FSD 会实时拦截 CLI 内部的确认请求，并以图形化弹窗（Approval Modal）的形式呈现，供您一键批准或驳回。

### 2. 全自动编程 (FSD 循环) —— 拯救老旧与缺乏资源维护的项目
对于许多疏于维护的历史遗留项目、缺乏人手的开源库、或是需要大批量重构的代码库，FSD 能够提供**全自主的开发与纠错闭环**：
*   **自主任务循环**：从输入一个高层级的任务目标开始，FSD 会自动进行“架构分析 -> 方案设计 -> 代码修改 -> 编译运行 -> 报错诊断 -> 迭代修复”，直至任务完全交付。
*   **自适应编译与诊断**：当遇到代码报错、TypeScript 类型校验未通过或 lint 错误时，FSD 能够自主编写轻量级调试脚本，抓取控制台 stdout/stderr，并自动定位到源码关联行进行修正。
*   **多级安全运行模式**：
    *   `Plan` (只读规划模式)：仅生成修改方案与路径，绝不修改物理文件，适合初步审计。
    *   `Default` (高安全模式)：所有的文件写入和命令执行均需人工确认批准，确保 100% 掌控。
    *   `Auto_Edit` (半自动模式)：代码编辑直接写入，但任何 Shell 命令执行均需点击确认，在效率与安全间取得最佳平衡。
    *   `YOLO` (全自主模式)：闭眼狂奔，完全交由 Agent 自主决策，适合在沙箱/容器中快速迭代。

### 3. 热插拔的工作区技能系统 (Workspace Skills)
*   **纯 Markdown 驱动**：只需在当前工作区的 `skills/<skill_id>/SKILL.md` 中编写说明，系统即可自动加载。
*   **领域知识注入**：你可以为项目量身定制专有的代码规范（如 CSS 书写风格、API 调用约束、Git Commit 提交规范等）。技能开启（Toggle ON）后，其指令会被自动解析并作为系统增强提示词（System Prompt Enhancement）注入到每次 Agent 调度中。

### 4. 深度整合 MCP (Model Context Protocol) 协议
*   **通用工具扩展**：内置 MCP 客户端管理器（基于 Standard JSON-RPC），支持挂载任意标准 MCP 服务。
*   **打破浏览器沙箱限制**：通过连接 `chrome-devtools-mcp` 等服务，使 Agent 具备了操作真实浏览器、检查前端 DOM、运行 Lighthouse 性能审计、爬取网页并无缝参与前端联合调试的能力。

### 5. 极致的视觉表现与实时监控
*   **高颜值界面**：采用精心调校的 HSL 暗黑/明亮双主题，拥有流畅的微交互、动态玻璃拟态（Glassmorphism）卡片与专为沉浸式开发设计的等宽字体排版。
*   **Token 资源量规**：界面直观呈现当前大模型 Context Window 的消耗状态与剩余 Headroom，防患上下文溢出于未然。
*   **SSE 实时流式响应**：基于 Server-Sent Events 实现毫秒级响应的聊天气泡与任务日志流。

---

## 🛠️ 项目结构

```text
full-self-developing/
├── client/             # 前端 React SPA 应用 (Vite 构建)
│   ├── src/            # 页面组件 (ChatPanel, LoopPanel, SettingsPanel 等)
│   ├── index.css       # Tailwind CSS & 全局设计系统 Token
│   └── package.json    # 前端依赖
├── agents/             # 智能体引擎定义、任务队列与 Prompt 管理器
├── queue/              # 任务队列本地持久化存储
├── skills/             # 本地可热插拔的技能库文件夹
├── server.js           # 后端 Express API 服务 (纯 API 模式运行在 8033 端口)
├── launcher.js         # 安全令牌生成与服务器引导脚本
└── start.bat           # Windows 一键并发启动脚本 (nodemon + Vite dev)
```

---

## 🚀 快速开始

### 1. 安装依赖

在项目根目录下执行：
```bash
npm install
```

### 2. 一键启动 (本地开发环境)

FSD 配备了 `start.bat` 一键启动脚本，它会同时拉起后端的 Express API 服务（端口 `8033`）和前端的 Vite 调试服务（端口 `5173`），并启用热重载：

*   **Windows 用户**：双击运行 `start.bat` 或在终端运行：
    ```bash
    .\start.bat
    ```
*   **其他平台用户**：
    ```bash
    node launcher.js
    ```

启动成功后，浏览器会自动打开 `http://localhost:5173/`。系统在启动时会随机生成一个高强度的安全授权 Token，并自动注入到浏览器 `localStorage` 中用于接口鉴权。

---

## 💡 老旧项目自动化迭代实战指南

对于资源匮乏或无人维护的历史项目，推荐采用以下工作流进行迭代：

1.  **挂载工作区**：在 FSD 顶部栏的目录选择器中，定位到你需要改造的历史项目根目录。
2.  **设定安全等级为 `Auto_Edit`**：允许 Agent 自动改写代码以快速修复 Bug，但拦截执行命令，防止其运行未知的清理或变动脚本。
3.  **新建 FSD 任务**：在 Loop 面板输入明确的修复目标（例如：`“将项目内所有的 react-router v5 路由 API 升级到 v6，并解决相关的 TypeScript 编译报错”`）。
4.  **实时审查 Diff**：通过 FSD UI 的 **File Changes** 面板，以 side-by-side 双栏比对视图实时直观地审查 Agent 自动改写的每一行代码。
5.  **一键提交**：确认编译和测试通过后，即可在本地终端放心执行 Git Commit。

---

## ⚙️ 核心配置说明

通过界面的 **Settings** 面板，您可以轻松配置以下内容：
*   **Engine Selector**：切换本地执行引擎（支持 `Gemini CLI`、`AtomCode CLI` 或通用 API 转发如 `OpenRouter`）。
*   **Model Config**：自定义当前运行的大语言模型与参数。
*   **MCP Servers**：热添加或移除 MCP 服务器（支持自定义启动命令行与参数）。
*   **Workspace Skills**：一键开关工作区中被扫描出来的特定技能。

---

*FSD — Full Self-Developing. 构建未来，由您和 AI 共同主导。*
