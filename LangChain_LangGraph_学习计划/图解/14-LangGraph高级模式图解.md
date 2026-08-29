# LangGraph 高级模式图解

> 超越基础的线性/分支/循环，掌握 Map-Reduce、动态路由、子图嵌套等高级编排模式。

---

## 一、高级模式总览

```mermaid
graph TB
    subgraph 基础模式 ["基础模式（第10课已学）"]
        B1["线性流程"]
        B2["条件分支"]
        B3["循环重试"]
        B4["并行执行"]
    end

    subgraph 高级模式 ["高级模式（本页）"]
        A1["Map-Reduce<br/>批量处理+合并"]
        A2["动态路由<br/>运行时决定图结构"]
        A3["子图嵌套<br/>模块化复杂图"]
        A4["人机协作<br/>中断+恢复+审批"]
        A5["多轮对话图<br/>带记忆的状态图"]
        A6["递归图<br/>自引用的图结构"]
    end

    基础模式 -->|"进阶"| 高级模式

    style 基础模式 fill:#E3F2FD
    style 高级模式 fill:#F3E5F5
```

## 二、Map-Reduce 模式

将一个任务拆分为多个子任务并行处理，最后合并结果。

```mermaid
graph TB
    INPUT["输入: 5篇文档"] --> MAP

    subgraph Map阶段 ["Map阶段（并行）"]
        MAP["分发"] --> M1["处理文档1"]
        MAP --> M2["处理文档2"]
        MAP --> M3["处理文档3"]
        MAP --> M4["处理文档4"]
        MAP --> M5["处理文档5"]
    end

    M1 & M2 & M3 & M4 & M5 --> REDUCE

    subgraph Reduce阶段 ["Reduce阶段"]
        REDUCE["合并结果"] --> FINAL["总结报告"]
    end

    style Map阶段 fill:#E3F2FD
    style Reduce阶段 fill:#C8E6C9
```

### 代码实现

```python
from typing import TypedDict, Annotated
from operator import add
from langgraph.graph import StateGraph, START, END

class MapReduceState(TypedDict):
    documents: list[str]              # 输入文档列表
    summaries: Annotated[list, add]  # 各文档摘要（自动追加）
    final_report: str                  # 最终报告

def map_documents(state: MapReduceState) -> dict:
    """返回多个节点指令（并行处理每篇文档）"""
    # LangGraph 支持在节点中返回 Send() 对象实现动态分发
    from langgraph.constants import Send
    return [
        Send("summarize", {"doc": doc})
        for doc in state["documents"]
    ]

def summarize_node(data: dict) -> dict:
    """处理单个文档"""
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import ChatPromptTemplate
    llm = ChatOpenAI(model="gpt-4o-mini")
    prompt = ChatPromptTemplate.from_template("用一句话总结：{doc}")
    chain = prompt | llm
    summary = chain.invoke({"doc": data["doc"]}).content
    return {"summaries": [summary]}

def reduce_node(state: MapReduceState) -> dict:
    """合并所有摘要"""
    combined = "\n".join(state["summaries"])
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import ChatPromptTemplate
    llm = ChatOpenAI(model="gpt-4o-mini")
    prompt = ChatPromptTemplate.from_template("将以下各文档摘要合并为一份报告：\n{summaries}")
    report = prompt | llm
    result = report.invoke({"summaries": combined}).content
    return {"final_report": result}

# 构建图
graph = StateGraph(MapReduceState)
graph.add_node("summarize", summarize_node)
graph.add_node("reduce", reduce_node)

graph.add_conditional_edges(START, map_documents)
graph.add_edge("summarize", "reduce")
graph.add_edge("reduce", END)

app = graph.compile()
```

## 三、动态路由模式

根据运行时状态动态决定下一步执行哪些节点：

