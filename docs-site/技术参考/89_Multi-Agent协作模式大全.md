# 89 Multi-Agent 协作模式大全

> 知识库·阶段 16。Multi-Agent 让多个 Agent 像团队一样协作——分工、协调、审核。这是最复杂也最强大的 Agent 模式。

---

## 一、四种 Multi-Agent 协作模式

```mermaid
graph TD
    M["Multi-Agent 模式"] --> M1["Supervisor<br/>主管模式"]
    M --> M2["Hierarchical<br/>层级模式"]
    M --> M3["Network<br/>网络模式"]
    M --> M4["Swarm<br/>群体模式"]
```

| 模式 | 结构 | 协调方式 | 适用 |
| --- | --- | --- | --- |
| Supervisor | 1 主管 + N 工人 | 主管分发 | 明确分工 |
| Hierarchical | 树状层级 | 上级分派 | 大型项目 |
| Network | 网状互联 | 直接通信 | 复杂协作 |
| Swarm | 动态交接 | Handoff | 灵活流转 |

---

## 二、Supervisor 主管模式

```mermaid
graph TD
    S["Supervisor<br/>主管"] --> A1["Worker 1<br/>研究员"]
    S --> A2["Worker 2<br/>写作者"]
    S --> A3["Worker 3<br/>审核员"]
    A1 --> S
    A2 --> S
    A3 --> S
```

```python
from typing import TypedDict, Literal
from langgraph.graph import StateGraph, END

class TeamState(TypedDict):
    task: str
    next_worker: str
    research: str
    draft: str
    review: str

def supervisor(state: TeamState) -> TeamState:
    """主管决定下一步派给谁"""
    if not state.get("research"):
        state["next_worker"] = "researcher"
    elif not state.get("draft"):
        state["next_worker"] = "writer"
    elif not state.get("review"):
        state["next_worker"] = "reviewer"
    else:
        state["next_worker"] = "done"
    return state

def researcher(state: TeamState) -> TeamState:
    state["research"] = f"研究完成：{state['task']}"
    return state

def writer(state: TeamState) -> TeamState:
    state["draft"] = f"写作完成：基于{state['research']}"
    return state

def reviewer(state: TeamState) -> TeamState:
    state["review"] = "审核通过"
    return state

def route(state: TeamState) -> str:
    w = state["next_worker"]
    if w == "done":
        return END
    return w

g = StateGraph(TeamState)
g.add_node("supervisor", supervisor)
g.add_node("researcher", researcher)
g.add_node("writer", writer)
g.add_node("reviewer", reviewer)
g.set_entry_point("supervisor")
g.add_conditional_edges("supervisor", route, {
    "researcher": "researcher",
    "writer": "writer",
    "reviewer": "reviewer",
    END: END,
})
for w in ["researcher", "writer", "reviewer"]:
    g.add_edge(w, "supervisor")
app = g.compile()
```

---

## 三、Hierarchical 层级模式

```mermaid
graph TD
    D["Director<br/>总监"] --> TL1["Team Lead 1"]
    D --> TL2["Team Lead 2"]
    TL1 --> W1["Worker A"]
    TL1 --> W2["Worker B"]
    TL2 --> W3["Worker C"]
    TL2 --> W4["Worker D"]
```

适用：大型项目需要多级分工。总监→组长→组员。

---

## 四、Network 网络模式

```mermaid
graph LR
    A1["Agent 1"] <--> A2["Agent 2"]
    A2 <--> A3["Agent 3"]
    A3 <--> A4["Agent 4"]
    A1 <--> A4
    A1 <--> A3
```

适用：Agent 之间需要直接通信，无固定层级。

---

## 五、Swarm 群体模式

```mermaid
graph TD
    U["用户输入"] --> A1["Agent 1<br/>接待"]
    A1 -->|"handoff"| A2["Agent 2<br/>专业"]
    A2 -->|"handoff"| A3["Agent 3<br/>结算"]
    A3 --> O["输出"]
```

```python
from langgraph.graph import StateGraph, END

def agent_1(state):
    """接待Agent——判断是否需要转交"""
    if state["query"] 涉及专业问题:
        return {"handoff_to": "agent_2"}
    return {"answer": "已接待处理"}

def agent_2(state):
    """专业Agent——处理专业问题"""
    if state["query"] 涉及结算:
        return {"handoff_to": "agent_3"}
    return {"answer": "专业问题已处理"}

def agent_3(state):
    """结算Agent"""
    return {"answer": "已结算完成"}

def route(state) -> str:
    if "handoff_to" in state:
        return state["handoff_to"]
    return END
```

---

## 六、模式对比与选型

| 维度 | Supervisor | Hierarchical | Network | Swarm |
| --- | --- | --- | --- | --- |
| 复杂度 | 中 | 高 | 极高 | 中 |
| 协调 | 中心化 | 层级化 | 去中心化 | 动态交接 |
| 扩展性 | 中 | 好 | 好 | 好 |
| 可控性 | 高 | 高 | 低 | 中 |
| 适用规模 | 3-5 Agent | 5-20 Agent | 3-10 Agent | 2-5 Agent |

---

## 七、Multi-Agent 的关键设计点

```mermaid
graph TD
    D["设计要点"] --> D1["状态共享<br/>Agent间传递信息"]
    D --> D2["任务分派<br/>谁做什么"]
    D --> D3["冲突处理<br/>结果矛盾时"]
    D --> D4["终止条件<br/>何时结束"]
    D --> D5["成本控制<br/>多Agent调用成本"]
```

| 设计点 | 方案 | 注意事项 |
| --- | --- | --- |
| 状态共享 | 共享 State | 避免状态污染 |
| 任务分派 | Supervisor 路由 | 明确分工边界 |
| 冲突处理 | 投票/仲裁 | 避免死锁 |
| 终止条件 | 任务完成/超时 | 加 max_iterations |
| 成本控制 | 小模型+大模型混用 | 避免全用大模型 |

---

## 八、常见反模式

| 反模式 | 问题 | 正确做法 |
| --- | --- | --- |
| 全用大模型 | 成本暴增 | 简单任务用小模型 |
| 无终止条件 | 可能死循环 | 加 max_iterations |
| Agent 职责重叠 | 互相干扰 | 明确分工边界 |
| 无状态隔离 | 状态污染 | 每个 Agent 独立输出 |
| 过度设计 | 简单任务用 Multi-Agent | 先试单 Agent |

---

## 小结

- 四种 Multi-Agent 模式：Supervisor、Hierarchical、Network、Swarm；
- Supervisor 最常用：1 主管分发 + N 工人执行 + 回主管汇总；
- Swarm 用 Handoff 实现动态交接；
- 关键设计：状态共享、任务分派、冲突处理、终止条件、成本控制；
- 反模式：不要为简单任务过度设计 Multi-Agent。