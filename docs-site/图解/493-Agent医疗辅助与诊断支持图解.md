# Agent 医疗辅助与诊断支持图解

> 辅助不替代，所有建议需医生确认。本图解可视化医疗 Agent。

---

## 诊断流程

```mermaid
graph TB
    SYMPTOM["症状采集"] --> TRIAGE["分诊"]
    TRIAGE -->|"紧急"| EMERG["⚠️立即就医"]
    TRIAGE -->|"非紧急"| DIAG["鉴别诊断"]
    DIAG --> LAB["检验建议"]
    LAB --> INTERPRET["结果解读"]
    INTERPRET --> ADVICE["辅助建议"]
    ADVICE --> DOCTOR["👨‍⚕️医生确认"]

    style TRIAGE fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style DOCTOR fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 三原则

| 原则 | 说明 |
|------|------|
| 辅助不替代 | 所有建议需医生确认 |
| 安全优先 | 宁保守不冒险 |
| 可溯源 | 建议有文献支撑 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 症状采集 | ☐ |
| 分诊(紧急判断) | ☐ |
| 鉴别诊断辅助 | ☐ |
| 检验结果解读 | ☐ |
| 用药安全检查 | ☐ |
| Human-in-the-Loop | ☐ |
