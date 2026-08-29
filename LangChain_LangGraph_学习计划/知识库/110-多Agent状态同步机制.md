# 多 Agent 状态同步机制

> 多个 Agent 并行工作时，如何确保它们看到的是一致的 State？这份指南覆盖并行同步机制。

---

## 一、状态同步的挑战

```mermaid
graph TB
    subgraph 问题 {"并行Agent状态不一致问题"}
        A1["Agent A 读取 state.x=1"] --> A2["Agent B 同时读取 state.x=1"]
        A2 --> A3["Agent A: x=1→2"]
        A3 --> A4["Agent B: x=1→3 (覆盖A的更新)"]
        A4 --> A5["❌ A的更新丢失"]
    end

    subgraph 解决 {"状态同步解决"}
        S1["Agent A和B并行读取"]
        S1 --> S2["各自更新不同字段"]
        S2 --> S3["Reducer合并各字段更新"]
        S3 --> S4["✅ 各自更新不丢失"]
    end

    style 问题 fill:'#FFCDD2'
    style 解决 fill:'#C8E6C9'
```

## 二、LangGraph 的同步机制

```python
from typing import TypedDict, Annotated
from operator import add
from langgraph.graph import StateGraph, START, END

class SyncState(TypedDict):
    # 用add Reducer: 并行节点的结果自动追加合并
    research_a: Annotated[list, add]    # Agent A 的研究结果
    research_b: Annotated[list, add]    # Agent B 的研究结果
    merged_result: str                   # 合并结果
    # 注意: 不同Agent更新不同字段，不会互相覆盖

def agent_a_node(state: SyncState) -> dict:
    """Agent A: 追加自己的结果"""
    return {"research_a": ["AgentA的研究结果"]}

def agent_b_node(state: SyncState) -> dict:
    """Agent B: 追加自己的结果"""
    return {"research_b": ["AgentB的研究结果"]}

def merge_node(state: SyncState) -> dict:
    """合并节点: 等A和B都完成后合并"""
    combined = state.get("research_a", []) + state.get("research_b", [])
    return {"merged_result": "\n".join(combined)}

# 构建并行图
graph = StateGraph(SyncState)
graph.add_node("agent_a", agent_a_node)
graph.add_node("agent_b", agent_b_node)
graph.add_node("merge", merge_node)

# 并行执行: START同时指向A和B
graph.add_edge(START, "agent_a")
graph.add_edge(START, "agent_b")
# 都完成后到merge
graph.add_edge("agent_a", "merge")
graph.add_edge("agent_b", "merge")
graph.add_edge("merge", END)

app = graph.compile()
```

## 三、LangGraph 的屏障机制

```mermaid
graph TB
    subgraph 屏障 {"LangGraph 屏障屏障(Barrier)"}
        S1["START"] --> A["Agent A<br/>(并行)"]
        S1 --> B["Agent B<br/>(并行)"]
        S1 --> C["Agent C<br/>(并行)"]
        A --> BARRIER["屏障: 等待A+B+C全部完成"]
        B --> BARRIER
        C --> BARRIER
        BARRIER --> MERGE["合并节点<br/>(看到所有Agent的结果)"]
    end

    style BARRIER fill:'#FFF9C4'
    style MERGE fill:'#C8E6C9'
```

> LangGraph 自动实现屏障：合并节点只有在所有前驱节点完成后才执行。

## 四、共享字段冲突处理

```python
# 当多个Agent更新同一个字段时，Reducer决定如何合并

class ConflictState(TypedDict):
    # 用add: 追加合并（适合列表）
    messages: Annotated[list, add]

    # 默认(无Reducer): 后到的覆盖先到的（适合标量）
    # 如果两个并行节点都返回{"answer": ...}，后执行的覆盖

def safe_parallel_agents():
    """安全的并行：每个Agent更新不同字段"""
    # ✅ 好: A更新research_a, B更新research_b
    # ❌ 差: A和B都更新answer（会覆盖）

    graph = StateGraph(SyncState)
    # ...
    return graph.compile()
```

## 五、检查清单

| 检查项 | 说明 | 状态 |
|--------|------|------|
| 不同字段更新 | 并行Agent更新不同字段 | ☐ |
| Reducer设置 | 共享字段用add Reducer | ☐ |
| 屏障机制 | 合并节点等所有前驱 | ☐ |
| 无竞态条件 | 不存在并发写同一字段 | ☐ |
