# LangGraph 子图组合与模块化编排指南

> 一个超大的图难以维护、难以测试。把大图拆成子图（subgraph），每个子图负责一个独立功能，再组合起来——这就是模块化编排。这篇指南讲透子图定义、状态映射和组合模式。

---

## 一、子图组合架构

```mermaid
graph TB
    subgraph 主图 &#123;"主图编排器"&#125;
        START((开始)) --> ROUTE&#123;"路由"&#125;
        ROUTE -->|检索| SUB1["子图: RAG模块"]
        ROUTE -->|工具| SUB2["子图: Agent模块"]
        ROUTE -->|分析| SUB3["子图: 分析模块"]
        SUB1 & SUB2 & SUB3 --> MERGE["合并结果"]
        MERGE --> END((结束))
    end

    subgraph 子图独立 &#123;"子图可独立测试"&#125;
        SUB1_TEST["RAG子图<br/>独立运行+测试"]
        SUB2_TEST["Agent子图<br/>独立运行+测试"]
    end

    style ROUTE fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style SUB1 fill:#E3F2FD,stroke:#1565C0
    style SUB2 fill:#F3E5F5,stroke:#6A1B9A
    style MERGE fill:#C8E6C9
```

子图的核心价值：每个子图有自己的状态Schema，可以独立编译、独立测试、独立复用。主图通过**状态映射**与子图通信。

---

## 二、子图定义与组合

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# ===== 子图1: RAG 模块 =====
class RAGState(TypedDict):
    query: str
    retrieved_docs: list[str]
    rag_answer: str

def retrieve(state: RAGState) -> RAGState:
    """检索文档。"""
    docs = [f"文档1: 关于&#123;state['query']&#125;", f"文档2: &#123;state['query']&#125;相关"]
    state["retrieved_docs"] = docs
    return state

def rag_generate(state: RAGState) -> RAGState:
    """基于检索结果生成答案。"""
    docs = state.get("retrieved_docs", [])
    response = llm.invoke(f"基于以下文档回答: &#123;docs&#125;\n问题: &#123;state['query']&#125;")
    state["rag_answer"] = response.content
    return state

# 构建RAG子图
rag_builder = StateGraph(RAGState)
rag_builder.add_node("retrieve", retrieve)
rag_builder.add_node("generate", rag_generate)
rag_builder.add_edge(START, "retrieve")
rag_builder.add_edge("retrieve", "generate")
rag_builder.add_edge("generate", END)
rag_subgraph = rag_builder.compile()

# ===== 子图2: Agent 工具模块 =====
class AgentState(TypedDict):
    query: str
    tool_result: str
    agent_answer: str

def call_tool(state: AgentState) -> AgentState:
    """调用工具。"""
    state["tool_result"] = f"工具执行结果: &#123;state['query'][:50]&#125;"
    return state

def agent_respond(state: AgentState) -> AgentState:
    """生成Agent回答。"""
    result = state.get("tool_result", "")
    response = llm.invoke(f"基于工具结果回答: &#123;result&#125;\n问题: &#123;state['query']&#125;")
    state["agent_answer"] = response.content
    return state

agent_builder = StateGraph(AgentState)
agent_builder.add_node("call_tool", call_tool)
agent_builder.add_node("respond", agent_respond)
agent_builder.add_edge(START, "call_tool")
agent_builder.add_edge("call_tool", "respond")
agent_builder.add_edge("respond", END)
agent_subgraph = agent_builder.compile()

# ===== 主图: 组合子图 =====
class MainState(TypedDict):
    query: str
    route: str
    rag_answer: str
    agent_answer: str
    final_answer: str

def classify(state: MainState) -> MainState:
    """路由分类。"""
    query = state["query"].lower()
    if "文档" in query or "知识" in query or "检索" in query:
        state["route"] = "rag"
    else:
        state["route"] = "agent"
    return state

def run_rag(state: MainState) -> MainState:
    """调用RAG子图。"""
    # 状态映射: MainState -> RAGState
    rag_input = &#123;"query": state["query"], "retrieved_docs": [], "rag_answer": ""&#125;
    rag_result = rag_subgraph.invoke(rag_input)
    # 状态映射: RAGState -> MainState
    state["rag_answer"] = rag_result.get("rag_answer", "")
    return state

def run_agent(state: MainState) -> MainState:
    """调用Agent子图。"""
    agent_input = &#123;"query": state["query"], "tool_result": "", "agent_answer": ""&#125;
    agent_result = agent_subgraph.invoke(agent_input)
    state["agent_answer"] = agent_result.get("agent_answer", "")
    return state

def merge_results(state: MainState) -> MainState:
    """合并结果。"""
    route = state.get("route", "agent")
    if route == "rag":
        state["final_answer"] = f"[RAG] &#123;state.get('rag_answer', '')&#125;"
    else:
        state["final_answer"] = f"[Agent] &#123;state.get('agent_answer', '')&#125;"
    return state

def route_decision(state: MainState) -> str:
    """路由决策。"""
    return state.get("route", "agent")

# 构建主图
main_builder = StateGraph(MainState)
main_builder.add_node("classify", classify)
main_builder.add_node("rag", run_rag)
main_builder.add_node("agent", run_agent)
main_builder.add_node("merge", merge_results)

main_builder.add_edge(START, "classify")
main_builder.add_conditional_edges("classify", route_decision, &#123;
    "rag": "rag",
    "agent": "agent",
&#125;)
main_builder.add_edge("rag", "merge")
main_builder.add_edge("agent", "merge")
main_builder.add_edge("merge", END)

main_graph = main_builder.compile()
```

---

## 三、使用示例

```python
import asyncio

async def main():
    # 方式1: 直接调用子图（独立测试）
    rag_result = rag_subgraph.invoke(&#123;"query": "LangGraph是什么", "retrieved_docs": [], "rag_answer": ""&#125;)
    print(f"RAG子图结果: &#123;rag_result['rag_answer'][:100]&#125;")

    # 方式2: 调用主图
    result = await main_graph.ainvoke(&#123;
        "query": "帮我检索关于LangChain的文档",
        "route": "",
        "rag_answer": "",
        "agent_answer": "",
        "final_answer": "",
    &#125;)
    print(f"主图结果: &#123;result['final_answer'][:200]&#125;")

asyncio.run(main())
```

---

## 四、组合模式对比

| 模式 | 结构 | 适用场景 | 复杂度 |
|------|------|----------|--------|
| 串行组合 | A→B→C | 管道式流程 | 低 |
| 路由组合 | 路由→A/B/C→合并 | 分支处理 | 中 |
| 并行扇出 | 分发→A&B&C→聚合 | 多路并行 | 中 |
| 嵌套子图 | 子图内含子图 | 层级抽象 | 高 |
| 动态组合 | 运行时选择子图 | 插件化架构 | 高 |

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 子图独立可测 | 每个子图可单独compile+invoke | ★★★ |
| 显式状态映射 | 主图↔子图字段对应关系清晰 | ★★★ |
| 子图Schema独立 | 不与主图共享State | ★★☆ |
| 子图命名规范 | rag_subgraph / agent_subgraph | ★★☆ |
| 组合后端到端测试 | 主图集成测试 | ★★★ |
| 子图版本化 | 子图更新不影响主图 | ★☆☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 有子图定义 | ☐ |
| 有状态映射 | ☐ |
| 有主图路由组合 | ☐ |
| 子图可独立运行 | ☐ |
| 子图可独立测试 | ☐ |
| 组合后端到端可用 | ☐ |
