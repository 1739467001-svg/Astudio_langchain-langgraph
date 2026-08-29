# 高级 RAG 模式图解

> 用图解方式理解 RAG 的进阶优化模式，知道什么时候用哪种。

---

## 一、RAG 优化全景

```mermaid
graph TB
    subgraph RAG管线 ["RAG 完整管线与优化点"]
        Q["用户问题"] --> OPT1["🔍 检索前优化<br/>查询改写 / HyDE"]
        OPT1 --> RET["向量检索"]
        RET --> OPT2["🔍 检索后优化<br/>重排序 / 压缩"]
        OPT2 --> CTX["组装上下文"]
        CTX --> GEN["LLM 生成回答"]
        GEN --> A["最终回答"]
    end

    style OPT1 fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style OPT2 fill:#FFE0B2,stroke:#E65100,stroke-width:3px
```

## 二、HyDE 原理图解

```mermaid
graph TB
    subgraph 基础检索 ["基础检索：问题直接向量化"]
        B_Q["问题: '怎么省钱'"] --> B_E["Embedding"]
        B_E --> B_S["向量检索"]
        B_S --> B_R["结果: 可能不相关"]
        Note1["问题太口语化<br/>与文档语言差异大"]
    end

    subgraph HyDE ["HyDE：先生成假设回答再向量化"]
        H_Q["问题: '怎么省钱'"]
        H_Q --> H_LLM["LLM生成假设回答<br/>'省钱方法包括：减少开支、<br/>预算管理、投资理财...'"]
        H_LLM --> H_E["对假设回答做Embedding"]
        H_E --> H_S["向量检索"]
        H_S --> H_R["结果: 更相关<br/>(假设回答接近文档语言)"]
    end

    style 基础检索 fill:#FFE0B2
    style HyDE fill:#C8E6C9
    style Note1 fill:#FFCDD2
```

### HyDE 效果对比

```mermaid
graph LR
    subgraph 向量空间 ["向量空间示意"]
        Q["⭐ '怎么省钱'<br/>(口语化)"]
        H["🔵 假设回答<br/>'成本控制方法...'"]
        D1["📄 文档: '成本优化策略'<br/>(正式)"]
        D2["📄 文档: '预算管理方法'<br/>(正式)"]
    end

    Q -.->|"距离远❌"| D1
    Q -.->|"距离远❌"| D2
    H -->|"距离近✅"| D1
    H -->|"距离近✅"| D2

    style Q fill:#FF6F00,color:#fff
    style H fill:#1565C0,color:#fff
    style D1 fill:#C8E6C9
    style D2 fill:#C8E6C9
```

## 三、重排序流程图解

```mermaid
graph TB
    subgraph 两阶段检索 ["两阶段检索（向量+重排序）"]
        Q["用户问题"] --> V["向量检索<br/>Top-10<br/>(快但粗)"]
        V --> V1["候选1: 相似度0.85<br/>可能不太相关"]
        V --> V2["候选2: 相似度0.82<br/>可能不太相关"]
        V --> V3["候选3: 相似度0.80<br/>可能很相关"]
        V --> V4["候选4-N..."]

        V1 & V2 & V3 & V4 --> R["Cross-Encoder重排序<br/>逐对评分(问题,文档)<br/>(慢但准)"]

        R --> R1["重排1: 候选3 分数0.92 ✓"]
        R --> R2["重排2: 候选1 分数0.88 ✓"]
        R --> R3["重排3: 候选2 分数0.85 ✓"]
        R4["其余丢弃 ✗"]

        R1 & R2 & R3 --> TOP["Top-3 最终结果"]
    end

    style V fill:#E3F2FD
    style R fill:#FFE0B2
    style TOP fill:#C8E6C9
    style R4 fill:#FFCDD2
```

### 向量检索 vs Cross-Encoder

```mermaid
graph TB
    subgraph 向量检索 ["向量检索（Bi-Encoder）"]
        B1["问题 → 向量"]
        B2["文档 → 向量"]
        B3["计算向量距离"]
        B4["✅ 快（可预计算）<br/>❌ 粗（独立编码）"]
    end

    subgraph CrossEncoder ["Cross-Encoder"]
        C1["问题 + 文档<br/>一起输入模型"]
        C2["输出相关性分数"]
        C3["✅ 准（联合编码）<br/>❌ 慢（不可预计算）"]
    end

    style 向量检索 fill:#C8E6C9
    style CrossEncoder fill:#FFE0B2
```

## 四、多查询检索图解

