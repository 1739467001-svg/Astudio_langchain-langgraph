# LangGraph 状态管理与检查点技术手册

> **定位**：技术参考手册 | **前置知识**：第08课 LangGraph入门、第18课 LangGraph进阶 | **难度**：高级

---

## 1. 状态管理核心概念

LangGraph 的核心设计理念：**图 = 状态机**。每个节点读取状态、处理、返回状态更新。

```mermaid
graph LR
    A[初始状态] --> B[节点1: 检索]
    B --> C[状态更新<br/>+检索结果]
    C --> D[节点2: 生成]
    D --> E[状态更新<br/>+生成结果]
    E --> F[节点3: 校验]
    F --> G{通过?}
    G -->|是| H[最终状态]
    G -->|否| D
```

### State 定义规范

```python
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

# 方式1：简单 TypedDict
class SimpleState(TypedDict):
    question: str
    answer: str

# 方式2：带 reducer 的状态（消息列表自动追加）
class ChatState(TypedDict):
    messages: Annotated[list, add_messages]  # add_messages reducer
    context: str
    answer: str

# 方式3：多字段 reducer
from operator import add

class WorkflowState(TypedDict):
    messages: Annotated[list, add_messages]
    retrieved_docs: Annotated[list, add]  # 列表追加
    query: str
    steps: Annotated[int, add]  # 整数累加
```

### Reducer 机制详解

```mermaid
flowchart TD
    A[节点返回值] --> B{字段有 reducer?}
    B -->|是| C[reducer 函数处理]
    B -->|否| D[直接覆盖]
    C --> E["add_messages: 追加消息"]
    C --> F["add: 列表拼接/数字相加"]
    C --> G["自定义: 任意逻辑"]
    D --> H[旧值被新值替换]
    E --> I[更新后的状态]
    F --> I
    G --> I
    H --> I
```

```python
from typing import Annotated
from operator import add

def merge_context(old: str, new: str) -> str:
    """自定义 reducer：拼接上下文"""
    if old and new:
        return f"{old}\n---\n{new}"
    return new or old

class RAGState(TypedDict):
    messages: Annotated[list, add_messages]
    documents: Annotated[list, add]  # 文档列表累积
    context: Annotated[str, merge_context]  # 自定义合并
    question: str
    answer: str
    retry_count: Annotated[int, add]  # 重试计数器
```

---

## 2. Checkpointer 持久化

Checkpointer 是 LangGraph 的记忆持久化层，保存图执行的每一步状态快照。

```mermaid
sequenceDiagram
    participant U as 用户
    participant G as Graph
    participant C as Checkpointer
    
    U->>G: 发送消息 (thread_id="chat_001")
    G->>C: 加载 thread_001 的最后状态
    C-->>G: 返回历史状态快照
    G->>G: 执行节点1
    G->>C: 保存节点1后的状态
    G->>G: 执行节点2
    G->>C: 保存节点2后的状态
    G-->>U: 返回结果
    U->>G: 发送下一条消息 (thread_id="chat_001")
    G->>C: 加载最新快照
    Note over C: 自动恢复上次状态
```

### Checkpointer 类型

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.checkpoint.postgres import PostgresSaver

# 1. 内存（开发/测试用）
checkpointer = MemorySaver()

# 2. SQLite（单机持久化）
import sqlite3
conn = sqlite3.connect("checkpoints.db", check_same_thread=False)
checkpointer = SqliteSaver(conn=conn)

# 3. PostgreSQL（生产环境）
checkpointer = PostgresSaver.from_conn_string(
    "postgresql://user:pass@localhost:5432/langgraph"
)

