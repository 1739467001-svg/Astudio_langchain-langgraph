# Agent 智能建筑与物业管理图解

> HVAC+照明+安防+电梯+能耗统一管理。本图解可视化建筑 Agent。

---

```mermaid
graph TB
    BMS["楼宇数据"] --> AGENT["建筑Agent"]
    AGENT --> HVAC["暖通优化"]
    AGENT --> LIGHT["照明控制"]
    AGENT --> SECURITY["安防联动"]
    AGENT --> ENERGY["能耗优化"]

    style AGENT fill:#FFF9C4,stroke:#F9A825,stroke-width=3px
    style ENERGY fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| HVAC优化 | ☐ |
| 照明控制 | ☐ |
| 安防联动 | ☐ |
| 设备监控 | ☐ |
| 物业服务 | ☐ |
