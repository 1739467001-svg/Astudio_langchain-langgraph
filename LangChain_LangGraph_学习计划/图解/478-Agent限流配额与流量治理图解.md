# Agent 限流配额与流量治理图解

> 令牌桶+滑动窗口+多维度配额+优先级调度。本图解可视化流量治理体系。

---

## 限流算法

```mermaid
graph TB
    ALG["限流算法"]

    ALG --> TB["令牌桶<br/>允许突发<br/>匀速补充"]
    ALG --> SW["滑动窗口<br/>精确<br/>窗口内计数"]
    ALG --> LB["漏桶<br/>匀速处理<br/>不允许突发"]

    style ALG fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style TB fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 多维度配额

```mermaid
graph TB
    REQ["请求"] --> U["用户级<br/>RPM/TPM/日配额"]
    U -->|"通过"| T["租户级<br/>组织配额"]
    T -->|"通过"| G["全局级<br/>系统总配额"]
    G -->|"通过"| EXEC["✅ 执行"]
    U -.->|"超限"| REJECT["⛔ 拒绝"]
    T -.->|"超限"| REJECT
    G -.->|"超限"| REJECT

    style EXEC fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style REJECT fill:#FFCCBC,stroke:#D84315
```

---

## 套餐配额

| 套餐 | RPM | TPM | 日配额 |
|------|-----|-----|--------|
| Free | 10 | 10K | 100 |
| Pro | 100 | 100K | 5000 |
| Enterprise | 1000 | 1M | 50000 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 四种算法 | ☐ |
| 令牌桶实现 | ☐ |
| 滑动窗口实现 | ☐ |
| 多维度配额 | ☐ |
| 优先级调度 | ☐ |
| 流量整形 | ☐ |
