# Agent 前端与聊天 UI 构建指南

> 后端 Agent 再强大，用户看到的只是一个聊天框。流式输出时的打字机效果、工具调用时的状态展示、多轮对话的上下文管理、错误处理的优雅降级——前端体验直接决定了用户对 AI 产品的评价。本指南系统讲解 Agent 聊天 UI 的架构设计、流式渲染、工具调用可视化，以及前后端集成方案。

---

## 1. 聊天 UI 的核心挑战

### 与传统 Web 应用的区别

```
传统 Web 应用：
  请求 → 等待 → 响应（一次性返回完整数据）
  UI：加载动画 → 展示结果

聊天 Agent UI：
  请求 → 流式返回（逐字输出）→ 可能有工具调用（中间状态）→ 最终回答
  UI：打字机效果 → 工具调用展示 → 引用来源 → 思考过程
  额外挑战：
  - 流式渲染（SSE/WebSocket）
  - 工具调用状态可视化
  - 可中断/重试
  - 多轮上下文
  - Markdown 渲染（代码高亮/表格）
  - 错误恢复
```

### 关键体验指标

| 指标 | 目标 | 影响 |
|------|------|------|
| 首 Token 延迟 | < 500ms | 用户感知响应速度 |
| 流式渲染帧率 | 30fps+ | 打字机效果流畅度 |
| 工具调用可见性 | 实时 | 信任感和透明度 |
| 错误恢复时间 | < 2s | 连接断开后的恢复 |
| Markdown 渲染 | < 100ms | 代码/表格展示速度 |

---

## 2. 前端架构设计

### 组件层次

```mermaid
graph TB
    subgraph "聊天 UI 组件层次"
        APP["ChatApp<br/>根组件"] --> MSGS["MessageList<br/>消息列表"]
        APP --> INPUT["ChatInput<br/>输入框"]
        APP --> SIDEBAR["Sidebar<br/>会话历史"]

        MSGS --> MSG1["UserMessage"]
        MSGS --> MSG2["AssistantMessage"]
        MSGS --> MSG3["ToolCallDisplay<br/>工具调用展示"]
        MSGS --> MSG4["ThinkingProcess<br/>思考过程"]

        MSG2 --> MD["MarkdownRenderer<br/>Markdown渲染"]
        MSG2 --> CITE["Citations<br/>引用来源"]
    end

    style APP fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style MSG3 fill:#FFF9C4,stroke:#F9A825
    style MD fill:#C8E6C9,stroke:#2E7D32
```

### 前后端通信架构

```
后端（LangGraph Agent）
  ↓ SSE (Server-Sent Events)
前端（React/Vue）
  ↓ 事件解析
  ├─ token 事件 → 追加到当前消息
  ├─ tool_start 事件 → 显示工具调用状态
  ├─ tool_end 事件 → 展示工具结果
  ├─ thinking 事件 → 展示思考过程
  └─ done 事件 → 消息完成
```

---

## 3. React 聊天组件实现

### 消息类型定义

```typescript
// types/chat.ts

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  // 工具调用
  toolCalls?: ToolCall[];
  // 引用来源
  citations?: Citation[];
  // 思考过程
  thinking?: string;
  // 状态
  status: "streaming" | "complete" | "error";
}

interface ToolCall {
  id: string;
  name: string;           // "web_search"
  args: Record<string, any>;  // {"query": "LangChain"}
  result?: string;
  status: "running" | "done" | "error";
  duration?: number;       // 耗时（ms）
}

interface Citation {
  id: number;
  source: string;          // 来源
  content: string;          // 引用内容片段
  url?: string;             // 链接
}
```

### SSE 流式接收 Hook