```mermaid
graph TB
    subgraph 多查询 ["Multi-Query Retrieval"]
        Q["原始问题:<br/>'Python怎么做网页'"]
        Q --> LLM["LLM改写为多个角度"]
        LLM --> Q1["变体1: 'Python Web开发入门'"]
        LLM --> Q2["变体2: 'Python Flask教程'"]
        LLM --> Q3["变体3: 'Python Django框架'"]

        Q1 --> S1["检索Top-3"]
        Q2 --> S2["检索Top-3"]
        Q3 --> S3["检索Top-3"]

        S1 --> D1["文档A, B, C"]
        S2 --> D2["文档B, D, E"]
        S3 --> D3["文档A, F, G"]

        D1 & D2 & D3 --> MERGE["合并去重"]
        MERGE --> FINAL["最终: A, B, C, D, E, F, G<br/>(覆盖更多角度)"]
    end

    style LLM fill:#FFF9C4
    style MERGE fill:#C8E6C9
```

## 五、父子文档检索图解

```mermaid
graph TB
    subgraph 传统chunk ["传统分割：chunk大小固定"]
        T1["文档(10000字)"] --> T2["块1(500字)<br/>块2(500字)<br/>块3(500字)..."]
        T3["问题：小块上下文不完整<br/>大块检索不精准"]
    end

    subgraph 父子文档 ["父子文档：小块检索，大块返回"]
        P1["父文档(2000字)<br/>→ 用于返回完整上下文"]
        P1 --> C1["子块1(400字) → 向量化检索"]
        P1 --> C2["子块2(400字) → 向量化检索"]
        P1 --> C3["子块3(400字) → 向量化检索"]
        P1 --> C4["子块4(400字) → 向量化检索"]

        C2 --> MATCH["匹配到子块2"]
        MATCH --> RETURN["返回父文档(2000字)<br/>完整上下文"]
    end

    style 传统chunk fill:#FFE0B2
    style 父子文档 fill:#C8E6C9
```

## 六、混合检索图解

```mermaid
graph TB
    subgraph 混合检索 ["Hybrid Search: 关键词 + 向量"]
        Q["问题: 'Python GIL'"]

        Q --> KW["关键词检索(BM25)<br/>精确匹配'Python'和'GIL'"]
        Q --> VEC["向量检索<br/>语义相似度"]

        KW --> KR["结果1: 'Python GIL详解'<br/>(精确匹配✅)"]
        KW --> KR2["结果2: 'Python多线程'"]

        VEC --> VR["结果1: '全局解释器锁的影响'<br/>(语义相关✅)"]
        VEC --> VR2["结果2: 'Python并发编程'"]

        KR & KR2 & VR & VR2 --> FUSE["融合排序(RRF)"]
        FUSE --> FINAL["最终结果<br/>(兼顾精确和语义)"]
    end

    style KW fill:#E3F2FD
    style VEC fill:#FFF3E0
    style FUSE fill:#C8E6C9
```

## 七、模式组合：完整高级 RAG 管线

```mermaid
graph TB
    Q["用户问题"] --> RW["查询改写<br/>口语化→正式表达"]
    RW --> HYDE["HyDE<br/>生成假设回答"]
    HYDE --> MQ["多查询<br/>生成3个变体"]
    MQ --> V1["向量检索x3"]
    MQ --> KW1["关键词检索x3"]
    V1 --> MERGE1["合并去重"]
    KW1 --> MERGE1
    MERGE1 --> RR["重排序<br/>Cross-Encoder精排"]
    RR --> TOP["取Top-3"]
    TOP --> PD["父子文档<br/>返回完整上下文"]
    PD --> GEN["LLM生成回答"]

    style RW fill:#E3F2FD
    style HYDE fill:#FFF9C4
    style MQ fill:#FFE0B2
    style RR fill:#F3E5F5
    style PD fill:#C8E6C9
```

## 八、效果-成本权衡图

```mermaid
graph TB
    subgraph 权衡 ["效果 vs 成本"]
        direction LR
        L1["基础RAG<br/>1次检索<br/>效果: ★★★☆<br/>成本: ★☆☆☆"]
        L2["+查询改写<br/>+1次LLM调用<br/>效果: ★★★★<br/>成本: ★★☆☆"]
        L3["+HyDE<br/>+1次LLM调用<br/>效果: ★★★★☆<br/>成本: ★★★☆"]
        L4["+重排序<br/>+模型推理<br/>效果: ★★★★★<br/>成本: ★★★☆"]
        L5["+多查询+混合<br/>多次检索<br/>效果: ★★★★★+<br/>成本: ★★★★☆"]
    end

    L1 --> L2 --> L3 --> L4 --> L5

    style L1 fill:#C8E6C9
    style L5 fill:#FFCDD2
```

> 💡 不是模式越多越好——根据实际效果和成本选择最小够用的组合。
