# Agent 混合搜索与语义检索增强图解

> 向量+关键词+语义三路召回→RRF融合→重排序。本图解可视化混合检索流程。

---

## 多路召回+融合

```mermaid
graph TB
    Q["用户查询"] --> VEC["向量检索<br/>语义相似<br/>Top-10"]
    Q --> KW["关键词检索<br/>精确匹配<br/>Top-10"]
    Q --> HYDE["HyDE<br/>假想文档<br/>Top-5"]

    VEC --> RRF["RRF融合<br/>倒数排名融合"]
    KW --> RRF
    HYDE --> RRF

    RRF --> RERANK["重排序<br/>Cross-Encoder"]
    RERANK --> TOP["Top-5 最终结果"]

    style RRF fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style RERANK fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style TOP fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 查询重写策略

```mermaid
graph TB
    Q["原始查询"] --> MULTI["Multi-Query<br/>生成多个变体"]
    Q --> HYDE2["HyDE<br/>生成假想回答"]
    Q --> SYN["同义词扩展"]
    Q --> DECOMP["查询分解<br/>拆成子问题"]

    style MULTI fill:#E3F2FD,stroke:#1565C0
    style HYDE2 fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

---

## 检索效果对比

| 方法 | 准确率 | 延迟 |
|------|--------|------|
| 纯向量 | 75% | 50ms |
| 纯关键词 | 70% | 20ms |
| 混合+RRF | 85% | 100ms |
| 混合+重排 | 92% | 300ms |
| 混合+HyDE+重排 | 94% | 500ms |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 混合搜索架构 | ☐ |
| RRF融合 | ☐ |
| Multi-Query | ☐ |
| HyDE | ☐ |
| 同义词扩展 | ☐ |
| 重排序 | ☐ |
