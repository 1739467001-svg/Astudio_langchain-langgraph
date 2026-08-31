# 第12课：高级 RAG 技术——让检索更精准

> **学习目标**：理解基础 RAG 的局限，学会多查询检索、上下文压缩、重排序、自适应检索、父子文档等高级 RAG 策略，掌握何时用哪种策略。

> **配套知识库**：`知识库/08_高级RAG与检索策略技术手册.md`

---

## 本课导航

| 小节 | 主题 | 预计时间 |
|------|------|---------|
| 1 | 基础 RAG 的局限 | 10 分钟 |
| 2 | 多查询检索 | 15 分钟 |
| 3 | 上下文压缩 | 10 分钟 |
| 4 | 重排序 | 15 分钟 |
| 5 | 自适应检索 | 10 分钟 |
| 6 | 策略选择 | 10 分钟 |

---

## 1. 基础 RAG 的局限

### 问题场景

```mermaid
graph TB
    Q["用户问题: '和传统搜索比<br/>向量检索有什么优势'"]
    Q --> R["基础 RAG 检索"]
    R --> D1["文档1: 向量检索原理"]
    R --> D2["文档2: BM25 原理"]
    R --> D3["文档3: 新闻报道(不相关)"]
    D1 --> LLM["LLM 回答"]
    D2 --> LLM
    D3 --> LLM
    LLM --> A["回答不完整<br/>因为关键词匹配不精准"]

    style Q fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style R fill:#FFF3E0,stroke:#E65100
    style D1 fill:#E8F5E9,stroke:#2E7D32
    style D2 fill:#E8F5E9,stroke:#2E7D32
    style D3 fill:#FCE4EC,stroke:#C62828,stroke-width:2px
    style A fill:#FCE4EC,stroke:#C62828,stroke-width:2px
```

> **图解说明**：基础 RAG 的问题——用户一个查询可能涉及多个子问题（向量检索的优势 vs 传统搜索的劣势），但基础 RAG 只用原始查询检索，可能遗漏关键文档或引入不相关文档。

### 基础 RAG 的四大问题

| 问题 | 表现 | 原因 |
|------|------|------|
| 查询不精准 | 检索不到关键文档 | 用户问题太短/模糊 |
| 上下文太长 | Token 浪费 + LLM 分心 | 所有文档全塞进去 |
| 排序不佳 | 最重要的文档排后面 | 纯靠向量相似度 |
| 缺乏自适应 | 不同问题用同一策略 | 没有路由 |

---

## 2. 多查询检索（Multi-Query）

### 生活类比

用户问"怎么学 Python"，你可以换三种方式问图书馆管理员：
1. "Python 编程入门教程"
2. "适合新手的 Python 书籍"
3. "Python 自学路线规划"

——多查几次，查到的更全面。

```mermaid
graph TB
    Q["用户问题: '怎么学Python'"]
    Q --> LLM["LLM 改写"]
    LLM --> Q1["改写1: 'Python 编程入门教程'"]
    LLM --> Q2["改写2: '适合新手的Python书籍'"]
    LLM --> Q3["改写3: 'Python自学路线'"]
    Q1 --> R1["检索 → doc A, B"]
    Q2 --> R2["检索 → doc B, C"]
    Q3 --> R3["检索 → doc D"]
    R1 --> M["合并去重<br/>doc A, B, C, D"]
    R2 --> M
    R3 --> M

    style Q fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style LLM fill:#FFF3E0,stroke:#E65100,stroke-width:2px
    style Q1 fill:#E8F5E9,stroke:#2E7D32
    style Q2 fill:#E8F5E9,stroke:#2E7D32
    style Q3 fill:#E8F5E9,stroke:#2E7D32
    style M fill:#F3E5F5,stroke:#6A1B9A,stroke-width:2px
```

> **图解说明**：多查询检索用 LLM 把用户一个问题改写成多个不同角度的查询，分别检索，合并去重。像派多个人去图书馆找同一主题的书——每人找的角度不同，合在一起更全。

