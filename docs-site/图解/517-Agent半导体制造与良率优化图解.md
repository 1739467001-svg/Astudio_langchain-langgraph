# Agent 半导体制造与良率优化图解

> 缺陷分析→良率分析→工艺优化。本图解可视化半导体 Agent。

---

```mermaid
graph TB
    WAFER["晶圆数据"] --> DEFECT["缺陷分析<br/>VLM分类"]
    DEFECT --> YIELD["良率分析<br/>根因定位"]
    YIELD --> OPT["工艺优化<br/>参数调整"]

    style DEFECT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style OPT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 缺陷分析 | ☐ |
| VLM分类 | ☐ |
| 良率分析 | ☐ |
| 工艺优化 | ☐ |
