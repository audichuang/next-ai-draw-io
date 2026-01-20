# GEMINI.md

此文件為 Google Gemini/Antigravity AI Agent 提供專案指引。

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

**重要**：在執行 `git commit` 或 `git push` 之前，必須確保相應的品質檢查通過。

## 專案概述

AI 驅動的 draw.io 圖表工具，支援透過自然語言生成和修改圖表。

- **框架**: Next.js 16 (App Router, Turbopack)
- **UI**: React 19 + Tailwind CSS 4 + Radix UI
- **AI**: Vercel AI SDK (`ai@6.x`)
- **資料庫**: Prisma + PostgreSQL
- **測試**: Vitest (單元) + Playwright (E2E)
- **格式化**: Biome

## 常用命令

```bash
# Quality Gates (AI Agent 必用)
make check-fast      # ⭐ commit 前必跑
make check-build     # 🚀 push 前必跑

# 開發
npm run dev          # 開發模式 (port 6002)
npm run build        # 建構生產版本

# 程式碼品質
make format          # Biome 格式化
make lint            # Lint 檢查
make typecheck       # TypeScript 類型檢查

# 測試
make test            # Vitest 單元測試
make test-e2e        # Playwright E2E 測試

# 資料庫
make db-generate     # 生成 Prisma Client
make db-migrate      # 執行遷移
make db-studio       # 開啟 Prisma Studio
```

## 架構要點

### 兩頁式架構 (Two-Page Architecture)

1. **History Page** (`/[lang]/`)：對話歷史列表、文件夾管理
2. **Editor Page** (`/[lang]/session/[id]`)：圖表編輯工作區

### 核心組件

| 檔案 | 用途 |
|------|------|
| `app/api/chat/route.ts` | 主 LLM API |
| `components/chat-panel.tsx` | AI 聊天面板 |
| `contexts/diagram-context.tsx` | 全域圖表狀態 |
| `hooks/use-session-manager.ts` | Session 管理 |

### AI Tools

| 工具 | 用途 |
|------|------|
| `display_diagram` | 建立新圖表 |
| `edit_diagram` | 修改現有圖表 |
| `append_diagram` | 續傳截斷的 XML |
| `get_shape_library` | 取得圖示庫 |

## 注意事項

1. XML 只生成 mxCell 元素，wrapper tags 由系統自動添加
2. Cell ID 從 `"2"` 開始
3. 圖表尺寸限制：800x600px
