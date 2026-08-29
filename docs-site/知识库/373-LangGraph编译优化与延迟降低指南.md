# LangGraph 编译优化与延迟降低指南

> 图定义好了，但每次执行都慢——节点串行执行、状态拷贝开销大、LLM 调用太多。这篇指南讲透图编译优化、并行扇出、状态裁剪和调用合并，系统化降低端到端延迟。

---

## 一、延迟优化全景

```mermaid
graph TB
    INPUT["用户请求"] --> PARSE["输入解析"]
    PARSE --> OPT&#123;"优化点"&#125;

    OPT -->|节点并行| PARALLEL["并行扇出<br/>独立节点同时执行"]
    OPT -->|状态裁剪| TRIM["状态裁剪<br/>只传递必要字段"]
    OPT -->|调用合并| BATCH["LLM调用合并<br/>多次→一次批量"]
    OPT -->|提前返回| SHORT["短路返回<br/>满足条件立即结束"]
    OPT -->|缓存复用| CACHE["结果缓存<br/>相同输入不重复算"]

    PARALLEL & TRIM & BATCH & SHORT & CACHE --> OUTPUT["响应返回"]

    style OPT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style OUTPUT fill:#C8E6C9
```

---

## 二、并行扇出优化

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
import asyncio
import time

class ParallelState(TypedDict):
    query: str
    web_results: str
    db_results: str
    cache_results: str
    final_answer: str

# ===== 串行版（慢） =====
async def serial_search(state: ParallelState) -> ParallelState:
    """串行搜索三个数据源。"""
    start = time.monotonic()

    # 依次执行——总时间 = web + db + cache
    state["web_results"] = await mock_search("web", state["query"], 0.5)
    state["db_results"] = await mock_search("db", state["query"], 0.3)
    state["cache_results"] = await mock_search("cache", state["query"], 0.1)

    state["final_answer"] = f"Web: &#123;state['web_results'][:20]&#125;, DB: &#123;state['db_results'][:20]&#125;, Cache: &#123;state['cache_results'][:20]&#125;"
    print(f"串行耗时: &#123;time.monotonic() - start:.2f&#125;s")
    return state

# ===== 并行版（快） =====
async def parallel_search(state: ParallelState) -> ParallelState:
    """并行搜索三个数据源。"""
    start = time.monotonic()

    # 并行执行——总时间 = max(web, db, cache)
    web_task = asyncio.create_task(mock_search("web", state["query"], 0.5))
    db_task = asyncio.create_task(mock_search("db", state["query"], 0.3))
    cache_task = asyncio.create_task(mock_search("cache", state["query"], 0.1))

    state["web_results"], state["db_results"], state["cache_results"] = await asyncio.gather(
        web_task, db_task, cache_task
    )

    state["final_answer"] = f"Web: &#123;state['web_results'][:20]&#125;, DB: &#123;state['db_results'][:20]&#125;, Cache: &#123;state['cache_results'][:20]&#125;"
    print(f"并行耗时: &#123;time.monotonic() - start:.2f&#125;s")
    return state

async def mock_search(source: str, query: str, delay: float) -> str:
    """模拟搜索（带延迟）。"""
    await asyncio.sleep(delay)
    return f"[&#123;source&#125;] &#123;query&#125;的结果"

# ===== LangGraph 原生并行 =====
async def search_web(state: ParallelState) -> ParallelState:
    state["web_results"] = await mock_search("web", state["query"], 0.5)
    return state

async def search_db(state: ParallelState) -> ParallelState:
    state["db_results"] = await mock_search("db", state["query"], 0.3)
    return state

async def search_cache(state: ParallelState) -> ParallelState:
    state["cache_results"] = await mock_search("cache", state["query"], 0.1)
    return state

async def merge_results(state: ParallelState) -> ParallelState:
    state["final_answer"] = f"Web: &#123;state['web_results'][:20]&#125;, DB: &#123;state['db_results'][:20]&#125;, Cache: &#123;state['cache_results'][:20]&#125;"
    return state

# 构建并行图——三个搜索节点从START并行执行
parallel_builder = StateGraph(ParallelState)
parallel_builder.add_node("search_web", search_web)
parallel_builder.add_node("search_db", search_db)
parallel_builder.add_node("search_cache", search_cache)
parallel_builder.add_node("merge", merge_results)

# 关键：三个节点都从START出发→自动并行
parallel_builder.add_edge(START, "search_web")
parallel_builder.add_edge(START, "search_db")
parallel_builder.add_edge(START, "search_cache")
# 三个都完成后进入merge
parallel_builder.add_edge("search_web", "merge")
parallel_builder.add_edge("search_db", "merge")
parallel_builder.add_edge("search_cache", "merge")
parallel_builder.add_edge("merge", END)

