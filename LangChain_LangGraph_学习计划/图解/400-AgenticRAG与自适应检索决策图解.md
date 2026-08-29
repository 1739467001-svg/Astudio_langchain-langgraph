# Agentic RAG 与自适应检索决策图解

> 传统 RAG 固定流程检索一次就生成。Agentic RAG 让 Agent 自主决策：要不要检索、查什么、够不够、要不要再查一轮。本图解可视化 Agentic RAG 全流程。

---

## 三代 RAG 演进

```mermaid
graph LR
    subgraph "第一代：朴素 RAG"
        R1["查询"] --> R2["向量检索 Top-K"] --> R3["LLM 生成"]
    end

    subgraph "第二代：高级 RAG"
        H1["查询"] --> H2["查询重写"] --> H3["检索"] --> H4["重排序"] --> H5["LLM 生成"]
    end

    subgraph "第三代：Agentic RAG"
        A1["查询"] --> A2{"需要检索?"}
        A2 -->|"否"| A7["直接回答"]
        A2 -->|"是"| A3["选择策略"]
        A3 --> A4["检索"]
        A4 --> A5{"够吗?"}
        A5 -->|"够"| A6["生成+校验"]
        A5 -->|"不够"| A8["重写查询"]
        A8 --> A3
    end

    style A2 fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style A5 fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style A6 fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## Agentic RAG 完整流程

```mermaid
graph TB
    Q["用户提问"] --> DECIDE{"检索决策器<br/>是否需要检索?"}
    DECIDE -->|"不需要"| DIRECT["直接回答<br/>闲聊/已知事实"]
    DECIDE -->|"需要"| STRAT{"选择检索策略"}
    
    STRAT -->|"向量"| VEC["语义检索"]
    STRAT -->|"关键词"| KW["精确匹配"]
    STRAT -->|"图谱"| GRAPH["关系检索"]
    STRAT -->|"混合"| HYBRID["多路召回"]
    
    VEC --> EVAL
    KW --> EVAL
    GRAPH --> EVAL
    HYBRID --> EVAL
    
    EVAL{"评估检索结果<br/>充分? 置信度?"}
    EVAL -->|"充分 + 高置信"| GEN["生成回答"]
    EVAL -->|"不够"| REWRITE["重写查询"]
    REWRITE --> STRAT
    
    GEN --> VERIFY{"事实校验<br/>幻觉检测"}
    VERIFY -->|"通过"| OUTPUT["✅ 输出回答<br/>+ 引用溯源"]
    VERIFY -->|"有幻觉"| REWRITE
    
    style DECIDE fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style EVAL fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style VERIFY fill:#FFCCBC,stroke:#D84315,stroke-width:3px
    style OUTPUT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 查询分解与多跳检索

```mermaid
graph TB
    Q["复杂问题<br/>对比A和B的优劣"] --> DECOMP["查询分解"]
    DECOMP --> SQ1["子问题1<br/>A的优点"]
    DECOMP --> SQ2["子问题2<br/>A的缺点"]
    DECOMP --> SQ3["子问题3<br/>B的优点"]
    DECOMP --> SQ4["子问题4<br/>B的缺点"]
    
    SQ1 --> R1["检索"] --> MERGE
    SQ2 --> R2["检索"] --> MERGE
    SQ3 --> R3["检索"] --> MERGE
    SQ4 --> R4["检索"] --> MERGE
    
    MERGE["去重合并<br/>交叉验证"] --> GEN["综合生成"]

    style DECOMP fill:#F3E5F5,stroke:#7B1FA2,stroke-width:2px
    style MERGE fill:#E3F2FD,stroke:#1565C0
    style GEN fill:#C8E6C9,stroke:#2E7D32
```

---

## 检索策略选择决策树

```mermaid
graph TB
    Q["用户问题"] --> Q1{"问题类型?"}
    Q1 -->|"事实查询"| F{"有精确关键词?"}
    Q1 -->|"分析推理"| A{"需要关系推理?"}
    Q1 -->|"操作流程"| P["关键词检索<br/>（精确匹配）"]
    Q1 -->|"对话延续"| C["少量检索 / 不检索"]
    
    F -->|"是"| KW["关键词检索"]
    F -->|"否"| VEC["向量检索"]
    A -->|"是"| GRAPH["图谱检索"]
    A -->|"否"| HYBRID["混合检索"]

    style Q1 fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style HYBRID fill:#FFF9C4,stroke:#F9A825
    style GRAPH fill:#F3E5F5,stroke:#7B1FA2
```

---

## Agentic RAG vs 传统 RAG 对比

| 维度 | 传统 RAG | Agentic RAG |
|------|----------|-------------|
| 检索次数 | 固定 1 次 | 1-3 次（自适应） |
| 检索策略 | 固定向量 | 动态选择 |
| 结果评估 | 无 | LLM 评估充分性 |
| 查询重写 | 无 | 自动重写 |
| 幻觉检测 | 无 | 事实校验 |
| LLM 调用 | 1 次 | 3-8 次 |
| 准确率 | ~70% | ~90% |
| 幻觉率 | ~15% | ~5% |
| 成本 | $0.001-0.01 | $0.005-0.05 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解三代 RAG 演进 | ☐ |
| 实现检索决策器 | ☐ |
| LangGraph 迭代检索循环 | ☐ |
| 检索结果评估节点 | ☐ |
| 查询重写/分解 | ☐ |
| 最大检索轮数限制 | ☐ |
| 事实校验/幻觉检测 | ☐ |
| 多源交叉验证 | ☐ |
| 成本优化策略 | ☐ |
