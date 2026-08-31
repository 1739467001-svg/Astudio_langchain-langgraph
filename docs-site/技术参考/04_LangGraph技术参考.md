# LangGraph 技术参考手册

> **定位**：本文档是 LangGraph 的架构级技术参考，涵盖 StateGraph、节点、边、状态管理、检查点、人机协作等核心机制，供开发者深入理解图式编排。

---

## 目录

1. [LangGraph 概述](#1-langgraph-概述)
2. [核心概念](#2-核心概念)
3. [StateGraph 详解](#3-stategraph-详解)
4. [节点与边](#4-节点与边)
5. [状态管理](#5-状态管理)
6. [检查点与持久化](#6-检查点与持久化)
7. [人机协作（HITL）](#7-人机协作hitl)
8. [多 Agent 架构](#8-多-agent-架构)
9. [高级模式](#9-高级模式)

---

## 1. LangGraph 概述

### 1.1 什么是 LangGraph

LangGraph 是 LangChain 团队推出的**图结构工作流编排引擎**，专门用于构建有状态、多步骤、可循环的 LLM 应用。

| 维度 | 说明 |
|------|------|
| **定位** | 复杂 Agent 工作流编排引擎 |
| **包名** | `langgraph`（独立于 langchain） |
| **核心抽象** | 有向图（StateGraph） |
| **设计目标** | 让复杂 Agent 工作流变得可控、可调试、可持久化 |
| **与 LangChain 关系** | 构建在 LangChain 组件之上，但编排能力远超 LCEL |

### 1.2 为什么需要 LangGraph

| 痛点 | LangChain (LCEL) | LangGraph |
|------|-----------------|-----------|
| 无法实现循环 | 线性管道，不支持 | 原生支持循环边 |
| 状态管理困难 | 需手动管理 | 显式 State 对象 |
| 无法中途暂停 | 无中断机制 | 内置 interrupt |
| 多 Agent 协作难 | 无内置方案 | 原生多 Agent 支持 |
| 无法恢复执行 | 无持久化 | Checkpointer 自动持久化 |
| 条件分支有限 | RunnableBranch 较简陋 | 条件边，灵活强大 |

### 1.3 安装

```bash
pip install langgraph

# 可选：持久化后端
pip install langgraph-checkpoint-sqlite  # SQLite 检查点
pip install langgraph-checkpoint-postgres # PostgreSQL 检查点

# 可选：预构建 Agent
# create_react_agent 已包含在 langgraph 中
```

---

## 2. 核心概念

### 2.1 概念总览

```mermaid
graph TB
    subgraph SG["StateGraph（有向图容器）"]
        A["Node A"]
        B["Node B"]
        C["Node C"]
        D["Node D"]
        E(("END"))

        A -->|普通边| B
        B -->|普通边| C
        B -->|条件边| D
        D --> E

        A -.->|读取/更新| ST
        B -.->|读取/更新| ST
        C -.->|读取/更新| ST
        D -.->|读取/更新| ST
    end

    subgraph ST["State（共享状态）"]
        S1["messages: list"]
        S2["count: int"]
        S3["summary: str"]
    end

    START(("START")) --> A

    style SG fill:#F3E5F5,stroke:#6A1B9A,stroke-width:2px
    style ST fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style A fill:#FFF3E0,stroke:#E65100
    style B fill:#FFF3E0,stroke:#E65100
    style C fill:#FFF3E0,stroke:#E65100
    style D fill:#FFF3E0,stroke:#E65100
    style START fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
```

> **图解说明**：StateGraph 是一个有向图容器，包含若干节点（Node）和边（Edge）。START 是唯一入口，END 是出口。普通边表示固定的执行顺序，条件边表示根据状态动态决定下一步。所有节点共享同一个 State 对象，可读取和更新其中的字段（虚线表示数据访问关系）。

### 2.2 概念速查表

| 概念 | 说明 | 类比 |
|------|------|------|
| **StateGraph** | 有向图容器 | 工厂车间布局 |
| **State** | 贯穿所有节点的共享数据 | 传票/工单 |
| **Node** | 图中的处理单元 | 车间中的工位 |
| **Edge** | 节点间的连接 | 工位间的传送带 |
| **Conditional Edge** | 根据条件选择下一节点 | 分拣路口 |
| **START / END** | 图的入口和出口 | 入料口/出货口 |
| **Checkpointer** | 状态快照持久化 | 存档点 |
| **Interrupt** | 中途暂停等待人工输入 | 检查站 |

---

## 3. StateGraph 详解

### 3.1 最简示例

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

# Step 1: 定义状态
class State(TypedDict):
    messages: Annotated[list, add_messages]  # 消息列表（自动追加）
    language: str                              # 语言偏好

# Step 2: 定义节点函数
def chatbot_node(state: State) -> State:
    response = model.invoke(state["messages"])
    return {"messages": [response]}  # 返回要更新的字段

# Step 3: 构建图
graph_builder = StateGraph(State)
graph_builder.add_node("chatbot", chatbot_node)
graph_builder.add_edge(START, "chatbot")
graph_builder.add_edge("chatbot", END)

# Step 4: 编译
graph = graph_builder.compile()

# Step 5: 运行
result = graph.invoke({
    "messages": [("user", "你好")],
    "language": "中文",
})
```

### 3.2 State 定义方式

#### 方式一：TypedDict（推荐）

```python
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages
from operator import add

class State(TypedDict):
    messages: Annotated[list, add_messages]  # 追加语义
    count: Annotated[int, add]               # 累加语义
    summary: str                              # 覆盖语义（默认）
    docs: list                                # 覆盖语义
```

#### 方式二：Pydantic BaseModel

```python
from pydantic import BaseModel

class State(BaseModel):
    messages: list = []
    count: int = 0
    summary: str = ""
```

### 3.3 状态合并策略（关键！）

| 注解 | 合并方式 | 说明 |
|------|---------|------|
| `Annotated[list, add_messages]` | 追加 | 新消息添加到列表末尾 |
| `Annotated[int, add]` | 累加 | 数值相加 |
| `Annotated[list, add]` | 列表拼接 | 列表合并 |
| 无 Annotated | 覆盖 | 新值直接替换旧值 |

```python
from typing import TypedDict, Annotated
from operator import add
from langgraph.graph.message import add_messages

class State(TypedDict):
    # 追加：节点返回 {"messages": [msg]} → 追加到已有列表
    messages: Annotated[list, add_messages]
    
    # 累加：节点返回 {"count": 1} → count += 1
    count: Annotated[int, add]
    
    # 覆盖：节点返回 {"summary": "新摘要"} → 直接替换
    summary: str
```

> **核心原则**：节点函数**只返回需要更新的字段**，未返回的字段保持不变。

---

## 4. 节点与边

### 4.1 节点（Node）

```python
# 节点就是一个普通函数：接收 State，返回部分 State
def my_node(state: State) -> dict:
    # 处理逻辑
    result = do_something(state["input"])
    # 只返回需要更新的字段
    return {"output": result}

# 添加节点
graph_builder.add_node("my_node", my_node)

# 节点也可以是 Runnable（如 LangChain 链）
graph_builder.add_node("llm_chain", my_chain)
```

### 4.2 边（Edge）

#### 普通边（无条件）

```python
# A → B（固定顺序）
graph_builder.add_edge("node_a", "node_b")
```

#### 条件边（分支）

```python
# 根据状态选择下一节点
def route_function(state: State) -> str:
    if state["needs_search"]:
        return "search_node"
    else:
        return "answer_node"

graph_builder.add_conditional_edges(
    "decision_node",    # 源节点
    route_function,     # 路由函数
    {                   # 路由映射（可选，用于可视化）
        "search_node": "search_node",
        "answer_node": "answer_node",
    }
)
```

#### 条件边完整示例

```python
from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    query: str
    category: str
    answer: str

def classify_node(state: State) -> dict:
    # 用 LLM 分类
    if "天气" in state["query"]:
        return {"category": "weather"}
    elif "新闻" in state["query"]:
        return {"category": "news"}
    else:
        return {"category": "general"}

def weather_node(state: State) -> dict:
    return {"answer": f"天气查询结果：{state['query']}"}

def news_node(state: State) -> dict:
    return {"answer": f"新闻查询结果：{state['query']}"}

def general_node(state: State) -> dict:
    return {"answer": f"通用回答：{state['query']}"}

def route_by_category(state: State) -> str:
    return state["category"]

# 构建图
builder = StateGraph(State)
builder.add_node("classify", classify_node)
builder.add_node("weather", weather_node)
builder.add_node("news", news_node)
builder.add_node("general", general_node)

builder.add_edge(START, "classify")
builder.add_conditional_edges("classify", route_by_category)
builder.add_edge("weather", END)
builder.add_edge("news", END)
builder.add_edge("general", END)

graph = builder.compile()
```

### 4.3 循环（LangGraph 的核心优势）

```python
# 循环：Agent 反复调用工具直到完成
def should_continue(state: State) -> str:
    """判断是否需要继续循环"""
    last_message = state["messages"][-1]
    if last_message.tool_calls:  # LLM 想调用工具
        return "tools"
    else:                         # LLM 已给出最终回答
        return END

# 构建带循环的图
builder = StateGraph(State)
builder.add_node("agent", agent_node)
builder.add_node("tools", tool_node)

builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", should_continue)  # agent → tools 或 END
builder.add_edge("tools", "agent")  # tools → agent（循环回去！）

graph = builder.compile()
```

```mermaid
graph LR
    START(("START")) --> AGENT["agent 节点<br/>调用 LLM"]
    AGENT -->|"should_continue()"| DECISION{"有 tool_calls？"}
    DECISION -->|是| TOOLS["tools 节点<br/>执行工具调用"]
    TOOLS -->|循环回去| AGENT
    DECISION -->|否| END(("END"))

    style AGENT fill:#FFF3E0,stroke:#E65100,stroke-width:2px
    style TOOLS fill:#E8F5E9,stroke:#2E7D32
    style DECISION fill:#FCE4EC,stroke:#C62828,stroke-width:2px
    style START fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style END fill:#F3E5F5,stroke:#6A1B9A,stroke-width:2px
```

> **图解说明**：这是 LangGraph 的经典循环模式——Agent 调用 LLM 后，判断返回是否包含 `tool_calls`：如果有，跳到 tools 节点执行工具，然后**循环回 agent**；如果没有，说明 LLM 已给出最终回答，跳到 END。这种循环是 LangChain LCEL 无法实现的。

---

## 5. 状态管理

### 5.1 状态在图中的流转

```mermaid
graph TB
    subgraph BEFORE["原始 State"]
        S1["messages: [msg1, msg2]"]
        S2["count: 3"]
        S3["summary: 对话摘要"]
    end

    BEFORE --> A["Node A<br/>返回部分 State"]
    BEFORE --> B["Node B<br/>返回部分 State"]
    BEFORE --> C["Node C<br/>返回部分 State"]

    A --> MERGE["状态合并<br/>(Annotated 策略)"]
    B --> MERGE
    C --> MERGE

    MERGE --> AFTER

    subgraph AFTER["更新后的 State"]
        S4["messages: [msg1,msg2,msg3]"]
        S5["count: 4"]
        S6["summary: 新摘要"]
    end

    style BEFORE fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style AFTER fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style MERGE fill:#FFF3E0,stroke:#E65100,stroke-width:2px
    style A fill:#FCE4EC,stroke:#C62828
    style B fill:#FCE4EC,stroke:#C62828
    style C fill:#FCE4EC,stroke:#C62828
```

> **图解说明**：State 在整个图中是共享的。每个节点接收完整 State，但**只返回需要更新的字段**。框架根据 Annotated 注解自动合并——`add_messages` 的字段追加，`add` 的字段累加，无注解的字段覆盖。最终得到更新后的 State 供下游节点使用。

### 5.2 子图（Subgraph）

```python
# 子图可以嵌套，实现模块化
child_builder = StateGraph(ChildState)
child_builder.add_node("step1", step1_node)
child_builder.add_node("step2", step2_node)
child_builder.add_edge(START, "step1")
child_builder.add_edge("step1", "step2")
child_builder.add_edge("step2", END)
child_graph = child_builder.compile()

# 将子图作为节点加入父图
parent_builder = StateGraph(ParentState)
parent_builder.add_node("child_process", child_graph)  # 子图作为节点
parent_builder.add_node("other_step", other_node)
parent_builder.add_edge(START, "child_process")
parent_builder.add_edge("child_process", "other_step")
parent_builder.add_edge("other_step", END)
```

---

## 6. 检查点与持久化

### 6.1 为什么需要检查点

| 场景 | 无检查点 | 有检查点 |
|------|---------|---------|
| 服务重启 | 状态丢失 | 状态恢复 |
| 时间旅行 | 不可能 | 可回溯任意历史状态 |
| 人机协作 | 无法暂停 | 暂停后恢复 |
| 并发控制 | 无 | 支持线程级隔离 |

### 6.2 使用 Checkpointer

```python
from langgraph.checkpoint.memory import MemorySaver

# 内存检查点（开发用）
checkpointer = MemorySaver()

# 编译时指定检查点
graph = builder.compile(checkpointer=checkpointer)

# 运行时指定线程 ID
config = {"configurable": {"thread_id": "user_123"}}

# 第一次对话
result = graph.invoke(
    {"messages": [("user", "我叫张三")]},
    config=config,
)

# 第二次对话（同一线程，有上下文）
result = graph.invoke(
    {"messages": [("user", "我叫什么名字？")]},
    config=config,
)
# AI: "你叫张三"（因为它记住了！）
```

### 6.3 检查点后端对比

| 后端 | 包名 | 持久化 | 适用场景 |
|------|------|--------|---------|
| 内存 | `MemorySaver` | 否 | 开发测试 |
| SQLite | `langgraph-checkpoint-sqlite` | 是 | 单机生产 |
| PostgreSQL | `langgraph-checkpoint-postgres` | 是 | 分布式生产 |

```python
# SQLite 检查点
from langgraph.checkpoint.sqlite import SqliteSaver

checkpointer = SqliteSaver.from_conn_string("checkpoints.db")
graph = builder.compile(checkpointer=checkpointer)

# PostgreSQL 检查点
from langgraph.checkpoint.postgres import PostgresSaver

checkpointer = PostgresSaver.from_conn_string(
    "postgresql://user:pass@localhost:5432/langgraph"
)
graph = builder.compile(checkpointer=checkpointer)
```

### 6.4 状态历史与时间旅行

```python
# 获取所有检查点历史
history = list(graph.get_state_history(config))

for state in history:
    print(f"步骤: {state.next}, 值: {state.values.get('messages', [])[:1]}")

# 回到某个历史状态重新执行
old_state = history[3]  # 第4个检查点
graph.invoke(None, config={**config, "checkpoint_id": old_state.config["configurable"]["checkpoint_id"]})
```

---

## 7. 人机协作（HITL）

### 7.1 Interrupt 机制

```python
from langgraph.types import interrupt, Command

def human_review_node(state: State) -> dict:
    # 暂停执行，等待人工输入
    human_input = interrupt({
        "question": "请审核以下内容是否正确：",
        "content": state["draft"],
    })
    # 人工输入后恢复执行
    return {"approved_content": human_input}

# 构建图
builder.add_node("draft", draft_node)
builder.add_node("review", human_review_node)
builder.add_node("publish", publish_node)
builder.add_edge(START, "draft")
builder.add_edge("draft", "review")
builder.add_edge("review", "publish")
builder.add_edge("publish", END)

graph = builder.compile(checkpointer=MemorySaver())

# 第一次调用：会在 review 节点暂停
config = {"configurable": {"thread_id": "task_1"}}
result = graph.invoke({"input": "生成报告"}, config=config)
# result 包含 interrupt 信息

# 人工审核后，恢复执行
result = graph.invoke(
    Command(resume="审核通过，内容正确"),
    config=config,
)
```

### 7.2 HITL 应用场景

| 场景 | 说明 |
|------|------|
| 内容审核 | AI 生成草稿 → 人工审核 → 发布 |
| 高风险操作确认 | AI 准备执行删除 → 人工确认 → 执行 |
| 信息补充 | AI 缺少信息 → 向用户提问 → 补充后继续 |
| 多轮迭代 | AI 生成 → 人工反馈 → AI 修改 → 确认 |

---

## 8. 多 Agent 架构

### 8.1 架构模式

| 模式 | 结构 | 适用场景 |
|------|------|---------|
| **Supervisor** | 中心调度者分配任务给子 Agent | 任务可分解为独立子任务 |
| **Hierarchical** | 多层 Supervisor 嵌套 | 大型复杂项目 |
| **Network** | Agent 间互相通信 | 协作探索型任务 |
| **Handoff** | Agent 间传递控制权 | 对话路由场景 |

### 8.2 Supervisor 模式示例

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class State(TypedDict):
    messages: Annotated[list, add_messages]
    next_agent: str

# Supervisor：决定下一步交给哪个 Agent
def supervisor(state: State) -> dict:
    last_msg = state["messages"][-1]
    # LLM 决策：交给谁
    if "代码" in last_msg.content:
        return {"next_agent": "coder"}
    elif "搜索" in last_msg.content:
        return {"next_agent": "researcher"}
    else:
        return {"next_agent": "FINISH"}

def route(state: State) -> str:
    next_agent = state["next_agent"]
    if next_agent == "FINISH":
        return END
    return next_agent

def coder_agent(state: State) -> dict:
    # 代码 Agent 处理
    return {"messages": [("ai", "这是代码实现...")]}

def researcher_agent(state: State) -> dict:
    # 研究 Agent 处理
    return {"messages": [("ai", "这是搜索结果...")]}

# 构建多 Agent 图
builder = StateGraph(State)
builder.add_node("supervisor", supervisor)
builder.add_node("coder", coder_agent)
builder.add_node("researcher", researcher_agent)

builder.add_edge(START, "supervisor")
builder.add_conditional_edges("supervisor", route)
builder.add_edge("coder", "supervisor")    # 回到 supervisor
builder.add_edge("researcher", "supervisor") # 回到 supervisor

graph = builder.compile(checkpointer=MemorySaver())
```

```mermaid
graph TB
    START(("START")) --> SUP["Supervisor<br/>中心调度者"]

    SUP -->|"route()"| DECISION{"next_agent?"}
    DECISION -->|coder| CODER["Coder Agent<br/>代码实现"]
    DECISION -->|researcher| RESEARCHER["Researcher Agent<br/>搜索研究"]
    DECISION -->|FINISH| END(("END"))

    CODER -->|回到 Supervisor| SUP
    RESEARCHER -->|回到 Supervisor| SUP

    style SUP fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style DECISION fill:#FCE4EC,stroke:#C62828,stroke-width:2px
    style CODER fill:#FFF3E0,stroke:#E65100
    style RESEARCHER fill:#E8F5E9,stroke:#2E7D32
    style START fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style END fill:#F3E5F5,stroke:#6A1B9A,stroke-width:2px
```

> **图解说明**：Supervisor 模式是多 Agent 协作的经典架构——所有子 Agent 只与 Supervisor 通信，不直接互相对话。Supervisor 接收用户消息后，用 LLM 决策下一步交给哪个 Agent 处理，子 Agent 处理完后回到 Supervisor，由它决定是否结束或继续分发。这种中心化的设计便于控制和管理。

### 8.3 使用预构建 Agent

```python
from langgraph.prebuilt import create_react_agent

# 一行创建 ReAct Agent（带工具调用 + 循环）
agent = create_react_agent(
    model=ChatOpenAI(model="gpt-4o-mini"),
    tools=[search_tool, calc_tool],
)

# 直接使用
result = agent.invoke({"messages": [("user", "搜索LangChain最新版本")]})
```

---

## 9. 高级模式

### 9.1 Map-Reduce 模式

```python
# 并行处理多个子任务，再汇总
import operator
from typing import Annotated

class State(TypedDict):
    questions: list
    answers: Annotated[list, operator.add]  # 并行结果累加

def map_node(state: State) -> dict:
    # 对每个问题并行调用（LangGraph 自动并行）
    answers = [answer_q(q) for q in state["questions"]]
    return {"answers": answers}

def reduce_node(state: State) -> dict:
    summary = "\n".join(state["answers"])
    return {"final_answer": summary}
```

### 9.2 动态图生成

```python
def dynamic_route(state: State) -> str:
    # 根据运行时状态动态决定图的结构
    available_tools = state.get("available_tools", [])
    if "web_search" in available_tools:
        return "search_and_answer"
    return "direct_answer"
```

### 9.3 流式输出

```python
# 流式输出事件
for event in graph.stream(
    {"messages": [("user", "写一首诗")]},
    config=config,
    stream_mode="values",  # 每次状态更新时输出
):
    if "messages" in event:
        last_msg = event["messages"][-1]
        if hasattr(last_msg, "content"):
            print(last_msg.content, end="", flush=True)

# stream_mode 选项
# "values"   : 每次状态更新时输出完整状态
# "updates"  : 只输出变更的字段
# "messages" : 逐 token 输出 LLM 消息
# "debug"    : 调试信息
```

### 9.4 流式模式对比

| stream_mode | 输出内容 | 适用场景 |
|-------------|---------|---------|
| `"values"` | 每步的完整状态 | 调试/监控 |
| `"updates"` | 每步的增量变更 | 日志记录 |
| `"messages"` | LLM 逐 token | 用户端流式显示 |
| `"debug"` | 执行轨迹详情 | 深度调试 |

---

## LangGraph 速查表

| 操作 | 代码 | 说明 |
|------|------|------|
| 定义状态 | `class State(TypedDict): ...` | 共享数据结构 |
| 创建图 | `StateGraph(State)` | 初始化图构建器 |
| 添加节点 | `add_node("name", func)` | 注册处理函数 |
| 普通边 | `add_edge("A", "B")` | 固定连接 |
| 条件边 | `add_conditional_edges("A", router)` | 动态路由 |
| 循环 | `add_edge("B", "A")` | 回边形成循环 |
| 编译 | `compile(checkpointer=...)` | 生成可执行图 |
| 运行 | `graph.invoke(input, config)` | 执行图 |
| 流式 | `graph.stream(input, config)` | 流式执行 |
| 暂停 | `interrupt(value)` | 人工介入 |
| 恢复 | `invoke(Command(resume=...))` | 恢复执行 |

---

> **配套学习课程**：请阅读 `学习课程/第08课_LangGraph入门_用图思维编排AI.md` 和 `第09课_复杂工作流与多Agent协作.md`
