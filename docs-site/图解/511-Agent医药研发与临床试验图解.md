# Agent 医药研发与临床试验图解

> 文献→化合物→临床→药物警戒。本图解可视化医药研发 Agent。

---

```mermaid
graph TB
    LIT["文献分析<br/>靶点发现"] --> COMPOUND["化合物筛选"]
    COMPOUND --> PRECLINICAL["临床前"]
    PRECLINICAL --> TRIAL["临床试验<br/>I/II/III期"]
    TRIAL --> PV["药物警戒<br/>不良反应监测"]

    style LIT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style TRIAL fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style PV fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 文献分析 | ☐ |
| 化合物筛选 | ☐ |
| 试验设计 | ☐ |
| 试验监测 | ☐ |
| 药物警戒 | ☐ |
