# 第28课：LangGraph 状态管理——精确控制 AI 工作流

> **前置知识**：第08课 LangGraph入门、第18课 LangGraph进阶 | **配套知识库**：24_LangGraph状态管理与检查点技术手册 | **难度**：高级

---

## 开篇：状态管理为什么重要？

想象一个工厂流水线：

> 原料进入 → 加工站1 → 质检 → 加工站2 → 包装 → 出厂

每个工位需要知道：**上一站做了什么、当前状态是什么、下一步该做什么**。这就是状态管理。

LangGraph 的核心理念：**图 = 状态机**。每个节点读取状态、处理、返回状态更新。

```mermaid
graph LR
    A[初始状态] --> B[检索节点]
    B --> C["状态 + 检索结果"]
    C --> D[生成节点]
    D --> E["状态 + 生成结果"]
    E --> F[校验节点]
    F --> G{通过?}
    G -->|是| H[最终状态]
    G -->|否| D
```

---

## 第一节：状态定义与 Reducer

### 状态是图的"血液"

```python
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages
from operator import add

class ChatState(TypedDict):
    # add_messages: 消息列表自动追加（而非覆盖）
    messages: Annotated[list, add_messages]
    # add: 列表拼接或数字累加
    documents: Annotated[list, add]
    # 无 reducer: 直接覆盖
    answer: str
    # 自定义 reducer: 整数累加
    retry_count: Annotated[int, add]
```

### Reducer 是什么？

Reducer 决定了**当节点返回状态更新时，如何与现有状态合并**。

```mermaid
flowchart TD
    A["节点返回 {'messages': [新消息]}"] --> B{字段有 reducer?}
    B -->|add_messages| C["追加到现有列表<br/>旧消息 + 新消息"]
    B -->|add| D["拼接列表/累加数字"]
    B -->|无 reducer| E["直接覆盖旧值"]
    B -->|自定义| F["执行自定义逻辑"]
    C --> G[更新后的状态]
    D --> G
    E --> G
    F --> G
```

**生活类比**：
- `add_messages` = 微信群聊记录（只追加不删除）
- `add` = 积分累计（每次加一点）
- 无 reducer = 覆盖 = 更新个人签名（新的覆盖旧的）

---

## 第二节：Checkpointer 持久化

### 为什么需要 Checkpointer？

没有 Checkpointer，每次对话都从零开始。有了它，**每一步状态都自动保存**，下次对话无缝接续。

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.checkpoint.postgres import PostgresSaver

# 三种存储后端
memory_cp = MemorySaver()              # 内存（开发用）
sqlite_cp = SqliteSaver.from_conn_string("checkpoints.db")  # SQLite（单机）
pg_cp = PostgresSaver.from_conn_string(
    "postgresql://user:pass@localhost/db"  # PostgreSQL（生产）
)

# 编译图时指定
app = graph.compile(checkpointer=memory_cp)
```

### thread_id 隔离不同用户

```python
# 用户A的对话
config_a = {"configurable": {"thread_id": "user_A"}}
app.invoke({"messages": [{"role": "user", "content": "我叫张三"}]}, config_a)

# 用户B的对话（互不干扰）
config_b = {"configurable": {"thread_id": "user_B"}}
app.invoke({"messages": [{"role": "user", "content": "我叫李四"}]}, config_b)

# 用户A继续对话（自动恢复上次状态）
result = app.invoke(
    {"messages": [{"role": "user", "content": "我叫什么"}]},
    config_a  # 使用同一个 thread_id
)
# AI: "你叫张三"（记得上次对话！）
```

```mermaid
sequenceDiagram
    participant UA as 用户A
    participant G as Graph
    participant C as Checkpointer
    
    UA->>G: "我叫张三" (thread_id="A")
    G->>C: 保存状态快照1
    G-->>UA: "你好张三"
    
    UA->>G: "我叫什么" (thread_id="A")
    G->>C: 加载thread_id="A"的最新快照
    C-->>G: 返回上次状态
    G->>G: 带着历史对话继续
    G-->>UA: "你叫张三"
```

### 三种后端对比

| 后端 | 速度 | 持久性 | 适用场景 |
|------|------|--------|---------|
| 内存 | ⚡最快 | ❌重启丢失 | 开发测试 |
| SQLite | 🐢中 | ✅是 | 单机部署 |
| PostgreSQL | 🐢中 | ✅是 | 生产环境 |

---

## 第三节：时间旅行——回到任意历史节点

LangGraph 可以回到图执行过程中的**任意一步**，从那里重新执行或分支。

```python
config = {"configurable": {"thread_id": "chat_001"}}

# 获取所有历史快照
states = list(app.get_state_history(config))

for state in states:
    step = state.metadata.get("step_count", "?")
    print(f"Step {step}: messages={len(state.values.get('messages', []))}")

# 回到第3步
target = states[-3]
replay_config = {
    "configurable": {
        "thread_id": "chat_001",
        "checkpoint_id": target.config["configurable"]["checkpoint_id"]
    }
}

# 从第3步重新执行
result = app.stream(None, replay_config, stream_mode="values")
for event in result:
    print(event)
