# Agent 微服务拆分与服务网格图解

> 单体→微服务+Istio治理。本图解可视化拆分策略和服务网格能力。

---

## 单体→微服务

```mermaid
graph TB
    subgraph "单体"
        M["一个进程<br/>对话+检索+工具"]
    end
    subgraph "微服务"
        GW["API网关"] --> CHAT["对话服务"]
        GW --> SEARCH["检索服务"]
        GW --> TOOLS["工具服务"]
        CHAT --> SEARCH
        CHAT --> TOOLS
    end

    style M fill:#FFCCBC,stroke:#D84315
    style GW fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style CHAT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 服务网格能力

```mermaid
graph TB
    MESH["服务网格"]

    MESH --> TRAFFIC["流量管理<br/>路由/负载均衡/熔断/重试"]
    MESH --> SEC["安全<br/>mTLS/认证/授权"]
    MESH --> OBS["可观测<br/>追踪/指标/日志"]
    MESH --> RES["弹性<br/>金丝雀/蓝绿/故障注入"]

    style MESH fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style TRAFFIC fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style SEC fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

---

## 服务间通信

```mermaid
graph LR
    CHAT["对话服务"] -->|"同步HTTP/gRPC"| SEARCH["检索服务"]
    CHAT -->|"异步消息队列"| TOOLS["工具服务"]
    TOOLS -->|"回调结果"| CHAT

    style CHAT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style SEARCH fill:#C8E6C9,stroke:#2E7D32
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 拆分原则 | ☐ |
| 何时拆分 | ☐ |
| 同步/异步通信 | ☐ |
| Istio服务网格 | ☐ |
| API网关 | ☐ |
| mTLS安全 | ☐ |
