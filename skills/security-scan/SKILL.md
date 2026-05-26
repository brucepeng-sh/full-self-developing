---
name: security-scan
description: Scan your ThinkPHP 5.0 project for security vulnerabilities, misconfigurations, and injection risks.
origin: ECC (Adapted for ThinkPHP 5.0)
---

# Security Scan Skill

Audit your ThinkPHP 5.0 project for common security issues.

## When to Activate

- Setting up a new ThinkPHP project or environment
- After modifying `application/config.php` or `application/database.php`
- Before deploying to production
- Periodic security hygiene checks

## What It Scans

| Area Path | Checks |
|-----------|--------|
| `application/config.php` | `app_debug` setting, token configuration, cookie settings |
| `application/database.php` | Hardcoded database credentials |
| `application/` | Use of `whereRaw`, `Db::query`, or direct interpolation |
| `thinkphp/VERSION` | Check for vulnerable ThinkPHP versions (below 5.0.24) |
| `.env` | Proper environment variable configuration |
| `public/` | Sensitive file exposure in the web root |

## Usage

### ThinkPHP 5.0 Core Version Check
Check if the ThinkPHP core is up to date:
```bash
grep "'VERSION'" thinkphp/base.php
```

### Config Scan
Check `app_debug` state:
```bash
grep "'app_debug'" application/config.php
```

### Database Credential Check
Scan for potential hardcoded credentials:
```bash
grep -C 5 "'password'" application/database.php
```

### SQL Injection Scan
Scan for potentially dangerous raw queries:
```bash
grep -r "whereRaw" application/
grep -r "Db::query" application/
```

## Severity Levels

| Grade | Meaning |
|-------|---------|
| Critical | RCE via vulnerable ThinkPHP version, Hardcoded production DB password |
| High | Debug mode enabled in production, SQLi through unparameterized raw queries |
| Medium | Missing CSRF tokens in forms, Weak cookie settings |
| Info | Missing file upload validation, Predicted filenames |

## Links

- **ThinkPHP 5.0 Core Security Patch**: [Official ThinkPHP site](https://www.thinkphp.cn/)
- **PHP Security Guide**: [OWASP PHP Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/PHP_Configuration_Cheat_Sheet.html)
