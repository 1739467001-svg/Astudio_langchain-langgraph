# Agentic RAG 与自适应检索决策指南

> 传统 RAG 是"检索一次 → 生成回答"的固定管线。Agentic RAG 把 RAG 变成一个自主智能体：它自己判断要不要检索、检索什么、检索够不够、要不要再查一轮、要不要换策略。本指南详解 Agentic RAG 的核心架构、自适应检索决策机制和 LangGraph 实现方案。

---

## 1. 从 RAG 到 Agentic RAG

### 传统 RAG 的局限

```
用户提问 → 向量检索 Top-K → LLM 生成回答

问题：
  - 不需要检索的问题也去检索（浪费）
  - 需要多轮检索的问题只检索一次（不够）
  - 检索结果不好无法自我修正
  - 无法根据问题类型选择检索策略
  - 无法交叉验证多个来源
```

### Agentic RAG 的核心思想

```
用户提问
  ↓
Agent 判断：需要检索吗？
  ├─ 不需要 → 直接回答（闲聊、已知事实）
  ├─ 需要 → 选择检索策略
  │   ├─ 向量检索（语义相似）
  │   ├─ 关键词检索（精确匹配）
  │   ├─ 知识图谱检索（关系推理）
  │   └─ 混合检索（多路召回）
  ↓
评估检索结果：够吗？
  ├─ 够了 → 生成回答
  ├─ 不够 → 重写查询再检索（迭代）
  └─ 矛盾 → 交叉验证多来源
```

### 三代 RAG 演进

| 代际 | 名称 | 特征 | 局限 |
|------|------|------|------|
| 第一代 | 朴素 RAG | 检索→生成，固定流程 | 无自适应、无迭代 |
| 第二代 | 高级 RAG | 查询重写、重排序、后处理 | 流程仍固定、无自主决策 |
| 第三代 | Agentic RAG | Agent 自主决策、迭代检索、多源验证 | 实现复杂、成本高 |

---

## 2. 自适应检索决策

### 是否需要检索的判断

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel
from typing import Literal

class RetrievalDecision(BaseModel):
    """检索决策"""
    need_retrieval: bool
    reason: str
    query_type: Literal["factual", "analytical", "conversational", "procedural"]
    suggested_strategy: Literal["vector", "keyword", "graph", "hybrid", "none"]

async def decide_retrieval(query: str, chat_history: list) -> RetrievalDecision:
    """让 LLM 判断是否需要检索"""
    decision_model = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    system_prompt = """你是一个检索决策器。分析用户问题，判断：

1. 是否需要检索知识库？（闲聊、已知常识、创意写作不需要）
2. 问题类型：
   - factual: 事实查询（"公司2024年营收"）
   - analytical: 分析推理（"对比两种方案的优劣"）
   - conversational: 对话延续（"好的，那然后呢"）
   - procedural: 操作流程（"怎么配置 SSL"）
3. 建议的检索策略：
   - vector: 语义相似度检索
   - keyword: 精确关键词匹配（代码、专有名词）
   - graph: 知识图谱检索（关系、实体）
   - hybrid: 多路混合检索
   - none: 不需要检索"""

    structured_model = decision_model.with_structured_output(RetrievalDecision)

    decision = await structured_model.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"问题: &#123;query&#125;\n\n聊天历史: &#123;chat_history[-3:] if chat_history else '无'&#125;")
    ])

    return decision
```

### 检索策略选择决策树

```python
async def select_retrieval_strategy(query: str, query_type: str) -> str:
    """根据问题特征选择检索策略"""

    # 精确匹配场景：代码、ID、专有名词
    if query_type == "procedural" and any(kw in query for kw in ["API", "配置", "安装", "命令"]):
        return "keyword"

    # 语义查询：概念性、模糊性
    if query_type == "factual" and not any(kw in query for kw in ["精确", "exact"]):
        return "vector"

    # 关系推理：实体间关系
    if query_type == "analytical" and any(kw in query for kw in ["关系", "影响", "关联", "对比"]):
        return "graph"

    # 默认：混合检索
    return "hybrid"
