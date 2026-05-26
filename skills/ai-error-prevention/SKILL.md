---
name: ai-error-prevention
description: Log of AI development errors and prevention strategies for TheOMS (ThinkPHP 5.0)
version: 1.0.0
---

# AI Error Prevention Log

This document tracks common mistakes made by AI coding assistants in this repository to prevent regression and ensure code quality.

## 1. View & Template Errors (ThinkPHP 5.0)

### 1.1 Missing Template Extension Tags
- **Error**: Creating or refactoring a view file (e.g., `achieve.html`) but forgetting to include `{extend name="..." /}` and `{block name="..."}`.
- **Consequence**: The page renders as a standalone HTML fragment without CSS, JS libraries (Vue, Element Plus), or layout, often leading to a blank screen or a "Template error".
- **Prevention**: 
    - Always check if the view should extend a base layout (e.g., `main/vue3`).
    - Ensure all content is wrapped in the correct `{block}` (usually `head` or `main`).
    - Verify that every `{block}` has a corresponding `{/block}`.

### 1.2 Vue 3 `.native` Modifier
- **Error**: Using `@keyup.enter.native` or similar `.native` modifiers in Vue 3 templates.
- **Consequence**: In Vue 3, `.native` was removed. It may cause event listeners to fail or warnings in the console.
- **Prevention**: Use standard `@keyup.enter` or the appropriate event names for Element Plus components.

## 2. Controller & Logic Errors

### 2.1 Missing Input Validation
- **Error**: Directly using `input('post.')` without passing it through a ThinkPHP `Validate` class.
- **Consequence**: Security vulnerabilities (SQLi, XSS) and data corruption.
- **Prevention**: 
    - Always use `application/common/validate` classes.
    - Call `$this->validate($input, 'ValidateClassName.scene')` in controllers.

### 2.2 N+1 Query Issues
- **Error**: Placing database queries (`db()->where()->find()`) inside a `foreach` loop.
- **Consequence**: Severe performance degradation when processing large datasets.
- **Prevention**: 
    - Use ORM associations (`hasOne`, `belongsTo`) and eager loading via `with()`.
    - Batch fetch data using `whereIn` before the loop.

### 2.3 Token Header/Cookie Mismatch
- **Error**: Frontend sends `Authorization: Bearer <token>` while backend token validation expects the raw token string, and backend gives the header priority over a valid `admin_token` cookie.
- **Consequence**: Browser pages can successfully load with the cookie, then API calls return `code:401`; frontend removes `localStorage.admin_token` and redirects to `/`, which may 302 back to `main.html`.
- **Prevention**:
    - Normalize `Authorization` headers by stripping the `Bearer ` prefix before validation.
    - Keep cookie auth as a fallback when a header token fails validation.
    - Add regression tests for both Bearer header parsing and cookie fallback behavior.

### 2.4 Refactoring Data Types (JSON string to Array)
- **Error**: Refactoring a service method (e.g., `RankService::getRankInfo`) to return a decoded array internally, but forgetting to remove `json_decode()` wrappers at all controller call sites.
- **Consequence**: Throws `ErrorException: json_decode() expects parameter 1 to be string, array given`, leading to API 500 errors.
- **Prevention**:
    - When changing a method's return type (e.g., from JSON string to Array), perform a global search (`grep`) for all callers of that method.
    - Inspect each caller to see if they apply string-specific operations (like `json_decode`) to the returned value and update them synchronously.

## 3. Database & Migration Errors

### 3.1 Field Name Mismatch (JSON Refactoring)
- **Error**: Updating frontend components to use new JSON fields (e.g., `rule_config`) but forgetting to update the backend saving logic, or vice versa.
- **Consequence**: Data loss or "Undefined index" errors in PHP.
- **Prevention**: 
    - Ensure `syn_sql` helper only filters fields that actually exist in the table.
    - Keep legacy fields as "read-only backups" if necessary during migration.

### 3.2 ThinkPHP 5.0 Query Builder `where` Cleared After `count()`
- **Error**: Reusing the same `$query` builder instance to execute a `count()` query and then a paginated `select()` query.
- **Consequence**: In ThinkPHP 5.0, executing `count()` on a query object automatically **clears** its compiled `where` conditions. Subsequent `select()` calls will run without any filter constraints, returning all rows from the table.
- **Prevention**:
    - **Separate Query Instances**: Always query count and page select separately.
      ```php
      $count = Model::where($sql)->count();
      if ($count) {
          $list = Model::with(['relation'])->where($sql)->page($page, $limit)->select();
      }
      ```
    - **Eager Loading**: Never eager load relations (`with()`) on the `count()` query itself. Separating the count query also improves query performance since the database doesn't need to join tables or evaluate relations just to count rows.

## 4. Mini-Program & Cross-Platform Errors

### 4.1 Global Variable Scope
- **Error**: Assuming `getApp()` or `this.data` in mini-programs (wxapp) behaves exactly like React/Vue state.
- **Consequence**: Data synchronization issues or crashes in specific mini-program versions.
- **Prevention**: 
    - Always use `this.setData()` for UI updates.
    - Validate `app.globalData` existence before access.

### 4.2 Path Case Sensitivity
- **Error**: Referencing files or components with incorrect case (e.g., `store/Achieve` vs `store/achieve`).
- **Consequence**: Works on Windows (case-insensitive) but fails on Linux servers.
- **Prevention**: Always use lowercase for file and directory names in the project.

## 5. Coding Style & Standard Regressions

### 5.1 Mixed PSR Standards
- **Error**: Writing camelCase for variables while the rest of the file uses snake_case, or vice-versa.
- **Consequence**: Poor readability and linting failures.
- **Prevention**: Check surrounding code style before adding new variables or functions. For TheOMS, PHP uses snake_case for local variables and camelCase for modern service methods.

---

## How to use this Skill
1. **Before starting a task**: Review the "Common Errors" section to identify relevant risks.
2. **During development**: Check if your proposed changes follow the "Prevention" guidelines.
3. **After fixing a bug**: If the bug was caused by an AI-generated mistake, record it here following the existing format.
