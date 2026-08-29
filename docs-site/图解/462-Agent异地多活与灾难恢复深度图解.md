# Agent 异地多活与灾难恢复深度图解

> 一个机房挂了另一个接管。本图解可视化多活架构和故障切换。

---

## 双活架构

```mermaid
graph TB
    subgraph "区域A 北京"
        AGENT_A["Agent集群<br/>3副本"]
        DB_A["PostgreSQL<br/>主库"]
    end
    subgraph "区域B 上海"
        AGENT_B["Agent集群<br/>3副本"]
        DB_B["PostgreSQL<br/>从库"]
    end

    DNS["DNS<br/>就近路由"] --> AGENT_A
    DNS --> AGENT_B
    AGENT_A --> DB_A
    AGENT_B --> DB_B
    DB_A <-->|"双向同步"| DB_B

    style DNS fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style DB_A fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 灾备等级

| 模式 | RTO | RPO | 成本 |
|------|-----|-----|------|
| 冷备 | 小时级 | 小时级 | 低 |
| 温备 | 分钟级 | 分钟级 | 中 |
| 热备 | 秒级 | 秒级 | 高 |
| 多活 | 0 | 0 | 最高 |

---

## 故障切换流程

```mermaid
graph TB
    FAIL["区域A故障"] --> DETECT["检测到不可用"] --> DNS_SWITCH["DNS切换到B"]
    DNS_SWITCH --> VERIFY["验证B服务正常"] --> OK["✅ 用户无感知"]

    style FAIL fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style OK fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| RTO/RPO理解 | ☐ |
| 多区域路由 | ☐ |
| 故障切换 | ☐ |
| 数据库同步 | ☐ |
| 向量库同步 | ☐ |
| 灾备演练 | ☐ |