```

---

## 3. LangGraph 完整实现

### 架构总览

```mermaid
graph TB
    Q["用户提问"] --> DECIDE&#123;"检索决策"&#125;
    DECIDE -->|"不需要"| ANSWER["直接回答"]
    DECIDE -->|"需要"| STRATEGY&#123;"选择策略"&#125;
    
    STRATEGY -->|"vector"| VEC["向量检索"]
    STRATEGY -->|"keyword"| KW["关键词检索"]
    STRATEGY -->|"graph"| GRAPH["图谱检索"]
    STRATEGY -->|"hybrid"| HYBRID["混合检索"]
    
    VEC --> EVAL&#123;"评估结果"&#125;
    KW --> EVAL
    GRAPH --> EVAL
    HYBRID --> EVAL
    
    EVAL -->|"够了"| GEN["生成回答"]
    EVAL -->|"不够"| REWRITE["重写查询"]
    REWRITE --> STRATEGY
    
    GEN --> VERIFY&#123;"事实校验"&#125;
    VERIFY -->|"通过"| OUTPUT["输出"]
    VERIFY -->|"不通过"| REWRITE
    
    style DECIDE fill:#E3F2FD,stroke:#1565C0
    style EVAL fill:#FFF9C4,stroke:#F9A825
    style VERIFY fill:#FFCCBC,stroke:#D84315
```

### 完整状态定义

```python
from typing import TypedDict, Literal
from dataclasses import dataclass, field

class AgenticRAGState(TypedDict):
    # 输入
    query: str
    chat_history: list
    
    # 决策
    need_retrieval: bool
    query_type: str
    retrieval_strategy: str
    
    # 检索
    search_rounds: int          # 已检索轮数
    max_rounds: int             # 最大检索轮数
    rewritten_query: str         # 重写后的查询
    retrieved_docs: list         # 检索到的文档
    
    # 评估
    retrieval_sufficient: bool   # 检索是否充分
    confidence: float           # 置信度
    
    # 输出
    answer: str
    citations: list
    sources_used: list
    
    # 元数据
    errors: list
    iterations: int
```

### 节点实现

```python
from langgraph.graph import StateGraph, START, END

# === 决策节点 ===
async def decide_node(state: AgenticRAGState):
    """判断是否需要检索及策略"""
    decision = await decide_retrieval(state["query"], state.get("chat_history", []))
    return &#123;
        "need_retrieval": decision.need_retrieval,
        "query_type": decision.query_type,
        "retrieval_strategy": decision.suggested_strategy,
        "max_rounds": 3,  # 最多检索3轮
        "search_rounds": 0,
    &#125;

# === 检索节点 ===
async def retrieve_node(state: AgenticRAGState):
    """根据策略执行检索"""
    query = state.get("rewritten_query", state["query"])
    strategy = state["retrieval_strategy"]

    if strategy == "vector":
        docs = await vector_search(query, top_k=5)
    elif strategy == "keyword":
        docs = await keyword_search(query, top_k=5)
    elif strategy == "graph":
        docs = await graph_search(query)
    else:  # hybrid
        vec_docs = await vector_search(query, top_k=3)
        kw_docs = await keyword_search(query, top_k=3)
        docs = merge_and_dedupe(vec_docs, kw_docs)

    # 保留之前的检索结果
    existing = state.get("retrieved_docs", [])
    all_docs = existing + docs

    return &#123;
        "retrieved_docs": all_docs,
        "search_rounds": state["search_rounds"] + 1,
    &#125;

