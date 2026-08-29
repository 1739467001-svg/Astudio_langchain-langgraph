# MCP 协议与 LangChain 工具集成图解

> MCP（Model Context Protocol）是 AI 工具的 USB-C：一个协议连接所有工具和数据源。本图解可视化 MCP 架构与 LangChain 集成方式。

---

## MCP 整体架构

```mermaid
graph TB
    subgraph "MCP Host（AI 应用）"
        AGENT["LangGraph Agent"]
        CLIENT["MCP Client"]
        AGENT --> CLIENT
    end

    CLIENT <-->|"MCP 协议<br/>stdio / SSE"| GW["MCP 协议层"]

    GW --> S1["MCP Server: Slack<br/>发消息/读频道"]
    GW --> S2["MCP Server: GitHub<br/>Issue/PR/代码"]
    GW --> S3["MCP Server: PostgreSQL<br/>查询数据库"]
    GW --> S4["MCP Server: 文件系统<br/>读写文件"]
    GW --> S5["自定义 Server<br/>企业内部工具"]

    style AGENT fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style CLIENT fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style GW fill:#F3E5F5,stroke:#7B1FA2,stroke-width:3px
```

---

## 三大原语

```mermaid
graph LR
    subgraph "MCP Server 提供的三种能力"
        T["🔧 Tools<br/>可执行函数<br/>发消息/查DB/运行代码"]
        R["📄 Resources<br/>可读数据<br/>文件/日志/快照"]
        P["📝 Prompts<br/>提示模板<br/>代码审查/分析"]
    end

    T -->|"tools/list<br/>tools/call"| C["Client"]
    R -->|"resources/list<br/>resources/read"| C
    P -->|"prompts/list<br/>prompts/get"| C

    style T fill:#E3F2FD,stroke:#1565C0
    style R fill:#FFF3E0,stroke:#E65100
    style P fill:#F3E5F5,stroke:#7B1FA2
    style C fill:#C8E6C9,stroke:#2E7D32
```

---

## LangChain 集成流程

```mermaid
graph LR
    A["MultiServerMCPClient"] --> B["连接 MCP Servers"]
    B --> C["get_tools()<br/>自动发现工具"]
    C --> D["转为 LangChain Tool"]
    D --> E["create_react_agent<br/>(model, tools)"]
    E --> F["Agent 自主调用<br/>MCP 工具"]

    style A fill:#E3F2FD,stroke:#1565C0
    style C fill:#FFF9C4,stroke:#F9A825
    style D fill:#E8F5E9,stroke:#2E7D32
    style F fill:#C8E6C9,stroke:#2E7D32
```

---

## 传输方式对比

```mermaid
graph TB
    subgraph "Stdio（本地）"
        A1["Client"] <-->|"stdin/stdout"| B1["Server 子进程"]
    end

    subgraph "SSE / HTTP（远程）"
        A2["Client"] <-->|"HTTP + SSE"| B2["远程 Server"]
    end

    style A1 fill:#E3F2FD,stroke:#1565C0
    style B1 fill:#C8E6C9,stroke:#2E7D32
    style A2 fill:#FFF3E0,stroke:#E65100
    style B2 fill:#F3E5F5,stroke:#7B1FA2
```

| 维度 | Stdio | SSE/HTTP |
|------|-------|----------|
| 部署 | 本机 | 远程 |
| 配置 | 零配置 | 需 URL + 认证 |
| 延迟 | 极低 | 网络延迟 |
| 扩展性 | 单机 | 可分布式 |
| 安全 | 进程隔离 | 需额外认证 |

---

## MCP vs 传统 Tool

```mermaid
graph TB
    subgraph "传统 Tool"
        T1["Python 函数"] --> T2["@tool 装饰器"]
        T2 --> T3["仅限 LangChain"]
    end

    subgraph "MCP Tool"
        M1["MCP Server"] --> M2["标准协议"]
        M2 --> M3["跨框架通用"]
        M2 --> M4["进程级隔离"]
        M2 --> M5["动态发现"]
    end

    style T3 fill:#FFCCBC,stroke:#D84315
    style M3 fill:#C8E6C9,stroke:#2E7D32
```

---

## 安全策略

```mermaid
graph LR
    REQ["工具调用请求"] --> WL{"白名单检查"}
    WL -->|"通过"| PF{"参数过滤"}
    WL -->|"拒绝"| BLOCK["拒绝调用"]
    PF --> TO{"超时检查"}
    TO -->|"正常"| TR["截断结果"]
    TO -->|"超时"| TIMEOUT["超时降级"]
    TR --> RET["返回结果"]

    style WL fill:#FFCCBC,stroke:#D84315
    style PF fill:#FFF9C4,stroke:#F9A825
    style TO fill:#E3F2FD,stroke:#1565C0
    style TR fill:#C8E6C9,stroke:#2E7D32
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解 MCP 三大原语 | ☐ |
| 能用 MultiServerMCPClient | ☐ |
| 在 LangGraph Agent 中使用 MCP | ☐ |
| 能自建 MCP Server | ☐ |
| 理解传输方式选择 | ☐ |
| 配置了安全策略 | ☐ |
| 了解 MCP vs 传统 Tool | ☐ |
| 会用 MCP Inspector 调试 | ☐ |
