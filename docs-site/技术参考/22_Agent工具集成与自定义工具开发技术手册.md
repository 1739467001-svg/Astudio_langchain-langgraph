# Agent 工具集成与自定义工具开发技术手册

> **定位**：技术参考手册 | **前置知识**：第06课 工具与代理Agent | **难度**：中高级

---

## 1. 概述与工具体系全景

LangChain 的 Agent 体系围绕「工具（Tool）」构建。工具是 Agent 与外部世界交互的桥梁——搜索网页、执行代码、查询数据库、调用 API，一切皆工具。

```mermaid
graph TB
    A[Agent 工具体系] --> B[内置工具]
    A --> C[自定义工具]
    A --> D[工具包 ToolKit]

    B --> B1[搜索引擎]
    B --> B2[Python REPL]
    B --> B3[Wikipedia]
    B --> B4[计算器]

    C --> C1["@tool 装饰器"]
    C --> C2[StructuredTool]
    C --> C3[继承 BaseTool]
    C --> C4[async 工具]

    D --> D1[工具集合]
    D --> D2[权限封装]
    D --> D3[场景分组]
```

### 工具的核心属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `name` | str | 工具名称，Agent 据此选择工具 |
| `description` | str | 功能描述，LLM 据此判断何时调用 |
| `args_schema` | Pydantic | 参数校验模式，定义输入结构 |
| `return_direct` | bool | 是否直接返回结果跳过 LLM |
| `handle_tool_error` | func | 错误处理函数 |

---

## 2. @tool 装饰器——最简工具定义

### 基础用法

```python
from langchain_core.tools import tool

@tool
def search_database(query: str, limit: int = 5) -> str:
    """在产品数据库中搜索信息。
    
    Args:
        query: 搜索关键词
        limit: 返回结果数量，默认5条
    
    Returns:
        搜索结果文本
    """
    # 实际数据库查询逻辑
    results = db.search(query, limit=limit)
    return f"找到 {len(results)} 条结果:\n" + "\n".join(results)
```

### 关键要点

- **docstring 即 description**：LLM 依据此文本判断何时调用工具，务必清晰准确
- **类型注解自动生成 schema**：`str`、`int`、`bool`、`list` 等基础类型自动映射
- **Pydantic 模型做复杂参数**：嵌套结构用 `args_schema` 指定

### 带校验的复杂工具

```python
from pydantic import BaseModel, Field
from langchain_core.tools import tool

class SearchInput(BaseModel):
    query: str = Field(description="搜索关键词，不少于2个字符")
    category: str = Field(default="all", description="搜索类别")
    limit: int = Field(default=10, ge=1, le=50, description="返回数量1-50")

@tool(args_schema=SearchInput)
def advanced_search(**kwargs) -> str:
    """高级搜索工具，支持分类和数量控制。"""
    query = kwargs["query"]
    category = kwargs["category"]
    limit = kwargs["limit"]
    return f"在类别 {category} 中搜索 '{query}'，返回 {limit} 条"
```

---

## 3. StructuredTool 与 BaseTool——灵活工具定义

### StructuredTool：从函数创建

```python
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

class WeatherInput(BaseModel):
    city: str = Field(description="城市名称")
    date: str = Field(description="日期 YYYY-MM-DD")

def get_weather(city: str, date: str) -> str:
    """查询指定城市指定日期的天气。"""
    return f"{city} 在 {date} 的天气：晴，25°C"

weather_tool = StructuredTool.from_function(
    func=get_weather,
    name="get_weather",
    description="查询天气信息",
    args_schema=WeatherInput,
    handle_tool_error=lambda e: f"天气查询失败: {e}"
)
```

### BaseTool：面向对象方式

```python
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Type

class CalculatorInput(BaseModel):
    expression: str = Field(description="数学表达式，如 '2+3*4'")

class CalculatorTool(BaseTool):
    name: str = "calculator"
    description: str = "安全计算数学表达式"
    args_schema: Type[BaseModel] = CalculatorInput

    def _run(self, expression: str) -> str:
        """同步执行"""
        # 安全评估：只允许数字和运算符
        import re
        if not re.match(r'^[\d+\-*/.()\s]+$', expression):
            return "错误：表达式包含非法字符"
        try:
            result = eval(expression, {"__builtins__": {}}, {})
            return f"{expression} = {result}"
        except Exception as e:
            return f"计算错误: {e}"

    async def _arun(self, expression: str) -> str:
        """异步执行（可选）"""
        import asyncio
        await asyncio.sleep(0.01)  # 模拟异步操作
        return self._run(expression)
```

