# Agent 前端与聊天 UI 构建图解

> 流式打字机、工具调用状态、思考过程折叠、引用来源展示——聊天 UI 的每个细节都影响用户体验。本图解可视化前端架构和组件层次。

---

## 前端组件层次

```mermaid
graph TB
    APP["ChatApp"] --> MSGS["MessageList"]
    APP --> INPUT["ChatInput"]
    APP --> SIDEBAR["Sidebar<br/>会话历史"]

    MSGS --> U["UserMessage"]
    MSGS --> A["AssistantMessage"]
    MSGS --> T["ToolCallDisplay"]
    MSGS --> TP["ThinkingPanel"]

    A --> MD["MarkdownRenderer<br/>代码高亮/表格"]
    A --> CITE["Citations<br/>引用来源"]

    style APP fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style T fill:#FFF9C4,stroke:#F9A825
    style MD fill:#C8E6C9,stroke:#2E7D32
```

---

## SSE 事件流

```mermaid
graph LR
    BACK["后端 LangGraph"] -->|"event: token"| T["追加文字<br/>打字机效果"]
    BACK -->|"event: tool_call"| TC["显示工具调用<br/>⚙️运行中"]
    BACK -->|"event: tool_result"| TR["展示结果<br/>✅完成"]
    BACK -->|"event: thinking"| TH["思考过程<br/>💭折叠"]
    BACK -->|"event: citations"| CI["引用来源<br/>📖"]
    BACK -->|"event: done"| D["完成<br/>✅"]

    style BACK fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style T fill:#FFF9C4,stroke:#F9A825
    style TC fill:#F3E5F5,stroke:#7B1FA2
    style D fill:#C8E6C9,stroke:#2E7D32
```

---

## 消息渲染

```mermaid
graph TB
    MSG["AssistantMessage"] --> THINK["💭 思考过程<br/>可折叠面板"]
    MSG --> TOOLS["⚙️ 工具调用<br/>名称+参数+结果+耗时"]
    MSG --> CONTENT["📝 Markdown内容<br/>代码高亮/表格/列表"]
    MSG --> CITE["📖 引用来源<br/>可点击跳转"]
    MSG --> STATUS["状态指示器<br/>streaming/complete/error"]

    style MSG fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style THINK fill:#F3E5F5,stroke:#7B1FA2
    style TOOLS fill:#FFF9C4,stroke:#F9A825
    style CONTENT fill:#C8E6C9,stroke:#2E7D32
```

---

## 体验优化要点

| 优化点 | 说明 |
|--------|------|
| 首 Token < 500ms | 用户感知响应速度 |
| 打字机 30fps+ | 流式渲染流畅 |
| 工具调用实时展示 | 透明度+信任感 |
| 自动滚动+暂停 | 滚到底部/手动暂停 |
| 断线重连 | 指数退避重试 |
| Markdown 渲染 | 代码高亮/表格 |
| 可中断 | 停止生成按钮 |
| 快捷键 | Enter发送/Shift+Enter换行 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| SSE 流式接收 | ☐ |
| 打字机效果 | ☐ |
| 工具调用可视化 | ☐ |
| Markdown 渲染 | ☐ |
| 引用来源展示 | ☐ |
| 思考过程折叠 | ☐ |
| 自动滚动 | ☐ |
| 断线重连 | ☐ |
| 后端 SSE 端点 | ☐ |
