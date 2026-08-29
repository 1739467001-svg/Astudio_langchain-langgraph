# Agent 跨平台与多端部署图解

> 一个 Agent 适配 Web/App/飞书/钉钉/小程序。本图解可视化渠道适配器架构。

---

## 渠道适配器架构

```mermaid
graph TB
    WEB["Web"] --> ADAPT["渠道适配器"]
    APP["App"] --> ADAPT
    WX["小程序"] --> ADAPT
    FS["飞书"] --> ADAPT
    DT["钉钉"] --> ADAPT

    ADAPT --> AGENT["统一Agent<br/>LangGraph"]

    style ADAPT fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style AGENT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 消息转换流程

```mermaid
graph LR
    IN["平台消息<br/>飞书/钉钉格式"] --> CONVERT_IN["入站转换<br/>→统一格式"]
    CONVERT_IN --> AGENT["Agent处理"]
    AGENT --> CONVERT_OUT["出站转换<br/>统一→平台格式"]
    CONVERT_OUT --> OUT["发送到平台"]

    style CONVERT_IN fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style CONVERT_OUT fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
```

---

## 平台差异

| 维度 | Web | 飞书 | 钉钉 | 小程序 |
|------|-----|------|------|--------|
| 流式 | SSE | WebSocket | WebSocket | 轮询 |
| 卡片 | HTML | ✅ | ✅ | ❌ |
| Markdown | 完整 | 部分 | 部分 | ❌ |
| 认证 | OAuth | 飞书OAuth | 钉钉OAuth | 微信 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 渠道适配器模式 | ☐ |
| 统一消息模型 | ☐ |
| 消息格式转换 | ☐ |
| Web/飞书/钉钉适配 | ☐ |
| 多渠道路由 | ☐ |
