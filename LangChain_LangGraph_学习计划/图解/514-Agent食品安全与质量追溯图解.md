# Agent 食品安全与质量追溯图解

> 检测→追溯→预警→召回。本图解可视化食品安全 Agent。

---

```mermaid
graph TB
    SAMPLE["食品样品"] --> DETECT["质量检测<br/>VLM+理化"]
    DETECT --> COMPARE{"符合标准?"}
    COMPARE -->|"是"| PASS["放行"]
    COMPARE -->|"否"| TRACE["追溯源头"]
    TRACE --> RECALL["召回建议"]

    style DETECT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style TRACE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style PASS fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style RECALL fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 质量检测(VLM) | ☐ |
| 全链追溯 | ☐ |
| 根源定位 | ☐ |
| 风险预警 | ☐ |
