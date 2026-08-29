# Agent 可靠性与韧性工程图解

> 快速失败、优雅降级、熔断保护。本图解可视化韧性六原则和降级链。

---

## 韧性六原则

```mermaid
graph TB
    R["韧性设计"]

    R --> FF["快速失败<br/>立即报错"]
    R --> GD["优雅降级<br/>主方案→备方案"]
    R --> ISO["故障隔离<br/>不级联崩溃"]
    R --> RT["自动重试<br/>指数退避"]
    R --> CB["熔断保护<br/>持续失败→熔断"]
    R --> RC["状态恢复<br/>检查点续跑"]

    style R fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style GD fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style CB fill:#FFCCBC,stroke:#D84315,stroke-width:2px
```

---

## 降级链

```mermaid
graph TB
    L1["Level 1: 主模型<br/>GPT-4o"] -.->|"失败"| L2["Level 2: 便宜模型<br/>GPT-4o-mini"]
    L2 -.->|"失败"| L3["Level 3: 缓存<br/>语义缓存"]
    L3 -.->|"未命中"| L4["Level 4: 默认回复<br/>服务暂不可用"]

    style L1 fill:#C8E6C9,stroke:#2E7D32
    style L2 fill:#FFF9C4,stroke:#F9A825
    style L3 fill:#E3F2FD,stroke:#1565C0
    style L4 fill:#FFCCBC,stroke:#D84315
```

---

## 三态熔断器

```mermaid
stateDiagram-v2
    [*] --> Closed
    Closed --> Open : 失败次数 ≥ 阈值
    Open --> HalfOpen : 超时后恢复
    HalfOpen --> Closed : 3次成功
    HalfOpen --> Open : 1次失败
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 韧性六原则 | ☐ |
| 分级异常处理 | ☐ |
| 降级链 | ☐ |
| 三态熔断器 | ☐ |
| 背压限流 | ☐ |
| 健康检查自愈 | ☐ |
| 混沌工程 | ☐ |