```

```mermaid
flowchart LR
    S0[Step0] --> S1[Step1: 检索]
    S1 --> S2[Step2: 生成]
    S2 --> S3[Step3: 校验]
    S3 --> S4[Step4: 完成]
    
    R[时间旅行] --> S2
    S2 --> S2b[Step2': 修改后重新生成]
    S2b --> S3b[Step3': 新校验]
```

**应用场景**：
- 调试：回到出错前检查状态
- A/B 测试：同一状态用不同参数分支执行
- 修正：发现早期错误后回退重做

---

## 第四节：人在回路——AI 的"审批机制"

### 为什么需要人工审批？

有些操作太重要或太危险，不能让 AI 自动执行：
- 🗑️ 删除文件
- 💸 发送邮件
- 📝 修改数据库
- 🔑 修改权限

LangGraph 用 `interrupt_before` 在关键节点前暂停，等待人工审批。

```python
from langgraph.graph import StateGraph, END, START
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph.message import add_messages
from typing import Annotated, TypedDict

class ActionState(TypedDict):
    messages: Annotated[list, add_messages]
    pending_action: str
    approved: bool

def propose_action(state: ActionState):
    """AI 提议操作"""
    return {"pending_action": "删除文件 test.txt"}

def execute_action(state: ActionState):
    """执行操作（需要审批后才能到这）"""
    action = state["pending_action"]
    return {"messages": [{"role": "ai", "content": f"已执行: {action}"}]}

graph = StateGraph(ActionState)
graph.add_node("propose", propose_action)
graph.add_node("execute", execute_action)
graph.add_edge(START, "propose")
graph.add_edge("propose", "execute")
graph.add_edge("execute", END)

# 在 execute 节点前中断！
app = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["execute"]
)

# 执行到 execute 前自动暂停
config = {"configurable": {"thread_id": "action_001"}}
result = app.invoke(
    {"messages": [{"role": "user", "content": "删除test.txt"}],
     "pending_action": "", "approved": False},
    config
)
# 此时停在 execute 前

# 查看待审批操作
state = app.get_state(config)
print(f"待审批: {state.values.get('pending_action')}")

# 人工审批
app.update_state(config, {"approved": True})

# 继续执行
result = app.invoke(None, config)
print(result["messages"][-1].content)  # "已执行: 删除文件 test.txt"
```

```mermaid
flowchart TD
    A[用户请求] --> B[AI分析提议]
    B --> C[中断: 等待审批]
    C --> D{人工审批}
    D -->|批准| E[执行操作]
    D -->|拒绝| F[告知用户被拒]
    D -->|修改参数| G[更新参数后执行]
    E --> H[返回结果]
    F --> H
    G --> H
    
    style C fill:#FFD700
    style D fill:#87CEEB
```

---

## 第五节：并行执行与动态路由

### 并行执行

```python
from langgraph.graph import StateGraph, END, START

class ResearchState(TypedDict):
    question: str
    web_results: str
    db_results: str
    answer: str

def web_search(state: ResearchState):
    return {"web_results": f"网页: {state['question']}"}

def db_search(state: ResearchState):
    return {"db_results": f"数据库: {state['question']}"}

def synthesize(state: ResearchState):
    combined = f"{state['web_results']}\n{state['db_results']}"
    return {"answer": f"综合: {combined}"}

graph = StateGraph(ResearchState)
graph.add_node("web", web_search)
graph.add_node("db", db_search)
graph.add_node("synth", synthesize)

# 从 START 同时出发到 web 和 db（并行）
graph.add_edge(START, "web")
graph.add_edge(START, "db")
# 两者完成后汇聚到 synth
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

### 动态路由

```python
def classify(state: AgentState) -> str:
    """根据问题类型路由到不同处理节点"""
    q = state["messages"][-1].content
    if "搜索" in q:
        return "search"
    elif "计算" in q:
        return "calculate"
    else:
        return "chat"

graph.add_conditional_edges(
    "classify_node",  # 源节点
    classify,         # 路由函数
    {                 # 路由映射
        "search": "search_node",
        "calculate": "calc_node",
        "chat": "chat_node"
    }
)
```

```mermaid
flowchart TD
    S[START] --> CL[分类节点]
    CL --> R{路由判断}
    R -->|search| SE[搜索节点]
    R -->|calculate| CA[计算节点]
    R -->|chat| RE[对话节点]
    SE --> E[END]
    CA --> E
    RE --> E
```

---

## 本课小结

| 能力 | 用法 | 生活类比 |
|------|------|---------|
| State + Reducer | 定义状态结构 | 流水线工位间的信息卡 |
| Checkpointer | 持久化每步状态 | 工厂的工序记录本 |
| thread_id | 隔离不同用户 | 每人一个独立编号 |
| 时间旅行 | 回到任意历史节点 | 时光倒流重做选择 |
| 人在回路 | 关键操作前暂停审批 | 主管签字才能执行 |
| 并行执行 | 多节点同时跑 | 多个工位同时开工 |
| 动态路由 | 条件分支选路 | 根据产品类型选流水线 |

**下一步学习**：第29课 高级 RAG 优化——让检索更聪明，学习重排序、查询变换等高级优化技术。