---

## 4. 异步工具开发

异步工具在 I/O 密集场景（网络请求、数据库查询）中显著提升并发性能。

```python
import asyncio
import aiohttp
from langchain_core.tools import tool

@tool
async def async_web_fetch(url: str) -> str:
    """异步获取网页内容。"""
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status == 200:
                text = await response.text()
                return text[:2000]  # 截取前2000字符
            return f"HTTP {response.status}"
```

### 异步工具调用

```python
import asyncio

async def main():
    # 并发调用多个异步工具
    tasks = [
        async_web_fetch.ainvoke({"url": "https://api.example.com/data1"}),
        async_web_fetch.ainvoke({"url": "https://api.example.com/data2"}),
    ]
    results = await asyncio.gather(*tasks)
    for r in results:
        print(r[:100])

asyncio.run(main())
```

---

## 5. 工具错误处理与重试

### 三级错误处理策略

```mermaid
flowchart TD
    A[工具调用] --> B{执行成功?}
    B -->|是| C[返回结果]
    B -->|否| D{handle_tool_error?}
    D -->|有| E[执行错误处理函数]
    D -->|无| F[抛出原始异常]
    E --> G[返回错误信息给 Agent]
    G --> H{Agent 能否自愈?}
    H -->|是| I[Agent 调整参数重试]
    H -->|否| J[Agent 选择其他工具]
```

### 实现示例

```python
from langchain_core.tools import Tool
import time

def robust_api_call(query: str) -> str:
    """带重试的 API 调用。"""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = call_external_api(query)
            return response
        except ConnectionError:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # 指数退避
                continue
            raise
        except TimeoutError:
            return "错误：API 超时，请稍后重试"

def handle_error(error: Exception) -> str:
    """工具错误处理函数。"""
    if isinstance(error, ConnectionError):
        return "网络连接失败，请检查网络后重试"
    elif isinstance(error, ValueError):
        return f"参数错误: {error}。请检查输入格式"
    else:
        return f"未知错误: {type(error).__name__}: {error}"

robust_tool = Tool(
    name="robust_api",
    description="带错误处理的 API 调用工具",
    func=robust_api_call,
    handle_tool_error=handle_error,
)
```

---

## 6. 工具包（Toolkit）组织模式

工具包将一组相关工具打包，便于按场景加载。

```python
from langchain_core.tools import BaseTool

class DatabaseToolkit:
    """数据库工具包：查询、插入、更新、删除"""

    def __init__(self, connection_string: str):
        self.conn_str = connection_string

    def get_tools(self) -> list[BaseTool]:
        @tool
        def db_query(sql: str) -> str:
            """执行只读 SQL 查询。"""
            # 安全检查：只允许 SELECT
            if not sql.strip().upper().startswith("SELECT"):
                return "错误：只允许查询操作"
            return execute_sql(self.conn_str, sql)

        @tool
        def db_tables() -> str:
            """列出数据库所有表名。"""
            return execute_sql(self.conn_str, "SHOW TABLES")

        @tool
        def db_schema(table_name: str) -> str:
            """查看指定表的结构。"""
            return execute_sql(self.conn_str, f"DESCRIBE {table_name}")

        return [db_query, db_tables, db_schema]

# 使用
toolkit = DatabaseToolkit("postgresql://user:pass@localhost/db")
tools = toolkit.get_tools()
agent = create_agent(llm, tools)
```

---

## 7. 工具选择策略与 Agent 架构

### 工具数量与选择策略

```mermaid
graph LR
    A[工具数量] --> B["1-5个<br/>全部注入"]
    A --> C["6-15个<br/>按场景分组"]
    A --> D["15+个<br/>检索式选择"]

    B --> B1[直接使用]
    C --> C1[动态加载 Toolkit]
    D --> D1[向量检索工具描述]
    D --> D2[RAG 选工具]
```

