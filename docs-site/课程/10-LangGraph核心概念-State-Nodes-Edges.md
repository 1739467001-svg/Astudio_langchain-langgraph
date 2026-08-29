# 第 10 课：LangGraph 核心概念——State、Nodes、Edges

> 这一课深入 LangGraph 的三个核心概念，掌握它们你就掌握了 LangGraph 的全部基础。

---

## 学习目标

- 深入理解 State 的定义方式与 Reducer 机制
- 掌握 Node 的编写规范和最佳实践
- 理解各种 Edge 类型的区别与用法
- 能够构建带条件分支和循环的图

## 一、State（状态）深入

### 1.1 State 是什么

State 是贯穿整个工作流的数据容器。每个节点读取 State 中的数据，处理完后返回要更新的字段。

```
State = &#123;
    "messages": [...],     # 对话历史
    "user_input": "...",   # 用户输入
    "retrieved_docs": [...], # 检索到的文档
    "answer": "...",       # 最终回答
&#125;
```

### 1.2 定义 State

方式一：TypedDict（推荐，简洁）

```python
from typing import TypedDict

class MyState(TypedDict):
    question: str
    answer: str
```

方式二：Pydantic（支持验证）

```python
from pydantic import BaseModel

class MyState(BaseModel):
    question: str
    answer: str = ""
```

### 1.3 Reducer（合并器）

这是 LangGraph 最关键的概念之一。

**问题**：当节点返回 `&#123;"messages": [new_message]&#125;` 时，是替换整个列表还是追加？

**答案**：由 Reducer 决定。

```python
from typing import TypedDict, Annotated
from operator import add

class State(TypedDict):
    # 用 add 合并器：新值追加到列表
    messages: Annotated[list, add]
    
    # 不指定 Reducer：新值直接替换旧值
    answer: str
```

对比效果：

```
当前 State: &#123;"messages": ["A"], "answer": "old"&#125;

节点返回: &#123;"messages": ["B"], "answer": "new"&#125;

结果 State:
  messages: ["A", "B"]  ← add 合并器追加
  answer: "new"          ← 直接替换
```

### 1.4 自定义 Reducer

```python
from typing import TypedDict, Annotated

def merge_dicts(old: dict, new: dict) -> dict:
    """合并字典而不是替换"""
    return &#123;**old, **new&#125;

class State(TypedDict):
    data: Annotated[dict, merge_dicts]  # 用自定义合并逻辑
```

### 1.5 实际示例：对话消息的 State

这是最常用的 State 模式——消息累积：

```python
from typing import TypedDict, Annotated
from operator import add
from langchain_core.messages import AnyMessage

class AgentState(TypedDict):
    # 消息列表用 add 合并器，每个节点返回的新消息会追加
    messages: Annotated[list[AnyMessage], add]
```

## 二、Node（节点）深入

### 2.1 节点的签名

节点就是一个接收 State、返回部分 State 的函数：

```python
def my_node(state: State) -> dict:
    # 读取
    value = state["some_field"]
    # 处理
    result = do_something(value)
    # 返回更新的字段（不需要返回整个 State）
    return &#123;"some_field": result&#125;
```

### 2.2 节点中调用 LLM

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o-mini")

