# RAG 高级检索策略图解

> 用图解理解 5 种查询重写与扩展策略的原理、适用场景和选型决策。

---

## 一、为什么需要查询重写

```mermaid
graph TB
    subgraph 问题 {"直接检索的盲区"}
        Q["用户: '怎么提升模型效果'"] --> MISS["❌ 文档写的是'提高模型性能'<br/>措辞不同，召回失败"]
    end

    subgraph 解决 {"查询重写后"}
        Q2["原始查询"] --> RW["重写为多个变体"]
        RW --> HIT["✅ 匹配到不同措辞的文档"]
    end

    style 问题 fill:#FFCDD2
    style 解决 fill:#C8E6C9
```

---

## 二、五种策略总览

```mermaid
graph TB
    ROOT["RAG高级检索"] --> S1["查询重写<br/>改写措辞"]
    ROOT --> S2["Multi-Query<br/>多路检索+RRF"]
    ROOT --> S3["HyDE<br/>假设答案嵌入"]
    ROOT --> S4["查询分解<br/>拆分子问题"]
    ROOT --> S5["后退提问<br/>先问抽象问题"]

    style ROOT fill:#1565C0,color:#fff
```

---

## 三、Multi-Query 流程

```mermaid
graph TB
    Q["原始查询"] --> LLM["LLM生成N个变体"]
    LLM --> Q1["变体1"]
    LLM --> Q2["变体2"]
    LLM --> Q3["变体3"]
    Q1 --> R1["检索Top-K"]
    Q2 --> R2["检索Top-K"]
    Q3 --> R3["检索Top-K"]
    R1 & R2 & R3 --> FUSE["RRF融合排序"]
    FUSE --> FINAL["最终结果"]

    style LLM fill:#FFF9C4
    style FUSE fill:#C8E6C9
```

---

## 四、HyDE 原理

```mermaid
graph LR
    Q["短查询: '什么是向量数据库'"] --> LLM["LLM生成假设答案"]
    LLM --> A["假设答案: '向量数据库是存储<br/>高维向量的系统...'"]
    A --> EMBED["嵌入假设答案"]
    EMBED --> SEARCH["用假设答案向量检索"]
    SEARCH --> HIT["✅ 命中"]

    style LLM fill:#FFF9C4
    style A fill:#E3F2FD
    style HIT fill:#C8E6C9
```

---

## 五、查询分解

```mermaid
graph TB
    Q["复杂: '对比Milvus和Pinecone的性能、成本'"] --> SPLIT["LLM拆分"]
    SPLIT --> SQ1["子问题1: Milvus性能"]
    SPLIT --> SQ2["子问题2: Pinecone性能"]
    SPLIT --> SQ3["子问题3: Milvus成本"]
    SPLIT --> SQ4["子问题4: Pinecone成本"]
    SQ1 & SQ2 & SQ3 & SQ4 --> SEARCH["各自检索"]
    SEARCH --> COMBINE["合并结果"]

    style SPLIT fill:#FFF9C4
    style COMBINE fill:#C8E6C9
```

---

## 六、后退提问

```mermaid
graph TB
    Q["具体: 'GPT-4o多模态准确率'"] --> SB["LLM生成后退问题"]
    SB --> BQ["后退: 'GPT-4o多模态能力概述'"]
    Q --> S1["检索具体信息"]
    BQ --> S2["检索背景知识"]
    S1 & S2 --> C["合并: 具体+背景"]

    style SB fill:#FFF9C4
    style C fill:#C8E6C9
```

---

## 七、选型决策

```mermaid
graph TB
    Q1["措辞差异大？"] -->|是| S1["查询重写/Multi-Query"]
    Q1 -->|否| Q2["问题复杂多方面？"]
    Q2 -->|是| S2["查询分解"]
    Q2 -->|否| Q3["需背景知识？"]
    Q3 -->|是| S3["后退提问"]
    Q3 -->|否| Q4["查询太短？"]
    Q4 -->|是| S4["HyDE"]
    Q4 -->|否| S5["直接检索"]

    style S1 fill:#E3F2FD
    style S2 fill:#C8E6C9
    style S3 fill:#F3E5F5
    style S4 fill:#FFF9C4
```

---

## 八、RRF融合原理

```mermaid
graph TB
    subgraph RRF {"Reciprocal Rank Fusion"}
        L1["路1: A→B→C→D"]
        L2["路2: B→A→E→D"]
        L3["路3: A→E→B→C"]
        L1 & L2 & L3 --> F["score = Σ 1/(60+rank)"]
        F --> R["融合: A→B→C→D→E"]
    end

    style F fill:#FFF9C4
    style R fill:#C8E6C9
```

---

## 九、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解查询重写原理 | ☐ |
| 实现了Multi-Query | ☐ |
| 理解HyDE原理 | ☐ |
| 能实现查询分解 | ☐ |
| 能实现后退提问 | ☐ |
| 有选型决策 | ☐ |
