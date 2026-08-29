# Web 搜索与浏览 Agent

> 让 Agent 能搜索互联网和浏览网页——从"只知道训练数据"到"知道一切最新信息"。

---

## 一、Web 搜索 Agent 的价值

```mermaid
graph TB
    subgraph 无搜索能力 &#123;"LLM 无搜索能力"&#125;
        U["用户: '今天的新闻是什么？'"]
        U --> LLM1["LLM: '我的训练数据截止到...'"]
        Note1["❌ 不知道实时信息<br/>❌ 无法验证最新事实"]
    end

    subgraph 有搜索能力 &#123;"Web 搜索 Agent"&#125;
        U2["用户: '今天的新闻是什么？'"]
        U2 --> SEARCH["搜索互联网"]
        SEARCH --> RESULTS["获取最新结果"]
        RESULTS --> LLM2["LLM基于搜索结果回答"]
        Note2["✅ 实时信息<br/>✅ 可引用来源"]
    end

    style 无搜索能力 fill:#FFCDD2
    style 有搜索能力 fill:#C8E6C9
```

## 二、搜索工具选择

### 2.1 工具对比

| 工具 | 安装 | 免费 | 特点 |
|------|------|------|------|
| DuckDuckGoSearchRun | `pip install duckduckgo-search` | ✅ | 免费，无需 API Key |
| TavilySearchResults | `pip install langchain-tavily` | 有免费额度 | AI 优化结果，质量高 |
| BraveSearch | `pip install langchain-community` | 有免费额度 | 隐私友好 |
| SerpAPI | `pip install google-search-results` | 付费 | Google 搜索结果 |

### 2.2 使用方式

```python
# 方式1: DuckDuckGo（免费，推荐学习用）
from langchain_community.tools import DuckDuckGoSearchRun
search = DuckDuckGoSearchRun()
result = search.invoke("LangChain 教程 2025")

# 方式2: Tavily（AI优化，推荐生产用）
from langchain_tavily import TavilySearch
# 需要设置 TAVILY_API_KEY
tavily = TavilySearch(max_results=3)
result = tavily.invoke("最新的 AI 新闻")

# 方式3: 直接用requests调搜索API
import requests
def custom_search(query: str) -> str:
    """自定义搜索实现"""
    # 可以接入任何搜索API
    response = requests.get(f"https://api.duckduckgo.com/?q=&#123;query&#125;&format=json")
    return response.json().get("AbstractText", "无结果")
```

## 三、构建搜索 Agent

```python
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# 定义搜索工具
@tool
def web_search(query: str) -> str:
    """搜索互联网获取最新信息。当用户询问新闻、天气、实时数据或
    你不确定的最新信息时使用此工具。

    Args:
        query: 搜索关键词
    """
    from langchain_community.tools import DuckDuckGoSearchRun
    return DuckDuckGoSearchRun().invoke(query)

@tool
def summarize_url(url: str) -> str:
    """获取并总结网页内容。当需要深入了解某个网页的内容时使用。

    Args:
        url: 网页URL
    """
    from langchain_community.document_loaders import WebBaseLoader
    try:
        loader = WebBaseLoader(url)
        docs = loader.load()
        if docs:
            # 简单截取前1000字
            return docs[0].page_content[:1000]
        return "无法加载网页内容"
    except Exception as e:
        return f"加载失败: &#123;e&#125;"

# 创建Agent
tools = [web_search, summarize_url]

prompt = ChatPromptTemplate.from_messages([
    ("system", """你是一个能搜索互联网的智能助手。
    你可以使用web_search工具搜索最新信息，使用summarize_url工具获取网页详情。
    回答时标注信息来源。"""),
    ("human", "&#123;input&#125;"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True, max_iterations=5)

# 使用
result = executor.invoke(&#123;"input": "2025年最热门的AI技术是什么？"&#125;)
print(result["output"])
```

## 四、网页浏览与内容提取

```python
from langchain_community.document_loaders import WebBaseLoader

def browse_and_extract(url: str) -> str:
    """加载网页并提取正文内容"""
    loader = WebBaseLoader(url)
    docs = loader.load()
    return docs[0].page_content if docs else ""

# 批量加载多个网页
def browse_multiple(urls: list[str]) -> list[str]:
    loader = WebBaseLoader(urls)
    docs = loader.load()
    return [d.page_content[:500] for d in docs]
```

## 五、LangGraph 搜索工作流

```mermaid
graph TB
    U["用户问题"] --> SEARCH["搜索节点<br/>调用搜索工具"]
    SEARCH --> BROWSE&#123;"需要深入?"&#125;
    BROWSE -->|"是"| READ["浏览网页<br/>获取详细内容"]
    BROWSE -->|"否"| GEN["生成回答"]
    READ --> GEN
    GEN --> OUT["输出回答+来源"]
```

```python
from typing import TypedDict, Annotated
from operator import add
from langchain_core.messages import AnyMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent

# 最简方案：用预构建的ReAct Agent
search_agent = create_react_agent(llm, [web_search, summarize_url])
result = search_agent.invoke(&#123;"messages": [HumanMessage(content="最新AI新闻")]&#125;)
```

## 六、搜索结果质量优化

```python
@tool
def multi_query_search(question: str) -> str:
    """多角度搜索，合并结果。当单一搜索结果不够全面时使用。

    Args:
        question: 用户问题
    """
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    from langchain_community.tools import DuckDuckGoSearchRun

    search = DuckDuckGoSearchRun()

    # 用LLM生成多个搜索变体
    rewrite_prompt = ChatPromptTemplate.from_template(
        "将问题改写为3个搜索查询变体，每行一个：&#123;question&#125;"
    )
    queries_text = (rewrite_prompt | llm | StrOutputParser()).invoke(&#123;"question": question&#125;)
    queries = [q.strip() for q in queries_text.split("\n") if q.strip()]

    # 分别搜索
    results = []
    seen = set()
    for q in queries[:3]:
        result = search.invoke(q)
        if result not in seen:
            seen.add(result)
            results.append(f"[查询: &#123;q&#125;]\n&#123;result[:300]&#125;")

    return "\n\n".join(results) if results else "无搜索结果"
```

## 七、选型决策

| 场景 | 推荐方案 | 原因 |
|------|---------|------|
| 学习/原型 | DuckDuckGo + Agent | 免费，零配置 |
| 生产环境 | Tavily + Agent | 质量高，AI优化 |
| 需要网页详情 | DuckDuckGo + WebBaseLoader | 先搜索再深入 |
| 批量研究 | 多查询搜索 + 批量浏览 | 全面覆盖 |
| 实时监控 | 定时搜索 + 摘要 | 自动追踪 |