```typescript
// hooks/useChatStream.ts

import { useState, useCallback, useRef } from "react";

interface UseChatStreamOptions {
  apiUrl: string;
  onToken?: (token: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

export function useChatStream(options: UseChatStreamOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    // 添加用户消息
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: Date.now(),
      status: "complete",
    };

    // 添加空的 assistant 消息（流式填充）
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      status: "streaming",
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    // 创建 AbortController（可中断）
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(options.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history: messages }),
        signal: controller.signal,
      });

      // SSE 流式读取
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 解析 SSE 事件（按 \n\n 分隔）
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          const lines = event.split("\n");
          const eventType = lines
            .find(l => l.startsWith("event:"))
            ?.replace("event: ", "");
          const data = lines
            .find(l => l.startsWith("data:"))
            ?.replace("data: ", "");

          if (!data) continue;
          const parsed = JSON.parse(data);

          switch (eventType) {
            case "token":
              // 追加 token 到 assistant 消息
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                last.content += parsed.token;
                return updated;
              });
              break;

            case "tool_call":
              // 添加工具调用
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                last.toolCalls = [...(last.toolCalls || []), parsed.toolCall];
                return updated;
              });
              break;

            case "tool_result":
              // 更新工具结果
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                const tc = last.toolCalls?.find(t => t.id === parsed.id);
                if (tc) {
                  tc.result = parsed.result;
                  tc.status = "done";
                  tc.duration = parsed.duration;
                }
                return updated;
              });
              break;

            case "thinking":
              // 更新思考过程
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                last.thinking = (last.thinking || "") + parsed.content;
                return updated;
              });
              break;

            case "citations":
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                last.citations = parsed.citations;
                return updated;
              });
              break;

            case "done":
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1].status = "complete";
                return updated;
              });
              break;

            case "error":
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1].status = "error";
                return updated;
              });
              break;
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // 用户主动中断
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].status = "complete";
          updated[updated.length - 1].content += "\n\n[已中断]";
          return updated;
        });
      } else {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].status = "error";
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isStreaming, sendMessage, stop };
}
```

### 消息渲染组件

```tsx
// components/MessageList.tsx

import React from "react";
import { Message } from "../types/chat";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ToolCallDisplay } from "./ToolCallDisplay";
import { ThinkingPanel } from "./ThinkingPanel";
import { Citations } from "./Citations";

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {messages.map(msg => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </div>
  );
}

function MessageItem({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl p-4 ${
          isUser
            ? "bg-blue-500 text-white"
            : "bg-gray-100 text-gray-900"
        }`}
      >
        {/* 头像 + 角色 */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">
            {isUser ? "你" : "AI"}
          </span>
          <span className="text-xs opacity-50">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>

        {/* 思考过程（可折叠） */}
        {message.thinking && (
          <ThinkingPanel content={message.thinking} />
        )}

        {/* 工具调用展示 */}
        {message.toolCalls?.map(tc => (
          <ToolCallDisplay key={tc.id} toolCall={tc} />
        ))}

        {/* 消息内容（Markdown 渲染） */}
        {!isUser ? (
          <MarkdownRenderer content={message.content} />
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}

        {/* 引用来源 */}
        {message.citations && message.citations.length > 0 && (
          <Citations citations={message.citations} />
        )}

        {/* 状态指示器 */}
        {message.status === "streaming" && (
          <div className="flex items-center gap-1 mt-2">
            <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse" />
          </div>
        )}
        {message.status === "error" && (
          <div className="text-red-500 text-sm mt-2">
            ⚠️ 回复出错，请重试
          </div>
        )}
      </div>
    </div>
  );
}
```

### 工具调用展示组件

```tsx
// components/ToolCallDisplay.tsx

export function ToolCallDisplay({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="my-2 border rounded-lg p-3 bg-white"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 text-sm">
        {/* 状态图标 */}
        {toolCall.status === "running" && (
          <span className="animate-spin">⚙️</span>
        )}
        {toolCall.status === "done" && <span>✅</span>}
        {toolCall.status === "error" && <span>❌</span>}

        {/* 工具名 */}
        <span className="font-medium">{toolCall.name}</span>

        {/* 参数摘要 */}
        <span className="text-gray-500">
          {JSON.stringify(toolCall.args).slice(0, 50)}
        </span>

        {/* 耗时 */}
        {toolCall.duration && (
          <span className="text-xs text-gray-400">
            {toolCall.duration}ms
          </span>
        )}
      </div>

      {/* 展开详情 */}
      {expanded && toolCall.result && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
          <pre>{toolCall.result}</pre>
        </div>
      )}
    </div>
  );
}
```

### Markdown 渲染组件

```tsx
// components/MarkdownRenderer.tsx

