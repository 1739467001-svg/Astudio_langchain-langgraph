# Agent 认知架构与思维模型图解

> 双系统思考+元认知+偏差缓解。本图解可视化认知架构。

---

```mermaid
graph TB
    INPUT["输入"] --> S1["系统1<br/>快思考<br/>直觉"]
    INPUT --> S2["系统2<br/>慢思考<br/>深度推理"]
    S1 --> CONF{"置信度高?"}
    CONF -->|"是"| OUT["输出"]
    CONF -->|"否"| S2
    S2 --> OUT
    OUT --> META["元认知<br/>反思+评估"]

    style S1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style S2 fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style META fill:#F3E5F5,stroke:#7B1FA2
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 双系统架构 | ☐ |
| 元认知 | ☐ |
| 认知偏差 | ☐ |
| 偏差缓解 | ☐ |