parallel_graph = parallel_builder.compile()
```

---

## 三、状态裁剪优化

```python
from typing import Annotated
from operator import add

class OptimizedState(TypedDict):
    query: str
    # 必要字段：只传递最小信息
    answer: str
    # 大字段只在局部使用，不放入全局State
    # retrieved_docs: list[str]  ← 不放State，局部变量

class TrimmedNode:
    """状态裁剪——只读写必要字段。"""

    @staticmethod
    async def retrieve_and_answer(state: OptimizedState) -> OptimizedState:
        """检索+回答在一个节点完成，避免中间结果传递。"""
        # 大量文档检索——局部变量，不存入State
        docs = await mock_search("full", state["query"], 0.2)
        # 只把最终答案写入State
        state["answer"] = f"基于&#123;len(docs)&#125;篇文档的回答"
        return state
```

### LLM 调用合并

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

class BatchLLMCaller:
    """批量LLM调用——合并为一次请求。"""

    @staticmethod
    async def call_batch(queries: list[str]) -> list[str]:
        """将多个问题合并为一次LLM调用。"""
        # 方案1：单次调用处理多个问题
        combined = "\n".join(f"问题&#123;i+1&#125;: &#123;q&#125;" for i, q in enumerate(queries))
        response = await llm.ainvoke([
            HumanMessage(content=f"请逐一回答以下问题，用序号标注：\n&#123;combined&#125;"),
        ])
        # 解析返回（按序号分割）
        answers = response.content.split("\n")
        return [a.strip() for a in answers if a.strip()][:len(queries)]

    @staticmethod
    async def call_parallel(queries: list[str]) -> list[str]:
        """并行调用——多请求同时发。"""
        tasks = [llm.ainvoke([HumanMessage(content=q)]) for q in queries]
        results = await asyncio.gather(*tasks)
        return [r.content for r in results]
```

### 短路返回优化

```python
class ShortCircuitState(TypedDict):
    query: str
    cached_answer: str
    needs_processing: bool
    final_answer: str

def check_cache(state: ShortCircuitState) -> ShortCircuitState:
    """检查缓存——命中则直接返回。"""
    if state["query"] in CACHE_DB:
        state["cached_answer"] = CACHE_DB[state["query"]]
        state["needs_processing"] = False
    else:
        state["needs_processing"] = True
    return state

def route_cache(state: ShortCircuitState) -> str:
    """命中缓存→直接结束，否则继续处理。"""
    return "end" if not state["needs_processing"] else "process"

CACHE_DB = &#123;"什么是AI": "AI是人工智能的缩写..."&#125;

# 构建——命中缓存时短路跳过处理节点
sc_builder = StateGraph(ShortCircuitState)
sc_builder.add_node("check_cache", check_cache)
sc_builder.add_node("process", lambda s: &#123;**s, "final_answer": f"处理: &#123;s['query']&#125;"&#125;)
sc_builder.add_edge(START, "check_cache")
sc_builder.add_conditional_edges("check_cache", route_cache, &#123;
    "process": "process",
    "end": END,
&#125;)
sc_builder.add_edge("process", END)
short_circuit_graph = sc_builder.compile()
```

---

## 四、优化效果对比

| 优化手段 | 延迟降低 | 实现难度 | 适用场景 |
|----------|----------|----------|----------|
| 并行扇出 | 50-70% | 中 | 独立节点 |
| 状态裁剪 | 5-15% | 低 | 大State |
| LLM调用合并 | 30-50% | 中 | 批量问题 |
| 短路返回 | 80-95% | 低 | 缓存命中 |
| 结果缓存 | 90-99% | 低 | 重复查询 |
| 流式输出 | 感知降低 | 中 | 首Token延迟 |

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 独立节点并行 | 无依赖的节点用扇出 | ★★★ |
| 缓存短路 | 命中缓存直接返回 | ★★★ |
| 大字段局部化 | 不放入全局State | ★★☆ |
| 批量合并 | 多个小请求合并 | ★★☆ |
| 流式输出 | 先返回首Token | ★★★ |
| 延迟监控 | p50/p95/p99追踪 | ★★★ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 有并行扇出 | ☐ |
| 有状态裁剪 | ☐ |
| 有短路返回 | ☐ |
| 有调用合并 | ☐ |
| 有延迟监控 | ☐ |
| 有缓存复用 | ☐ |
