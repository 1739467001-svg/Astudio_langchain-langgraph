# Agent 设计模式与参考架构图解

> 12 种 Agent 设计模式一图看懂。本图解可视化模式分类和选型矩阵。

---

## 12 种模式分类

```mermaid
graph TB
    P["Agent 设计模式"]

    P --> SINGLE["单 Agent"]
    P --> MULTI["多 Agent"]
    P --> FLOW["流程"]

    SINGLE --> S1["ReAct<br/>推理+行动"]
    SINGLE --> S2["Plan-Execute<br/>先规划后执行"]
    SINGLE --> S3["Reflection<br/>自我反思"]
    SINGLE --> S4["ReWOO<br/>推理无观察"]

    MULTI --> M1["Supervisor<br/>主管分发"]
    MULTI --> M2["Hierarchical<br/>层级委派"]
    MULTI --> M3["Network<br/>Agent互联"]
    MULTI --> M4["Debate<br/>辩论共识"]

    FLOW --> F1["Map-Reduce<br/>并行扇出"]
    FLOW --> F2["Pipeline<br/>串行"]
    FLOW --> F3["Router<br/>条件路由"]
    FLOW --> F4["Saga<br/>补偿事务"]

    style P fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style S1 fill:#C8E6C9,stroke:#2E7D32
    style M1 fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style F4 fill:#F3E5F5,stroke:#7B1FA2
```

---

## ReAct 循环

```mermaid
graph LR
    T["Thought<br/>推理"] --> A["Action<br/>行动"]
    A --> O["Observation<br/>观察"]
    O --> T
    O -->|"完成"| ANSWER["回答"]

    style T fill:#E3F2FD,stroke:#1565C0
    style A fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style ANSWER fill:#C8E6C9,stroke:#2E7D32
```

---

## 选型矩阵

| 需求 | 推荐 | 备选 |
|------|------|------|
| 通用问答 | ReAct | Plan-Execute |
| 复杂多步 | Plan-Execute | ReWOO |
| 高质量 | Reflection | Debate |
| 多角色 | Supervisor | Hierarchical |
| 多角度 | Debate | Map-Reduce |
| 批量 | Map-Reduce | Pipeline |
| 分流 | Router | Supervisor |
| 事务 | Saga | Pipeline |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解12种模式 | ☐ |
| ReAct/Plan-Execute | ☐ |
| Reflection/Debate | ☐ |
| Supervisor/Hierarchical | ☐ |
| Map-Reduce/Saga | ☐ |
| 模式组合 | ☐ |
