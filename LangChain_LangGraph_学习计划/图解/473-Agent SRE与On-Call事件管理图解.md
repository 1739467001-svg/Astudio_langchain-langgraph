# Agent SRE 与 On-Call 事件管理图解

> SLI/SLO/错误预算+On-Call排班+事件生命周期。本图解可视化SRE体系。

---

## SLI/SLO/SLA

```mermaid
graph LR
    SLI["SLI<br/>指标<br/>成功率99.2%"] --> SLO["SLO<br/>目标<br/>>=99.5%"]
    SLO --> SLA["SLA<br/>承诺<br/>>=99.0%"]
    SLO --> EB["错误预算<br/>100%-99.5%=0.5%<br/>允许0.5%失败"]

    style EB fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style SLA fill:#FFCCBC,stroke:#D84315
```

---

## 事件生命周期

```mermaid
graph LR
    D["检测"] --> A["确认"] --> T["分诊"] --> I["调查"]
    I --> M["缓解"] --> R["解决"] --> P["复盘"]

    style D fill:#FFCCBC,stroke:#D84315
    style M fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style P fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## On-Call升级

```mermaid
graph TB
    ALERT["告警"] --> L1["L1 通知主值班<br/>Slack/钉钉"]
    L1 -->|"5分钟未确认"| L2["L2 通知备份"]
    L2 -->|"5分钟未确认"| L3["L3 通知全员<br/>+电话呼叫"]

    style L1 fill:#E3F2FD,stroke:#1565C0
    style L2 fill:#FFF9C4,stroke:#F9A825
    style L3 fill:#FFCCBC,stroke:#D84315,stroke-width:2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| SLI/SLO定义 | ☐ |
| 错误预算 | ☐ |
| On-Call排班 | ☐ |
| 告警升级 | ☐ |
| 事件管理流程 | ☐ |
| 复盘报告 | ☐ |
| Runbook自动化 | ☐ |
