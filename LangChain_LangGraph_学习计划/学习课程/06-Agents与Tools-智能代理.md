# 第 06 课：Agents 与 Tools——智能代理

> 前面学的 Chain 是"固定流程"——你预先设计好步骤。Agent 则是"动态决策"——LLM 自己决定下一步做什么。

---

## 学习目标

- 理解 Chain 与 Agent 的本质区别
- 学会创建自定义工具（Tool）
- 掌握 Agent 的创建与调用方式
- 理解 ReAct 模式和 Tool Calling

## 一、Chain vs Agent

### 1.1 核心区别

| 特性 | Chain | Agent |
|------|-------|-------|
| 流程 | 预先固定的步骤 | LLM 动态决策 |
| 控制权 | 开发者 | LLM |
| 灵活性 | 低，流程不变 | 高，适应不同输入 |
| 可预测性 | 高 | 较低 |
| 适用场景 | 固定工作流 | 需要判断和选择的场景 |

举例说明：

```
用户问："今天北京天气怎么样？"

Chain 方式（固定流程）：
  Step 1: 调用天气API → Step 2: 把结果给LLM → Step 3: 生成回复

Agent 方式（动态决策）：
  LLM 思考："用户想知道天气，我需要调用天气工具"
  → 调用天气工具
  LLM 思考："拿到数据了，可以回复用户了"
  → 生成最终回复
```

### 1.2 什么时候用 Agent

```
用 Chain：当你知道每一步该做什么（固定流程）
用 Agent：当你不确定需要哪些步骤，需要 LLM 来判断
```

## 二、Tools（工具）

### 2.1 什么是工具

工具就是 LLM 可以调用的外部函数。比如：

- 搜索引擎查询
- 计算器
- 数据库查询
- 调用某个 API
- 执行代码

### 2.2 创建自定义工具

```python
from langchain_core.tools import tool

@tool
def calculate(expression: str) -> str:
    """计算数学表达式并返回结果。
    
    Args:
        expression: 数学表达式，如 "2 + 3 * 4"
    
    Returns:
        计算结果
    """
    try:
        result = eval(expression)  # 教学示例，生产环境不要用 eval
        return f"计算结果：{result}"
    except Exception as e:
        return f"计算失败：{e}"

@tool
def get_word_length(word: str) -> int:
    """返回单词的字符长度。"""
    return len(word)
```

关键点：

- `@tool` 装饰器把普通函数变成 LangChain 工具
- **函数的 docstring 非常重要**——LLM 通过它来理解工具的用途
- 参数需要标注类型，LLM 会据此生成正确的参数

### 2.3 使用 LangChain 内置工具

LangChain 社区提供了大量现成工具：

```python
# DuckDuckGo 搜索
from langchain_community.tools import DuckDuckGoSearchRun
search = DuckDuckGoSearchRun()

# Wikipedia 查询
from langchain_community.tools import WikipediaQueryRun
from langchain_community.utilities import WikipediaAPIWrapper
wiki = WikipediaQueryRun(api_wrapper=WikipediaAPIWrapper())
```

### 2.4 工具的描述很关键

LLM 决定是否使用工具、如何使用工具，完全取决于工具的描述：

```python
@tool
def search_database(query: str) -> str:
    """在公司产品数据库中搜索信息。支持产品名称、型号、类别等关键词搜索。
    当用户询问产品信息、价格、库存时使用此工具。
    
    Args:
        query: 搜索关键词
    """
    # ... 实现省略
```

> 💡 **最佳实践**：工具描述要清晰说明"什么时候该用"和"什么时候不该用"。

## 三、创建 Agent

### 3.1 基于 Tool Calling 的 Agent（推荐）

现代 LLM（GPT-4、Claude 等）原生支持 Tool Calling，这是推荐方式：

```python
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

load_dotenv()

# 1. 定义工具
@tool
def calculate(expression: str) -> str:
    """计算数学表达式。如 '2 + 3 * 4'"""
    try:
        return str(eval(expression))
    except:
        return "计算失败"

@tool
def get_current_date() -> str:
    """获取当前日期"""
    from datetime import datetime
    return datetime.now().strftime("%Y年%m月%d日")

# 2. 创建 LLM（需要支持 tool calling）
llm = ChatOpenAI(model="gpt-4o-mini")

# 3. 定义工具列表
tools = [calculate, get_current_date]

# 4. 创建提示词
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个有用的助手。你可以使用工具来帮助回答问题。"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),  # Agent 的中间思考过程
])

# 5. 创建 Agent
agent = create_tool_calling_agent(llm, tools, prompt)

# 6. 创建执行器
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# 7. 运行
result = agent_executor.invoke({"input": "123 * 456 等于多少？"})
print(result["output"])  # "123 * 456 = 56088"
```

