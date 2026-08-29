# Agent 委托代理与权限委派图解

> 用户→A→B 委托链+审计。本图解可视化权限委派。

---

```mermaid
graph LR
    USER["用户"] --> A["Agent A"]
    A --> B["Agent B"]
    B --> ACT["执行操作"]
    ACT --> AUDIT["审计链"]

    style A fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style B fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style AUDIT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 委托链 | ☐ |
| 权限检查 | ☐ |
| 撤销 | ☐ |
| 审计链 | ☐ |
