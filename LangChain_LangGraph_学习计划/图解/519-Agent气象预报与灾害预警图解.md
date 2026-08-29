# Agent 气象预报与灾害预警图解

> 数据分析→预报→预警→公众服务。本图解可视化气象 Agent。

---

```mermaid
graph TB
    DATA["气象数据"] --> ANALYZE["数据分析"]
    ANALYZE --> FORECAST["预报生成"]
    FORECAST --> WARN["灾害预警<br/>蓝/黄/橙/红"]
    ANALYZE --> SERVICE["公众服务<br/>穿衣/出行"]

    style DATA fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style WARN fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style SERVICE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 预报生成 | ☐ |
| 灾害预警(5类) | ☐ |
| 预警分级 | ☐ |
| 穿衣建议 | ☐ |
| 出行建议 | ☐ |
