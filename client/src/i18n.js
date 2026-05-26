import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      settings: {
        search: "Search settings...",
        general: "GENERAL",
        agentCapabilities: "AGENT & CAPABILITIES",
        system: "SYSTEM",
        tabs: {
          ui: "UI",
          fsd: "FSD",
          memory: "Memory",
          safety: "Safety",
          ai: "AI",
          mcp: "MCP Servers",
          skills: "Skills",
          integrations: "Integrations",
          advanced: "Advanced"
        },
        ai: {
          title: "AI Configuration",
          description: "Configure AI models, providers, and advanced parameters.",
          provider: "API Provider",
          apiKey: "API Key",
          baseUrl: "Base URL",
          testConnection: "Test Connection",
          driver: "AI Driver",
          model: "Main Model",
          executionMode: "Execution Mode",
          cliBinaryPath: "CLI Binary Path",
          visionModel: "Vision Model",
          embeddingModel: "Embedding Model",
          maxOutputTokens: "Max Output Tokens",
          advancedOptions: "Advanced Options",
          temperature: "Temperature",
          contextBudget: "Context Budget",
          systemPrompt: "System Prompt",
          selectModel: "Select Model"
        },
        ui: {
          title: "UI Preferences",
          description: "Customize appearance and localization.",
          theme: "Theme",
          language: "Language"
        },
        fsd: {
          title: "FSD Engine",
          description: "Core parameters for the FSD development platform.",
          reviewRounds: "Review Rounds",
          concurrency: "Concurrency",
          manualConfirm: "Manual Confirm",
          taskPriority: "Task Priority",
          autoRunTests: "Auto run tests",
          requireApproval: "Require approval",
          ignoredPaths: "Ignored Paths"
        },
        memory: {
          title: "Memory",
          description: "Manage system memory and context retention.",
          enabled: "Memory enabled",
          enabledDesc: "Allow FSD to save project preferences and decisions",
          compression: "Compression",
          compressionDesc: "Automatically compress outdated memories",
          dedupeThreshold: "Dedupe threshold",
          dedupeThresholdDesc: "Threshold for merging similar memories"
        },
        safety: {
          title: "Safety",
          description: "Confirmation and access controls for risky operations.",
          confirmDestructive: "Confirm destructive commands",
          confirmDestructiveDesc: "Request confirmation before delete, reset, or overwrite",
          confirmStopAll: "Confirm stop all",
          confirmStopAllDesc: "Double confirm before stopping all tasks",
          networkAccess: "Network access",
          networkAccessDesc: "Allow tasks to access external documentation and package repos",
          externalUrlAccess: "External URL access",
          externalUrlAccessDesc: "Allow visiting external web pages"
        },
        mcp: {
          title: "MCP Servers",
          description: "Manage Model Context Protocol servers.",
          addServer: "Add Server",
          emptyTitle: "No MCP Servers connected",
          emptyDesc: "Add a server to enhance AI capabilities."
        },
        skills: {
          title: "Skills",
          description: "Manage local and built-in skills.",
          addSkill: "Add / Import Skill",
          emptyTitle: "Enhance AI with new Skills",
          emptyDesc: "Import skills via URL or drag and drop files."
        },
        integrations: {
          title: "Integrations",
          description: "External services and plugins.",
          engine: "Engine",
          proxy: "Proxy",
          proxyReload: "Reload Proxy"
        },
        advanced: {
          title: "Advanced",
          description: "System-level advanced and maintenance settings.",
          logLevel: "Log Level",
          telemetry: "Telemetry",
          exportImport: "Export / Import Settings",
          exportBtn: "Export",
          importBtn: "Import",
          clearCache: "Clear Cache"
        }
      }
    }
  },
  zh: {
    translation: {
      settings: {
        search: "搜索设置...",
        general: "通用 (GENERAL)",
        agentCapabilities: "智能与能力 (AGENT & CAPABILITIES)",
        system: "系统 (SYSTEM)",
        tabs: {
          ui: "UI",
          fsd: "FSD",
          memory: "记忆 (Memory)",
          safety: "安全 (Safety)",
          ai: "AI",
          mcp: "MCP 服务 (MCP Servers)",
          skills: "技能 (Skills)",
          integrations: "集成 (Integrations)",
          advanced: "高级 (Advanced)"
        },
        ai: {
          title: "AI 配置",
          description: "配置 AI 模型、提供商和高级参数。",
          provider: "API 提供商",
          apiKey: "API Key",
          baseUrl: "基础 URL",
          testConnection: "测试连接",
          driver: "AI 驱动",
          model: "主要模型",
          executionMode: "执行模式 (Execution Mode)",
          cliBinaryPath: "CLI 路径 (CLI Binary Path)",
          visionModel: "视觉模型 (Vision Model)",
          embeddingModel: "向量模型 (Embedding Model)",
          maxOutputTokens: "最大输出 Tokens (Max Output Tokens)",
          advancedOptions: "高级选项",
          temperature: "温度 (Temperature)",
          contextBudget: "上下文预算 (Context Budget)",
          systemPrompt: "系统提示词 (System Prompt)",
          selectModel: "选择模型"
        },
        ui: {
          title: "UI 偏好",
          description: "自定义界面外观和本地化。",
          theme: "主题",
          language: "语言"
        },
        fsd: {
          title: "FSD 引擎",
          description: "FSD 开发平台核心参数。",
          reviewRounds: "审查轮数",
          concurrency: "并发数",
          manualConfirm: "手动确认",
          taskPriority: "任务优先级",
          autoRunTests: "自动运行测试",
          requireApproval: "需要批准",
          ignoredPaths: "忽略路径"
        },
        memory: {
          title: "记忆 (Memory)",
          description: "管理系统记忆和上下文保留。",
          enabled: "启用记忆",
          enabledDesc: "允许 FSD 保存项目偏好和决策",
          compression: "压缩记忆",
          compressionDesc: "自动压缩过期记忆",
          dedupeThreshold: "去重阈值",
          dedupeThresholdDesc: "相似记忆合并阈值"
        },
        safety: {
          title: "安全 (Safety)",
          description: "风险操作的确认和访问控制。",
          confirmDestructive: "确认破坏性命令",
          confirmDestructiveDesc: "删除、重置和覆盖前请求确认",
          confirmStopAll: "确认停止全部",
          confirmStopAllDesc: "停止全部任务前二次确认",
          networkAccess: "网络访问",
          networkAccessDesc: "允许任务访问外部文档和包仓库",
          externalUrlAccess: "外部 URL 访问",
          externalUrlAccessDesc: "允许访问外部网址"
        },
        mcp: {
          title: "MCP 服务",
          description: "管理模型上下文协议 (MCP) 服务。",
          addServer: "添加服务",
          emptyTitle: "未连接 MCP 服务",
          emptyDesc: "添加一个服务以增强 AI 能力。"
        },
        skills: {
          title: "技能",
          description: "管理本地或内置的技能集合。",
          addSkill: "添加 / 导入技能",
          emptyTitle: "使用新技能增强 AI",
          emptyDesc: "通过 URL 或拖放文件导入技能。"
        },
        integrations: {
          title: "集成",
          description: "外部服务与插件接入。",
          engine: "引擎",
          proxy: "代理",
          proxyReload: "重载代理"
        },
        advanced: {
          title: "高级",
          description: "系统级高级与维护设置。",
          logLevel: "日志级别",
          telemetry: "遥测 (Telemetry)",
          exportImport: "导出 / 导入设置",
          exportBtn: "导出",
          importBtn: "导入",
          clearCache: "清除缓存"
        }
      }
    }
  },
  ja: {
    translation: {
      settings: {
        search: "設定を検索...",
        general: "一般 (GENERAL)",
        agentCapabilities: "エージェントと機能 (AGENT & CAPABILITIES)",
        system: "システム (SYSTEM)",
        tabs: {
          ui: "UI",
          fsd: "FSD",
          memory: "メモリ (Memory)",
          safety: "安全 (Safety)",
          ai: "AI",
          mcp: "MCP サーバー",
          skills: "スキル (Skills)",
          integrations: "統合 (Integrations)",
          advanced: "詳細設定 (Advanced)"
        },
        ai: {
          title: "AI 設定",
          description: "AIモデル、プロバイダー、および詳細パラメーターを設定します。",
          provider: "API プロバイダー",
          apiKey: "API キー",
          baseUrl: "ベース URL",
          testConnection: "接続テスト",
          driver: "AI ドライバー",
          model: "メインモデル",
          executionMode: "実行モード (Execution Mode)",
          cliBinaryPath: "CLI パス (CLI Binary Path)",
          visionModel: "視覚モデル (Vision Model)",
          embeddingModel: "埋め込みモデル (Embedding Model)",
          maxOutputTokens: "最大出力トークン (Max Output Tokens)",
          advancedOptions: "詳細オプション",
          temperature: "温度 (Temperature)",
          contextBudget: "コンテキスト予算 (Context Budget)",
          systemPrompt: "システムプロンプト",
          selectModel: "モデルの選択"
        },
        ui: {
          title: "UI 設定",
          description: "外観とローカリゼーションをカスタマイズします。",
          theme: "テーマ",
          language: "言語"
        },
        fsd: {
          title: "FSD エンジン",
          description: "FSD 開発プラットフォームのコアパラメーター。",
          reviewRounds: "レビュー回数",
          concurrency: "同時実行数",
          manualConfirm: "手動確認",
          taskPriority: "タスクの優先度",
          autoRunTests: "テストの自動実行",
          requireApproval: "承認を必要とする",
          ignoredPaths: "無視するパス"
        },
        memory: {
          title: "メモリ",
          description: "システムメモリとコンテキストの保持を管理します。",
          enabled: "メモリを有効にする",
          enabledDesc: "FSD がプロジェクトの好みと決定を保存できるようにします",
          compression: "圧縮",
          compressionDesc: "古いメモリを自動的に圧縮する",
          dedupeThreshold: "重複排除のしきい値",
          dedupeThresholdDesc: "類似したメモリをマージするためのしきい値"
        },
        safety: {
          title: "安全",
          description: "危険な操作の確認とアクセス制御。",
          confirmDestructive: "破壊的なコマンドを確認する",
          confirmDestructiveDesc: "削除、リセット、または上書きする前に確認を求める",
          confirmStopAll: "すべての停止を確認する",
          confirmStopAllDesc: "すべてのタスクを停止する前に二重に確認する",
          networkAccess: "ネットワークアクセス",
          networkAccessDesc: "タスクが外部ドキュメントやパッケージリポジトリにアクセスできるようにする",
          externalUrlAccess: "外部 URL アクセス",
          externalUrlAccessDesc: "外部 Web ページへのアクセスを許可する"
        },
        mcp: {
          title: "MCP サーバー",
          description: "Model Context Protocol サーバーを管理します。",
          addServer: "サーバーを追加",
          emptyTitle: "MCP サーバーが接続されていません",
          emptyDesc: "サーバーを追加して AI の機能を強化します。"
        },
        skills: {
          title: "スキル",
          description: "ローカルおよび組み込みのスキルを管理します。",
          addSkill: "スキルを追加 / インポート",
          emptyTitle: "新しいスキルで AI を強化",
          emptyDesc: "URL 経由またはファイルをドラッグ＆ドロップしてスキルをインポートします。"
        },
        integrations: {
          title: "統合",
          description: "外部サービスとプラグイン。",
          engine: "エンジン",
          proxy: "プロキシ",
          proxyReload: "プロキシを再読み込み"
        },
        advanced: {
          title: "詳細設定",
          description: "システムレベルの詳細とメンテナンス設定。",
          logLevel: "ログレベル",
          telemetry: "テレメトリ",
          exportImport: "設定のエクスポート / インポート",
          exportBtn: "エクスポート",
          importBtn: "インポート",
          clearCache: "キャッシュをクリア"
        }
      }
    }
  },
  ko: {
    translation: {
      settings: {
        search: "설정 검색...",
        general: "일반 (GENERAL)",
        agentCapabilities: "에이전트 및 기능 (AGENT & CAPABILITIES)",
        system: "시스템 (SYSTEM)",
        tabs: {
          ui: "UI",
          fsd: "FSD",
          memory: "메모리 (Memory)",
          safety: "안전 (Safety)",
          ai: "AI",
          mcp: "MCP 서버",
          skills: "스킬 (Skills)",
          integrations: "통합 (Integrations)",
          advanced: "고급 (Advanced)"
        },
        ai: {
          title: "AI 구성",
          description: "AI 모델, 공급자 및 고급 매개변수를 구성합니다.",
          provider: "API 공급자",
          apiKey: "API 키",
          baseUrl: "기본 URL",
          testConnection: "연결 테스트",
          driver: "AI 드라이버",
          model: "주요 모델",
          executionMode: "실행 모드 (Execution Mode)",
          cliBinaryPath: "CLI 경로 (CLI Binary Path)",
          visionModel: "비전 모델 (Vision Model)",
          embeddingModel: "임베딩 모델 (Embedding Model)",
          maxOutputTokens: "최대 출력 토큰 (Max Output Tokens)",
          advancedOptions: "고급 옵션",
          temperature: "온도 (Temperature)",
          contextBudget: "컨텍스트 예산 (Context Budget)",
          systemPrompt: "시스템 프롬프트",
          selectModel: "모델 선택"
        },
        ui: {
          title: "UI 기본 설정",
          description: "모양과 현지화를 사용자 정의합니다.",
          theme: "테마",
          language: "언어"
        },
        fsd: {
          title: "FSD 엔진",
          description: "FSD 개발 플랫폼을 위한 핵심 매개변수입니다.",
          reviewRounds: "검토 횟수",
          concurrency: "동시성",
          manualConfirm: "수동 확인",
          taskPriority: "작업 우선순위",
          autoRunTests: "테스트 자동 실행",
          requireApproval: "승인 필요",
          ignoredPaths: "무시된 경로"
        },
        memory: {
          title: "메모리",
          description: "시스템 메모리 및 컨텍스트 유지를 관리합니다.",
          enabled: "메모리 활성화",
          enabledDesc: "FSD가 프로젝트 기본 설정 및 결정을 저장하도록 허용합니다.",
          compression: "압축",
          compressionDesc: "오래된 메모리를 자동으로 압축합니다.",
          dedupeThreshold: "중복 제거 임계값",
          dedupeThresholdDesc: "유사한 메모리를 병합하기 위한 임계값"
        },
        safety: {
          title: "안전",
          description: "위험한 작업에 대한 확인 및 액세스 제어.",
          confirmDestructive: "파괴적인 명령 확인",
          confirmDestructiveDesc: "삭제, 재설정 또는 덮어쓰기 전에 확인을 요청합니다.",
          confirmStopAll: "모두 중지 확인",
          confirmStopAllDesc: "모든 작업을 중지하기 전에 다시 확인합니다.",
          networkAccess: "네트워크 액세스",
          networkAccessDesc: "작업이 외부 문서 및 패키지 저장소에 액세스할 수 있도록 허용합니다.",
          externalUrlAccess: "외부 URL 액세스",
          externalUrlAccessDesc: "외부 웹 페이지 방문 허용"
        },
        mcp: {
          title: "MCP 서버",
          description: "Model Context Protocol 서버를 관리합니다.",
          addServer: "서버 추가",
          emptyTitle: "연결된 MCP 서버 없음",
          emptyDesc: "AI 기능을 향상시키기 위해 서버를 추가하십시오."
        },
        skills: {
          title: "스킬",
          description: "로컬 및 내장 스킬을 관리합니다.",
          addSkill: "스킬 추가 / 가져오기",
          emptyTitle: "새로운 스킬로 AI 강화",
          emptyDesc: "URL을 통해 또는 파일을 드래그 앤 드롭하여 스킬을 가져옵니다."
        },
        integrations: {
          title: "통합",
          description: "외부 서비스 및 플러그인.",
          engine: "엔진",
          proxy: "프록시",
          proxyReload: "프록시 새로고침"
        },
        advanced: {
          title: "고급",
          description: "시스템 수준의 고급 및 유지 관리 설정.",
          logLevel: "로그 레벨",
          telemetry: "원격 분석 (Telemetry)",
          exportImport: "설정 내보내기 / 가져오기",
          exportBtn: "내보내기",
          importBtn: "가져오기",
          clearCache: "캐시 지우기"
        }
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
