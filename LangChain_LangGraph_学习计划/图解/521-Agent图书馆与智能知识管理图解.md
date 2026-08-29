# Agent 图书馆与智能知识管理图解

> 检索→推荐→编目→知识图谱。本图解可视化图书馆 Agent。

---

```mermaid
graph TB
    QUERY["读者查询"] --> SEARCH["智能检索<br/>语义+元数据"]
    SEARCH --> RECOMMEND["阅读推荐"]
    BOOK["新书"] --> CATALOG["自动编目"]
    CATALOG --> KG["知识图谱"]

    style SEARCH fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style CATALOG fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style RECOMMEND fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 智能检索 | ☐ |
| 知识问答 | ☐ |
| 阅读推荐 | ☐ |
| 自动编目 | ☐ |
