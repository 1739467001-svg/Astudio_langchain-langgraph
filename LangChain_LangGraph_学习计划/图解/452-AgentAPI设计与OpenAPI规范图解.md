# Agent API 设计与 OpenAPI 规范图解

> 同步/流式/异步/WebSocket 四种 API 模式。本图解可视化 API 架构和端点设计。

---

## 四种 API 模式

```mermaid
graph TB
    API["Agent API"]

    API --> SYNC["同步<br/>请求→等待→响应<br/><5秒"]
    API --> STREAM["流式 SSE<br/>逐步输出<br/>打字机效果"]
    API --> ASYNC["异步任务<br/>提交→轮询/回调<br/>长耗时"]
    API --> WS["WebSocket<br/>双向实时<br/>语音/协作"]

    style API fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style STREAM fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style ASYNC fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

---

## 端点设计

```mermaid
graph LR
    CLIENT["客户端"] --> CHAT["POST /v1/chat<br/>同步对话"]
    CLIENT --> STREAM_EP["POST /v1/chat/stream<br/>SSE流式"]
    CLIENT --> TASK["POST /v1/tasks<br/>异步任务"]
    CLIENT --> STATUS["GET /v1/tasks/:id<br/>查询状态"]
    CLIENT --> SESSION["POST /v1/sessions<br/>会话管理"]

    style STREAM_EP fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style TASK fill:#E3F2FD,stroke:#1565C0
```

---

## 认证方案

| 方案 | 适用 | 方式 |
|------|------|------|
| JWT | 用户 | Bearer Token |
| API Key | Agent间 | X-API-Key 头 |
| OAuth | 第三方 | 授权码流程 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 四种API模式 | ☐ |
| 端点设计 | ☐ |
| OpenAPI文档 | ☐ |
| 认证鉴权 | ☐ |
| 版本管理 | ☐ |
| 限流配额 | ☐ |
| SDK生成 | ☐ |
