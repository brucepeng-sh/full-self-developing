---
name: php-security
description: PHP and ThinkPHP 5.0 security best practices, including common vulnerabilities (RCE, SQLi, XSS) and hardening.
origin: ECC (Adapted for ThinkPHP 5.0)
---

# PHP/ThinkPHP Security Best Practices

Comprehensive security guidance for ThinkPHP 5.0 applications to protect against common vulnerabilities.

## Common ThinkPHP 5.0 Vulnerabilities

### 1. Remote Code Execution (RCE)
ThinkPHP 5.x has historically been vulnerable to RCE through controller/method manipulation in the URL.
- **Fix**: Ensure you are on ThinkPHP **5.0.24** or higher.
- **Check**: Look at `thinkphp/base.php` or `thinkphp/VERSION` for version information.

### 2. SQL Injection
Even with Query Builder, improper use of `whereRaw` or direct `Db::query` can lead to SQLi.
- **Best Practice**: Always use parameter binding or standard Query Builder methods (`where(['id' => $id])`).
- **Avoid**: `Db::query("SELECT * FROM users WHERE id = $id")` (Direct interpolation).

### 3. Debug Mode Leakage
Leaving `app_debug` set to `true` in production exposes stack traces and environment variables.
- **Setting**: `application/config.php` -> `'app_debug' => false`.

## Core Security Hardening

### Input Validation
Always use the `Validate` class for all user-provided data.
- **Example**:
```php
$rule = [
    'id'  => 'require|number',
    'name' => 'require|max:25',
];
$data = ['id' => 1, 'name' => 'thinkphp'];
$validate = new \think\Validate($rule);
if (!$validate->check($data)) {
    dump($validate->getError());
}
```

### XSS Prevention
Sanitize all user-generated content before rendering.
- Use `htmlspecialchars()` or ThinkPHP's `input('param', '', 'filter')` helper.
- **Blade/Templates**: Ensure output is escaped.

### CSRF Protection
ThinkPHP 5.0 includes a token mechanism for form submission.
- **Usage**: Use `token()` in forms and verify in the controller.

## Secrets and Credentials
- Never hardcode database credentials in `application/database.php`. Use environment variables or a `.env` file if supported.
- Ensure `runtime/` and `file/` directories are not publicly accessible via the web server.

## File Upload Safety
- Validate MIME type, extension, and file size.
- Store uploads outside the web root if possible.
- Avoid using predictable filenames.
```php
$file = request()->file('image');
$info = $file->validate(['size'=>15678,'ext'=>'jpg,png,gif'])->move(ROOT_PATH . 'public' . DS . 'uploads');
```

## Success Metrics
- No hardcoded secrets in the codebase.
- `app_debug` is disabled in production.
- All database queries use parameter binding.
- All user inputs are validated.
