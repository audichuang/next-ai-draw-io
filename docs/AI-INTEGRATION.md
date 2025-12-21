# AI 與 Draw.io 整合技術文檔

> 這份文檔解釋 Next AI Draw.io 如何讓 AI 理解並生成 draw.io 格式的圖表

---

## 目錄

1. [AI 是如何串接的？](#1-ai-是如何串接的)
2. [提示詞 (System Prompt) 完整解析](#2-提示詞-system-prompt-完整解析)
3. [AI 如何學會寫 Draw.io XML？](#3-ai-如何學會寫-drawio-xml)
4. [AI 與 Draw.io 的互動流程](#4-ai-與-drawio-的互動流程)
5. [為什麼 AI 能生成正確的 Draw.io XML？](#5-為什麼-ai-能生成正確的-drawio-xml)
6. [總結](#6-總結)

---

## 1. AI 是如何串接的？

### 架構概覽

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   用戶輸入   │ ──▶ │  Next.js API    │ ──▶ │   AI 提供者     │
│  (文字/圖片) │     │  /api/chat      │     │  (8種可選)      │
└─────────────┘     └─────────────────┘     └─────────────────┘
                            │
                    使用 Vercel AI SDK
                    streamText() 串流回應
                            │
                            ▼
                    ┌─────────────────┐
                    │   Tool Calls    │
                    │ display_diagram │
                    │  edit_diagram   │
                    └─────────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │   Draw.io 畫布  │
                    │   載入 XML      │
                    └─────────────────┘
```

### 核心技術：Vercel AI SDK

**檔案:** `app/api/chat/route.ts`

```typescript
import { streamText, convertToModelMessages } from 'ai';
import { getAIModel } from '@/lib/ai-providers';

export async function POST(req: Request) {
  const { messages, xml } = await req.json();

  // 取得 AI 模型（支援 8 種提供者）
  const { model, providerOptions, headers } = getAIModel();

  // 串流式 AI 回應
  const result = streamText({
    model,
    messages: [systemMessageWithCache, ...enhancedMessages],
    tools: { display_diagram, edit_diagram },
    temperature: 0,  // 確保一致性
  });

  return result.toUIMessageStreamResponse();
}
```

### 8 種 AI 提供者支援

**檔案:** `lib/ai-providers.ts`

| 提供者 | 環境變數 | 說明 |
|--------|----------|------|
| **AWS Bedrock** | `AWS_ACCESS_KEY_ID` | 預設，支援 Claude |
| **Anthropic** | `ANTHROPIC_API_KEY` | 直接 Claude API |
| **OpenAI** | `OPENAI_API_KEY` | GPT 系列 |
| **Azure OpenAI** | `AZURE_API_KEY` | 微軟託管 |
| **Google AI** | `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini |
| **DeepSeek** | `DEEPSEEK_API_KEY` | 中國 AI |
| **Ollama** | (無需 key) | 本地模型 |
| **OpenRouter** | `OPENROUTER_API_KEY` | 多模型聚合 |

**切換提供者只需修改環境變數:**

```bash
# .env.local
AI_PROVIDER=anthropic
AI_MODEL=claude-sonnet-4-5
ANTHROPIC_API_KEY=sk-xxx
```

---

## 2. 提示詞 (System Prompt) 完整解析

### 系統提示詞結構

**位置:** `app/api/chat/route.ts:53-153`

系統提示詞分為以下幾個部分：

### 2.1 角色定義

```
You are an expert diagram creation assistant specializing in draw.io XML generation.
Your primary function is chat with user and crafting clear, well-organized visual diagrams
through precise XML specifications.
You can see the image that user uploaded.
```

**關鍵點:**
- 定義 AI 為「圖表創建專家」
- 強調專精於 draw.io XML
- 說明可以看到用戶上傳的圖片

### 2.2 工具說明

```
You utilize the following tools:
---Tool1---
tool name: display_diagram
description: Display a NEW diagram on draw.io. Use this when creating a diagram from scratch
or when major structural changes are needed.
parameters: { xml: string }

---Tool2---
tool name: edit_diagram
description: Edit specific parts of the EXISTING diagram. Use this when making small targeted
changes like adding/removing elements, changing labels, or adjusting properties.
parameters: { edits: Array<{search: string, replace: string}> }
```

### 2.3 工具選擇指引

```
IMPORTANT: Choose the right tool:
- Use display_diagram for: Creating new diagrams, major restructuring, or when the
  current diagram XML is empty
- Use edit_diagram for: Small modifications, adding/removing elements, changing text/colors,
  repositioning items
```

### 2.4 核心能力描述

```
Core capabilities:
- Generate valid, well-formed XML strings for draw.io diagrams
- Create professional flowcharts, mind maps, entity diagrams, and technical illustrations
- Convert user descriptions into visually appealing diagrams using basic shapes and connectors
- Apply proper spacing, alignment and visual hierarchy in diagram layouts
- Adapt artistic concepts into abstract diagram representations using available shapes
- Optimize element positioning to prevent overlapping and maintain readability
- Structure complex systems into clear, organized visual components
```

### 2.5 佈局約束

```
Layout constraints:
- CRITICAL: Keep all diagram elements within a single page viewport to avoid page breaks
- Position all elements with x coordinates between 0-800 and y coordinates between 0-600
- Maximum width for containers (like AWS cloud boxes): 700 pixels
- Maximum height for containers: 550 pixels
- Use compact, efficient layouts that fit the entire diagram in one view
```

**這很重要！** 確保 AI 生成的圖表不會超出畫面，避免分頁。

### 2.6 重要規則

```
Note that:
- Use proper tool calls to generate or edit diagrams
- Never return raw XML in text responses
- Never use display_diagram to generate messages (e.g. "hello" text box)
- Return XML only via tool calls, never in text responses
- If user asks to replicate a diagram from an image, match the style and layout as closely as possible
- When generating AWS architecture, use **AWS 2025 icons**
```

### 2.7 Edit 工具使用指引

```
When using edit_diagram tool:
- Keep edits minimal - only include the specific line being changed plus 1-2 context lines
- Example GOOD edit: {"search": "<mxCell id=\"2\" value=\"Old Text\">",
                      "replace": "<mxCell id=\"2\" value=\"New Text\">"}
- Example BAD edit: Including 10+ unchanged lines just to change one attribute
- RETRY POLICY: If edit_diagram fails:
  * You may retry up to 3 times with adjusted search patterns
  * After 3 failed attempts, MUST fall back to display_diagram
```

---

## 3. AI 如何學會寫 Draw.io XML？

### 關鍵：在提示詞中教會 AI XML 結構

**這是最重要的部分！** AI 並不是天生就懂 draw.io XML，而是透過 System Prompt 中的結構說明和範例來學習。

### 3.1 基本結構說明

```xml
## Draw.io XML Structure Reference

Basic structure:
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <!-- All other cells go here as siblings -->
  </root>
</mxGraphModel>
```

### 3.2 關鍵規則

```
CRITICAL RULES:
1. Always include the two root cells: <mxCell id="0"/> and <mxCell id="1" parent="0"/>
2. ALL mxCell elements must be DIRECT children of <root> - NEVER nest mxCell inside another mxCell
3. Use unique sequential IDs for all cells (start from "2" for user content)
4. Set parent="1" for top-level shapes, or parent="<container-id>" for grouped elements
```

### 3.3 形狀範例

```xml
Shape (vertex) example:
<mxCell id="2" value="Label" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
  <mxGeometry x="100" y="100" width="120" height="60" as="geometry"/>
</mxCell>
```

### 3.4 連接線範例

```xml
Connector (edge) example:
<mxCell id="3" style="endArrow=classic;html=1;" edge="1" parent="1" source="2" target="4">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

### 3.5 常用樣式參考

```
Common styles:
- Shapes: rounded=1 (rounded corners), fillColor=#hex, strokeColor=#hex
- Edges: endArrow=classic/block/open/none, startArrow=none/classic, curved=1,
         edgeStyle=orthogonalEdgeStyle
- Text: fontSize=14, fontStyle=1 (bold), align=center/left/right
```

### 3.6 工具描述中的完整範例

在 `display_diagram` 工具的描述中，提供了一個完整的泳道圖範例：

```xml
Example with swimlanes and edges (note: all mxCells are siblings):
<root>
  <mxCell id="0"/>
  <mxCell id="1" parent="0"/>
  <mxCell id="lane1" value="Frontend" style="swimlane;" vertex="1" parent="1">
    <mxGeometry x="40" y="40" width="200" height="200" as="geometry"/>
  </mxCell>
  <mxCell id="step1" value="Step 1" style="rounded=1;" vertex="1" parent="lane1">
    <mxGeometry x="20" y="60" width="160" height="40" as="geometry"/>
  </mxCell>
  <mxCell id="lane2" value="Backend" style="swimlane;" vertex="1" parent="1">
    <mxGeometry x="280" y="40" width="200" height="200" as="geometry"/>
  </mxCell>
  <mxCell id="step2" value="Step 2" style="rounded=1;" vertex="1" parent="lane2">
    <mxGeometry x="20" y="60" width="160" height="40" as="geometry"/>
  </mxCell>
  <mxCell id="edge1" style="edgeStyle=orthogonalEdgeStyle;endArrow=classic;" edge="1"
          parent="1" source="step1" target="step2">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root>
```

---

## 4. AI 與 Draw.io 的互動流程

### 完整流程圖

```
┌─────────────────────────────────────────────────────────────────┐
│                        用戶輸入                                  │
│                   "幫我畫一個流程圖"                             │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    chat-panel.tsx                               │
│  1. 取得當前圖表 XML (可能為空)                                  │
│  2. 組合訊息: 文字 + 圖片 + 當前 XML                             │
│  3. 發送到 /api/chat                                            │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      route.ts                                   │
│  1. 檢查快取 (常用提示可能有預設回應)                            │
│  2. 組合 System Prompt + 用戶訊息                               │
│  3. 呼叫 AI (streamText)                                        │
│  4. AI 決定使用哪個工具                                         │
└─────────────────────────────────────────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │                                     │
            ▼                                     ▼
┌───────────────────────┐           ┌───────────────────────┐
│   display_diagram     │           │     edit_diagram      │
│                       │           │                       │
│  AI 生成完整 XML      │           │  AI 生成搜尋/替換     │
│                       │           │  [{search, replace}]  │
└───────────────────────┘           └───────────────────────┘
            │                                     │
            ▼                                     ▼
┌───────────────────────┐           ┌───────────────────────┐
│  validateMxCell       │           │  replaceXMLParts()    │
│  Structure()          │           │  三階段匹配           │
│  驗證 XML 格式        │           │  應用編輯             │
└───────────────────────┘           └───────────────────────┘
            │                                     │
            └──────────────────┬──────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   diagram-context.tsx                           │
│  loadDiagram(xml) → drawioRef.current.load({ xml })            │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Draw.io 畫布                               │
│                    顯示新圖表                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 關鍵程式碼

#### 4.1 前端發送訊息

**檔案:** `components/chat-panel.tsx:148-189`

```typescript
const onSubmit = async () => {
  // 取得當前圖表 XML
  const currentXml = await onFetchChart();

  // 組合訊息內容
  const contentParts = [
    { type: 'text', text: userInput },
    ...files.map(file => ({ type: 'file', url: file.url, mediaType: file.type }))
  ];

  // 發送到 API，帶上當前 XML
  sendMessage({
    content: contentParts,
    options: { body: { xml: formatXML(currentXml) } }
  });
};
```

#### 4.2 API 組合訊息

**檔案:** `app/api/chat/route.ts:163-171`

```typescript
// 把當前 XML 和用戶輸入組合成結構化格式
const formattedTextContent = `
Current diagram XML:
"""xml
${xml || ''}
"""
User input:
"""md
${lastMessageText}
"""`;
```

**這讓 AI 能看到當前圖表狀態！**

#### 4.3 前端處理工具呼叫

**檔案:** `components/chat-panel.tsx:69-129`

```typescript
async onToolCall({ toolCall }) {
  if (toolCall.toolName === "display_diagram") {
    const { xml } = toolCall.input;

    // 驗證 XML
    const validationError = validateMxCellStructure(xml);
    if (validationError) {
      return { output: validationError };  // 讓 AI 知道錯誤
    }

    // 成功 - 圖表會自動載入
    return { output: "Successfully displayed the diagram." };
  }

  if (toolCall.toolName === "edit_diagram") {
    const { edits } = toolCall.input;
    const currentXml = await onFetchChart(false);  // 不存歷史

    try {
      const editedXml = replaceXMLParts(currentXml, edits);
      onDisplayChart(editedXml);
      return { output: `Successfully applied ${edits.length} edit(s).` };
    } catch (error) {
      // 回傳錯誤和當前 XML，讓 AI 可以重試
      return { output: `Edit failed: ${error.message}\n\nCurrent XML:\n${currentXml}` };
    }
  }
}
```

---

## 5. 為什麼 AI 能生成正確的 Draw.io XML？

### 5.1 精確的結構定義

System Prompt 清楚定義了：
- XML 必須包含的根元素 (`<mxCell id="0"/>` 和 `<mxCell id="1" parent="0"/>`)
- 所有 mxCell 必須是 `<root>` 的直接子元素
- ID 必須唯一
- parent 屬性的正確使用方式

### 5.2 具體範例

提供了：
- 形狀 (vertex) 的完整範例
- 連接線 (edge) 的完整範例
- 泳道圖的複雜範例

### 5.3 樣式參考

列出了常用樣式：
- `rounded=1` - 圓角
- `fillColor=#hex` - 填充顏色
- `endArrow=classic` - 箭頭類型
- `edgeStyle=orthogonalEdgeStyle` - 正交連接線

### 5.4 錯誤回饋機制

- `validateMxCellStructure()` 會檢查 XML 格式
- 錯誤訊息會回傳給 AI
- AI 可以根據錯誤修正並重試

### 5.5 佈局約束

- 明確的座標範圍 (0-800, 0-600)
- 容器大小限制 (700x550)
- 防止分頁的指引

---

## 6. 總結

| 問題 | 答案 |
|------|------|
| **AI 怎麼串的？** | 使用 Vercel AI SDK 的 `streamText()`，支援 8 種 AI 提供者 |
| **提示詞有什麼？** | 角色定義 + 工具說明 + 核心能力 + 佈局約束 + XML 結構參考 |
| **如何與 Draw.io 互動？** | 透過 `react-drawio` 的 `load({ xml })` 方法載入 XML |
| **AI 怎麼學會寫 XML？** | System Prompt 包含完整的結構說明、規則和範例 |

### 核心設計哲學

> 不依賴 AI 的預訓練知識，而是在每次請求時透過 System Prompt 教會 AI 正確的 XML 格式。這確保了一致性和可控性。

---

## 附錄：關鍵檔案參考

| 檔案 | 說明 |
|------|------|
| `app/api/chat/route.ts` | AI 聊天 API、System Prompt、工具定義 |
| `lib/ai-providers.ts` | 8 種 AI 提供者配置 |
| `lib/utils.ts` | XML 驗證、搜尋替換邏輯 |
| `components/chat-panel.tsx` | 前端聊天面板、工具呼叫處理 |
| `contexts/diagram-context.tsx` | 圖表狀態管理、歷史記錄 |
