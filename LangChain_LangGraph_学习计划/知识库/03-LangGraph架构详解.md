# LangGraph 架构详解

> 深入理解 LangGraph 的图式编排架构、核心概念和设计理念。

---

## 一、定位与背景

### 1.1 LangGraph 是什么

LangGraph 是 LangChain 团队开发的**图式工作流编排框架**，专门用于构建有状态、多步骤、支持分支和循环的 AI 应用。

### 1.2 为什么不只用 LangChain Chain

```
LangChain Chain（LCEL）：
  线性管道 A → B → C → D
  ✅ 简单、易用、流式输出
  ❌ 不支持条件分支
  ❌ 不支持循环（重试、迭代优化）
  ❌ 不支持复杂状态管理
  ❌ 不支持多 Agent 协作

LangGraph：
  有向图（支持分支、循环、并行）
  ✅ 条件分支（根据状态选择路径）
  ✅ 循环（重试、迭代优化）
  ✅ 复杂状态管理（Reducer 机制）
  ✅ 多 Agent 协作
  ✅ 人工介入（Human-in-the-Loop）
  ✅ 持久化与时间旅行
  ❌ 比 Chain 复杂
```

### 1.3 LangGraph 与 LangChain 的关系

```
LangChain 提供组件（积木）
    ├── Models（LLM 调用）
    ├── Prompts（提示词）
    ├── Tools（工具）
    ├── Retrievers（检索器）
    └── ...

LangGraph 提供编排（把积木组装成工作流）
    ├── StateGraph（图构建器）
    ├── Node（节点 = LangChain 组件的封装）
    ├── Edge（连接）
    └── ...
```

在 LangGraph 中，每个 Node 内部通常使用 LangChain 组件来实现具体逻辑。

## 二、核心架构

### 2.1 架构总览

```
┌──────────────────────────────────────────────────────┐
│                  LangGraph 架构                      │
│                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────────┐    │
│  │  State   │   │  Node    │   │    Edge       │    │
│  │ (状态)   │   │ (节点)   │   │   (边)        │    │
│  └──────────┘   └──────────┘   └──────────────┘    │
│                                                      │
│  ┌──────────────────────────────────────────┐       │
│  │           StateGraph (图构建器)           │       │
│  │  add_node / add_edge / add_conditional  │       │
│  └──────────────────────────────────────────┘       │
│                                                      │
│  ┌──────────────────────────────────────────┐       │
│  │            Compiler (编译器)              │       │
│  │   compile() → 可执行的应用                │       │
│  └──────────────────────────────────────────┘       │
│                                                      │
│  ┌──────────────────────────────────────────┐       │
│  │         Checkpointer (检查点)            │       │
│  │  MemorySaver / SQLite / PostgreSQL        │       │
│  └──────────────────────────────────────────┘       │
│                                                      │
│  ┌──────────────────────────────────────────┐       │
│  │         Runtime (运行时)                  │       │
│  │  invoke / stream / ainvoke / astream     │       │
│  └──────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────┘
```

### 2.2 执行模型

LangGraph 的执行模型是一个**消息传递的状态机**：

```
1. 初始化 State
2. 执行当前节点（Node 函数接收 State，返回更新）
3. State 通过 Reducer 合并更新
4. 检查出边（Edge）：固定边直接走，条件边调用路由函数
5. 如果有下一个节点，回到 Step 2
6. 如果到达 END，返回最终 State
```

## 三、State 详解

### 3.1 State 定义方式

```python
# 方式一：TypedDict（推荐，简洁）
from typing import TypedDict, Annotated
from operator import add

class State(TypedDict):
    messages: Annotated[list, add]  # 用 add 合并器
    count: int                       # 默认替换

# 方式二：Pydantic BaseModel
from pydantic import BaseModel

class State(BaseModel):
    messages: list = []
    count: int = 0
```

### 3.2 Reducer 机制详解

Reducer 定义了 State 字段如何被更新。这是 LangGraph 最核心的概念：

