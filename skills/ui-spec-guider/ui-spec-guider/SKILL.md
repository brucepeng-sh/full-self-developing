---
name: ui-spec-guider
description: Enforces project UI specifications for frontend development. Use this skill WHENEVER the user requests to build or modify frontend UI components (e.g., "build a button", "create a dashboard"). It reformats the request to explicitly require adherence to the UI_SPEC.md.
---

# UI Spec Guider

## Overview

This skill ensures that any frontend UI development requests strictly adhere to the project's design system defined in `UI_SPEC.md`. When the user asks to create or modify a UI element, this skill intercepts the requirement and rewrites it to explicitly reference the relevant UI specifications before execution.

## Core Rules

When you receive a frontend development request from the user (e.g., "帮我做一个按钮" or "添加一个卡片组件"), you MUST execute the following workflow:

### 1. Read the UI Spec
Always read the contents of `UI_SPEC.md` in the workspace root to understand the current design system (colors, typography, component specs, page structures).

### 2. Rewrite the Requirement
Internally rewrite the user's request to explicitly reference the `UI_SPEC.md` specification. 
- Expand generic requests ("做一个按钮") into specific design requirements based on `UI_SPEC.md` ("按照 UI_SPEC.md 的 Button Primary 规范...").
- Example: Change "帮我做一个按钮" to "按照 UI_SPEC.md 的 Button Primary 规范，实现一个加载状态的按钮".

### 3. Execute with Strict Adherence
Implement the component strictly following the colors, padding, fonts, and interaction states defined in the specification. 
- DO NOT invent arbitrary Tailwind classes or colors that violate `UI_SPEC.md`.
- NEVER use arbitrary Tailwind colors (like `bg-blue-500`) if a specific hex code or rule is provided in `UI_SPEC.md` (e.g., `#1A56DB`).

## Example Transformations

**Example 1: Button Implementation**
- *User Input*: "帮我写一个卡片组件"
- *Skill Transformation*: "按照 UI_SPEC.md 的 Card 规范（白色背景、shadow-sm、E5E7EB 边框、p-6 padding），实现一个卡片组件"

**Example 2: Page Layout**
- *User Input*: "实现 Dashboard 页面"
- *Skill Transformation*: "按照 UI_SPEC.md 的 Dashboard 页页面结构（左侧 Sidebar 240px，顶部 Header 56px sticky，主内容区 max-w-5xl），实现 Dashboard 页面结构"