# === 评估节点 ===
async def evaluate_node(state: AgenticRAGState):
    """评估检索结果是否充分"""
    docs = state["retrieved_docs"]
    query = state["query"]

    evaluator = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    class EvalResult(BaseModel):
        sufficient: bool
        confidence: float
        missing: str  # 缺少什么信息
        rewrite_suggestion: str  # 重写建议

    eval_prompt = f"""评估检索结果是否足以回答问题。

问题: &#123;query&#125;
检索到的文档数量: &#123;len(docs)&#125;
文档内容摘要:
&#123;chr(10).join([f'- &#123;d["content"][:100]&#125;...' for d in docs[:5]])&#125;

判断:
1. 是否有足够信息回答问题？
2. 置信度（0-1）
3. 如果不够，缺少什么？
4. 建议如何重写查询以获得更好的结果？"""

    structured_eval = evaluator.with_structured_output(EvalResult)
    result = await structured_eval.ainvoke(eval_prompt)

    return &#123;
        "retrieval_sufficient": result.sufficient,
        "confidence": result.confidence,
        "rewritten_query": result.rewrite_suggestion if not result.sufficient else state.get("rewritten_query", ""),
    &#125;

# === 重写查询节点 ===
async def rewrite_node(state: AgenticRAGState):
    """重写查询以获得更好的检索结果"""
    rewriter = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

    rewrite_prompt = f"""重写以下查询以获得更好的检索结果。

原查询: &#123;state["query"]&#125;
当前重写: &#123;state.get("rewritten_query", "")&#125;
缺少的信息: &#123;state.get("rewritten_query", "")&#125;
已检索轮数: &#123;state["search_rounds"]&#125;

策略：
- 如果是向量检索效果差：尝试用更具体的表述
- 如果是关键词检索效果差：尝试用更通用的表述
- 如果是分析型问题：拆分为子问题
- 如果信息矛盾：聚焦验证某个来源"""

    response = await rewriter.ainvoke(rewrite_prompt)
    return &#123;"rewritten_query": response.content&#125;

# === 生成回答节点 ===
async def generate_node(state: AgenticRAGState):
    """基于检索结果生成回答"""
    docs = state["retrieved_docs"]
    query = state["query"]

    context = "\n\n".join([
        f"[&#123;i+1&#125;] &#123;d['content']&#125;\n来源: &#123;d.get('source', '未知')&#125;"
        for i, d in enumerate(docs)
    ])

    gen_prompt = f"""基于以下检索到的文档回答问题。

文档:
&#123;context&#125;

问题: &#123;query&#125;

要求:
1. 只基于文档内容回答，不要编造
2. 在回答中标注引用来源 [1] [2] 等
3. 如果文档信息不完整，明确说明
4. 如果不同来源信息矛盾，指出差异"""

    model = ChatOpenAI(model="gpt-4o", temperature=0)
    response = await model.ainvoke(gen_prompt)

    return &#123;
        "answer": response.content,
        "citations": [&#123;"id": i+1, "source": d.get("source", "")&#125;
                      for i, d in enumerate(docs)],
    &#125;

# === 事实校验节点 ===
async def verify_node(state: AgenticRAGState):
    """校验生成的回答是否忠实于检索结果"""
    verifier = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    class VerifyResult(BaseModel):
        is_faithful: bool
        hallucinated_claims: list  # 幻觉内容
        confidence: float

    verify_prompt = f"""检查回答是否忠实于检索文档。

回答: &#123;state["answer"]&#125;

检索文档:
&#123;chr(10).join([d["content"][:200] for d in state["retrieved_docs"]])&#125;

判断: 回答中是否有文档不支持的内容？"""

    structured_verifier = verifier.with_structured_output(VerifyResult)
    result = await structured_verifier.ainvoke(verify_prompt)

    if not result.is_faithful and state["iterations"] < 2:
        # 有幻觉，重试生成
        return &#123;
            "answer": "",
            "errors": state.get("errors", []) + [f"幻觉: &#123;result.hallucinated_claims&#125;"],
            "iterations": state.get("iterations", 0) + 1,
        &#125;
    return &#123;&#125;