```mermaid
graph TB
    START([START]) --> ANALYZE["分析节点<br/>理解用户意图"]

    ANALYZE --> DYNAMIC["动态路由<br/>根据意图生成路由列表"]

    DYNAMIC -->|"需要搜索"| SEARCH["搜索"]
    DYNAMIC -->|"需要计算"| CALC["计算"]
    DYNAMIC -->|"需要翻译"| TRANS["翻译"]
    DYNAMIC -->|"需要多个"| SEARCH & CALC

    SEARCH --> MERGE["合并结果"]
    CALC --> MERGE
    TRANS --> MERGE

    MERGE --> RESPOND["生成回答"]
    RESPOND --> END([END])

    style DYNAMIC fill:#FFF9C4
    style MERGE fill:#C8E6C9
```

### 与固定条件边的区别

```mermaid
graph TB
    subgraph 固定路由 ["固定条件边"]
        F1["路由函数"] -->|"返回固定字符串"| F2["映射到预设节点"]
        Note1["限制：必须提前知道所有可能的路由目标"]
    end

    subgraph 动态路由 ["动态路由（Send）"]
        D1["路由函数"] -->|"返回Send对象列表"| D2["运行时决定去哪些节点"]
        D3["可以同时分发到多个节点"]
        D4["节点数量运行时才确定"]
        Note2["灵活：根据状态动态生成路由"]
    end

    style 固定路由 fill:#E3F2FD
    style 动态路由 fill:#F3E5F5
```

## 四、子图嵌套模式

```mermaid
graph TB
    subgraph 主图
        S([START]) --> R["研究子图"]
        R --> W["写作子图"]
        W --> E([END])
    end

    subgraph 研究子图 ["研究子图（内部）"]
        RS["搜索"] --> RO["整理"] --> RV["验证"]
    end

    subgraph 写作子图 ["写作子图（内部）"]
        WD["起草"] --> WP["润色"] --> WC["字数检查"]
    end

    style 主图 fill:#E3F2FD
    style 研究子图 fill:#FFF3E0
    style 写作子图 fill:#C8E6C9
```

### 子图的状态传递

```mermaid
graph LR
    subgraph 状态传递
        MS["主图State<br/>{topic, research, draft}"]
        SS1["研究子图State<br/>{topic, search_results}"]
        SS2["写作子图State<br/>{research, draft}"]
    end

    MS -->|"传入topic"| SS1
    SS1 -->|"返回research"| MS
    MS -->|"传入research"| SS2
    SS2 -->|"返回draft"| MS

    style MS fill:#E3F2FD
    style SS1 fill:#FFF3E0
    style SS2 fill:#C8E6C9
```

```python
# 子图作为主图的一个节点
research_subgraph = build_research_graph().compile()
writing_subgraph = build_writing_graph().compile()

main_graph = StateGraph(MainState)
main_graph.add_node("research", research_subgraph)  # 子图作为节点
main_graph.add_node("write", writing_subgraph)
main_graph.add_edge(START, "research")
main_graph.add_edge("research", "write")
main_graph.add_edge("write", END)
```

## 五、多轮对话状态图

```mermaid
graph TB
    subgraph 多轮对话循环
        U["用户输入"] --> LOAD["加载对话历史<br/>(从Checkpointer)"]
        LOAD --> PROCESS["处理节点<br/>(LLM生成回复)"]
        PROCESS --> SAVE["保存状态<br/>(更新历史+State)"]
        SAVE --> RESPONSE["返回回复"]
        RESPONSE --> WAIT["等待下一次输入"]
        WAIT --> U
    end

    style 多轮对话循环 fill:#E3F2FD
    style WAIT fill:#FFF9C4
```

### 关键：State 中管理消息列表

