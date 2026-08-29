# Agent 知识管理与企业搜索深度图解

> 混合搜索+知识图谱+权限过滤+推荐。本图解可视化企业知识管理。

---

```mermaid
graph TB
    SOURCE["知识来源"] --> INGEST["摄入+索引"]
    INGEST --> SEARCH["混合搜索<br/>向量+关键词+图谱"]
    SEARCH --> FILTER["权限过滤"]
    FILTER --> ANSWER["企业问答+引用"]
    INGEST --> RECOMMEND["知识推荐"]

    style SEARCH fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style ANSWER fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 混合搜索 | ☐ |
| 意图理解 | ☐ |
| 权限过滤 | ☐ |
| 知识图谱 | ☐ |
| 推荐 | ☐ |
