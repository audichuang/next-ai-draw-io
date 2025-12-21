# Next AI Draw.io 開發指南

## 專案概述

AI 驅動的 draw.io 圖表工具，支援透過自然語言生成和修改圖表。可作為獨立應用使用，也可透過 iframe 嵌入其他平台（如 Docmost）。

**Live Demo**: https://next-ai-drawio.jiang.jp/

## 技術棧

| 類別 | 技術 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS 4 + Radix UI |
| 繪圖 | react-drawio 1.0.3 |
| AI | Vercel AI SDK (ai@5.0.89) |
| 動畫 | motion 12.23.25 |
| 觀測 | Langfuse |

### 支援的 AI 供應商

- AWS Bedrock (預設)
- Anthropic (Claude)
- OpenAI (GPT)
- Google (Gemini)
- Azure OpenAI
- DeepSeek
- Ollama (本地)
- OpenRouter
- SiliconFlow

## 目錄結構

```
next-ai-draw-io/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # 主 LLM API (tool calling)
│   │   ├── config/route.ts        # 配置 API
│   │   └── verify-access-code/    # 存取碼驗證
│   └── [lang]/
│       └── page.tsx               # 主頁面（偵測 embed 模式）
├── components/
│   ├── chat-panel.tsx             # AI 聊天面板（核心）
│   ├── chat-input.tsx             # 使用者輸入
│   ├── chat-message-display.tsx   # 訊息顯示
│   ├── settings-dialog.tsx        # 設定對話框
│   ├── history-dialog.tsx         # 圖表歷史
│   └── ui/                        # Radix UI 組件
├── contexts/
│   └── diagram-context.tsx        # 全域圖表狀態
├── hooks/
│   └── use-embed-mode.ts          # Embed 模式 hook
├── lib/
│   ├── embed-api.ts               # postMessage 協議
│   ├── ai-providers.ts            # AI 供應商配置
│   ├── system-prompts.ts          # 系統提示詞
│   ├── utils.ts                   # XML 驗證與處理
│   └── i18n/                      # 國際化 (EN, CN, JA)
└── packages/
    └── mcp-server/                # MCP 伺服器
```

## AI 工具 (Tool Calling)

API (`/api/chat`) 使用 Vercel AI SDK 的 tool calling：

| 工具 | 用途 |
|------|------|
| `display_diagram` | 建立新圖表（生成完整 XML） |
| `edit_diagram` | 修改現有圖表（新增/更新/刪除 cells） |
| `append_diagram` | 續傳截斷的 XML |
| `get_shape_library` | 取得可用圖示庫（AWS, Azure, GCP 等） |

## Embed 模式

### 啟用方式

URL 加上 `?embed=true` 參數

### 通訊協議

定義於 `lib/embed-api.ts`：

```typescript
type EmbedMessageType =
  | 'READY'           // iframe 準備好
  | 'LOAD_DIAGRAM'    // 載入圖表
  | 'REQUEST_EXPORT'  // 請求匯出
  | 'EXPORT_RESULT'   // 匯出結果
  | 'SAVE_REQUESTED'  // 用戶點擊儲存

interface EmbedMessage {
  type: EmbedMessageType
  payload?: {
    xml?: string   // Draw.io XML
    svg?: string   // 渲染後的 SVG
  }
}
```

### 使用範例（Parent 端）

```javascript
// 嵌入 iframe
const iframe = document.createElement('iframe')
iframe.src = 'https://your-nextai-url.com?embed=true'

// 監聽訊息
window.addEventListener('message', (e) => {
  if (e.data.type === 'READY') {
    // 載入既有圖表
    iframe.contentWindow.postMessage({
      type: 'LOAD_DIAGRAM',
      payload: { xml: existingXml }
    }, '*')
  }
  if (e.data.type === 'SAVE_REQUESTED') {
    // 儲存圖表
    const { xml, svg } = e.data.payload
    saveDiagram(xml, svg)
  }
})
```

## 開發命令

```bash
# 安裝依賴
npm install

# 開發模式 (預設 port 3000)
npm run dev

# 建構
npm run build

# 生產模式
npm start

# Lint
npm run lint
```

## 環境變數

```env
# 必要：AI 供應商
AI_PROVIDER=anthropic
AI_MODEL=claude-sonnet-4-5-20250514

# 必要：對應供應商的 API Key
ANTHROPIC_API_KEY=sk-ant-...
# 或 OPENAI_API_KEY=sk-...
# 或 AWS_REGION=us-east-1 + AWS credentials

# 可選：存取控制
ACCESS_CODE_LIST=code1,code2
DAILY_REQUEST_LIMIT=100
DAILY_TOKEN_LIMIT=500000
TPM_LIMIT=60000

# 可選：AI 參數
TEMPERATURE=0
ANTHROPIC_THINKING_BUDGET_TOKENS=12000

# 可選：Embed 安全
ALLOWED_ORIGINS=https://your-docmost.com

# 可選：Draw.io 離線部署
NEXT_PUBLIC_DRAWIO_BASE_URL=https://your-drawio-instance.com

# 可選：觀測
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

## 關鍵注意事項

### XML 格式要求

1. **圖表尺寸**：所有元素需在 800x600px 視窗內
2. **Cell ID**：從 `"2"` 開始（0, 1 保留給根節點）
3. **結構**：必須是有效的 mxCell + mxGeometry

### 驗證函數

`lib/utils.ts` 提供：
- `isMxCellXmlComplete()` - 檢查 XML 是否截斷
- `validateAndFixXml()` - 自動修復常見問題
- `convertToLegalXml()` - 從 AI 輸出提取有效 XML

### 圖示庫支援

雲端架構圖示：
- AWS (`aws4`)
- Azure (`azure2`)
- GCP (`gcp2`)
- Kubernetes
- 更多見 `docs/shape-libraries/`

## MCP Server

支援與 Claude Desktop、Cursor、VS Code 整合：

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["@next-ai-drawio/mcp-server@latest"]
    }
  }
}
```

詳見 `packages/mcp-server/README.md`

## 常見任務

### 新增 AI 供應商

1. 在 `lib/ai-providers.ts` 新增 provider 配置
2. 安裝對應的 `@ai-sdk/*` 套件
3. 更新環境變數文件

### 修改系統提示詞

編輯 `lib/system-prompts.ts`，注意：
- 保持 XML 格式說明
- 維持尺寸限制（800x600）
- 考慮 prompt caching 的 token 最小值

### 新增圖示庫文件

在 `docs/shape-libraries/` 建立對應的 `.md` 檔案
