---
name: error-prevention
description: 用于记录 TheOMS 项目中的典型错误、框架陷阱及预防方案，任何参与开发的 AI 工具均需遵守。
---

# Error Prevention Skill (错误预防指南)

本技能库记录了在 TheOMS（ThinkPHP 5.0）开发过程中遇到的典型 Bug、反模式和框架陷阱。**任何参与本项目的 AI 协作工具或智能体，在编写/修改代码前必须参考此库，以避免重复历史错误。**

## 协作工作流
- **发现即记录**：在任何对话过程中，如果发现了新的框架陷阱、逻辑缺陷或配置错误，在问题彻底解决并验证通过后，**必须**将该案例补充到本指南中。
- **定期审计**：通过 `/code-review` 或专项审计，检查现有代码是否违反了本指南记录的预防方案。

## 核心原则
- **约定优于配置**：优先使用框架默认行为（如类名到表名的自动映射），除非有极特殊的理由。
- **全局作用域**：核心鉴权和基础工具函数应放在全局文件（如 `system_func.php`），以支持跨模块调用。

## 错误记录与预防

### 1. ThinkPHP 5.0 模型表前缀丢失 (Table Prefix Loss)

- **现象**：在配置文件设置了 `DB_PREFIX=is_` 的情况下，执行 SQL 时依然报错 `Base table or view not found`，显示的表名不带 `is_` 前缀。
- **根源**：在 Model 类中显式定义了 `protected $table = 'xxx';`。在 ThinkPHP 5.0 中，`$table` 代表**完整表名**（包含前缀），设置后框架将不再自动添加配置的前缀。
- **后果**：导致跨环境（不同前缀）或标准配置下的数据库连接失败。
- **预防方案**：
  - **不要设置 `$table`**：只要类名符合蛇形命名法（如 `NewProjectThird` 对应 `new_project_third`），框架会自动处理。
  - **使用 `$name`**：如果必须指定，请使用 `protected $name = 'xxx';`，框架会在此基础上自动补全前缀。
- **错误示例**：
  ```php
  class NewProjectThird extends Model {
      protected $table = 'new_project_third'; // 错误：会导致丢失 is_ 前缀
  }
  ```
- **正确示例**：
  ```php
  class NewProjectThird extends Model {
      // 推荐：直接留空，依靠框架自动映射
  }
  ```

### 2. 跨模块调用导致的函数未定义 (Undefined Function in Cross-Module Inheritance)

- **现象**：当 `api` 模块的控制器继承 `index` 模块的基类（如 `Acl`）时，报错 `Call to undefined function checklogin()`。
- **根源**：ThinkPHP 5.0 的模块函数库（`application/module/common.php`）是按需加载的。处于 `api` 模块上下文时，`index` 模块的 `common.php` 不会被加载。
- **后果**：导致继承自其他模块基类的控制器在执行初始化或鉴权时崩溃。
- **预防方案**：
  - **迁移至全局**：将核心鉴权（`checklogin`）、用户信息（`user_info`）、系统配置（`get_sys_merchant`）等函数从模块私有文件迁移至 `application/system_func.php` 或 `application/common.php`。
  - **显式调用**：在基类中调用全局函数时，建议加上反斜杠，如 `\checklogin()`。

### 3. ThinkPHP 5.0 查询构造器 where 条件在 count() 后丢失 (Query Builder Where Cleared After count())

- **现象**：分页查询列表时，总记录数 (`count`) 筛选正确，但实际返回的数据列表中包含了全表数据（包含无关客户），过滤条件在列表查询中失效。
- **根源**：在 ThinkPHP 5.0 中，如果共用同一个 Model Query 对象实例先执行 `$query->count()` 后再执行 `$query->select()`，查询构造器内部在执行 `count()` 完毕后，会**自动清除 (clear) 已绑定的 `where` 限制条件**。这导致后续的 `select()` 在没有 `where` 限制的情况下执行，从而返回了全表数据。
- **后果**：分页列表的搜索过滤功能失效，并且还会因为返回过多无用数据给前端导致系统性能下降。
- **预防方案**：
  - **Query 实例分离**：将 `count()` 和 `select()` 的 Query 构造过程完全分离开。
    * 数量查询：`$count = \app\index\model\SomeModel::where($sql)->count();` （注意：不需要在此步挂载关系 `with`，以提升查询性能）
    * 列表查询：`$list = \app\index\model\SomeModel::with([...])->where($sql)->page($page, $limit)->select();`
  - **避免重用实例**：永远不要为了省事共用一个 `$query` 变量去先后调用 `count()` 和 `select()`，除非在执行 `count()` 时使用了 `(clone $query)->count()` 克隆对象。

---
