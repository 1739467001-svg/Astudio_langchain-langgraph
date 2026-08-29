# Agent 多轮谈判与协商协议图解

> 出价→还价→达成/僵局。本图解可视化谈判流程。

---

```mermaid
graph TB
    INIT["发起"] --> OFFER["出价"]
    OFFER --> EVAL["评估"]
    EVAL --> ACC{"接受?"}
    ACC -->|"是"| DEAL["✅ 达成"]
    ACC -->|"否"| COUNTER["还价"]
    COUNTER --> MAX{"轮次上限?"}
    MAX -->|"否"| OFFER
    MAX -->|"是"| DEAD["僵局/仲裁"]

    style DEAL fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style DEAD fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 谈判流程 | ☐ |
| 让步策略 | ☐ |
| 僵局处理 | ☐ |