### 代码

```python
from langchain.retrievers.multi_query import MultiQueryRetriever
from langchain_openai import ChatOpenAI

retriever = MultiQueryRetriever(
    retriever=base_retriever,
    llm=ChatOpenAI(model="gpt-4o-mini"),
)

# 自动生成 3 个改写查询，分别检索，合并去重
docs = retriever.invoke("怎么学 Python")
# 返回比基础检索更多、更全的文档
```

---

## 3. 上下文压缩（Contextual Compression）

### 生活类比

你问"汉堡的热量"，基础 RAG 返回了一整本"快餐百科"。上下文压缩就像**划重点**——只提取关于热量的那几句话。

```mermaid
graph LR
    A["原始文档<br/>2000 token"] --> B["压缩器"]
    B --> C["压缩后<br/>200 token<br/>只留相关信息"]
    C --> D["送入 LLM"]

    A2["原始文档2<br/>1500 token"] --> B2["压缩器"]
    B2 --> C2["压缩后<br/>100 token"]
    C2 --> D

    style A fill:#FCE4EC,stroke:#C62828,stroke-width:2px
    style B fill:#FFF3E0,stroke:#E65100,stroke-width:2px
    style C fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style D fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
```

> **图解说明**：上下文压缩在检索后加了一步——用小模型对每个文档提取与问题相关的段落，只把精华部分送入大模型。原始 2000 token 压缩到 200 token，大幅降低成本。

### 代码

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain_openai import ChatOpenAI
from langchain.retrievers.document_compressors import LLMChainExtractor

# 用小模型做压缩
compressor = LLMChainExtractor.from_llm(
    ChatOpenAI(model="gpt-4o-mini")
)

# 包装基础检索器
compression_retriever = ContextualCompressionRetriever(
    base_retriever=base_retriever,
    base_compressor=compressor,
)

docs = compression_retriever.invoke("汉堡的热量是多少")
# 返回精简后的片段，而非整篇文档
```

---

## 4. 重排序（Re-Ranking）

### 生活类比

基础检索像百度搜索第一页——粗排。重排序像**人工精选**——从第一页 10 条中挑出最相关的 3 条。

```mermaid
graph TB
    A["用户问题"] --> B["基础检索<br/>(向量相似度粗排)"]
    B --> C["Top-10 候选文档"]
    C --> D["Re-Ranker<br/>(交叉编码精排)"]
    D --> E["Top-3 精选文档"]
    E --> F["送入 LLM 回答"]

    style A fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style B fill:#FFF3E0,stroke:#E65100
    style C fill:#FCE4EC,stroke:#C62828
    style D fill:#F3E5F5,stroke:#6A1B9A,stroke-width:2px
    style E fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style F fill:#E3F2FD,stroke:#1565C0
```

> **图解说明**：重排序是两阶段策略——先用向量检索粗排得到 Top-10 候选，再用交叉编码模型精排，选出最相关的 Top-3。粗排快但粗，精排慢但准。

### 代码

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain_cohere import CohereRerank

# 使用 Cohere Rerank 模型
reranker = CohereRerank(top_n=3)

rerank_retriever = ContextualCompressionRetriever(
    base_retriever=base_retriever,
    base_compressor=reranker,
)

docs = rerank_retriever.invoke("什么是量子纠缠")
# 返回重排序后的 Top-3 最相关文档
```

---

## 5. 自适应检索（Self-Query）

### 生活类比

用户问"2023年发布的科幻电影"——这个查询有两部分：
- 语义部分："科幻电影" → 向量检索
- 过滤条件："2023年发布" → 元数据过滤

Self-Query 像一个**聪明的图书管理员**——能听懂你的要求，自动把"语义描述"和"筛选条件"分开。

