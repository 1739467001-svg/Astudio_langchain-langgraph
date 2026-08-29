# Agent 计费与成本管理深度图解

> 运营 Agent 平台要算清成本和收入。本图解可视化成本归因和计费方案。

---

## 成本归因

```mermaid
graph TB
    COST["成本归因"]

    COST --> USER["按用户<br/>谁花了多少"]
    COST --> TENANT["按租户<br/>哪个组织"]
    COST --> TASK["按任务类型<br/>QA/编码/分析"]
    COST --> MODEL["按模型<br/>哪个模型最贵"]
    COST --> TIME["按时间<br/>每日/每月趋势"]

    style COST fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style MODEL fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style USER fill:#C8E6C9,stroke:#2E7D32
```

---

## 计费模式

```mermaid
graph TB
    BILL["计费方案"]

    BILL --> PPU["按量计费<br/>每次请求收费<br/>适合低频用户"]
    BILL --> SUB["订阅制<br/>月费+超额<br/>适合稳定用户"]
    BILL --> TIER["阶梯计费<br/>用量越多越便宜<br/>适合大客户"]

    style BILL fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style PPU fill:#C8E6C9,stroke:#2E7D32
    style SUB fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style TIER fill:#F3E5F5,stroke:#7B1FA2
```

---

## 预算控制闭环

```mermaid
graph TB
    REQ["请求"] --> CHECK{"预算检查"}
    CHECK -->|"月预算不足"| REJECT["拒绝<br/>提示余额不足"]
    CHECK -->|"日限制超"| REJECT2["拒绝<br/>达到日上限"]
    CHECK -->|"OK"| EXEC["执行"]
    EXEC --> DEDUCT["扣费"]
    DEDUCT --> OPT{"自动优化?"}
    OPT -->|"简单任务用贵模型"| DOWNGRADE["降级模型"]
    OPT -->|"上下文过大"| COMPRESS["压缩"]
    OPT -->|"无缓存"| CACHE["启用缓存"]

    style CHECK fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style EXEC fill:#C8E6C9,stroke:#2E7D32
    style DOWNGRADE fill:#FFF9C4,stroke:#F9A825
```

---

## 成本优化策略

| 策略 | 节省 | 实现 |
|------|------|------|
| 模型降级 | 10-15x | 简单任务用便宜模型 |
| 语义缓存 | 20-30% | 相似查询复用 |
| 上下文压缩 | 15-20% | 减少Token |
| 批量去重 | 5-10% | 合并相同请求 |
| Prompt缓存 | 50% | 固定前缀缓存 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 多维度成本追踪 | ☐ |
| 计费方案设计 | ☐ |
| 预算控制闭环 | ☐ |
| 自动成本优化 | ☐ |
| 成本仪表盘 | ☐ |
