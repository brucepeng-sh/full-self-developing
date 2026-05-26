# FSD — Full Self-Developing

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Engine: Gemini/AtomCode/OpenRouter](https://img.shields.io/badge/Engine-Configurable-blue.svg)](#)

[中文版](README_zh.md)

> **Directly drive authorized local CLIs for seamless coding and chat; designed specifically for legacy and under-resourced projects, providing closed-loop fully autonomous iteration and intelligent auto-fixing capabilities.**

FSD (Full Self-Developing) is a **highly aesthetic, zero-login, fully local graphical Agent console** built for developers and project maintainers. It interfaces directly with your pre-authorized local CLI environments to provide a secure, controllable autonomous programming loop.

---

## 🌟 Core Advantages & Killer Features

### 1. Direct Local Authorized CLI Driving, Zero-Config Out-of-the-Box
*   **No API Key Configuration Required**: Directly bind and invoke command-line tools that are already logged in and authorized on your local machine (such as `gemini-cli`, `atomcode-cli`, etc.). The system automatically inherits security credentials from your local terminal, eliminating tedious web logins and the risk of API Key leakage.
*   **Interactive Prompt Interception & Approval**: When executing high-risk system commands, creating/modifying files, or installing third-party dependencies, FSD intercepts confirmation requests in real-time and presents them via a graphical pop-up (Approval Modal) for one-click approval or rejection.

### 2. Fully Autonomous Programming (FSD Loop) — Salvaging Legacy & Under-Resourced Projects
For legacy codebases, open-source libraries short on maintainers, or projects requiring large-scale refactoring, FSD offers a **fully autonomous development and troubleshooting loop**:
*   **Autonomous Task Loop**: Starting from a high-level task goal, FSD automatically conducts "Architecture Analysis -> Plan Design -> Code Modification -> Compile & Run -> Error Diagnosis -> Iterative Bug Fixing" until the task is successfully delivered.
*   **Adaptive Compilation & Diagnosis**: Upon encountering compiler/syntax errors, TypeScript validation failures, or lint issues, FSD autonomously writes lightweight debugging scripts, captures stdout/stderr from the console, and automatically maps issues to corresponding source code lines for corrections.
*   **Multi-Tier Safety Operation Modes**:
    *   `Plan` (Read-only planning mode): Only generates modification plans and paths, never touches physical files. Ideal for initial auditing.
    *   `Default` (High-safety mode): All file modifications and command executions require manual approval, ensuring 100% control.
    *   `Auto_Edit` (Semi-autonomous mode): Code edits are written directly, but shell command executions still require approval, offering the optimal balance between speed and security.
    *   `YOLO` (Fully autonomous mode): Run completely autonomously. The agent makes all decisions—ideal for rapid iteration within sandbox/container environments.

### 3. Hot-Pluggable Workspace Skills
*   **Pure Markdown Driven**: Simply write a description in the workspace's `skills/<skill_id>/SKILL.md` to automatically load it.
*   **Domain Knowledge Injection**: You can tailor custom code conventions (e.g., CSS writing style, API call constraints, Git commit message rules) specifically for your project. Once toggled ON, the skill's instructions are parsed and injected as System Prompt Enhancements into every agent execution.

### 4. Deep Integration with MCP (Model Context Protocol)
*   **Universal Tool Extension**: Built-in MCP client manager (based on Standard JSON-RPC) that supports mounting any standard MCP service.
*   **Break Browser Sandbox Limits**: By connecting services like `chrome-devtools-mcp`, the agent gains the ability to operate real browsers, inspect DOM elements, run Lighthouse audits, scrape web page content, and seamlessly participate in front-end debug sessions.

### 5. Premium Visuals & Real-Time Monitoring
*   **Beautiful UI**: Designed with carefully tuned HSL dark/light dual themes, smooth micro-interactions, dynamic glassmorphism cards, and monospace typography tailored for immersive development.
*   **Token Resource Gauges**: Visually represents current context window usage and remaining headroom, preventing context overflow proactively.
*   **SSE Real-Time Streaming**: Delivers millisecond-level responsiveness for chat bubbles and task logs using Server-Sent Events.

---

## 🛠️ Project Structure

```text
full-self-developing/
├── client/             # Frontend React SPA (built with Vite)
│   ├── src/            # UI components (ChatPanel, LoopPanel, SettingsPanel, etc.)
│   ├── index.css       # Tailwind CSS & global design system tokens
│   └── package.json    # Frontend dependencies
├── agents/             # Agent engine definitions, task queue, and prompt managers
├── queue/              # Local persistent storage for task queue
├── skills/             # Local hot-pluggable skills folder
├── server.js           # Backend Express API service (running on port 8033)
├── launcher.js         # Security token generation and server bootstrap script
└── start.bat           # Windows one-click startup script (nodemon + Vite dev)
```

---

## 🚀 Quick Start

### 1. Install Dependencies

Run the following in the project root directory:
```bash
npm install
```

### 2. Startup (Local Development)

FSD provides a one-click startup script `start.bat`, which starts the Express API backend (port `8033`) and the Vite frontend dev server (port `5173`) concurrently, complete with hot-reloading:

*   **Windows Users**: Double-click `start.bat` or run:
    ```bash
    .\start.bat
    ```
*   **Other Platforms**:
    ```bash
    node launcher.js
    ```

Once started, the browser will automatically open `http://localhost:5173/`. A random high-entropy authorization token is generated on startup and injected into the browser's `localStorage` for API authorization.

---

## 💡 Legacy Project Autonomous Iteration Guide

For historical or under-resourced projects, the following iteration workflow is recommended:

1.  **Mount Workspace**: Use the directory selector in the FSD top navigation bar to locate the root directory of your legacy project.
2.  **Set Safety Level to `Auto_Edit`**: Allow the agent to modify code directly to resolve bugs, while intercepting command executions to prevent unwanted scripts from running.
3.  **Create an FSD Task**: Input a clear target in the Loop panel (e.g., `"Upgrade all React Router v5 APIs in the project to v6, and fix any related TypeScript compilation issues."`).
4.  **Review Diffs in Real-Time**: Use the **File Changes** tab in FSD to inspect all code alterations side-by-side as the agent modifies them.
5.  **Commit Your Changes**: Once compilation and testing pass, commit your changes using Git in your terminal.

---

## ⚙️ Core Settings Configuration

Configure the following options under the **Settings** panel:
*   **Engine Selector**: Toggle the active local execution engine (supports `Gemini CLI`, `AtomCode CLI`, or custom API endpoints like `OpenRouter`).
*   **Model Config**: Customize active LLM models and parameters.
*   **MCP Servers**: Dynamically add/remove MCP servers with custom startup command lines.
*   **Workspace Skills**: Instantly toggle scanned workspace skills.

---

*FSD — Full Self-Developing. Build the future, driven by you and AI.*