```python
from typing import Annotated

# 默认行为（不指定 Reducer）：直接替换
class State(TypedDict):
    answer: str  # 节点返回 {"answer": "new"} → answer 变成 "new"

# add Reducer：追加
class State(TypedDict):
    messages: Annotated[list, add]  
    # 节点返回 {"messages": [msg]} → messages 追加 msg

# 自定义 Reducer
def keep_max(old: int, new: int) -> int:
    return max(old, new)

class State(TypedDict):
    score: Annotated[int, keep_max]
    # 节点返回 {"score": 5} → score 变成 max(old_score, 5)
```

**Reducer 规则总结**：

| Reducer | 行为 | 常见用途 |
|---------|------|----------|
| 不指定 | 替换 | 简单字段（answer, status） |
| `add` | 追加/累加 | 消息列表、计数器 |
| 自定义函数 | 任意逻辑 | 合并字典、取最大值等 |

### 3.3 State 的消息模式

最常用的 State 模式——消息累积：

```python
from typing import TypedDict, Annotated
from operator import add
from langchain_core.messages import AnyMessage

class AgentState(TypedDict):
    # 每个节点返回的新消息会自动追加到列表
    messages: Annotated[list[AnyMessage], add]
```

## 四、Node 详解

### 4.1 节点函数签名

```python
def my_node(state: State) -> dict:
    """
    节点函数。
    - 接收完整的当前 State
    - 返回要更新的字段（部分 State，不需要全部）
    - 返回的 dict 通过 Reducer 合并到 State
    """
    # 读取
    value = state["some_field"]
    
    # 处理
    result = do_something(value)
    
    # 返回更新（只返回变化的字段）
    return {"some_field": result}
```

### 4.2 节点类型

```python
# 类型一：普通函数节点
def process_node(state: State) -> dict:
    return {"result": "processed"}

# 类型二：调用 LLM 的节点
def llm_node(state: State) -> dict:
    response = llm.invoke(state["messages"])
    return {"messages": [response]}

# 类型三：调用工具的节点
def tool_node(state: State) -> dict:
    last_msg = state["messages"][-1]
    results = []
    for call in last_msg.tool_calls:
        output = tools[call["name"]].invoke(call["args"])
        results.append(ToolMessage(content=output, tool_call_id=call["id"]))
    return {"messages": results}

# 类型四：子图作为节点
subgraph_app = subgraph_builder.compile()
graph.add_node("subgraph", subgraph_app)  # 整个子图作为单个节点
```

### 4.3 特殊节点

```python
from langgraph.graph import START, END

# START 和 END 是特殊的虚拟节点
# START: 图的入口
# END: 图的出口

graph.add_edge(START, "first_node")  # 从开始到第一个节点
graph.add_edge("last_node", END)      # 从最后节点到结束
```

## 五、Edge 详解

### 5.1 边的类型

```python
# 类型一：普通边（固定顺序）
graph.add_edge("node_a", "node_b")
# node_a 执行完必定走到 node_b

# 类型二：条件边（根据状态路由）
graph.add_conditional_edges(
    "node_a",           # 源节点
    routing_function,   # 路由函数（返回字符串）
    {                    # 返回值 → 目标节点 映射
        "path_1": "node_b",
        "path_2": "node_c",
        "end": END,
    }
)

# 类型三：入口边
graph.add_edge(START, "first_node")

# 类型四：出口边
graph.add_edge("last_node", END)
```

### 5.2 路由函数

```python
def routing_function(state: State) -> str:
    """
    返回字符串，决定下一个节点。
    返回值需要匹配 add_conditional_edges 中的映射键。
    """
    if state["status"] == "error":
        return "retry"      # 去重试节点
    else:
        return "continue"  # 继续下一个节点

graph.add_conditional_edges(
    "current_node",
    routing_function,
    {
        "retry": "current_node",  # 回到自身（循环）
        "continue": "next_node",  # 前进
    }
)
```

### 5.3 并行边

```python
# 从同一个节点出发多条边 → 并行执行
graph.add_edge(START, "node_a")
graph.add_edge(START, "node_b")  # node_a 和 node_b 并行执行
graph.add_edge("node_a", "merge")  # 都完成后到 merge
graph.add_edge("node_b", "merge")
```

