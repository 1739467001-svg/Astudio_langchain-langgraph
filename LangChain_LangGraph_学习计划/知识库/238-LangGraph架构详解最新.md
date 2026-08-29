# LangGraph 架构详解最新

> 知识库 03 有 452 行。这篇从架构设计视角补充——LangGraph 的设计理念、核心抽象和与传统框架的对比。

---

## 一、设计理念

```mermaid
graph TB
    subgraph 理念 {"LangGraph设计理念"}
        I1["图即程序<br/>用图结构描述工作流"]
        I2["状态显式<br/>State是一等公民"]
        I3["可恢复<br/>每步可检查点"]
        I4["可观测<br/>每步可追踪"]
        I5["人机协作<br/>interrupt一等支持"]
    end

    style 理念 fill:#E3F2FD
    style I2 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、核心抽象

```python
class LangGraphAbstractions:
    """LangGraph核心抽象。"""

    ABSTRACTIONS = {
        "StateGraph": {
            "desc": "状态图——核心容器",
            "作用": "定义工作流的拓扑结构",
            "API": "StateGraph(StateType)",
        },
        "State (TypedDict)": {
            "desc": "状态——在图中流转的数据",
            "作用": "定义数据结构+字段合并方式(Reducer)",
            "API": "class MyState(TypedDict): messages: Annotated[list, add_messages]",
        },
        "Node": {
            "desc": "节点——一个处理步骤",
            "作用": "接收State→处理→返回State更新",
            "API": "graph.add_node('name', handler_func)",
        },
        "Edge": {
            "desc": "边——节点间的连接",
            "作用": "定义执行顺序",
            "API": "graph.add_edge('node_a', 'node_b')",
        },
        "Conditional Edge": {
            "desc": "条件边——根据状态路由",
            "作用": "实现if/else逻辑",
            "API": "graph.add_conditional_edges('source', route_func, {mapping})",
        },
        "Reducer": {
            "desc": "归约器——字段合并策略",
            "作用": "定义State字段如何更新（覆盖/追加）",
            "示例": "add_messages=追加, add=列表追加, 无=覆盖",
        },
        "Checkpointer": {
            "desc": "检查点——状态持久化",
            "作用": "保存每步状态，支持中断恢复和时间旅行",
            "API": "graph.compile(checkpointer=MemorySaver())",
        },
        "Store": {
            "desc": "长期存储——跨线程记忆",
            "作用": "存储用户画像等跨会话数据",
            "API": "graph.compile(store=InMemoryStore())",
        },
        "Compile": {
            "desc": "编译——将图定义转为可执行程序",
            "作用": "验证图完整性+生成可执行实例",
            "API": "app = graph.compile(checkpointer=..., store=...)",
        },
    }
```

---

## 三、执行模型

```mermaid
graph TB
    subgraph 执行 {"LangGraph执行流程"}
        INVOKE["app.invoke(input)"] --> START["START节点"]
        START --> NODE1["节点1<br/>读State→处理→返回更新"]
        NODE1 --> CP1["检查点保存"]
        CP1 --> ROUTE{"条件路由"}
        ROUTE --> NODE2["节点2"]
        ROUTE --> NODE3["节点3"]
        NODE2 --> CP2["检查点保存"]
        NODE3 --> CP3["检查点保存"]
        CP2 & CP3 --> END["END→返回最终State"]
    end

    style CP1 fill:#FFF9C4
    style ROUTE fill:#E3F2FD
```

---

## 四、与传统框架对比

```python
class FrameworkComparison:
    """LangGraph vs 传统框架。"""

    COMPARISON = {
        "LangChain Chains": {
            "模型": "线性管道(A→B→C)",
            "状态": "隐式（隐式传递）",
            "循环": "❌ 不支持",
            "条件": "❌ 不便",
            "持久化": "❌ 不支持",
            "人机交互": "❌ 不支持",
        },
        "LangGraph": {
            "模型": "有向图（任意拓扑）",
            "状态": "显式（TypedDict+Reducer）",
            "循环": "✅ 原生支持",
            "条件": "✅ 条件边",
            "持久化": "✅ Checkpointer",
            "人机交互": "✅ interrupt",
        },
        "CrewAI": {
            "模型": "角色+任务",
            "状态": "隐式",
            "循环": "⚠️ 有限",
            "条件": "⚠️ 有限",
            "持久化": "⚠️ 有限",
            "人机交互": "⚠️ 有限",
        },
    }
```

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| State用TypedDict+Reducer | 显式管理状态 | ★★★ |
| 条件路由用纯函数 | 不依赖外部状态 | ★★★ |
| Checkpointer必配 | 支持恢复 | ★★★ |
| 节点函数要幂等 | 重试安全 | ★★☆ |
| 节点粒度适中 | 太细开销大，太粗恢复难 | ★★☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解设计理念 | ☐ |
| 知道核心抽象 | ☐ |
| 理解执行模型 | ☐ |
| 知道与Chain区别 | ☐ |
