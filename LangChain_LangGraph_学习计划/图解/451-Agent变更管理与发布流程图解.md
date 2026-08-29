# Agent 变更管理与发布流程图解

> 每次变更可控、可追踪、可回滚。本图解可视化变更管理流程和灰度发布。

---

## 变更管理流程

```mermaid
graph LR
    PROPOSE["提出变更"] --> REVIEW["评审"]
    REVIEW --> APPROVE{"审批"}
    APPROVE -->|"通过"| TEST["测试"]
    APPROVE -->|"拒绝"| REJECT["❌ 拒绝"]
    TEST --> CANARY["灰度发布"]
    CANARY --> MONITOR{"监控"}
    MONITOR -->|"正常"| FULL["✅ 全量"]
    MONITOR -->|"异常"| ROLLBACK["⬅️ 回滚"]
    FULL --> ARCHIVE["归档"]

    style APPROVE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style FULL fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style ROLLBACK fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

---

## 灰度发布阶段

```mermaid
graph LR
    S0["内部测试<br/>0%"] --> S1["1%灰度"] --> S2["5%"] --> S3["25%"] --> S4["50%"] --> S5["全量"]
    S1 -.->|"质量不达标"| S0
    S2 -.->|"质量不达标"| S1

    style S0 fill:#C8E6C9,stroke:#2E7D32
    style S5 fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 变更类型与风险

| 类型 | 风险 | 需审批 |
|------|------|--------|
| Prompt变更 | 中 | 是 |
| 模型切换 | 高 | 是 |
| 工具更新 | 中 | 是 |
| 配置变更 | 低 | 否 |
| 代码变更 | 高 | 是 |
| 数据更新 | 低 | 否 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 变更分类与风险 | ☐ |
| 变更注册中心 | ☐ |
| 审批流程 | ☐ |
| 灰度发布管理 | ☐ |
| 自动回滚 | ☐ |
| 变更审计 | ☐ |
