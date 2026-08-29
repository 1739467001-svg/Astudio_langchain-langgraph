# LangGraph API 参考与速查

> 知识库 04 有 467 行但主要讲 LangChain API。这篇专注 LangGraph API——StateGraph、节点、边、条件路由、Command、流式。

---

## 一、核心 API 速查

```python
class LangGraphAPI:
    """LangGraph API速查表。"""

    GRAPH_BUILDING = {
        "StateGraph": "from langgraph.graph import StateGraph",
        "START": "from langgraph.graph import START",
        "END": "from langgraph.graph import END",
        "add_messages": "from langgraph.graph.message import add_messages",
        "compile": "graph.compile(checkpointer=..., store=...)",
    }

    NODES_EDGES = {
        "add_node": "graph.add_node('name', func)",
        "add_edge": "graph.add_edge('node_a', 'node_b')",
        "add_conditional_edges": "graph.add_conditional_edges('source', route_func, {'key': 'target'})",
        "add_edge(START)": "graph.add_edge(START, 'first_node')",
        "add_edge(END)": "graph.add_edge('last_node', END)",
    }

    PREBUILT = {
        "create_react_agent": "from langgraph.prebuilt import create_react_agent",
        "ToolNode": "from langgraph.prebuilt import ToolNode",
    }

    COMMAND_INTERRUPT = {
        "interrupt": "from langgraph.types import interrupt",
        "Command": "from langgraph.types import Command",
        "resume": "Command(resume={'data': ...})",
        "update_goto": "Command(update={...}, goto='node')",
    }

    STREAMING = {
        "astream": "async for state in graph.astream(input, config)",
        "astream_events": "async for event in graph.astream_events(input, version='v2')",
        "stream_mode": "graph.astream(input, stream_mode='messages')",
    }

    PERSISTENCE = {
        "MemorySaver": "from langgraph.checkpoint.memory import MemorySaver",
        "SqliteSaver": "from langgraph.checkpoint.sqlite import SqliteSaver",
        "PostgresSaver": "from langgraph.checkpoint.postgres import PostgresSaver",
        "Store": "from langgraph.store.memory import InMemoryStore",
        "get_state": "graph.get_state(config)",
        "update_state": "graph.update_state(config, values={...})",
        "get_state_history": "graph.get_state_history(config)",
    }

    MESSAGE_MANAGEMENT = {
        "RemoveMessage": "from langgraph.graph.message import RemoveMessage",
        "HumanMessage": "from langchain_core.messages import HumanMessage",
        "AIMessage": "from langchain_core.messages import AIMessage",
        "SystemMessage": "from langchain_core.messages import SystemMessage",
        "ToolMessage": "from langchain_core.messages import ToolMessage",
    }
```

---

## 二、常用模式速查

```python
# 1. 创建Agent（最简）
from langgraph.prebuilt import create_react_agent
agent = create_react_agent(llm, tools, checkpointer=MemorySaver())

# 2. 条件路由
def route(state):
    if state["needs_search"]:
        return "search"
    return "generate"
graph.add_conditional_edges("classify", route, {"search": "search", "generate": "generate"})

# 3. 人机交互
from langgraph.types import interrupt, Command
approval = interrupt({"question": "批准?"})
# 恢复: agent.invoke(Command(resume={"approved": True}), config)

# 4. 流式输出
async for event in agent.astream_events(input, version="v2"):
    if event["event"] == "on_chat_model_stream":
        print(event["data"]["chunk"].content, end="")

# 5. 状态修改
graph.update_state(config, values={"key": "new_value"})

# 6. 时间旅行
history = list(graph.get_state_history(config))
graph.invoke(None, {**config, "checkpoint_id": history[2].config["configurable"]["checkpoint_id"]})

# 7. 消息清理
from langgraph.graph.message import RemoveMessage
graph.update_state(config, values={"messages": [RemoveMessage(id=msg.id)]})
```

---

## 三、配置模式

```python
CONFIG_PATTERNS = {
    # 基本配置
    "basic": {"configurable": {"thread_id": "session-1"}},

    # 带检查点恢复
    "restore": {"configurable": {"thread_id": "session-1", "checkpoint_id": "cp-xxx"}},

    # 多用户隔离
    "multi_user": {"configurable": {"thread_id": f"user-{user_id}-session-{session_id}"}},
}
```

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| astream_events用v2 | v1已过时 | ★★★ |
| 必须设thread_id | 对话隔离 | ★★★ |
| interrupt必须配checkpointer | 否则无法恢复 | ★★★ |
| RemoveMessage清理历史 | 防止膨胀 | ★★☆ |
| 条件路由用纯函数 | 不依赖外部 | ★★☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有API速查表 | ☐ |
| 有常用模式 | ☐ |
| 有配置模式 | ☐ |
