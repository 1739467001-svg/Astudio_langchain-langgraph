# Agent 生态系统与标准互操作图解

> MCP 连接工具、A2A 连接 Agent、Agent Card 自描述。本图解可视化生态四层和标准现状。

---

## 四层生态

```mermaid
graph TB
    APP["应用层<br/>客服/分析/编程"]
    FRAME["框架层<br/>LangGraph/SDK/CrewAI/AutoGen"]
    PROTO["协议层<br/>MCP/A2A/Function Calling"]
    MODEL["模型层<br/>OpenAI/Anthropic/Local"]

    APP --> FRAME
    FRAME --> PROTO
    PROTO --> MODEL

    style APP fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style PROTO fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style MODEL fill:#C8E6C9,stroke:#2E7D32
```

---

## 标准化现状

| 标准 | 层级 | 成熟度 | 采用 |
|------|------|--------|------|
| Function Calling | 模型接口 | 高 | 广泛 |
| MCP | 工具协议 | 中 | 增长中 |
| A2A | Agent通信 | 早期 | Google推动 |
| Agent Card | Agent描述 | 早期 | 研究 |
| OWASP Top10 | 安全 | 中 | 共识 |

---

## Agent 市场愿景

```mermaid
graph LR
    DEV["开发者发布Agent"] --> MARKET["Agent市场<br/>注册+发现"]
    USER["用户搜索Agent"] --> MARKET
    MARKET --> CALL["按需调用"]
    A1["Agent A"] -.->|"协作"| A2["Agent B"]
    A2 -.->|"协作"| A3["Agent C"]

    style MARKET fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style CALL fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四层生态 | ☐ |
| MCP 工具互操作 | ☐ |
| A2A Agent通信 | ☐ |
| Agent Card | ☐ |
| 跨框架迁移 | ☐ |
| Agent注册中心 | ☐ |
