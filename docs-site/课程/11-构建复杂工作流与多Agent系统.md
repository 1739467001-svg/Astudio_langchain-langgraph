# 第 11 课：构建复杂工作流与多 Agent 系统

> 这一课把前面学的所有内容融合起来，用 LangGraph 构建真实场景中的复杂 AI 系统。

---

## 学习目标

- 掌握多 Agent 协作的编排方式
- 理解 Human-in-the-Loop（人机协作）模式
- 学会使用子图（Subgraph）组织复杂逻辑
- 能够构建一个完整的多 Agent 系统

## 一、多 Agent 系统

### 1.1 为什么需要多 Agent

单个 Agent 做所有事，就像让一个人同时当研究员、作家和审稿人。多 Agent 系统让不同"专家"各司其职：

```
用户提问
    ↓
┌─────────┐     ┌─────────┐     ┌─────────┐
│ 研究员   │ ──→ │  写手   │ ──→ │  审稿人  │
│ Agent   │     │ Agent   │     │ Agent   │
└─────────┘     └─────────┘     └─────────┘
                                    ↓
                              最终输出 ← (如果不合格，回到写手)
```

### 1.2 多 Agent 架构模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| 串联式 | A → B → C，顺序执行 | 流水线式任务 |
| 路由式 | 根据输入分派给不同 Agent | 客服系统 |
| 协作式 | Agent 之间互相交流 | 复杂推理 |
| 层级式 | 主 Agent 调度子 Agent | 大型系统 |

## 二、实战：研究-写作-审稿 多 Agent 系统

```python
from dotenv import load_dotenv
from typing import TypedDict, Annotated
from operator import add
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langgraph.graph import StateGraph, START, END

load_dotenv()
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

# 1. 定义共享状态
class ReportState(TypedDict):
    topic: str           # 报告主题
    research: str        # 研究结果
    draft: str            # 写作的初稿
    review: str           # 审稿意见
    final_report: str     # 最终报告
    revision_count: int   # 修改次数

# 2. 定义各个 Agent 节点

def research_agent(state: ReportState) -> dict:
    """研究 Agent：收集信息"""
    prompt = ChatPromptTemplate.from_template(
        "你是一个研究员。请围绕以下主题，列出3-5个关键要点：\n&#123;topic&#125;"
    )
    chain = prompt | llm | StrOutputParser()
    result = chain.invoke(&#123;"topic": state["topic"]&#125;)
    return &#123;"research": result&#125;

def writing_agent(state: ReportState) -> dict:
    """写作 Agent：根据研究结果撰写报告"""
    prompt = ChatPromptTemplate.from_template(
        "你是一个专业写手。根据以下研究要点，写一篇结构清晰、内容丰富的报告：\n&#123;research&#125;"
    )
    chain = prompt | llm | StrOutputParser()
    result = chain.invoke(&#123;"research": state["research"]&#125;)
    return &#123;"draft": result&#125;

def review_agent(state: ReportState) -> dict:
    """审稿 Agent：审查报告质量"""
    prompt = ChatPromptTemplate.from_template(
        "你是一个严格的审稿人。审查以下报告。\n"
        "如果质量达标，回复'APPROVED'。\n"
        "如果需要修改，回复'NEEDS_REVISION'并给出具体建议。\n\n"
        "报告：\n&#123;draft&#125;"
    )
    chain = prompt | llm | StrOutputParser()
    result = chain.invoke(&#123;"draft": state["draft"]&#125;)
    count = state.get("revision_count", 0) + 1
    return &#123;"review": result, "revision_count": count&#125;

def finalize_agent(state: ReportState) -> dict:
    """定稿 Agent：输出最终报告"""
    return &#123;"final_report": state["draft"]&#125;

# 3. 条件路由
def should_revise(state: ReportState) -> str:
    """决定是否需要修改"""
    review = state.get("review", "")
    count = state.get("revision_count", 0)
    
    if "APPROVED" in review:
        return "finalize"
    elif count >= 3:
        return "finalize"  # 最多修改3次
    else:
        return "rewrite"  # 需要重新写

# 4. 构建图
graph = StateGraph(ReportState)

graph.add_node("research", research_agent)
graph.add_node("write", writing_agent)
graph.add_node("review", review_agent)
graph.add_node("finalize", finalize_agent)

graph.add_edge(START, "research")
graph.add_edge("research", "write")
graph.add_edge("write", "review")

graph.add_conditional_edges(
    "review",
    should_revise,
    &#123;
        "rewrite": "write",    # 需要修改：回到写作（循环）
        "finalize": "finalize", # 通过：定稿
    &#125;
)

graph.add_edge("finalize", END)

# 5. 编译运行
app = graph.compile()

result = app.invoke(&#123;
    "topic": "人工智能在教育领域的应用与挑战",
    "revision_count": 0
&#125;)

print("=== 最终报告 ===")
print(result["final_report"])
print(f"\n修改次数: &#123;result['revision_count']&#125;")
```

## 三、Human-in-the-Loop（人机协作）

### 3.1 什么是人机协作

有些场景需要人工介入：

- Agent 生成结果后，需要人确认才能继续
- Agent 要执行危险操作（如删除数据）前，需要人审批
- 人工修正 Agent 的中间结果

### 3.2 实现：使用 `interrupt`

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from typing import TypedDict

class HumanState(TypedDict):
    input: str
    draft: str
    approved: bool

def generate_draft(state: HumanState) -> dict:
    """生成草稿"""
    draft = f"关于'&#123;state['input']&#125;'的草稿内容..."
    return &#123;"draft": draft&#125;

def human_review(state: HumanState) -> dict:
    """人工审查节点"""
    # 这个节点会在运行时暂停，等待人工输入
    pass