# 编译图时指定
app = graph.compile(checkpointer=checkpointer)
```

### Checkpoint 存储结构

| 字段 | 说明 |
|------|------|
| `thread_id` | 会话标识，隔离不同用户 |
| `checkpoint_id` | 每步状态快照的唯一 ID |
| `parent_id` | 父快照 ID，形成链表 |
| `channel_values` | 当前状态值 |
| `channel_versions` | 各字段版本号 |
| `metadata` | 执行元信息（步数、节点名等） |

---

## 3. 时间旅行与状态回溯

LangGraph 允许回到任意历史检查点，从该点重新执行或分支。

```python
# 获取所有历史快照
config = {"configurable": {"thread_id": "chat_001"}}
states = list(app.get_state_history(config))

# 查看每个快照
for state in states:
    print(f"Step {state.metadata['step_count']}: "
          f"node={state.metadata.get('source')}, "
          f"messages={len(state.values.get('messages', []))}")

# 回到第3步的状态
target_state = states[-3]  # 假设倒数第3个
config_replay = {
    "configurable": {
        "thread_id": "chat_001",
        "checkpoint_id": target_state.config["configurable"]["checkpoint_id"]
    }
}

# 从该点重新执行
for event in app.stream(None, config_replay, stream_mode="values"):
    print(event)