### 动态工具选择

```python
from langchain_core.vectorstores import FAISS
from langchain_core.embeddings import FakeEmbeddings

# 为每个工具创建描述向量
tool_descriptions = [
    {"name": t.name, "description": t.description}
    for t in all_tools
]

# 构建工具描述索引
texts = [f"{t['name']}: {t['description']}" for t in tool_descriptions]
tool_vectorstore = FAISS.from_texts(texts, FakeEmbeddings(size=10))

def select_tools(query: str, k: int = 3) -> list:
    """根据用户查询动态选择最相关的 k 个工具"""
    docs = tool_vectorstore.similarity_search(query, k=k)
    selected_names = [d.page_content.split(":")[0].strip() for d in docs]
    return [t for t in all_tools if t.name in selected_names]
```

---

## 8. 生产环境工具开发规范

| 规范 | 说明 | 示例 |
|------|------|------|
| 输入校验 | 用 Pydantic 强制类型 | `Field(ge=1, le=100)` |
| 超时控制 | 设置最大执行时间 | `asyncio.wait_for(coro, timeout=30)` |
| 权限隔离 | 不同角色不同工具集 | `if user.role == 'admin': ...` |
| 日志记录 | 记录工具调用与结果 | `logger.info(f"调用 &#123;tool.name&#125;: &#123;result&#125;")` |
| 幂等设计 | 重复调用不产生副作用 | 带去重 key 的写入 |
| 限流 | 防止工具被频繁调用 | `@rate_limit(calls=10, period=60)` |

### 工具调用审计日志

```python
from datetime import datetime
import json

class ToolAuditor:
    """工具调用审计器"""
    
    def __init__(self):
        self.log_file = "tool_audit.log"
    
    def before(self, tool_name: str, args: dict):
        self._log({
            "timestamp": datetime.now().isoformat(),
            "tool": tool_name,
            "args": args,
            "event": "call_start"
        })
    
    def after(self, tool_name: str, result: str, duration: float):
        self._log({
            "timestamp": datetime.now().isoformat(),
            "tool": tool_name,
            "result_preview": result[:200],
            "duration_ms": round(duration * 1000, 2),
            "event": "call_end"
        })
    
    def _log(self, entry: dict):
        with open(self.log_file, "a") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
```

---

## 9. 完整实战：多工具 Agent 系统

```python
from langchain_openai import ChatOpenAI
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import tool
import asyncio

# 工具定义
@tool
def calculate(expression: str) -> str:
    """计算数学表达式。如 '2+3*4' """
    import re
    if not re.match(r'^[\d+\-*/.()\s]+$', expression):
        return "错误：非法字符"
    return str(eval(expression, {"__builtins__": {}}, {}))

@tool
async def fetch_url(url: str) -> str:
    """异步获取网页内容摘要。"""
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            text = await resp.text()
            return text[:2000]

@tool
def format_json(data: str) -> str:
    """格式化 JSON 字符串。"""
    import json
    try:
        obj = json.loads(data)
        return json.dumps(obj, indent=2, ensure_ascii=False)
    except json.JSONDecodeError as e:
        return f"JSON 解析错误: {e}"

# 构建 Agent
tools = [calculate, fetch_url, format_json]
llm = ChatOpenAI(model="gpt-4", temperature=0)
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个多功能助手，可以使用以下工具帮助用户。"),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# 执行
result = executor.invoke({"input": "计算 (15+27)*3 的结果"})
print(result["output"])
```

---

## 10. 总结与最佳实践

| 实践 | 说明 |
|------|------|
| description 要精确 | LLM 靠描述选工具，描述不清=不会用 |
| 参数尽量简单 | 参数越少，LLM 出错概率越低 |
| 优先用异步工具 | 网络/IO 操作用 `async def` |
| 做好错误处理 | `handle_tool_error` 让 Agent 自愈 |
| 工具不要太多 | 单次调用 ≤15 个，多了用检索选 |
| 写好 docstring | 它就是 description 的来源 |
