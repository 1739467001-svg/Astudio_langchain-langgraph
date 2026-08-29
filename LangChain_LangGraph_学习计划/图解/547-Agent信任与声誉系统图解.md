# Agent 信任与声誉系统图解

> 直接信任+声誉信任+认证信任。本图解可视化信任体系。

---

```mermaid
graph TB
    T["信任体系"]
    T --> D["直接信任<br/>交互历史"]
    T --> R["声誉信任<br/>第三方评价"]
    T --> C["认证信任<br/>身份凭证"]
    D --> SCORE["声誉分数"]
    R --> SCORE
    C --> SCORE
    SCORE --> RANK["Agent排名"]

    style T fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style SCORE fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 三种信任模型 | ☐ |
| 声誉计算 | ☐ |
| Agent排名 | ☐ |
| 防欺诈 | ☐ |
