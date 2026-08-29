# Agent 实时决策与流式处理图解

> 数据流→窗口→检测→决策→行动。本图解可视化实时 Agent。

---

```mermaid
graph LR
    STREAM["数据流<br/>Kafka"] --> WINDOW["滑动窗口"]
    WINDOW --> DETECT["异常检测<br/>Z-Score"]
    DETECT --> DECIDE["Agent决策"]
    DECIDE --> ACT["实时行动"]

    style STREAM fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style DETECT fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style ACT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 流式架构 | ☐ |
| 滑动窗口 | ☐ |
| 实时异常 | ☐ |
| 事件驱动 | ☐ |
