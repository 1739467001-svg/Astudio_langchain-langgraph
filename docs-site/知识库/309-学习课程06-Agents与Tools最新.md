# 学习课程 06：Agents 与 Tools 最新

> 学习课程 06 有 320 行。这篇基于 v0.3 更新——create_react_agent 替代旧 AgentExecutor。

---

## 一、v0.3 Agent 创建

```mermaid
graph TB
    USER["用户消息"] --> AGENT["Agent节点<br/>LLM推理"]
    AGENT --> DECIDE&#123;"有tool_calls?"&#125;
    DECIDE -->|有| TOOLS["Tools节点<br/>执行工具"]
    TOOLS --> AGENT
    DECIDE -->|无| ANSWER["返回回答"]

    style AGENT fill:#E3F2FD
    style TOOLS fill:#FFF9C4
```

---

## 二、创建 Agent

```python
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

@tool
def search(query: str) -> str:
    """搜索信息。何时使用：需要最新信息时。"""
    return f"搜索结果: &#123;query&#125;"

@tool
def calculate(expression: str) -> str:
    """计算数学表达式。何时使用：需要数学计算时。"""
    return str(eval(expression))

# 一行创建Agent
agent = create_react_agent(
    ChatOpenAI(model="gpt-4o-mini", streaming=True),
    [search, calculate],
    checkpointer=MemorySaver(),
    prompt="你是助手。可以搜索和计算。",
)

# 使用
config = &#123;"configurable": &#123;"thread_id": "conv-1"&#125;&#125;
result = agent.invoke(
    &#123;"messages": [&#123;"role": "user", "content": "GPT-4o的价格是多少？乘以12个月"&#125;]&#125;,
    config,
)
```

---

## 三、工具设计

```python
from pydantic import BaseModel, Field

class SearchInput(BaseModel):
    query: str = Field(description="搜索关键词")
    max_results: int = Field(default=5, ge=1, le=20)

@tool(args_schema=SearchInput)
async def search_web(query: str, max_results: int = 5) -> str:
    """搜索网络获取信息。

    何时使用：用户询问最新信息、实时数据。
    何时不使用：通用知识问题。

    Args:
        query: 搜索关键词
        max_results: 返回结果数(1-20)
    """
    return f"结果: &#123;query&#125;"
```

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 用create_react_agent | 一行创建 | ★★★ |
| 工具5-10个最佳 | 太多决策混乱 | ★★★ |
| 描述含"何时使用" | Agent靠描述选 | ★★★ |
| streaming=True | 流式输出 | ★★☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 能创建Agent | ☐ |
| 能定义工具 | ☐ |
