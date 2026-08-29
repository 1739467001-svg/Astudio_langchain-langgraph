# GraphRAG 与知识图谱实体抽取图解

> 向量 RAG 找不到关系，GraphRAG 沿图谱"走"。本图解可视化图谱构建和混合检索。

---

## 向量 RAG vs GraphRAG

```mermaid
graph TB
    subgraph "向量 RAG"
        Q1["张三和李四什么关系?"] --> VEC1["搜索'张三'"]
        VEC1 --> R1["找到含张三文档"]
        R1 --> FAIL1["但文档没提李四 ❌"]
    end

    subgraph "GraphRAG"
        Q2["张三和李四什么关系?"] --> GRAPH["图谱查询"]
        GRAPH --> R2["张三-[同事]→李四"]
        R2 --> OK1["直接返回关系 ✅"]
    end

    style FAIL1 fill:#FFCCBC,stroke:#D84315
    style OK1 fill:#C8E6C9,stroke:#2E7D32
```

---

## 图谱构建流程

```mermaid
graph LR
    DOC["文档"] --> EXTRACT["LLM 实体抽取"]
    EXTRACT --> ENTITIES["实体列表<br/>人/组织/地点"]
    EXTRACT --> RELATIONS["关系列表<br/>works_for/located_in"]
    ENTITIES --> GRAPH["知识图谱"]
    RELATIONS --> GRAPH

    style EXTRACT fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style GRAPH fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 混合检索

```mermaid
graph TB
    Q["用户查询"] --> ENT["识别实体"]
    ENT --> VEC["向量检索<br/>语义相似文档"]
    ENT --> GRAPH_Q["图谱检索<br/>邻居/路径"]
    VEC --> MERGE["合并上下文"]
    GRAPH_Q --> MERGE
    MERGE --> LLM["LLM 生成回答"]

    style MERGE fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style GRAPH_Q fill:#F3E5F5,stroke:#7B1FA2
```

---

## 检索能力对比

| 能力 | 向量RAG | GraphRAG |
|------|---------|----------|
| 相似检索 | ★★★★★ | ★★★ |
| 关系推理 | ★ | ★★★★★ |
| 多跳查询 | ❌ | ★★★★★ |
| 实体汇总 | ❌ | ★★★★ |
| 构建成本 | 低 | 高 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解向量vs图谱 | ☐ |
| 实体关系抽取 | ☐ |
| 图谱存储 | ☐ |
| 邻居/路径查找 | ☐ |
| 混合检索 | ☐ |
| Neo4j 集成 | ☐ |
