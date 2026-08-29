# Agent 海洋探索与海事管理图解

> 航行安全+环境+渔业+搜救。本图解可视化海事 Agent。

---

```mermaid
graph TB
    AIS["AIS数据"] --> NAV["航行安全<br/>碰撞预警"]
    BUOY["浮标数据"] --> ENV["海洋环境"]
    VESSEL["渔船"] --> FISH["渔业管理"]
    SOS["遇险"] --> SAR["搜救辅助"]

    style NAV fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style SAR fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style FISH fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 碰撞预警 | ☐ |
| 环境监测 | ☐ |
| 渔业管理 | ☐ |
| 搜救方案 | ☐ |
