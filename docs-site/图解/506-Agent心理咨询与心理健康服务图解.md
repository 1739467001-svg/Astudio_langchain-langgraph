# Agent 心理咨询与心理健康服务图解

> 情绪评估→支持→教育→危机干预。本图解可视化心理健康 Agent。

---

## 心理健康流程

```mermaid
graph TB
    USER["用户对话"] --> ASSESS["情绪评估"]
    ASSESS --> RISK&#123;"风险等级?"&#125;
    RISK -->|"低"| SUPPORT["情绪支持"]
    RISK -->|"中"| EDUCATE["心理教育"]
    RISK -->|"高"| CRISIS["危机干预<br/>提供热线"]
    RISK -->|"危急"| EMERGENCY["🚨紧急转介"]

    style ASSESS fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style CRISIS fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style EMERGENCY fill:#FFCCBC,stroke:#D84315,stroke-width=3px
    style SUPPORT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 伦理边界

| 原则 | 说明 |
|------|------|
| 不做诊断 | 不贴精神疾病标签 |
| 不开处方 | 不推荐药物 |
| 危机转介 | 自伤风险立即转人工 |
| 知情同意 | 用户知道与AI对话 |
| 数据保护 | 心理数据特别敏感 |
| 不替代专业 | 始终建议专业咨询 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 情绪评估 | ☐ |
| 危机检测 | ☐ |
| 情绪支持 | ☐ |
| 心理教育 | ☐ |
| 危机干预 | ☐ |
| 情绪追踪 | ☐ |
