# LangGraph 并行与扇出深度

> 并行执行和动态扇出是 LangGraph 的高级能力。本指南深入讲解 Send 机制和 Map-Reduce 模式。

---

## 一、两种并行方式对比

```mermaid
graph TB
    subgraph 静态并行 {"静态并行（固定边）"}
        S1["START"] --> A & B & C
        A & B & C --> MERGE["合并"]
        Note1["并行数量编译时确定"]
    end

    subgraph 动态扇出 {"动态扇出（Send）"}
        D1["START"] --> DISP["分发节点"]
        DISP -->|"Send×N"| N1["工作节点1"]
        DISP -->|"Send×N"| N2["工作节点2"]
        DISP -->|"Send×N"| NN["工作节点N"]
        N1 & N2 & NN --> REDUCE["合并"]
        Note2["并行数量运行时决定"]
    end

    style 静态并行 fill:'#C8E6C9'
    style 动态扇出 fill:'#F3E5F5'
```

## 二、静态并行

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from operator import add

class State(TypedDict):
    results: Annotated[list, add]

def task_a(state: State) -> dict:
    return {"results": ["A完成"]}

def task_b(state: State) -> dict:
    return {"results": ["B完成"]}

def task_c(state: State) -> dict:
    return {"results": ["C完成"]}

def merge_node(state: State) -> dict:
    return {"results": [f"合并了{len(state['results'])}个结果"]}

graph = StateGraph(State)
graph.add_node("A", task_a)
graph.add_node("B", task_b)
graph.add_node("C", task_c)
graph.add_node("merge", merge_node)

# 静态并行：START同时指向A、B、C
graph.add_edge(START, "A")
graph.add_edge(START, "B")
graph.add_edge(START, "C")
graph.add_edge("A", "merge")
graph.add_edge("B", "merge")
graph.add_edge("C", "merge")
graph.add_edge("merge", END)

app = graph.compile()
result = app.invoke({"results": []})
# results: ["A完成", "B完成", "C完成", "合并了3个结果"]
```

## 三、动态扇出（Send）

### 3.1 Send 机制原理

```mermaid
graph TB
    subgraph Send原理 {"Send 机制"}
        INPUT["输入: 5篇文档"]
        INPUT --> DISP["分发节点<br/>返回 [Send(node, data) × 5]"]
        DISP --> W1["工作节点<br/>处理文档1"]
        DISP --> W2["工作节点<br/>处理文档2"]
        DISP --> WN["工作节点<br/>处理文档5"]
        W1 & W2 & WN --> REDUCE["合并结果"]
        Note1["N=5 在运行时才知道<br/>不是编译时固定的"]
    end

    style Send原理 fill:'#E3F2FD'
    style Note1 fill:'#FFF9C4'
```

### 3.2 完整实现

```python
from langgraph.graph import StateGraph, START, END
from langgraph.constants import Send
from typing import TypedDict, Annotated
from operator import add

class MapReduceState(TypedDict):
    documents: list[str]                    # 输入文档列表
    summaries: Annotated[list, add]         # 各文档摘要(自动追加)
    final_report: str                        # 最终报告

def dispatch_node(state: MapReduceState) -> list[Send]:
    """分发节点：为每个文档创建一个Send到工作节点"""
    return [
        Send("worker", {"document": doc})
        for doc in state["documents"]
    ]

def worker_node(data: dict) -> dict:
    """工作节点：处理单个文档"""
    doc = data["document"]
    # 实际中用LLM生成摘要
    summary = f"摘要: {doc[:50]}..."
    return {"summaries": [summary]}

def reduce_node(state: MapReduceState) -> dict:
    """合并节点：合并所有摘要"""
    all_summaries = state.get("summaries", [])
    report = f"共处理{len(all_summaries)}个文档:\n" + "\n".join(all_summaries)
    return {"final_report": report}

# 构建图
graph = StateGraph(MapReduceState)
graph.add_node("worker", worker_node)  # 工作节点（会被多次并行调用）
graph.add_node("reduce", reduce_node)

# dispatch_node 返回 Send列表，自动扇出到worker
graph.add_conditional_edges(START, dispatch_node)
# 所有worker完成后到reduce
graph.add_edge("worker", "reduce")
graph.add_edge("reduce", END)

app = graph.compile()

# 使用：N在运行时才知道
result = app.invoke({
    "documents": ["文档1内容...", "文档2内容...", "文档3内容..."],
    "summaries": [],
    "final_report": "",
})
print(result["final_report"])
# "共处理3个文档:\n摘要: 文档1...\n摘要: 文档2...\n摘要: 文档3..."
```

## 四、Send vs 静态边

```mermaid
graph TB
    subgraph 对比 {"Send vs 静态边"}
        STATIC["静态边<br/>add_edge(START, A)<br/>add_edge(START, B)<br/>✅ 简单<br/>❌ 并行数量固定"]
        SEND["Send<br/>return [Send('worker', data) for ...]<br/>✅ 并行数量运行时决定<br/>✅ 每个实例可带不同数据<br/>⚠️ 稍复杂"]
    end

    style STATIC fill:'#C8E6C9'
    style SEND fill:'#E3F2FD'
```

## 五、实际应用场景

| 场景 | 模式 | 说明 |
|------|------|------|
| 3个Agent并行审查 | 静态并行 | 数量固定=3 |
| N篇文档摘要 | Send扇出 | N运行时知道 |
| N个搜索查询 | Send扇出 | 查询数量动态 |
| 固定3步流水线 | 静态边 | 步骤固定 |
| 用户上传的文件处理 | Send扇出 | 文件数量不定 |
| 并行调用3个不同模型 | 静态并行 | 模型固定=3 |

## 六、注意事项

```mermaid
graph TB
    subgraph 注意 {"使用Send的注意事项"}
        N1["⚠️ 工作节点必须用Reducer<br/>(Annotated[list, add])<br/>否则多个实例的结果会覆盖"]
        N2["⚠️ Send的数据是独立的<br/>每个工作实例收到自己的data<br/>不共享完整State"]
        N3["⚠️ 合并节点在所有工作完成后执行<br/>LangGraph自动等待所有Send完成"]
        N4["⚠️ 并行数过多可能触发限流<br/>建议控制最大并发"]
    end

    style 注意 fill:'#FFE0B2'
```
