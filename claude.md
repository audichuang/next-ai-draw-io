# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

AI 驅動的 draw.io 圖表工具，支援透過自然語言生成和修改圖表。可作為獨立應用使用，也可透過 iframe 嵌入其他平台（如 Docmost）。

**Live Demo**: https://next-ai-drawio.jiang.jp/

## 🚨 Quality Gates（必讀）

> **AI Agent 注意**：commit 和 push 前必須執行對應的檢查，確保代碼品質。

| 時機 | 命令 | 說明 |
|------|------|------|
| **commit 前** | `make check-fast` | TS 類型檢查 + Lint + 單元測試 |
| **push 前** | `make check-build` | 上述 + 構建檢查 |
| 完整檢查 | `make check-all` | 上述 + E2E 測試 |

```bash
# 快速查看所有可用命令
make help
```

## 常用命令

```bash
# 開發
npm run dev          # 開發模式 (port 6002, turbopack)
npm run build        # 建構生產版本
npm start            # 生產模式 (port 6001)

# 程式碼品質 (推薦使用 make)
make check-fast      # ⭐ commit 前必跑
make check-build     # 🚀 push 前必跑
make format          # Biome 格式化

# 測試
npm test             # Vitest 單元測試
npm run test:e2e     # Playwright E2E 測試

# 資料庫 (需要 DATABASE_URL)
npx prisma generate  # 生成 Prisma Client
npx prisma migrate dev  # 執行遷移
npx prisma studio    # 開啟 Prisma Studio

# Electron 桌面應用
npm run electron:dev # Electron 開發模式
npm run dist:mac     # 打包 macOS 版本
npm run dist:win     # 打包 Windows 版本
npm run dist:linux   # 打包 Linux 版本

# Cloudflare 部署
npm run preview      # 本地預覽
npm run deploy       # 部署到 Cloudflare Workers
```

## 技術棧

| 類別 | 技術 |
|------|------|
| 框架 | Next.js 16 (App Router, Turbopack) |
| UI | React 19 + Tailwind CSS 4 + Radix UI |
| 繪圖 | react-drawio |
| AI | Vercel AI SDK (`ai@6.x`) |
| 資料庫 | Prisma + PostgreSQL (可選) |
| 格式化 | Biome |
| 測試 | Vitest (單元) + Playwright (E2E) |
| 觀測 | Langfuse |

## 架構概覽

```
app/
├── api/
│   ├── chat/route.ts          # 主 LLM API (streamText + tool calling)
│   ├── sessions/              # Session CRUD API (Prisma)
│   └── folders/               # Folder CRUD API (Prisma)
└── [lang]/page.tsx            # 主頁面 (i18n: en, zh, zh-TW, ja)

components/
├── chat-panel.tsx             # AI 聊天面板 (核心 UI)
├── chat-input.tsx             # 使用者輸入
└── chat-message-display.tsx   # 訊息顯示 + tool result 處理

contexts/
└── diagram-context.tsx        # 全域圖表狀態 (chartXML, history, drawioRef)

hooks/
├── use-embed-mode.ts          # Embed 模式 hook (postMessage 通訊)
└── use-session-manager.ts     # Session 管理 (IndexedDB/Prisma)

lib/
├── ai-providers.ts            # 多 AI 供應商配置 (14+ providers)
├── system-prompts.ts          # AI 系統提示詞
├── embed-api.ts               # postMessage 協議定義
└── utils.ts                   # XML 驗證與處理
```

## 核心資料流

```
User Input → chat-panel.tsx → /api/chat → AI Provider
                                            ↓
                              streamText + tool calling
                                            ↓
                              display_diagram / edit_diagram
                                            ↓
                              diagram-context.tsx → react-drawio
```

## AI Tool Calling

`/api/chat` 使用 Vercel AI SDK 的 tool calling：

| 工具 | 用途 |
|------|------|
| `display_diagram` | 建立新圖表（生成完整 mxCell XML） |
| `edit_diagram` | 修改現有圖表（update/add/delete cells by ID） |
| `append_diagram` | 續傳截斷的 XML |
| `get_shape_library` | 取得可用圖示庫（讀取 `docs/shape-libraries/*.md`） |

## Embed 模式 (iframe 整合)

URL 加上 `?embed=true` 啟用。通訊協議定義於 `lib/embed-api.ts`：

| 訊息 | 方向 | 用途 |
|------|------|------|
| `READY` | NextAI → Parent | iframe 已準備好 |
| `LOAD_DIAGRAM` | Parent → NextAI | 載入既有圖表 |
| `REQUEST_EXPORT` | Parent → NextAI | 請求匯出 |
| `EXPORT_RESULT` | NextAI → Parent | 回傳結果 |
| `SAVE_REQUESTED` | NextAI → Parent | 用戶點擊儲存 |

## 環境變數

```env
# 必要：AI 供應商 (擇一設定)
AI_PROVIDER=anthropic          # bedrock, openai, anthropic, google, azure, ollama, openrouter, deepseek, siliconflow, gateway, doubao, modelscope
AI_MODEL=claude-sonnet-4-5-20250514

# 對應供應商的 API Key
ANTHROPIC_API_KEY=sk-ant-...
# 或 OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, AWS_REGION + credentials, etc.

# 可選：資料庫 (啟用 session 持久化)
DATABASE_URL=postgresql://...

# 可選：存取控制
ACCESS_CODE_LIST=code1,code2
DAILY_REQUEST_LIMIT=100

# 可選：Embed 安全
ALLOWED_ORIGINS=https://your-docmost.com
```

## 關鍵注意事項

### XML 格式要求
1. **只生成 mxCell 元素**：wrapper tags (`<mxfile>`, `<mxGraphModel>`, `<root>`) 和 root cells (id="0", "1") 由系統自動添加
2. **圖表尺寸**：所有元素需在 800x600px 視窗內
3. **Cell ID**：從 `"2"` 開始

### 驗證函數 (`lib/utils.ts`)
- `isMxCellXmlComplete()` - 檢查 XML 是否截斷
- `validateAndFixXml()` - 自動修復常見問題
- `convertToLegalXml()` - 從 AI 輸出提取有效 XML

### 測試結構
- 單元測試：`tests/**/*.test.{ts,tsx}` (Vitest)
- E2E 測試：`tests/e2e/*.spec.ts` (Playwright)

## 常見任務

### 新增 AI 供應商
1. 在 `lib/ai-providers.ts` 的 `getAIModel()` 中新增 case
2. 更新 `ProviderName` type 和 `PROVIDER_ENV_VARS`
3. 安裝對應的 `@ai-sdk/*` 套件

### 修改系統提示詞
編輯 `lib/system-prompts.ts`，注意：
- 保持 XML 格式說明
- 維持尺寸限制（800x600）
- 考慮 prompt caching 的 token 最小值（Opus/Haiku 4.5 需要 4000 tokens）

### 新增圖示庫文件
在 `docs/shape-libraries/` 建立對應的 `.md` 檔案