```

```mermaid
flowchart LR
    A[Step 0: 初始] --> B[Step 1: 检索]
    B --> C[Step 2: 生成]
    C --> D[Step 3: 校验]
    D --> E[Step 4: 重试]
    E --> F[Step 5: 完成]
    
    G[时间旅行] --> C
    C --> H[分支: 修改参数]
    H --> I[Step 2': 新生成]
    I --> J[Step 3': 新校验]
```

---

## 4. 人在回路（Human-in-the-Loop）

### 中断与审批模式

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

class ToolState(TypedDict):
    messages: Annotated[list, add_messages]
    pending_tool_call: dict
    approved: bool

def execute_tool_node(state: ToolState):
    """工具执行节点"""
    tool_call = state.get("pending_tool_call", {})
    # 暂停，等待人工审批
    return {"pending_tool_call": tool_call}

def human_approval_node(state: ToolState):
    """人工审批节点"""
    # 这个节点在实际运行中会被中断
    # 用户通过 update_state 注入审批结果
    pass

graph = StateGraph(ToolState)
graph.add_node("execute", execute_tool_node)
graph.add_node("approve", human_approval_node)
graph.set_entry_point("execute")
graph.add_edge("execute", "approve")
graph.add_conditional_edges(
    "approve",
    lambda s: "execute" if s.get("approved") else END
)

# 编译时设置中断点
app = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["approve"]  # 在审批节点前暂停
)
```

### 审批流程实操

```python
config = {"configurable": {"thread_id": "tool_001"}}

# 1. 执行到中断点
result = app.invoke(
    {"messages": [{"role": "user", "content": "删除文件 test.txt"}],
     "pending_tool_call": {"tool": "delete_file", "args": {"path": "test.txt"}},
     "approved": False},
    config
)
# 此时在 "approve" 节点前暂停

# 2. 查看当前状态
state = app.get_state(config)
print(f"待审批操作: {state.values.get('pending_tool_call')}")

# 3. 人工审批：批准或拒绝
app.update_state(
    config,
    {"approved": True},  # 或 False 拒绝
    as_node="approve"
)

# 4. 继续执行
result = app.invoke(None, config)  # None 表示从断点继续
```

```mermaid
flowchart TD
    A[用户请求] --> B[Agent 决定调用工具]
    B --> C[中断: 等待审批]
    C --> D{人工审批}
    D -->|批准| E[执行工具]
    D -->|拒绝| F[告知用户被拒]
    D -->|修改参数| G[更新参数后执行]
    E --> H[返回结果]
    F --> H
    G --> H
```

---

## 5. 并行执行与状态合并

```python
from langgraph.graph import StateGraph, END

class ResearchState(TypedDict):
    question: str
    web_results: str
    db_results: str
    final_answer: str

def web_search_node(state: ResearchState):
    """并行节点1：网页搜索"""
    return {"web_results": f"网页搜索结果: {state['question']}"}

def db_search_node(state: ResearchState):
    """并行节点2：数据库搜索"""
    return {"db_results": f"数据库结果: {state['question']}"}

def synthesize_node(state: ResearchState):
    """合并节点：综合两个来源"""
    combined = f"{state['web_results']}\n{state['db_results']}"
    return {"final_answer": f"综合答案: {combined}"}

graph = StateGraph(ResearchState)
graph.add_node("web", web_search_node)
graph.add_node("db", db_search_node)
graph.add_node("synthesize", synthesize_node)

graph.set_entry_point("web")  # 入口可以是列表实现并行

# 使用 add_node + 条件边实现并行
from langgraph.graph import START

graph = StateGraph(ResearchState)
graph.add_node("web", web_search_node)
graph.add_node("db", db_search_node)
graph.add_node("synth", synthesize_node)

# 从 START 同时连到 web 和 db（并行执行）
graph.add_edge(START, "web")
graph.add_edge(START, "db")
# 两者完成后都进入 synth
graph.add_edge("web", "synth")
graph.add_edge("db", "synth")
graph.add_edge("synth", END)
```

```mermaid
graph TD
    S[START] --> W[网页搜索]
    S --> D[数据库搜索]
    W --> SY[综合合成]
    D --> SY
    SY --> E[END]
```

---

## 6. 子图与状态映射

子图是封装复杂逻辑的独立图，通过状态映射与父图交互。

```python
class ParentState(TypedDict):
    messages: Annotated[list, add_messages]
    subgraph_result: str

class SubgraphState(TypedDict):
    query: str
    documents: list
    answer: str

def subgraph_node(state: ParentState):
    """子图作为节点"""
    sub_app = build_subgraph()  # 编译好的子图
    # 映射父状态到子状态
    sub_input = {"query": state["messages"][-1].content}
    # 同步执行子图
    result = sub_app.invoke(sub_input)
    # 提取子结果到父状态
    return {"subgraph_result": result["answer"]}

def build_subgraph():
    sg = StateGraph(SubgraphState)
    sg.add_node("retrieve", retrieve_docs)
    sg.add_node("generate", generate_answer)
    sg.set_entry_point("retrieve")
    sg.add_edge("retrieve", "generate")
    sg.add_edge("generate", END)
    return sg.compile()
```

---

## 7. 动态路由与条件分支

```python
from langgraph.graph import StateGraph, END

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    query_type: str
    needs_search: bool

def classify_node(state: AgentState):
    """分类节点：判断查询类型"""
    last_msg = state["messages"][-1].content
    if "搜索" in last_msg or "查找" in last_msg:
        return {"query_type": "search", "needs_search": True}
    elif "计算" in last_msg:
        return {"query_type": "calculation", "needs_search": False}
    else:
        return {"query_type": "chat", "needs_search": False}

def route_query(state: AgentState) -> str:
    """路由函数：根据状态决定下一步"""
    if state.get("needs_search"):
        return "search"
    elif state.get("query_type") == "calculation":
        return "calculate"
    else:
        return "respond"

graph = StateGraph(AgentState)
graph.add_node("classify", classify_node)
graph.add_node("search", search_node)
graph.add_node("calculate", calc_node)
graph.add_node("respond", respond_node)

graph.set_entry_point("classify")
graph.add_conditional_edges(
    "classify",
    route_query,
    {"search": "search", "calculate": "calculate", "respond": "respond"}
)
graph.add_edge("search", END)
graph.add_edge("calculate", END)
graph.add_edge("respond", END)
```

```mermaid
flowchart TD
    S[START] --> CL[分类节点]
    CL --> R{路由判断}
    R -->|search| SE[搜索节点]
    R -->|calculate| CA[计算节点]
    R -->|respond| RE[回复节点]
    SE --> E[END]
    CA --> E
    RE --> E
```

---

## 8. 生产环境状态管理规范

### 多会话并发管理

```python
from langgraph.checkpoint.postgres import PostgresSaver
import uuid

# 生产环境用 PostgreSQL Checkpointer
checkpointer = PostgresSaver.from_conn_string(
    "postgresql://user:pass@db:5432/langgraph"
)
checkpointer.setup()  # 初始化表结构

app = graph.compile(checkpointer=checkpointer)

def chat(user_id: str, message: str) -> str:
    """每个用户独立 thread"""
    thread_id = f"user_{user_id}"
    config = {"configurable": {"thread_id": thread_id}}
    
    result = app.invoke(
        {"messages": [{"role": "user", "content": message}]},
        config
    )
    return result["messages"][-1].content
```

### 状态清理策略

```python
import time
from datetime import datetime, timedelta

def cleanup_old_checkpoints(checkpointer, max_age_hours: int = 24):
    """清理过期检查点"""
    cutoff = datetime.now() - timedelta(hours=max_age_hours)
    # 根据 checkpointer 类型实现清理逻辑
    # PostgreSQL: DELETE FROM checkpoints WHERE created_at < cutoff
    pass
```

| 规范 | 说明 |
|------|------|
| thread_id 隔离 | 每个用户/会话用唯一 thread_id |
| 定期清理 | 超过一定时长的快照归档或删除 |
| 状态最小化 | 只存必要字段，避免大对象 |
| 异步持久化 | 非关键路径用异步写入 |
| 监控快照大小 | 防止状态膨胀 |

---

## 9. 完整实战：带审批的 RAG Agent

```python
from langgraph.graph import StateGraph, END, START
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph.message import add_messages
from langchain_openai import ChatOpenAI
from typing import Annotated, TypedDict

class RAGState(TypedDict):
    messages: Annotated[list, add_messages]
    retrieved_docs: Annotated[list, add]  # 累积追加
    needs_approval: bool
    approved: bool
    answer: str

llm = ChatOpenAI(model="gpt-4", temperature=0)

def retrieve_node(state: RAGState):
    """检索节点"""
    question = state["messages"][-1].content
    docs = [f"文档1: 关于 {question} 的内容"]
    needs_approval = "删除" in question or "修改" in question
    return {
        "retrieved_docs": docs,
        "needs_approval": needs_approval,
        "approved": False
    }

def check_approval(state: RAGState) -> str:
    """路由：是否需要审批"""
    if state.get("needs_approval") and not state.get("approved"):
        return "wait_approval"
    return "generate"

def generate_node(state: RAGState):
    """生成节点"""
    docs = state.get("retrieved_docs", [])
    context = "\n".join(docs)
    question = state["messages"][-1].content
    response = llm.invoke(f"上下文:\n{context}\n\n问题: {question}")
    return {"answer": response.content,
            "messages": [{"role": "ai", "content": response.content}]}

graph = StateGraph(RAGState)
graph.add_node("retrieve", retrieve_node)
graph.add_node("generate", generate_node)

graph.add_edge(START, "retrieve")
graph.add_conditional_edges("retrieve", check_approval,
    {"wait_approval": "retrieve", "generate": "generate"})
# 当需要审批时，中断等待
graph.add_edge("generate", END)

app = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["generate"]  # 在生成前可中断
)

# 使用
config = {"configurable": {"thread_id": "rag_001"}}
result = app.invoke(
    {"messages": [{"role": "user", "content": "修改用户权限"}]},
    config
)
# 中断在 generate 前

# 人工审批后继续
app.update_state(config, {"approved": True})
result = app.invoke(None, config)
print(result["answer"])
```

---

## 10. 总结与选型指南

| 需求 | 推荐方案 |
|------|---------|
| 简单对话记忆 | MemorySaver + thread_id |
| 持久化存储 | PostgreSQL Checkpointer |
| 审批流程 | interrupt_before + update_state |
| 并行处理 | 多 START 边 + 共同汇聚节点 |
| 历史回溯 | get_state_history + checkpoint_id |
| 复杂封装 | 子图 + 状态映射 |
| 动态分支 | conditional_edges + 路由函数 |
