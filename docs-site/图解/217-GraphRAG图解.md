# GraphRAG 图解

> 用图解理解 GraphRAG 完整流程。

---

## 一、完整流程

```mermaid
graph TB
    subgraph 离线 &#123;"离线建图"&#125;
        D["文档"] --> EX["实体抽取"] --> REL["关系抽取"] --> STORE["存图+向量"]
    end
    subgraph 在线 &#123;"在线查询"&#125;
        Q["查询"] --> ROUTE&#123;"含关系词?"&#125;
        ROUTE -->|是| GRAPH["图谱查询"]
        ROUTE -->|否| VEC["向量检索"]
        GRAPH & VEC --> FUSE["融合"] --> LLM["生成"]
    end

    style ROUTE fill:#FFF9C4
    style LLM fill:#C8E6C9
```

---

## 二、检查清单

| 检查项 | 状态 |
|--------|------|
| 有实体抽取 | ☐ |
| 有混合查询 | ☐ |
