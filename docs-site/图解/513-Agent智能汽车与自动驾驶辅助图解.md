# Agent 智能汽车与自动驾驶辅助图解

> 传感器融合→感知→预测→决策→控制+语音。本图解可视化车载 Agent。

---

```mermaid
graph TB
    SENSOR["传感器融合<br/>摄像头/雷达/激光雷达"] --> PERCEIVE["环境感知"]
    PERCEIVE --> PREDICT["危险预测"]
    PREDICT --> DECIDE["驾驶决策"]
    DECIDE --> CONTROL["车辆控制"]
    PERCEIVE --> VOICE["语音助手"]

    style SENSOR fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style DECIDE fill:#FFF9C4,stroke:#F9A825,stroke-width=3px
    style CONTROL fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 多传感器融合 | ☐ |
| 危险预测 | ☐ |
| 车载语音 | ☐ |
| 驾驶决策 | ☐ |