def publish(state: HumanState) -> dict:
    """发布"""
    return &#123;"approved": True&#125;

# 构建图
graph = StateGraph(HumanState)
graph.add_node("generate", generate_draft)
graph.add_node("review", human_review)
graph.add_node("publish", publish)

graph.add_edge(START, "generate")
graph.add_edge("generate", "review")
graph.add_edge("review", "publish")
graph.add_edge("publish", END)

# 编译时启用中断（在 review 节点暂停）
app = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["review"]  # 在 review 之前暂停
)

# 运行（会在 review 之前暂停）
config = &#123;"configurable": &#123;"thread_id": "1"&#125;&#125;
result = app.invoke(&#123;"input": "测试内容"&#125;, config=config)
# 此时停在 review 之前

# 人工审查后，更新 state 并继续
app.update_state(config, &#123;"draft": "人工修改后的草稿"&#125;)
result = app.invoke(None, config=config)  # 传 None 表示继续之前暂停的执行
```

### 3.3 人机协作的典型场景

```
Agent 生成代码 → [人工审查] → 如果通过则执行，否则修改
Agent 拟邮件  → [人工确认] → 如果满意则发送，否则重写
Agent 做决策  → [人工审批] → 如果同意则执行，否则终止
```

## 四、子图（Subgraph）

### 4.1 为什么需要子图

当图变得很大很复杂时，可以把一部分封装成子图，就像代码中的函数：

```
主图:
  START → 研究子图 → 写作子图 → END

研究子图:
  搜索 → 整理 → 验证
```

### 4.2 实现子图

```python
# 子图：研究流程
research_graph = StateGraph(ReportState)
research_graph.add_node("search", search_node)
research_graph.add_node("organize", organize_node)
research_graph.add_edge(START, "search")
research_graph.add_edge("search", "organize")
research_graph.add_edge("organize", END)
research_app = research_graph.compile()

# 主图：引用子图作为节点
main_graph = StateGraph(ReportState)
main_graph.add_node("research", research_app)  # 子图作为节点
main_graph.add_node("write", writing_agent)
main_graph.add_edge(START, "research")
main_graph.add_edge("research", "write")
main_graph.add_edge("write", END)
main_app = main_graph.compile()
```

## 五、Agent 之间通信

### 5.1 通过共享 State

最简单的 Agent 通信方式——通过共享 State 传递信息：

```python
class State(TypedDict):
    messages: Annotated[list, add]  # 所有 Agent 共享消息列表
    current_agent: str              # 当前由哪个 Agent 处理
    task_complete: bool             # 任务是否完成
```

### 5.2 消息传递模式

```python
def agent_a(state: State) -> dict:
    """Agent A 处理后，把结果写入消息"""
    result = "Agent A 的分析结果"
    return &#123;"messages": [AIMessage(content=f"[Agent A]: &#123;result&#125;")]&#125;

def agent_b(state: State) -> dict:
    """Agent B 读取 Agent A 的结果并处理"""
    # 读取上一个 Agent 的消息
    last_msg = state["messages"][-1].content
    result = f"基于 '&#123;last_msg&#125;' 的进一步分析"
    return &#123;"messages": [AIMessage(content=f"[Agent B]: &#123;result&#125;")]&#125;
```

## 六、高级模式

### 6.1 并行执行

```python
# 多个节点可以并行执行
graph.add_node("research_a", research_a_agent)
graph.add_node("research_b", research_b_agent)
graph.add_node("merge", merge_results)

# 两个研究节点同时执行
graph.add_edge(START, "research_a")
graph.add_edge(START, "research_b")  # 并行
# 都完成后才到 merge
graph.add_edge("research_a", "merge")
graph.add_edge("research_b", "merge")
graph.add_edge("merge", END)
```

### 6.2 动态路由

```python
def supervisor(state: State) -> str:
    """主控 Agent：决定下一个由谁处理"""
    # 让 LLM 根据当前状态决定路由
    decision = llm.invoke([
        SystemMessage(content="你是一个任务调度器。根据当前任务状态决定下一步由哪个Agent处理。"),
        HumanMessage(content=f"当前状态：&#123;state&#125;")
    ])
    if "研究" in decision.content:
        return "researcher"
    elif "写作" in decision.content:
        return "writer"
    else:
        return "end"
```

## 动手练习

1. ✅ 运行研究-写作-审稿多 Agent 系统
2. ✅ 修改审稿条件，让"NEEDS_REVISION"时附带具体修改建议，并把建议传给写作 Agent
3. ✅ 在多 Agent 系统中添加一个"翻译" Agent，在定稿后把报告翻译成英文
4. ✅ 实现一个简单的 Human-in-the-Loop：在生成草稿后暂停，人工修改后继续
5. ✅ 挑战：用并行模式让两个研究 Agent 同时工作（一个查中文资料、一个查英文资料），然后合并结果

## 自测清单

- [ ] 我理解多 Agent 系统的优势
- [ ] 我知道至少 3 种多 Agent 架构模式
- [ ] 我能用 LangGraph 构建多 Agent 工作流
- [ ] 我理解条件边如何实现 Agent 之间的循环协作
- [ ] 我知道 Human-in-the-Loop 的概念和实现方式
- [ ] 我理解子图的作用和使用方法

## 下一课

→ 打开 [12-实战项目-从零到一.md](12-实战项目-从零到一.md)，综合运用所学，构建一个完整项目。

## 知识库链接

- 多 Agent 系统设计模式 → [知识库：LangGraph 架构详解](../知识库/03-LangGraph架构详解.md)
- 完整的复杂工作流代码 → [知识库：代码示例集](../知识库/05-代码示例集.md)
- 术语不懂？→ [知识库：技术术语表](../知识库/01-技术术语表.md)
