# 第 09 课：LangGraph 入门——图式编排

> 当 Chain 不够用时，你需要 LangGraph。它让你像画流程图一样编排 AI 工作流。

---

## 学习目标

- 理解 LangChain Chain 的局限性
- 理解为什么需要 LangGraph
- 掌握 LangGraph 的基本概念
- 跑通第一个 LangGraph 应用

## 一、为什么需要 LangGraph

### 1.1 Chain 的局限

前面学过的 Chain 是**线性的**：

```
A → B → C → D
```

但真实的 AI 应用往往需要更复杂的控制流：

```
需求 1：条件分支 — "如果用户问的是技术问题，走技术支持流程；否则走客服流程"
需求 2：循环 — "如果模型回答不够好，让它重新生成"
需求 3：多 Agent 协作 — "Agent A 做研究 → Agent B 写报告 → Agent C 审稿"
需求 4：人工介入 — "模型生成结果后，等人工确认再继续"
需求 5：状态管理 — "在整个流程中维护和更新复杂的状态"
```

Chain 无法优雅地处理这些需求——它只能线性执行，不支持分支、循环和复杂状态。

### 1.2 LangGraph 的解决思路

LangGraph 把工作流建模为一张**有向图**：

```
     ┌──→ Node B ──┐
Node A               ├──→ Node D (END)
     └──→ Node C ──┘
```

- **Node（节点）**：每个节点是一个处理步骤（可以是 LLM 调用、工具调用、任意函数）
- **Edge（边）**：节点之间的连接，决定数据流向
- **条件边**：根据状态决定下一个走哪个节点（实现分支）
- **循环边**：允许回到之前的节点（实现循环）
- **State（状态）**：在所有节点之间共享的数据

> 📌 如果学过流程图，就很容易理解——LangGraph 本质上就是"把流程图变成可执行的程序"。

### 1.3 LangChain vs LangGraph 的关系

```
LangChain  →  组件库（提供积木：LLM、Prompt、Tool、Retriever...）
LangGraph  →  编排框架（把积木组装成复杂的工作流）
```

它们不是替代关系，而是**互补关系**：

- 用 LangChain 的组件作为 LangGraph 中每个节点的实现
- 用 LangGraph 来编排这些组件形成复杂工作流

> 📌 更详细的架构说明见 [知识库：LangGraph 架构详解](../知识库/03-LangGraph架构详解.md)

## 二、安装与核心概念

### 2.1 安装

```bash
pip install langgraph
```

### 2.2 四个核心概念

| 概念 | 说明 | 类比 |
|------|------|------|
| State | 在图中流转的共享数据 | 流程中的"文件袋" |
| Node | 处理步骤，接收 State 并返回更新 | 流程中的"处理站" |
| Edge | 节点间的连接 | 流程中的"箭头" |
| Conditional Edge | 根据条件选择下一个节点 | 流程中的"判断菱形" |

### 2.3 State（状态）

State 是 LangGraph 的核心——它在所有节点之间共享和传递。用 `TypedDict` 或 Pydantic 定义：

```python
from typing import TypedDict, Annotated
from operator import add

# 定义状态类型
class State(TypedDict):
    messages: Annotated[list, add]  # 消息列表，用 add 合并器累加
    topic: str                      # 当前话题
    summary: str                     # 摘要
```

`Annotated[list, add]` 的意思是：当节点返回了新的 messages 列表时，不是替换而是**追加合并**到现有列表中。

### 2.4 Node（节点）

节点就是普通的 Python 函数，接收当前 State，返回要更新的字段：

```python
def generate_summary(state: State) -> dict:
    """生成摘要的节点"""
    # 读取 state 中的数据
    topic = state["topic"]
    # 返回要更新的字段（不需要返回全部，只返回变化的部分）
    return &#123;"summary": f"这是关于&#123;topic&#125;的摘要"&#125;
```

### 2.5 Edge（边）

边定义节点间的执行顺序：

```python
from langgraph.graph import StateGraph, START, END

graph = StateGraph(State)

# 添加节点
graph.add_node("generate", generate_summary)
graph.add_node("review", review_summary)

# 添加边（固定顺序）
graph.add_edge(START, "generate")     # 从开始到 generate
graph.add_edge("generate", "review")  # 从 generate 到 review
graph.add_edge("review", END)         # 从 review 到结束
```

### 2.6 Conditional Edge（条件边）

根据当前状态决定下一个节点：

```python
def should_continue(state: State) -> str:
    """决定下一步去哪个节点"""
    if state["summary"] == "":
        return "generate"  # 摘要为空，重新生成
    else:
        return "end"      # 摘要有了，结束

graph.add_conditional_edges(
    "review",              # 从哪个节点出发
    should_continue,       # 判断函数
    &#123;
        "generate": "generate",  # 返回 "generate" 则去 generate 节点
        "end": END,               # 返回 "end" 则结束
    &#125;
)
```

