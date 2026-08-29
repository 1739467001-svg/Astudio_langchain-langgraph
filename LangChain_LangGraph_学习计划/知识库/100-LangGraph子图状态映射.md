# LangGraph 子图状态映射

> 子图与主图如何传递 State？数据如何映射？这份指南覆盖子图间状态传递的完整模式。

---

## 一、子图状态映射的挑战

```mermaid
graph TB
    subgraph 问题 {"子图状态映射的两个核心问题"}
        C1["❓ 主图State → 子图State<br/>哪些字段传给子图？"]
        C2["❓ 子图State → 主图State<br/>子图的结果如何合并回主图？"]
    end

    style 问题 fill:'#E3F2FD'
```

## 二、三种映射模式

```mermaid
graph TB
    subgraph 三种模式 {"子图状态映射三种模式"}
        M1["模式1: 共享State<br/>子图与主图用同一个State类型<br/>✅ 最简单 ❌ 耦合"]
        M2["模式2: 字段映射<br/>主图State和子图State不同<br/>→手动映射字段<br/>✅ 解耦 ❌ 需要转换"]
        M3["模式3: 适配器模式<br/>在子图入口/出口做转换<br/>→主图不感知子图State细节<br/>✅ 最灵活 ✅ 可复用"]
    end

    style M1 fill:'#C8E6C9'
    style M2 fill:'#E3F2FD'
    style M3 fill:'#F3E5F5'
```

## 三、模式1: 共享State

```python
from typing import TypedDict, Annotated
from operator import add
from langgraph.graph import StateGraph, START, END

# 主图和子图共享同一个State类型
class SharedState(TypedDict):
    messages: Annotated[list, add]
    topic: str
    research: str
    draft: str

# 子图：研究流程
def build_research_subgraph():
    g = StateGraph(SharedState)
    g.add_node("search", search_node)
    g.add_node("organize", organize_node)
    g.add_edge(START, "search")
    g.add_edge("search", "organize")
    g.add_edge("organize", END)
    return g.compile()

def search_node(state: SharedState) -> dict:
    return {"research": f"关于{state['topic']}的研究结果"}
def organize_node(state: SharedState) -> dict:
    return {"research": f"整理后: {state['research']}"}

# 主图引用子图
main_graph = StateGraph(SharedState)
main_graph.add_node("research", build_research_subgraph())  # 子图作为节点
main_graph.add_node("write", write_node)
main_graph.add_edge(START, "research")
main_graph.add_edge("research", "write")
main_graph.add_edge("write", END)

# 子图直接访问主图的State字段(research, topic)
```

## 四、模式2: 字段映射

```python
class MainState(TypedDict):
    user_question: str
    research_result: str
    final_answer: str

class ResearchSubState(TypedDict):
    query: str        # 对应主图的user_question
    findings: str      # 对应主图的research_result

def research_entry_adapter(state: MainState) -> ResearchSubState:
    """主图→子图的入口适配器"""
    return {"query": state["user_question"], "findings": ""}

def research_exit_adapter(sub_state: ResearchSubState) -> dict:
    """子图→主图的出口适配器"""
    return {"research_result": sub_state["findings"]}

def research_subgraph_node(state: MainState) -> dict:
    """子图节点：入口转换→执行→出口转换"""
    # 转换为主图→子图
    sub_state = research_entry_adapter(state)
    # 执行子图逻辑
    sub_state["findings"] = f"研究结果: {sub_state['query']}"
    # 转换子图→主图
    return research_exit_adapter(sub_state)
```

## 五、模式3: 完整适配器模式

```python
class SubGraphWrapper:
    """子图包装器：处理状态映射"""
    def __init__(self, subgraph_app, entry_mapper, exit_mapper):
        self.subgraph = subgraph_app
        self.entry_mapper = entry_mapper     # 主图→子图
        self.exit_mapper = exit_mapper        # 子图→主图

    def __call__(self, state):
        # 入口映射
        sub_state = self.entry_mapper(state)
        # 执行子图
        sub_result = self.subgraph.invoke(sub_state)
        # 出口映射
        return self.exit_mapper(sub_result)

# 使用
def main_to_research(state: MainState) -> dict:
    return {"query": state["user_question"], "findings": ""}

def research_to_main(sub_state: dict) -> dict:
    return {"research_result": sub_state.get("findings", "")}

research_wrapper = SubGraphWrapper(
    subgraph_app=build_research_subgraph(),
    entry_mapper=main_to_research,
    exit_mapper=research_to_main,
)

# 在主图中使用包装后的子图
main_graph.add_node("research", research_wrapper)
```

## 六、状态映射检查表

| 检查项 | 说明 | 状态 |
|--------|------|------|
| 入口映射 | 主图State正确传给子图 | ☐ |
| 出口映射 | 子图结果正确合并回主图 | ☐ |
| 字段类型匹配 | 映射的字段类型一致 | ☐ |
| Reducer一致 | 双方Reducer行为一致 | ☐ |
| 空值处理 | 缺失字段有默认值 | ☐ |
| 无遗漏 | 所有需要的字段都传递了 | ☐ |
