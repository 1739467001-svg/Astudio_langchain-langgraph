# Agent 智能制造与工业互联网图解

> 传感器→边缘→Agent→监控/预测/调度/质检。本图解可视化工业 Agent。

---

## 工业Agent流程

```mermaid
graph TB
    SENSOR["传感器数据"] --> EDGE["边缘计算"]
    EDGE --> AGENT["工业Agent"]
    AGENT --> MONITOR["状态监控"]
    AGENT --> PREDICT["故障预测"]
    AGENT --> SCHEDULE["生产调度"]
    AGENT --> QUALITY["质量检测"]

    style AGENT fill:#FFF9C4,stroke:#F9A825,stroke-width=3px
    style MONITOR fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 设备监控 | ☐ |
| 故障预测 | ☐ |
| 生产调度 | ☐ |
| 质量检测 | ☐ |
| 边缘计算 | ☐ |
