# LangGraph 条件分支与动态路由指南

> LangGraph 的条件边（conditional edges）让图不再是一条直线，而是根据状态动态选择下一步。这篇指南讲透条件分支、动态路由和状态驱动的流程控制。

---

## 一、条件分支核心概念

```mermaid
graph TB
    START((开始)) --> CLASSIFY["分类节点<br/>判断查询类型"]
    CLASSIFY -->|"simple"| DIRECT["直接回答"]
    CLASSIFY -->|"research"| SEARCH["检索+推理"]
    CLASSIFY -->|"code"| EXEC["代码执行"]

    DIRECT --> CHECK&#123;"质量检查"&#125;
    SEARCH --> CHECK
    EXEC --> CHECK
    CHECK -->|"通过"| END((结束))
    CHECK -->|"不通过"| REWORK["返工修正"]
    REWORK --> CLASSIFY

    style CLASSIFY fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style CHECK fill:#E3F2FD,stroke:#1565C0
    style REWORK fill:#FFE0B2,stroke:#E65100
```

条件边的本质是一个**返回字符串的函数**，返回值决定下一个节点。LangGraph 用 `add_conditional_edges` 将这个函数挂到图上。

---

## 二、基础条件分支

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Literal
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

class AgentState(TypedDict):
    query: str
    query_type: str
    answer: str
    quality_ok: bool
    retry_count: int

def classify_query(state: AgentState) -> AgentState:
    """分类查询类型。"""
    query = state["query"].lower()
    if any(kw in query for kw in ["代码", "计算", "运行", "code"]):
        state["query_type"] = "code"
    elif any(kw in query for kw in ["研究", "分析", "对比", "调研"]):
        state["query_type"] = "research"
    else:
        state["query_type"] = "simple"
    return state

def direct_answer(state: AgentState) -> AgentState:
    """简单问题直接回答。"""
    response = llm.invoke(f"简洁回答：&#123;state['query']&#125;")
    state["answer"] = response.content
    return state

def research_answer(state: AgentState) -> AgentState:
    """研究型问题多步推理。"""
    response = llm.invoke(f"分步骤分析并回答：&#123;state['query']&#125;")
    state["answer"] = response.content
    return state

def code_answer(state: AgentState) -> AgentState:
    """代码问题执行后回答。"""
    response = llm.invoke(f"写代码解决：&#123;state['query']&#125;\n并解释。")
    state["answer"] = response.content
    return state

def quality_check(state: AgentState) -> AgentState:
    """质量检查。"""
    answer = state.get("answer", "")
    state["quality_ok"] = len(answer) > 50 and "抱歉" not in answer[:20]
    return state

# 路由函数
def route_by_type(state: AgentState) -> Literal["direct", "research", "code"]:
    """根据查询类型路由。"""
    return state.get("query_type", "simple") if state.get("query_type") != "simple" else "direct"

def route_by_quality(state: AgentState) -> Literal["end", "rework"]:
    """根据质量检查路由。"""
    if state.get("quality_ok") or state.get("retry_count", 0) >= 2:
        return "end"
    return "rework"

def rework(state: AgentState) -> AgentState:
    """返工——增加重试计数。"""
    state["retry_count"] = state.get("retry_count", 0) + 1
    return state

# 构建图
graph_builder = StateGraph(AgentState)

graph_builder.add_node("classify", classify_query)
graph_builder.add_node("direct", direct_answer)
graph_builder.add_node("research", research_answer)
graph_builder.add_node("code", code_answer)
graph_builder.add_node("quality", quality_check)
graph_builder.add_node("rework", rework)

graph_builder.add_edge(START, "classify")
graph_builder.add_conditional_edges("classify", route_by_type, &#123;
    "direct": "direct",
    "research": "research",
    "code": "code",
&#125;)
graph_builder.add_edge("direct", "quality")
graph_builder.add_edge("research", "quality")
graph_builder.add_edge("code", "quality")
graph_builder.add_conditional_edges("quality", route_by_quality, &#123;
    "end": END,
    "rework": "rework",
&#125;)
graph_builder.add_edge("rework", "classify")

graph = graph_builder.compile()
```

---

## 三、动态路由——运行时决定路径

```python
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

@tool
def search_web(query: str) -> str:
    """搜索网络。"""
    return f"搜索结果：&#123;query&#125;的相关信息..."

@tool
def search_db(query: str) -> str:
    """搜索数据库。"""
    return f"数据库结果：&#123;query&#125;的匹配记录..."

# 动态路由：根据Agent输出中的工具选择决定下一步
class DynamicState(TypedDict):
    messages: list
    available_tools: list[str]
    current_tool: str

def dynamic_router(state: DynamicState) -> str:
    """根据消息内容动态决定下一步。"""
    last_message = state["messages"][-1] if state["messages"] else ""
    if isinstance(last_message, str) and "搜索网络" in last_message:
        return "web_search"
    elif isinstance(last_message, str) and "数据库" in last_message:
        return "db_search"
    return "end"

# 基于状态值的动态路径映射
dynamic_graph = StateGraph(DynamicState)
dynamic_graph.add_node("agent", lambda s: s)
dynamic_graph.add_node("web_search", lambda s: &#123;**s, "current_tool": "web"&#125;)
dynamic_graph.add_node("db_search", lambda s: &#123;**s, "current_tool": "db"&#125;)

dynamic_graph.add_edge(START, "agent")
dynamic_graph.add_conditional_edges("agent", dynamic_router, &#123;
    "web_search": "web_search",
    "db_search": "db_search",
    "end": END,
&#125;)
dynamic_graph.add_edge("web_search", END)
dynamic_graph.add_edge("db_search", END)

dynamic_compiled = dynamic_graph.compile()
```

---

## 四、条件分支模式对比

| 模式 | 路由依据 | 典型场景 | 复杂度 |
|------|----------|----------|--------|
| 类型路由 | 查询分类标签 | 简单/研究/代码分流 | 低 |
| 质量路由 | 输出质量检查 | 不通过则返工 | 中 |
| 工具路由 | Agent工具选择 | ReAct模式工具分发 | 中 |
| 状态路由 | 状态字段值 | 多轮对话流程控制 | 中 |
| LLM路由 | LLM判断意图 | 复杂意图分类 | 高 |
| 混合路由 | 规则+LLM组合 | 生产级系统 | 高 |

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 路由函数纯函数 | 不依赖外部状态 | ★★★ |
| 有兜底路径 | 路由不确定时走默认 | ★★★ |
| 限制最大重试 | 防止循环死锁 | ★★★ |
| 路由可观测 | 记录每次路由决策 | ★★☆ |
| 条件边显式映射 | 不用隐式默认 | ★★☆ |
| 状态字段命名规范 | route_needed / next_step | ★☆☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 有条件分支路由 | ☐ |
| 有质量检查回路 | ☐ |
| 有最大重试限制 | ☐ |
| 路由函数为纯函数 | ☐ |
| 有兜底默认路径 | ☐ |
| 动态路由支持运行时决策 | ☐ |
