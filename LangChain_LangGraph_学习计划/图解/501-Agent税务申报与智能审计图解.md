# Agent 税务申报与智能审计图解

> 发票→计算→申报→审计。本图解可视化税务 Agent。

---

## 税务流程

```mermaid
graph TB
    INVOICE["发票管理"] --> VERIFY["验真+查重"]
    VERIFY --> CALC["税额计算<br/>增值税/所得税"]
    CALC --> DECLARE["申报表生成"]
    DECLARE --> COMPLIANCE["合规审核"]
    COMPLIANCE --> FILE["电子申报"]
    FILE --> AUDIT["智能审计"]

    style INVOICE fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style CALC fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style FILE fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 发票解析 | ☐ |
| 验真+查重 | ☐ |
| 增值税计算 | ☐ |
| 申报表生成 | ☐ |
| 合规检查 | ☐ |
| 智能审计 | ☐ |
| 税务优化 | ☐ |