```mermaid
graph TB
    subgraph State演进 ["对话过程中State的变化"]
        T1["第1轮<br/>messages: [Human('你好')]<br/>→ AI回复追加"]
        T2["第2轮<br/>messages: [Human('你好'),<br/>AI('你好！'), Human('1+1=?')]<br/>→ AI回复追加"]
        T3["第3轮<br/>messages: [Human('你好'), AI('你好！'),<br/>Human('1+1=?'), AI('2'),<br/>Human('为什么?')]<br/>→ AI回复追加"]
    end

    T1 --> T2 --> T3

    style T1 fill:#E3F2FD
    style T2 fill:#FFF3E0
    style T3 fill:#C8E6C9
```

## 六、递归自引用图

```mermaid
graph TB
    START([START]) --> TASK["任务分解<br/>拆成子任务"]

    TASK --> CHECK{"子任务可<br/>直接处理?"}
    CHECK -->|"是"| EXEC["执行子任务"]
    CHECK -->|"否，需进一步分解"| TASK

    EXEC --> MERGE["合并子任务结果"]
    MERGE --> DONE{"所有子任务<br/>完成?"}
    DONE -->|"否"| TASK
    DONE -->|"是"| END([END])

    style TASK fill:#FFF9C4
    style CHECK fill:#FFE0B2
    style EXEC fill:#E3F2FD
    style MERGE fill:#C8E6C9
    style DONE fill:#FFE0B2
```

## 七、Map-Reduce vs 固定并行的区别

```mermaid
graph TB
    subgraph 固定并行 ["固定并行"]
        direction TB
        FP1["START → A, B, C（提前知道并行3个）"]
        FP2["A, B, C → Merge"]
        FP3["并行数量编译时确定"]
    end

    subgraph Map-Reduce ["Map-Reduce"]
        direction TB
        MR1["START → 动态分发N个"]
        MR2["N运行时才知道"]
        MR3["每个完成后追加结果"]
        MR4["全部完成 → Reduce"]
    end

    style 固定并行 fill:#E3F2FD
    style Map-Reduce fill:#F3E5F5
```

## 八、模式选择决策树

```mermaid
graph TD
    Q1{"任务类型?"}
    Q1 -->|"批量处理多个同类数据"| MAP_REDUCE["✅ Map-Reduce"]
    Q1 -->|"需要模块化|组织"| SUBGRAPH["✅ 子图嵌套"]
    Q1 -->|"需要人工介入"| HIL["✅ Human-in-Loop"]
    Q1 -->|"需要多轮对话"| CONV["✅ 对话状态图"]
    Q1 -->|"任务可递归分解"| RECURSIVE["✅ 递归图"]
    Q1 -->|"路由目标运行时才知道"| DYNAMIC["✅ 动态路由"]
    Q1 -->|"简单固定流程"| BASIC["→ 用基础模式"]

    style MAP_REDUCE fill:#C8E6C9
    style SUBGRAPH fill:#C8E6C9
    style HIL fill:#C8E6C9
    style CONV fill:#C8E6C9
    style RECURSIVE fill:#C8E6C9
    style DYNAMIC fill:#C8E6C9
    style BASIC fill:#E3F2FD
```

## 九、实际应用场景映射

```mermaid
graph TB
    subgraph 场景到模式
        SC1["多文档摘要<br/>→ Map-Reduce"] --> M1
        SC2["客服系统<br/>→ 动态路由"] --> M2
        SC3["复杂报告生成<br/>→ 子图嵌套"] --> M3
        SC4["代码审查<br/>→ Human-in-Loop"] --> M4
        SC5["聊天机器人<br/>→ 对话状态图"] --> M5
        SC6["复杂任务分解<br/>→ 递归图"] --> M6
    end

    M1["Map-Reduce"]
    M2["动态路由"]
    M3["子图嵌套"]
    M4["Human-in-Loop"]
    M5["对话状态图"]
    M6["递归图"]

    style SC1 fill:#E3F2FD
    style SC2 fill:#FFF3E0
    style SC3 fill:#FFF9C4
    style SC4 fill:#F3E5F5
    style SC5 fill:#C8E6C9
    style SC6 fill:#FFE0B2
```