## 三、第一个 LangGraph 应用

实现一个简单的"写作助手"：先生成大纲 → 再生成内容 → 结束。

```python
from dotenv import load_dotenv
from typing import TypedDict
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langgraph.graph import StateGraph, START, END

load_dotenv()
llm = ChatOpenAI(model="gpt-4o-mini")

# 1. 定义状态
class WritingState(TypedDict):
    topic: str       # 写作主题
    outline: str     # 大纲
    content: str     # 正文

# 2. 定义节点
def generate_outline(state: WritingState) -> dict:
    """生成大纲"""
    prompt = ChatPromptTemplate.from_template("为主题'&#123;topic&#125;'生成3个要点的中文大纲")
    chain = prompt | llm | StrOutputParser()
    outline = chain.invoke(&#123;"topic": state["topic"]&#125;)
    return &#123;"outline": outline&#125;  # 只返回更新的字段

def generate_content(state: WritingState) -> dict:
    """根据大纲生成正文"""
    prompt = ChatPromptTemplate.from_template(
        "根据以下大纲，写一段详细的内容：\n&#123;outline&#125;"
    )
    chain = prompt | llm | StrOutputParser()
    content = chain.invoke(&#123;"outline": state["outline"]&#125;)
    return &#123;"content": content&#125;

# 3. 构建图
graph = StateGraph(WritingState)

# 添加节点
graph.add_node("outline", generate_outline)
graph.add_node("content", generate_content)

# 添加边
graph.add_edge(START, "outline")     # 开始 → 生成大纲
graph.add_edge("outline", "content") # 大纲 → 生成正文
graph.add_edge("content", END)       # 正文 → 结束

# 4. 编译图
app = graph.compile()

# 5. 运行
result = app.invoke(&#123;"topic": "人工智能的未来"&#125;)
print("=== 大纲 ===")
print(result["outline"])
print("\n=== 正文 ===")
print(result["content"])
```

## 四、可视化图

LangGraph 支持可视化你的工作流图：

```python
# 在 Jupyter Notebook 中显示
from IPython.display import Image, display

display(Image(app.get_graph().draw_meracle_png()))
```

或在终端生成 ASCII 图：

```python
print(app.get_graph().draw_ascii())
```

## 五、与 Chain 的对比

同样的功能，用 Chain 实现：

```python
# Chain 方式
outline_prompt = ChatPromptTemplate.from_template("为主题'&#123;topic&#125;'生成大纲")
content_prompt = ChatPromptTemplate.from_template("根据大纲写内容：\n&#123;outline&#125;")

chain = (
    outline_prompt | llm | StrOutputParser()
    | (lambda outline: &#123;"outline": outline, "topic": "AI"&#125;)
    | content_prompt | llm | StrOutputParser()
)
```

用 LangGraph 实现：

```python
# LangGraph 方式（同样的功能，但支持更复杂的扩展）
graph = StateGraph(WritingState)
graph.add_node("outline", generate_outline)
graph.add_node("content", generate_content)
graph.add_edge(START, "outline")
graph.add_edge("outline", "content")
graph.add_edge("content", END)
```

对于简单线性流程，Chain 更简洁。但当你需要条件分支、循环时，LangGraph 的优势就非常明显了。

## 动手练习

1. ✅ 安装 LangGraph，运行第一个示例
2. ✅ 在写作助手中添加第三个节点"润色"，在大纲和正文之间加一个"扩写"步骤
3. ✅ 尝试用 `draw_ascii()` 或 `draw_meracle_png()` 可视化你的图
4. ✅ 挑战：添加一个条件边——如果大纲太短（少于 50 字），让它重新生成

## 自测清单

- [ ] 我理解 Chain 的局限性（不支持分支、循环等）
- [ ] 我知道 LangGraph 的四个核心概念：State、Node、Edge、Conditional Edge
- [ ] 我理解 State 在节点间共享数据的机制
- [ ] 我能创建一个简单的线性 LangGraph 工作流
- [ ] 我知道如何编译和运行 LangGraph

## 下一课

→ 打开 [10-LangGraph核心概念-State-Nodes-Edges.md](10-LangGraph核心概念-State-Nodes-Edges.md)，深入理解每个概念。

## 知识库链接

- LangGraph 完整架构 → [知识库：LangGraph 架构详解](../知识库/03-LangGraph架构详解.md)
- LangGraph 代码示例 → [知识库：代码示例集](../知识库/05-代码示例集.md)
- 术语不懂？→ [知识库：技术术语表](../知识库/01-技术术语表.md)
