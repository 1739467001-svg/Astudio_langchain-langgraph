# LangGraph 代码示例集

> 知识库 05 有 549 行但主要是 LangChain 示例。这篇专注 LangGraph——从最简 Agent 到复杂多 Agent 系统的完整代码。

---

## 一、基础示例

### 1.1 最简 Agent

```python
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

@tool
def calculate(expression: str) -> str:
    """计算数学表达式"""
    return str(eval(expression))

llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)
agent = create_react_agent(llm, [calculate])

result = agent.invoke(&#123;"messages": [&#123;"role": "user", "content": "2+3*4"&#125;]&#125;)
print(result["messages"][-1].content)
```

### 1.2 带记忆的 Agent

```python
from langgraph.checkpoint.memory import MemorySaver

agent = create_react_agent(
    llm, [calculate],
    checkpointer=MemorySaver(),
)

config = &#123;"configurable": &#123;"thread_id": "conv-1"&#125;&#125;

# 第一轮
agent.invoke(&#123;"messages": [&#123;"role": "user", "content": "我叫张三"&#125;]&#125;, config)

# 第二轮——记得张三
result = agent.invoke(&#123;"messages": [&#123;"role": "user", "content": "我叫什么？"&#125;]&#125;, config)
# → "你叫张三"
```

### 1.3 流式输出

```python
import asyncio

async def stream():
    async for event in agent.astream_events(
        &#123;"messages": [&#123;"role": "user", "content": "解释量子计算"&#125;]&#125;,
        version="v2",
    ):
        if event["event"] == "on_chat_model_stream":
            chunk = event["data"]["chunk"]
            if chunk.content:
                print(chunk.content, end="", flush=True)
    print()

asyncio.run(stream())
```

---

## 二、中级示例

### 2.1 自定义图（RAG 管线）

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class RAGState(TypedDict):
    messages: Annotated[list, add_messages]
    query: str
    docs: list
    answer: str

async def retrieve(state):
    docs = await vectorstore.asimilarity_search(state["query"], k=3)
    return &#123;"docs": docs&#125;

async def generate(state):
    context = "\n".join(d.page_content for d in state["docs"])
    from langchain_core.messages import HumanMessage
    response = await llm.ainvoke([HumanMessage(
        content=f"基于以下信息回答:\n&#123;context[:2000]&#125;\n\n问题: &#123;state['query']&#125;"
    )])
    return &#123;"answer": response.content, "messages": [response]&#125;

graph = StateGraph(RAGState)
graph.add_node("retrieve", retrieve)
graph.add_node("generate", generate)
graph.add_edge(START, "retrieve")
graph.add_edge("retrieve", "generate")
graph.add_edge("generate", END)
app = graph.compile(checkpointer=MemorySaver())
```

### 2.2 条件路由

```python
def route(state):
    if "搜索" in state["messages"][-1].content:
        return "search"
    return "direct"

graph.add_conditional_edges("entry", route, &#123;
    "search": "search_node",
    "direct": "direct_node",
&#125;)
```

### 2.3 人机交互

```python
from langgraph.types import interrupt, Command

async def review_node(state):
    approval = interrupt(&#123;
        "draft": state["messages"][-1].content[:200],
        "question": "批准发送？",
    &#125;)
    if approval.get("approved"):
        return &#123;"messages": [&#123;"role": "ai", "content": "已发送"&#125;]&#125;
    return &#123;"messages": [&#123;"role": "ai", "content": "已取消"&#125;]&#125;

# 恢复执行
# result = agent.invoke(Command(resume=&#123;"approved": True&#125;), config)
```

---

## 三、高级示例

### 3.1 多 Agent（Supervisor）

```python
class MultiAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    task: str
    research: str
    report: str

async def researcher(state):
    from langchain_core.messages import HumanMessage
    response = await llm.ainvoke([HumanMessage(content=f"研究: &#123;state['task']&#125;")])
    return &#123;"research": response.content&#125;

async def writer(state):
    from langchain_core.messages import HumanMessage
    response = await llm.ainvoke([HumanMessage(content=f"基于研究写报告: &#123;state['research'][:500]&#125;")])
    return &#123;"report": response.content, "messages": [response]&#125;

graph = StateGraph(MultiAgentState)
graph.add_node("researcher", researcher)
graph.add_node("writer", writer)
graph.add_edge(START, "researcher")
graph.add_edge("researcher", "writer")
graph.add_edge("writer", END)
multi_agent = graph.compile(checkpointer=MemorySaver())
```

### 3.2 并行执行

```python
import asyncio

async def parallel_search(state):
    async def search_one(q):
        return await search_tool.ainvoke(&#123;"query": q&#125;)

    tasks = [search_one(q) for q in state.get("queries", [])]
    results = await asyncio.gather(*tasks)
    return &#123;"search_results": results&#125;
```

### 3.3 子图

```python
def build_rag_subgraph():
    sub = StateGraph(RAGState)
    sub.add_node("retrieve", retrieve)
    sub.add_node("generate", generate)
    sub.add_edge(START, "retrieve")
    sub.add_edge("retrieve", "generate")
    sub.add_edge("generate", END)
    return sub.compile()

# 在主图中使用子图
rag_sub = build_rag_subgraph()

async def rag_node(state):
    result = await rag_sub.ainvoke(&#123;"query": state["messages"][-1].content, "docs": [], "answer": "", "messages": []&#125;)
    return &#123;"messages": [AIMessage(content=result["answer"])]&#125;
```

---

## 四、最佳实践

| 模式 | 场景 | 优先级 |
|------|------|--------|
| create_react_agent | 快速创建Agent | ★★★ |
| 自定义图 | 需要精确控制 | ★★★ |
| 条件路由 | 多路径分发 | ★★☆ |
| 人机交互 | 高风险操作 | ★★☆ |
| 子图 | 模块化复用 | ★★☆ |
| 并行执行 | 多路检索 | ★★☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有基础示例 | ☐ |
| 有中级示例 | ☐ |
| 有高级示例 | ☐ |