### 3.2 理解执行过程

Agent 的执行是一个循环：

```
1. LLM 接收用户问题
2. LLM 决定：需要调用工具？→ 是 → 调用工具 → 把结果给 LLM → 回到 Step 2
                       → 否 → 直接生成最终回复 → 结束
```

设置 `verbose=True` 可以看到这个完整的"思考-行动"过程：

```
> Entering new AgentExecutor chain...

Thought: 用户要计算 123 * 456，我需要使用 calculate 工具。
Action: calculate
Action Input: 123 * 456
Observation: 56088
Thought: 我得到了结果，可以回复用户了。
Final Answer: 123 * 456 = 56088
```

### 3.3 ReAct 模式

上面这个过程就是 **ReAct（Reasoning + Acting）模式**：

```
Thought（思考） → Action（行动/调用工具） → Observation（观察结果） → Thought → ... → Final Answer
```

ReAct 是大多数 Agent 的基本范式——先想、再做、看结果、再想，直到能给出最终答案。

## 四、Agent 实战：带搜索能力的助手

```python
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

load_dotenv()

@tool
def fake_web_search(query: str) -> str:
    """搜索互联网获取最新信息。当需要查找新闻、天气、实时数据时使用。
    
    Args:
        query: 搜索关键词
    """
    # 教学示例：模拟搜索结果
    # 实际使用可以接入 DuckDuckGo 或 Tavily 等搜索 API
    return f"搜索结果：根据查询'{query}'，找到了相关信息。[模拟数据]"

tools = [fake_web_search]

llm = ChatOpenAI(model="gpt-4o-mini")

prompt = ChatPromptTemplate.from_messages([
    ("system", """你是一个智能助手。你可以使用搜索工具来获取最新信息。
    如果你的知识已经足够回答问题，就不需要使用工具。
    使用工具时，请基于搜索结果给出准确回答。"""),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

agent = create_tool_calling_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# 测试
result1 = agent_executor.invoke({"input": "什么是 Python 编程语言？"})
# LLM 可能直接回答，不需要搜索

result2 = agent_executor.invoke({"input": "搜索一下最新的 AI 新闻"})
# LLM 会调用搜索工具
print(result2["output"])
```

## 五、Agent 的关键参数

```python
agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,           # 打印执行过程
    max_iterations=5,        # 最多循环5次（防止无限循环）
    handle_parsing_errors=True,  # 出错时自动重试
    early_stopping_method="generate",  # 达到次数限制时的行为
)
```

## 六、Structured Tools（更规范的工具定义）

对于复杂工具，可以用 `StructuredTool` 或 Pydantic 模型定义参数：

```python
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

class WeatherQuery(BaseModel):
    city: str = Field(description="城市名称")
    date: str = Field(description="日期，格式 YYYY-MM-DD", default="今天")

def get_weather(city: str, date: str = "今天") -> str:
    return f"{city}在{date}的天气：晴，25°C"

weather_tool = StructuredTool.from_function(
    func=get_weather,
    name="get_weather",
    description="查询指定城市的天气",
    args_schema=WeatherQuery,
)
```

## 动手练习

1. ✅ 运行计算器 Agent 示例
2. ✅ 创建一个带 3 个工具的 Agent（计算器、日期、模拟搜索）
3. ✅ 测试不同问题，观察 Agent 何时选择使用工具、何时直接回答
4. ✅ 把 `verbose=True` 打开，理解 Agent 的思考-行动循环
5. ✅ 挑战：创建一个"代码执行"工具（用 Python 的 exec），让 Agent 能计算复杂任务

## 自测清单

- [ ] 我能清晰解释 Chain 和 Agent 的区别
- [ ] 我会用 `@tool` 装饰器创建自定义工具
- [ ] 我理解工具的 docstring 对 Agent 的重要性
- [ ] 我能用 `create_tool_calling_agent` 创建 Agent
- [ ] 我理解 ReAct 的"思考-行动-观察"循环
- [ ] 我知道 `max_iterations` 的作用和为什么要设置它

## 下一课

→ 打开 [07-RAG检索增强生成.md](07-RAG检索增强生成.md)，学习如何让 LLM 基于你的私有数据回答问题。

## 知识库链接

- 所有内置工具列表 → [知识库：API 参考与速查手册](../知识库/04-API参考与速查手册.md)
- Agent 的完整代码示例 → [知识库：代码示例集](../知识库/05-代码示例集.md)
- 术语不懂？→ [知识库：技术术语表](../知识库/01-技术术语表.md)