import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        // 代码块高亮
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          return !inline && match ? (
            <SyntaxHighlighter
              language={match[1]}
              style={oneDark}
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          ) : (
            <code className="bg-gray-200 px-1 rounded" {...props}>
              {children}
            </code>
          );
        },
        // 表格渲染
        table({ children }) {
          return (
            <table className="border-collapse border border-gray-300 my-2 w-full">
              {children}
            </table>
          );
        },
        // 引用渲染
        blockquote({ children }) {
          return (
            <blockquote className="border-l-4 border-gray-300 pl-4 my-2 italic text-gray-600">
              {children}
            </blockquote>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

---

## 4. 后端 SSE 适配

### LangGraph SSE 端点

```python
# server.py — FastAPI 后端

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from langgraph.graph import StateGraph, MessagesState, START, END
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
import json
import asyncio

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"])

@tool
def web_search(query: str) -> str:
    """搜索网络"""
    return f"搜索结果: {query}"

@tool
def calculator(expression: str) -> str:
    """计算"""
    return str(eval(expression))

llm = ChatOpenAI(model="gpt-4o-mini")
agent = create_react_agent(llm, [web_search, calculator])

async def sse_stream(user_message: str):
    """将 LangGraph 事件流转为 SSE"""
    async for event in agent.astream_events(
        {"messages": [{"role": "user", "content": user_message}]},
        version="v2",
    ):
        kind = event["event"]
        data = event["data"]

        if kind == "on_chat_model_stream":
            # Token 流
            chunk = data.get("chunk")
            if chunk and chunk.content:
                yield f"event: token\ndata: {json.dumps({'token': chunk.content})}\n\n"

        elif kind == "on_tool_start":
            # 工具开始
            yield f"event: tool_call\ndata: {json.dumps({'toolCall': {'id': data.get('run_id',''), 'name': data.get('name',''), 'args': data.get('input',{}), 'status': 'running'}})}\n\n"

        elif kind == "on_tool_end":
            # 工具结束
            yield f"event: tool_result\ndata: {json.dumps({'id': data.get('run_id',''), 'result': str(data.get('output',''))[:500], 'duration': 0})}\n\n"

    yield f"event: done\ndata: {json.dumps({})}\n\n"

@app.post("/chat")
async def chat(request: dict):
    message = request.get("message", "")
    return StreamingResponse(
        sse_stream(message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # nginx 关闭缓冲
        },
    )
```

---

## 5. 高级体验优化

### 自动滚动与手动暂停

```typescript
// hooks/useAutoScroll.ts

export function useAutoScroll(dependency: any) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // 监听用户手动滚动
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(atBottom);
  };

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [dependency, autoScroll]);

  return { containerRef, handleScroll, autoScroll };
}
```

### 连接断开重连

```typescript
class ReconnectSSE {
  private reconnectAttempts = 0;
  private maxReconnects = 3;
  private reconnectDelay = 1000;

  async connectWithRetry(url: string, onMessage: Function) {
    while (this.reconnectAttempts < this.maxReconnects) {
      try {
        await this.connect(url, onMessage);
        this.reconnectAttempts = 0; // 成功后重置
      } catch (err) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error("连接失败，请检查网络");
  }
}
```

### 输入增强

```tsx
// 组件：自动调整高度 + 快捷键 + 建议提示
function ChatInput({ onSend, disabled, suggestions }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整高度
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent) => {
    // Enter 发送，Shift+Enter 换行
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend(value);
        setValue("");
      }
    }
  };

  return (
    <div className="border-t p-4">
      {/* 建议提示 */}
      {suggestions.length > 0 && !value && (
        <div className="flex gap-2 mb-2">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => setValue(s)}
              className="px-3 py-1 text-sm bg-gray-100 rounded-full hover:bg-gray-200"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          className="flex-1 resize-none border rounded-lg p-2"
          rows={1}
        />
        <button
          onClick={() => {
            if (value.trim()) { onSend(value); setValue(""); }
          }}
          disabled={disabled || !value.trim()}
          className="px-4 bg-blue-500 text-white rounded-lg disabled:opacity-50"
        >
          {disabled ? "停止" : "发送"}
        </button>
      </div>
    </div>
  );
}
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解聊天 UI 与传统 Web 的区别 | ☐ |
| 实现了 SSE 流式接收 | ☐ |
| 支持打字机效果渲染 | ☐ |
| 工具调用状态可视化 | ☐ |
| Markdown 渲染（代码高亮/表格） | ☐ |
| 引用来源展示 | ☐ |
| 思考过程折叠面板 | ☐ |
| 自动滚动 + 手动暂停 | ☐ |
| 连接断开重连 | ☐ |
| 输入增强（快捷键/建议） | ☐ |
| 后端 SSE 端点对接 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 13 | 流式输出与异步编程 | 流式基础 |
| 24 | 前后端集成教程 | 前后端集成 |
| 98 | 流式输出前端集成图解 | 前端流式 |
| 130 | 流式输出前端集成指南 | 前端集成 |
| 146 | LangGraph 流式 API 深度 | LangGraph 流式 |
| 147 | Agent 用户体验设计 | UX 设计 |
| 353 | Agent 流式输出与 SSE | SSE 推送 |
| 383 | Agent 流式输出与 SSE 实时推送 | SSE 实现 |
| 391 | Agent 云原生部署与容器化 | 前端部署 |