def answer_node(state: AgentState) -> dict:
    """根据对话历史生成回答"""
    prompt = ChatPromptTemplate.from_messages([
        ("system", "你是一个有用的助手。"),
        ("human", "&#123;input&#125;")
    ])
    chain = prompt | llm | StrOutputParser()
    answer = chain.invoke(&#123;"input": state["messages"][-1].content&#125;)
    
    # 返回新的 AI 消息，会自动追加到 messages 列表
    return &#123;"messages": [AIMessage(content=answer)]&#125;
```

### 2.3 节点中调用工具

```python
@tool
def search(query: str) -> str:
    """搜索工具"""
    return f"搜索结果: &#123;query&#125;"

def tool_node(state: AgentState) -> dict:
    """执行工具调用"""
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        results = []
        for call in last_message.tool_calls:
            tool_output = search.invoke(call["args"])
            results.append(ToolMessage(content=tool_output, tool_call_id=call["id"]))
        return &#123;"messages": results&#125;
    return &#123;&#125;
```

### 2.4 节点的最佳实践

```python
# ✅ 好：只返回需要更新的字段
def good_node(state: State) -> dict:
    return &#123;"answer": "42"&#125;

# ❌ 坏：返回整个 State（容易出错）
def bad_node(state: State) -> dict:
    state["answer"] = "42"
    return state  # 不要这样做
```

## 三、Edge（边）深入

### 3.1 普通边（固定连接）

```python
graph.add_edge("node_a", "node_b")
# 从 node_a 执行完后，必定走到 node_b
```

### 3.2 条件边（根据状态分支）

```python
def route(state: State) -> str:
    """路由函数：返回下一个节点的名字"""
    if "error" in state.get("answer", ""):
        return "retry"      # 有错误，重试
    return "done"            # 没错误，结束

graph.add_conditional_edges(
    "generate",        # 从哪个节点出发
    route,             # 路由函数
    &#123;                   # 返回值到节点名的映射
        "retry": "generate",  # 返回 "retry" 则去 generate（形成循环）
        "done": END,          # 返回 "done" 则结束
    &#125;
)
```

### 3.3 条件边实现循环

这是 LangGraph 最强大的特性之一：

```python
# 实现一个"重试直到满意"的循环
graph.add_edge(START, "generate")
graph.add_conditional_edges(
    "generate",
    lambda state: "review" if state.get("answer") else "generate",  # 答案为空则重试
    &#123;"review": "review", "generate": "generate"&#125;
)
graph.add_edge("review", END)
```

### 3.4 多路条件分支

```python
def complex_router(state: State) -> str:
    """复杂路由逻辑"""
    question = state.get("question", "")
    
    if "数学" in question:
        return "math_agent"
    elif "翻译" in question:
        return "translation_agent"
    elif "代码" in question:
        return "code_agent"
    else:
        return "general_agent"

graph.add_conditional_edges(
    "router",
    complex_router,
    &#123;
        "math_agent": "math_agent",
        "translation_agent": "translation_agent",
        "code_agent": "code_agent",
        "general_agent": "general_agent",
    &#125;
)
```

## 四、完整示例：带条件分支的 Agent

构建一个"自纠错"的翻译 Agent：翻译 → 检查 → 如果有问题则重新翻译。

```python
from dotenv import load_dotenv
from typing import TypedDict, Annotated
from operator import add
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langgraph.graph import StateGraph, START, END

load_dotenv()
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# 1. 定义 State
class TranslationState(TypedDict):
    original_text: str        # 原文
    translated: str           # 翻译结果
    review: str               # 审查意见
    attempt: int              # 尝试次数

# 2. 定义节点
def translate(state: TranslationState) -> dict:
    """翻译节点"""
    prompt = ChatPromptTemplate.from_template(
        "将以下中文翻译为英文，只输出翻译：\n&#123;text&#125;"
    )
    chain = prompt | llm | StrOutputParser()
    result = chain.invoke(&#123;"text": state["original_text"]&#125;)
    attempt = state.get("attempt", 0) + 1
    return &#123;"translated": result, "attempt": attempt&#125;

def review_translation(state: TranslationState) -> dict:
    """审查翻译质量"""
    prompt = ChatPromptTemplate.from_template(
        "审查以下翻译的质量。如果翻译质量好，回复'PASS'；如果有问题，回复'FAIL'并说明原因。\n"
        "原文：&#123;original&#125;\n翻译：&#123;translation&#125;"
    )
    chain = prompt | llm | StrOutputParser()
    result = chain.invoke(&#123;
        "original": state["original_text"],
        "translation": state["translated"]
    &#125;)
    return &#123;"review": result&#125;

# 3. 条件路由
def should_retry(state: TranslationState) -> str:
    """根据审查结果决定是否重试"""
    review = state.get("review", "")
    attempt = state.get("attempt", 0)
    
    if "PASS" in review:
        return "done"        # 通过审查，结束
    elif attempt >= 3:
        return "done"        # 超过最大重试次数，结束
    else:
        return "retry"       # 未通过，重新翻译

# 4. 构建图
graph = StateGraph(TranslationState)

graph.add_node("translate", translate)
graph.add_node("review", review_translation)

graph.add_edge(START, "translate")
graph.add_edge("translate", "review")

graph.add_conditional_edges(
    "review",
    should_retry,
    &#123;
        "retry": "translate",  # 重试：回到翻译节点（循环）
        "done": END,           # 完成：结束
    &#125;
)

# 5. 编译
app = graph.compile()

# 6. 运行
result = app.invoke(&#123;
    "original_text": "人工智能正在改变我们的生活方式",
    "attempt": 0
&#125;)

print(f"翻译结果：&#123;result['translated']&#125;")
print(f"审查意见：&#123;result['review']&#125;")
print(f"尝试次数：&#123;result['attempt']&#125;")
```

## 五、图的编译与运行

### 5.1 编译

```python
# 编译图（变成可执行的应用）
app = graph.compile()

# 可选：添加检查点（用于持久化和时间旅行）
from langgraph.checkpoint.memory import MemorySaver
app = graph.compile(checkpointer=MemorySaver())
```

### 5.2 运行方式

```python
# 同步调用
result = app.invoke(&#123;"input": "hello"&#125;)

# 流式输出
for event in app.stream(&#123;"input": "hello"&#125;):
    print(event)

# 异步调用
result = await app.ainvoke(&#123;"input": "hello"&#125;)

# 异步流式
async for event in app.astream(&#123;"input": "hello"&#125;):
    print(event)
```

### 5.3 带检查点的运行

```python
# 使用 MemorySaver 可以实现"中断"和"恢复"
checkpointer = MemorySaver()
app = graph.compile(checkpointer=checkpointer)

# 每次调用指定 thread_id
config = &#123;"configurable": &#123;"thread_id": "conversation_1"&#125;&#125;
result = app.invoke(&#123;"input": "hello"&#125;, config=config)
```

## 动手练习

1. ✅ 运行自纠错翻译 Agent 示例
2. ✅ 修改翻译 Agent，让最大重试次数从 3 改为 5，观察行为变化
3. ✅ 构建一个三路分支的图：根据用户问题类型（数学/翻译/闲聊）路由到不同节点
4. ✅ 用 `app.stream()` 运行图，观察每一步的输出
5. ✅ 挑战：用 MemorySaver 实现中断恢复——在某一步暂停，修改 State 后继续运行

## 自测清单

- [ ] 我理解 State 的 Reducer 机制（替换 vs 追加）
- [ ] 我知道 `Annotated[list, add]` 的含义
- [ ] 我会编写接收 State、返回部分 State 的节点函数
- [ ] 我能用条件边实现分支和循环
- [ ] 我能编译和运行 LangGraph
- [ ] 我知道 `invoke`、`stream`、`ainvoke` 的区别

## 下一课

→ 打开 [11-构建复杂工作流与多Agent系统.md](11-构建复杂工作流与多Agent系统.md)，构建更复杂的多 Agent 系统。

## 知识库链接

- LangGraph 的完整 API → [知识库：API 参考与速查手册](../知识库/04-API参考与速查手册.md)
- 多 Agent 系统的代码示例 → [知识库：代码示例集](../知识库/05-代码示例集.md)
- 术语不懂？→ [知识库：技术术语表](../知识库/01-技术术语表.md)
