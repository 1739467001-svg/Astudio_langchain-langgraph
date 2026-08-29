# Agent 联邦学习与隐私保护深度图解

> 数据不动模型动+差分隐私+安全聚合。本图解可视化联邦学习。

---

```mermaid
graph TB
    HOSP_A["医院A<br/>本地数据"] --> LOCAL_A["本地训练"]
    HOSP_B["医院B<br/>本地数据"] --> LOCAL_B["本地训练"]
    HOSP_C["医院C<br/>本地数据"] --> LOCAL_C["本地训练"]

    LOCAL_A --> AGG["安全聚合<br/>FedAvg"]
    LOCAL_B --> AGG
    LOCAL_C --> AGG
    AGG --> GLOBAL["全局模型<br/>数据不出本地"]

    style AGG fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style GLOBAL fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 横向/纵向联邦 | ☐ |
| FedAvg聚合 | ☐ |
| 差分隐私 | ☐ |
| 安全聚合 | ☐ |
