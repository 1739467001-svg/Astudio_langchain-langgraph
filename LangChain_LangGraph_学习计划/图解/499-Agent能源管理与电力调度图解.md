# Agent 能源管理与电力调度图解

> 负荷预测→发电调度→储能→需求响应。本图概可视化能源 Agent。

---

## 能源调度流程

```mermaid
graph TB
    FORECAST["负荷预测"] --> GEN["发电调度<br/>风/光/火/储"]
    GEN --> BALANCE["供需平衡"]
    BALANCE --> STORAGE["储能管理<br/>谷充峰放"]
    BALANCE --> DEMAND["需求响应<br/>削峰填谷"]

    style BALANCE fill:#FFF9C4,stroke:#F9A825,stroke-width=3px
    style STORAGE fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 负荷预测 | ☐ |
| 发电调度 | ☐ |
| 储能管理 | ☐ |
| 需求响应 | ☐ |
| 负荷预警 | ☐ |