```

### 路由逻辑

```python
def route_after_decision(state: AgenticRAGState):
    """检索决策后的路由"""
    if not state["need_retrieval"]:
        return "direct_answer"
    return "retrieve"

def route_after_evaluation(state: AgenticRAGState):
    """评估后的路由"""
    if state["retrieval_sufficient"]:
        return "generate"
    if state["search_rounds"] < state["max_rounds"]:
        return "rewrite"
    # 达到最大轮数，用已有结果生成
    return "generate"

def route_after_verify(state: AgenticRAGState):
    """事实校验后的路由"""
    if state.get("answer"):  # 通过校验
        return END
    if state.get("iterations", 0) >= 2:
        return END  # 重试次数用完
    return "generate"  # 重新生成
```

### 组装完整图

```python
async def direct_answer(state: AgenticRAGState):
    """不需要检索，直接回答"""
    model = ChatOpenAI(model="gpt-4o", temperature=0.7)
    response = await model.ainvoke(state["query"])
    return &#123;"answer": response.content&#125;

graph = StateGraph(AgenticRAGState)

# 添加节点
graph.add_node("decide", decide_node)
graph.add_node("retrieve", retrieve_node)
graph.add_node("evaluate", evaluate_node)
graph.add_node("rewrite", rewrite_node)
graph.add_node("generate", generate_node)
graph.add_node("verify", verify_node)
graph.add_node("direct_answer", direct_answer)

