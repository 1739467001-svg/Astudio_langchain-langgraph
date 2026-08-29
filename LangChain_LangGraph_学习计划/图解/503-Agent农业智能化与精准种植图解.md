# Agent 农业智能化与精准种植图解

> 传感器→环境分析→病虫害→灌溉→产量。本图解可视化农业 Agent。

---

## 农业 Agent 流程

```mermaid
graph TB
    SENSOR["传感器数据"] --> ANALYZE["环境分析"]
    ANALYZE --> CROP["作物管理<br/>灌溉/施肥"]
    ANALYZE --> PEST["病虫害识别<br/>VLM图像"]
    ANALYZE --> YIELD["产量预测"]
    CROP --> ADVISE["种植建议"]

    style ANALYZE fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style PEST fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style ADVISE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 环境监测 | ☐ |
| 病虫害识别(VLM) | ☐ |
| 灌溉决策 | ☐ |
| 产量预测 | ☐ |
