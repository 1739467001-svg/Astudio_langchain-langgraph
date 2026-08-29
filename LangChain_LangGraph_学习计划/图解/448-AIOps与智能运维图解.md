# AIOps 与智能运维图解

> AI 运维 AI——异常检测、故障预测、智能诊断、自愈闭环。本图解可视化 AIOps 架构。

---

## 核心闭环

```mermaid
graph TB
    MONITOR["监控指标"] --> DETECT["异常检测<br/>Z-Score偏离"]
    DETECT --> DIAGNOSE["智能诊断<br/>LLM分析日志"]
    DIAGNOSE --> HEAL["自愈执行<br/>自动修复"]
    HEAL --> VERIFY["验证恢复"]
    VERIFY --> LEARN["学习记录<br/>更新知识库"]
    LEARN --> MONITOR

    style DETECT fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style DIAGNOSE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style HEAL fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 异常检测

```mermaid
graph TB
    METRIC["实时指标"] --> BASELINE{"偏离基线?"}
    BASELINE -->|"Z>3"| ANOMALY["⚠️ 异常"]
    BASELINE -->|"正常"| CONTINUE["继续监控"]
    ANOMALY --> LLM["LLM语义分析<br/>可能根因+严重度"]
    LLM --> ALERT["告警+诊断"]

    style ANOMALY fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style LLM fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

---

## 传统 vs AIOps

| 维度 | 传统运维 | AIOps |
|------|---------|-------|
| 监控 | 人工看 | AI分析 |
| 告警 | 阈值 | 异常检测 |
| 诊断 | 人工查日志 | LLM分析 |
| 修复 | 人工操作 | 自动修复 |
| 预测 | 被动 | 主动预测 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 异常检测器 | ☐ |
| 语义异常分析 | ☐ |
| 故障预测 | ☐ |
| LLM智能诊断 | ☐ |
| 自愈闭环 | ☐ |
| 运维知识学习 | ☐ |
