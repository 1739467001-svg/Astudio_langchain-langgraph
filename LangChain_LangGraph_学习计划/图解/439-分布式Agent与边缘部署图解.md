# 分布式 Agent 与边缘部署图解

> Agent 分布到多节点、推理推到边缘设备。本图解可视化分布式架构和边缘路由。

---

## 分布式架构

```mermaid
graph TB
    GW["API网关<br/>路由+负载均衡"]
    GW --> N1["节点1<br/>LLM推理"]
    GW --> N2["节点2<br/>LLM推理"]
    GW --> N3["节点3<br/>工具执行"]
    GW --> EDGE["边缘节点<br/>轻量推理"]
    N1 --> STATE["共享状态<br/>Redis"]
    N2 --> STATE
    N3 --> STATE

    style GW fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style EDGE fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style STATE fill:#C8E6C9,stroke:#2E7D32
```

---

## 边缘智能路由

```mermaid
graph TB
    Q["用户请求"] --> LOCAL["本地模型<br/>快速响应"]
    LOCAL --> CONF{"置信度?"}
    CONF -->|">0.8"| RETURN["✅ 返回<br/>边缘完成"]
    CONF -->|"<0.8"| CLOUD["☁️ 云端模型<br/>复杂处理"]
    CLOUD --> RETURN

    style LOCAL fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style CLOUD fill:#FFF9C4,stroke:#F9A825
```

---

## 容灾故障转移

```mermaid
graph TB
    NODE1["节点1 ❌"] -.->|"故障"| DETECT["检测到故障"]
    DETECT --> FAILOVER["故障转移"]
    FAILOVER --> NODE2["节点2 ✅<br/>接管请求"]

    style NODE1 fill:#FFCCBC,stroke:#D84315
    style NODE2 fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解分布式架构 | ☐ |
| 跨节点通信 | ☐ |
| 边缘智能路由 | ☐ |
| 边缘缓存 | ☐ |
| 分布式状态管理 | ☐ |
| 容灾故障转移 | ☐ |