```mermaid
graph TB
    Q["用户: '2023年发布的科幻电影'"]
    Q --> P["Self-Query 拆分"]
    P --> S["语义部分: '科幻电影'"]
    P --> F["过滤条件: year=2023"]
    S --> R["向量检索<br/>(找'科幻电影')"]
    F --> M["元数据过滤<br/>(year=2023)"]
    R --> D["交集: 2023年科幻电影"]
    M --> D

    style Q fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style P fill:#FFF3E0,stroke:#E65100,stroke-width:2px
    style S fill:#E8F5E9,stroke:#2E7D32
    style F fill:#F3E5F5,stroke:#6A1B9A
    style R fill:#FFF3E0,stroke:#E65100
    style M fill:#FFF3E0,stroke:#E65100
    style D fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
```

> **图解说明**：Self-Query 用 LLM 把用户查询拆成两部分——语义描述走向量检索，结构化条件走元数据过滤，最后取交集。这样检索既精准又高效。

### 代码

```python
from langchain.retrievers.self_query import SelfQueryRetriever
from langchain_openai import ChatOpenAI

# 定义元数据字段
metadata_field_info = [
    {"name": "year", "description": "发布年份", "type": "integer"},
    {"name": "genre", "description": "电影类型", "type": "string"},
]

self_query_retriever = SelfQueryRetriever.from_llm(
    llm=ChatOpenAI(model="gpt-4o-mini"),
    vectorstore=vectorstore,
    document_contents="电影信息",
    metadata_field_info=metadata_field_info,
)

docs = self_query_retriever.invoke("2023年发布的科幻电影")
```

---

## 6. 策略选择决策树

```mermaid
graph TB
    START["你的 RAG 效果不好?"]
    START --> Q1{"检索召回率低?<br/>(该找到的没找到)"}
    Q1 -->|"是"| S1["用 Multi-Query<br/>多查询检索"]
    Q1 -->|"否"| Q2{"上下文太长?<br/>(token 浪费)"}
    Q2 -->|"是"| S2["用上下文压缩<br/>或 Re-Ranking"]
    Q2 -->|"否"| Q3{"有结构化过滤需求?"}
    Q3 -->|"是"| S3["用 Self-Query<br/>自适应检索"]
    Q3 -->|"否"| Q4{"需要长短文档<br/>兼顾?"}
    Q4 -->|"是"| S4["用 Parent-Document<br/>父子文档检索"]
    Q4 -->|"否"| S5["基础 RAG 已够用<br/>无需升级"]

    style START fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style S1 fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style S2 fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style S3 fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style S4 fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style S5 fill:#FFF3E0,stroke:#E65100
```

> **图解说明**：这张决策树帮你选对策略——先判断问题出在哪（召回率低/上下文太长/结构化过滤/长短文档），再对症下药。不要盲目堆砌所有策略。

### 策略对比总结

| 策略 | 解决什么问题 | 代价 | 推荐场景 |
|------|------------|------|---------|
| Multi-Query | 召回率低 | 多次 LLM 调用 | 问题复杂、多角度 |
| 上下文压缩 | Token 浪费 | 额外 LLM 调用 | 文档长、信息密度低 |
| Re-Ranking | 排序不佳 | 额外 API 费用 | 召回多但精度不够 |
| Self-Query | 结构化过滤 | LLM 拆分开销 | 有元数据（日期/类别） |
| Parent-Document | 长短文档矛盾 | 存储翻倍 | 同时有长文和短文 |

---

## 本课小结

| 你学到了什么 | 一句话总结 |
|-------------|-----------|
| 基础 RAG 局限 | 查询不精准/上下文太长/排序不佳/缺乏自适应 |
| 多查询检索 | LLM 改写多个查询，合并去重 |
| 上下文压缩 | 小模型提取精华，减少 Token |
| 重排序 | 两阶段——粗排+精排 |
| 自适应检索 | 语义+结构化条件拆分 |
| 策略选择 | 先诊断问题，再选策略 |

### 配套知识库

- 📖 `知识库/08_高级RAG与检索策略技术手册.md`

### 下一课

➡️ **第13课：综合实战——从零构建 AI 知识助手**——把所学全部串联，构建一个完整项目。