# 添加边
graph.add_edge(START, "decide")
graph.add_conditional_edges("decide", route_after_decision, &#123;
    "direct_answer": "direct_answer",
    "retrieve": "retrieve",
&#125;)
graph.add_edge("retrieve", "evaluate")
graph.add_conditional_edges("evaluate", route_after_evaluation, &#123;
    "generate": "generate",
    "rewrite": "rewrite",
&#125;)
graph.add_edge("rewrite", "retrieve")
graph.add_edge("generate", "verify")
graph.add_conditional_edges("verify", route_after_verify, &#123;
    END: END,
    "generate": "generate",
&#125;)
graph.add_edge("direct_answer", END)

agentic_rag = graph.compile()

# 使用
result = await agentic_rag.ainvoke(&#123;
    "query": "对比 LangChain 和 LlamaIndex 在 RAG 实现上的差异",
    "chat_history": [],
    "iterations": 0,
    "errors": [],
&#125;)
```

---

## 4. 迭代检索优化

### 查询分解与子问题

```python
async def decompose_query(query: str) -> list[str]:
    """将复杂问题分解为子问题"""
    decomposer = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    class DecomposedQuery(BaseModel):
        sub_queries: list[str]
        reasoning: str

    prompt = f"""将以下复杂问题分解为可独立检索的子问题。

问题: &#123;query&#125;

规则:
1. 每个子问题应该可以独立检索和回答
2. 子问题之间可以有依赖（标注顺序）
3. 2-5个子问题为宜"""

    structured = decomposer.with_structured_output(DecomposedQuery)
    result = await structured.ainvoke(prompt)
    return result.sub_queries

# 使用：逐个子问题检索
async def multi_hop_retrieve(query: str):
    """多跳检索：分解→逐个检索→合并"""
    sub_queries = await decompose_query(query)
    all_docs = []

    for sq in sub_queries:
        docs = await vector_search(sq, top_k=3)
        all_docs.extend(docs)

    # 去重
    seen = set()
    unique_docs = []
    for d in all_docs:
        key = d["content"][:100]
        if key not in seen:
            seen.add(key)
            unique_docs.append(d)

    return unique_docs
```

### 自适应 Top-K

```python
async def adaptive_top_k(query: str, query_type: str) -> int:
    """根据问题复杂度动态决定返回文档数"""
    base_k = 5

    if query_type == "factual":
        return 3   # 简单事实，少量文档
    elif query_type == "analytical":
        return 8   # 分析需要更多上下文
    elif query_type == "procedural":
        return 5  # 流程类，标准数量
    elif query_type == "conversational":
        return 2  # 对话延续，少量
    return 5
```

---

## 5. 多源交叉验证

```python
async def cross_validate_sources(query: str, docs: list) -> dict:
    """多源交叉验证"""
    validator = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    # 按来源分组
    by_source = &#123;&#125;
    for doc in docs:
        source = doc.get("source", "unknown")
        by_source.setdefault(source, []).append(doc)

    class ValidationResult(BaseModel):
        consistent: bool
        conflicts: list  # 矛盾信息
        consensus: str   # 一致结论
        confidence: float

    prompt = f"""分析不同来源的信息是否一致。

问题: &#123;query&#125;

各来源信息:
&#123;chr(10).join([f"[&#123;src&#125;] &#123;d['content'][:150]&#125;" for src, docs in by_source.items() for d in docs[:2]])&#125;

判断:
1. 不同来源信息是否一致？
2. 如有矛盾，列出矛盾点
3. 如果一致，给出共识结论"""

    structured = validator.with_structured_output(ValidationResult)
    return await structured.ainvoke(prompt)
```

---

## 6. 性能与成本分析

### Agentic RAG vs 传统 RAG 成本对比

| 维度 | 传统 RAG | Agentic RAG |
|------|----------|-------------|
| LLM 调用次数 | 1次（生成） | 3-8次（决策+评估+生成+校验） |
| 检索次数 | 1次 | 1-3次（迭代） |
| 端到端延迟 | 2-5秒 | 5-20秒 |
| 成本/查询 | $0.001-0.01 | $0.005-0.05 |
| 回答准确率 | ~70% | ~90% |
| 幻觉率 | ~15% | ~5% |

### 成本优化策略

```python
# 策略1：缓存决策结果
decision_cache = &#123;&#125;  # query_hash → decision

async def cached_decide(query: str):
    cache_key = hash(query)
    if cache_key in decision_cache:
        return decision_cache[cache_key]
    decision = await decide_retrieval(query, [])
    decision_cache[cache_key] = decision
    return decision

# 策略2：用便宜模型做决策和评估
# 决策、评估用 gpt-4o-mini
# 生成、校验用 gpt-4o（只在必要时）

# 策略3：早停机制
# 如果第一轮检索置信度 > 0.9，直接生成，不再迭代
```

---

## 7. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解 Agentic RAG 与传统 RAG 的区别 | ☐ |
| 实现了检索决策器（是否检索/策略选择） | ☐ |
| 在 LangGraph 中实现了迭代检索循环 | ☐ |
| 实现了检索结果评估节点 | ☐ |
| 实现了查询重写/分解 | ☐ |
| 配置了最大检索轮数限制 | ☐ |
| 实现了事实校验/幻觉检测 | ☐ |
| 支持多源交叉验证 | ☐ |
| 有成本优化策略（缓存/模型分级/早停） | ☐ |
| 监控了检索轮次、延迟、准确率 | ☐ |

---

## 8. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 03 | RAG 全流程图解 | 传统 RAG 基础 |
| 16 | 高级 RAG 模式 | 高级 RAG 技巧 |
| 107 | 自适应 RAG 架构 | Self-RAG / Corrective RAG |
| 124 | RAG 高级检索策略 | 查询重写、Multi-Query |
| 131 | 查询理解流程 | 查询分析与意图识别 |
| 139 | 自适应 RAG | Self-RAG 反思机制 |
| 148 | RAG 查询路由 | 多知识源路由 |
| 174 | RAG 多轮对话 | 多轮 RAG 状态管理 |
| 294 | RAG 自适应 | 自适应检索配置 |
| 322 | RAG 查询路由 | 查询路由策略 |
| 356 | 幻觉检测 | RAG 幻觉检测机制 |
| 363 | 多跳问答 | 子问题分解与多跳检索 |
| 407 | RAG 重排序 | 检索结果重排序 |
