# Prompt 注册中心图解

> Prompt 从散落代码变为可管理的资产——注册中心 + 版本管理 + A/B测试。

---

```mermaid
graph TB
    DEV["开发者"] --> REG["注册中心<br/>存储+版本+Hash"]
    REG --> V1["Prompt v1"]
    REG --> V2["Prompt v2"]
    V1 --> A&#123;"A/B测试<br/>50/50分流"&#125;
    V2 --> A
    A -->|A组| UA["50%用户"]
    A -->|B组| UB["50%用户"]
    UA & UB --> METRICS["效果对比<br/>准确率/满意度/成本"]
    METRICS --> WIN&#123;"胜出?"&#125;
    WIN -->|是| PROMOTE["全量切换"]
    WIN -->|否| REVERT["回滚旧版"]

    style REG fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style A fill:#E3F2FD,stroke:#1565C0
    style PROMOTE fill:#C8E6C9
    style REVERT fill:#FFCDD2,stroke:#C62828
```

---

## A/B 测试阶段

| 阶段 | 流量比例 | 持续 | 判定指标 |
|------|----------|------|----------|
| 灰度 | 5% | 1h | 错误率 |
| 扩量 | 20% | 4h | 满意度 |
| 半量 | 50% | 1d | 准确率 |
| 全量 | 100% | 持续 | 全指标 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有注册中心 | ☐ |
| 有版本管理 | ☐ |
| 有A/B测试 | ☐ |
| 支持秒级回滚 | ☐ |
