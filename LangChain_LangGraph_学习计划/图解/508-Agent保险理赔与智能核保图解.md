# Agent 保险理赔与智能核保图解

> 核保→理赔→定损→欺诈检测。本图解可视化保险 Agent。

---

```mermaid
graph TB
    CLAIM["理赔申请"] --> DOC["材料审核"]
    DOC --> ASSESS["损失评估"]
    ASSESS --> FRAUD{"欺诈检测?"}
    FRAUD -->|"无"| PAY["赔付"]
    FRAUD -->|"有风险"| INVESTIGATE["人工调查"]

    style DOC fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style FRAUD fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style PAY fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 智能核保 | ☐ |
| 材料审核 | ☐ |
| 损失评估 | ☐ |
| 赔付计算 | ☐ |
| 欺诈检测 | ☐ |
