# Agent 知识更新与增量学习图解

> 变更检测→增量更新→漂移检测→缓存失效。本图解可视化知识更新。

---

```mermaid
graph LR
    CHANGE["数据变更"] --> DETECT["变更检测"]
    DETECT --> UPDATE["增量更新"]
    UPDATE --> REINDEX["重新索引"]
    REINDEX --> CACHE["缓存失效"]

    style DETECT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style UPDATE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style CACHE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 变更检测 | ☐ |
| 增量更新 | ☐ |
| 漂移检测 | ☐ |
| 缓存失效 | ☐ |
