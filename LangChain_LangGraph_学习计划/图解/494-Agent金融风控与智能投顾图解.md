# Agent 金融风控与智能投顾图解

> KYC→风险评估→投资建议→反欺诈→审计。本图解可视化金融 Agent。

---

## 金融流程

```mermaid
graph TB
    USER["用户请求"] --> KYC["身份验证+KYC"]
    KYC --> RISK["风险评估<br/>风险等级+承受度"]
    RISK --> ADVISE["建议生成"]
    ADVISE --> COMPLIANCE{"合规检查"}
    COMPLIANCE -->|"通过"| OUTPUT["输出"]
    COMPLIANCE -->"不通过"| REJECT["拒绝"]
    OUTPUT --> AUDIT["审计日志"]

    style KYC fill:#FFCCBC,stroke:#D84315,stroke-width:2px
    style COMPLIANCE fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style AUDIT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 能力

| 能力 | 说明 |
|------|------|
| 风控评估 | 用户风险等级+信用评分 |
| 投顾建议 | 资产配置+风险提示 |
| 反欺诈 | 规则引擎+LLM分析 |
| 审计追踪 | 链式哈希不可篡改 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 风险评估 | ☐ |
| 信用评估 | ☐ |
| 投资建议 | ☐ |
| 反欺诈 | ☐ |
| 合规检查 | ☐ |
| 审计日志 | ☐ |