## 六、编译与运行

### 6.1 编译选项

```python
from langgraph.checkpoint.memory import MemorySaver

# 基础编译
app = graph.compile()

# 带检查点（持久化、中断、时间旅行）
app = graph.compile(checkpointer=MemorySaver())

# 带中断（Human-in-the-Loop）
app = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["review_node"],  # 在 review_node 之前暂停
    interrupt_after=["generate_node"], # 在 generate_node 之后暂停
)
```

### 6.2 运行方式

```python
# 同步
result = app.invoke(input_data, config=config)

# 流式（逐节点输出）
for event in app.stream(input_data, config=config):
    print(event)  # 每个节点的输出

# 异步
result = await app.ainvoke(input_data, config=config)

# 异步流式
async for event in app.astream(input_data, config=config):
    print(event)

# 流式输出 LLM 的 token（而不是节点级别的输出）
async for msg, metadata in app.astream_events(
    input_data, config=config, version="v2"
):
    if msg["event"] == "on_chat_model_stream":
        print(msg["data"]["chunk"].content, end="")
```

### 6.3 检查点（Checkpoint）

检查点机制允许：

- **持久化**：程序重启后恢复状态
- **中断**：在指定节点暂停，等待外部输入后继续
- **时间旅行**：回到之前的状态，从那里重新开始

```python
from langgraph.checkpoint.memory import MemorySaver
# 生产环境可用：
# from langgraph.checkpoint.sqlite import SqliteSaver
# from langgraph.checkpoint.postgres import PostgresSaver

checkpointer = MemorySaver()
app = graph.compile(checkpointer=checkpointer)

# 每次调用指定 thread_id
config = {"configurable": {"thread_id": "session_1"}}
result = app.invoke({"input": "hello"}, config=config)

# 查看状态历史
state_history = list(app.get_state_history(config))

# 从某个历史状态恢复
for state in state_history:
    print(state.config, state.values)
```

## 七、预构建组件

LangGraph 提供了一些常用模式的预构建实现：

### 7.1 create_react_agent

```python
from langgraph.prebuilt import create_react_agent

# 快速创建 ReAct Agent（不需要手动构建图）
tools = [search_tool, calculator_tool]
agent = create_react_agent(llm, tools)

result = agent.invoke({"messages": [HumanMessage(content="123 * 456 = ?")]})
```

### 7.2 ToolNode

```python
from langgraph.prebuilt import ToolNode

# 自动执行 LLM 的工具调用
tool_node = ToolNode(tools=[search_tool, calculator_tool])
```

### 7.3 MessageGraph

```python
from langgraph.graph import MessageGraph

# 简化的图，State 就是消息列表
graph = MessageGraph()
graph.add_node("agent", agent_node)
graph.add_node("tools", ToolNode(tools))
graph.add_edge(START, "agent")
# ...
```

## 八、设计模式

### 8.1 常见图模式

```
模式一：线性流程
  START → A → B → C → END

模式二：条件分支
  START → A → [条件] → B → END
                     → C → END

模式三：循环（重试/迭代）
  START → A → B → [条件] → END
                     ↓
                     A（重新执行）

模式四：并行
  START → A ──┐
        → B ──┤→ Merge → END
        → C ──┘

模式五：多 Agent 路由
  START → Router → Agent_A → END
                 → Agent_B → END
                 → Agent_C → END

模式六：Supervisor 模式
  START → Supervisor → Agent_A → Supervisor → Agent_B → Supervisor → END
```

### 8.2 Agent 调度模式

```python
# Supervisor 模式：主 Agent 决定下一步交给谁
def supervisor(state) -> str:
    """主 Agent 决定路由"""
    decision = llm.invoke(...)
    return decision  # 返回下一个 Agent 的名字

# 每个子 Agent 完成后回到 Supervisor
graph.add_conditional_edges("supervisor", supervisor, {
    "agent_a": "agent_a",
    "agent_b": "agent_b",
    "done": END,
})
graph.add_edge("agent_a", "supervisor")  # 回到 Supervisor
graph.add_edge("agent_b", "supervisor")
```
