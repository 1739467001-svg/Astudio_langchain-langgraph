# Agent 法律辅助与合同审查图解

> 合同解析→风险识别→合规检查→律师确认。本图解可视化法律 Agent。

---

## 审查流程

```mermaid
graph TB
    CONTRACT["合同上传"] --> PARSE["解析提取"]
    PARSE --> CLASSIFY["条款分类"]
    CLASSIFY --> RISK["风险识别"]
    RISK --> COMPLIANCE["合规检查"]
    COMPLIANCE --> REPORT["审查报告"]
    REPORT --> LAWYER["👨‍⚖️律师确认"]

    style PARSE fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style RISK fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style LAWYER fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 审查维度

| 维度 | 检查 |
|------|------|
| 违约责任 | 是否对等 |
| 付款条件 | 是否合理 |
| 终止条款 | 是否公平 |
| 保密范围 | 是否过宽 |
| 知识产权 | 归属是否清晰 |
| 争议解决 | 管辖是否合理 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 合同解析 | ☐ |
| 条款分类 | ☐ |
| 风险识别 | ☐ |
| 合规检查 | ☐ |
| 法律问答 | ☐ |
| 律师确认 | ☐ |
