# Agent 语义缓存与智能缓存策略深度图解

> 精确匹配+语义匹配+前缀缓存三层缓存。本图解可视化缓存架构。

---

## 多层缓存

```mermaid
graph TB
    Q["用户查询"] --> L1["L1 精确匹配<br/>字典/Redis<br/>0ms"]
    L1 -->|"未命中"| L2["L2 语义匹配<br/>Embedding相似度<br/>50ms"]
    L2 -->|"未命中"| L3["L3 前缀缓存<br/>Prompt前缀<br/>免费加速"]
    L3 -->|"未命中"| LLM["LLM调用<br/>500-5000ms"]
    LLM --> STORE["存入缓存"]
    STORE --> L1
    STORE --> L2

    style L1 fill:#C8E6C9,stroke:#2E7D32
    style L2 fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style LLM fill:#FFCCBC,stroke:#D84315
```

---

## 语义匹配原理

```mermaid
graph LR
    Q1["Python怎么读文件"] --> EMB1["Embedding"]
    Q2["Python读取文件的方法"] --> EMB2["Embedding"]
    EMB1 --> SIM&#123;"余弦相似度<br/>0.95 > 0.92"&#125;
    EMB2 --> SIM
    SIM -->|"命中"| CACHE["✅ 返回缓存"]

    style SIM fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style CACHE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 缓存失效策略

| 失效原因 | 触发条件 | 范围 |
|---------|---------|------|
| TTL过期 | 超过1小时 | 全部 |
| Prompt变更 | 版本号不同 | 全部 |
| 模型切换 | 模型名变化 | 全部 |
| 数据更新 | 知识库变更 | 相关项 |
| LRU淘汰 | 缓存满 | 低命中 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 语义缓存原理 | ☐ |
| 多层缓存 | ☐ |
| LRU淘汰 | ☐ |
| TTL过期 | ☐ |
| 失效策略 | ☐ |
| 效果分析 | ☐ |
