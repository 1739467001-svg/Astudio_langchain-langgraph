# Agent 工具链编排

> 多个工具如何组合成"工具链"？工具之间如何传递数据？这份指南覆盖工具编排模式。

---

## 一、工具链 vs 单工具

```mermaid
graph TB
    subgraph 单工具 &#123;"单工具调用"&#125;
        U["用户问题"] --> T1["工具: 搜索"]
        T1 --> R1["搜索结果"]
        R1 --> LLM["LLM回答"]
    end

    subgraph 工具链 &#123;"工具链：多工具串联"&#125;
        U2["用户问题"] --> T2["工具1: 搜索"]
        T2 --> R2["搜索结果(含URL)"]
        R2 --> T3["工具2: 浏览网页"]
        T3 --> R3["网页内容"]
        R3 --> T4["工具3: 翻译"]
        T4 --> R4["翻译内容"]
        R4 --> LLM2["LLM综合回答"]
    end

    style 单工具 fill:'#E3F2FD'
    style 工具链 fill:'#C8E6C9'
```

## 二、工具链编排模式

### 2.1 串联模式

```python
from langchain_core.tools import tool

@tool
def search_web(query: str) -> str:
    """搜索互联网。"""
    return "搜索结果: LangChain是一个框架..."

@tool
def extract_urls(text: str) -> str:
    """从文本中提取URL。"""
    import re
    urls = re.findall(r'https?://[^\s]+', text)
    return "\n".join(urls) if urls else "无URL"

@tool
def browse_url(url: str) -> str:
    """获取网页内容。"""
    from langchain_community.document_loaders import WebBaseLoader
    try:
        loader = WebBaseLoader(url)
        docs = loader.load()
        return docs[0].page_content[:1000] if docs else "无内容"
    except:
        return "加载失败"

# 串联工具链
def search_and_browse(query: str) -> str:
    """搜索→提取URL→浏览"""
    # Step 1: 搜索
    search_result = search_web.invoke(query)
    # Step 2: 提取URL
    urls = extract_urls.invoke(search_result)
    # Step 3: 浏览第一个URL
    url = urls.split("\n")[0] if urls != "无URL" else ""
    if url:
        content = browse_url.invoke(url)
        return content
    return search_result
```

### 2.2 条件分支模式

```python
def smart_tool_chain(question: str) -> str:
    """条件工具链：根据问题类型选择工具路径"""
    if "天气" in question:
        # 天气路径
        weather = get_weather.invoke(question)
        return llm.invoke(f"基于天气信息回答：&#123;weather&#125;").content
    elif "计算" in question:
        # 计算路径
        result = calculator.invoke(question)
        return f"计算结果: &#123;result&#125;"
    else:
        # 搜索路径
        search_result = search_web.invoke(question)
        return llm.invoke(f"基于搜索结果回答：&#123;search_result&#125;").content
```

### 2.3 LangGraph 工具编排

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from operator import add

class ToolChainState(TypedDict):
    question: str
    search_result: str
    web_content: str
    answer: str

def search_node(state: ToolChainState) -> dict:
    """搜索节点"""
    result = search_web.invoke(state["question"])
    return &#123;"search_result": result&#125;

def browse_node(state: ToolChainState) -> dict:
    """浏览节点"""
    # 从搜索结果中提取URL
    urls = extract_urls.invoke(state["search_result"])
    if urls and urls != "无URL":
        content = browse_url.invoke(urls.split("\n")[0])
        return &#123;"web_content": content&#125;
    return &#123;"web_content": state["search_result"]&#125;

def answer_node(state: ToolChainState) -> dict:
    """回答节点"""
    from langchain_core.prompts import ChatPromptTemplate
    prompt = ChatPromptTemplate.from_template(
        "基于以下信息回答：\n搜索：&#123;search&#125;\n详情：&#123;web&#125;\n问题：&#123;q&#125;"
    )
    chain = prompt | llm
    answer = chain.invoke(&#123;
        "search": state["search_result"],
        "web": state["web_content"],
        "q": state["question"],
    &#125;).content
    return &#123;"answer": answer&#125;

# 构建图
graph = StateGraph(ToolChainState)
graph.add_node("search", search_node)
graph.add_node("browse", browse_node)
graph.add_node("answer", answer_node)
graph.add_edge(START, "search")
graph.add_edge("search", "browse")
graph.add_edge("browse", "answer")
graph.add_edge("answer", END)

app = graph.compile()
```

## 三、编排模式对比

```mermaid
graph TB
    subgraph 模式 &#123;"三种工具编排模式"&#125;
        S1["串联模式<br/>工具1→工具2→工具3<br/>✅ 简单<br/>❌ 灵活性低"]
        S2["条件分支<br/>根据问题类型路由<br/>✅ 灵活<br/>❌ 需要分类"]
        S3["LangGraph编排<br/>图式工具链<br/>✅ 最灵活<br/>✅ 支持循环/并行"]
    end

    style S1 fill:'#C8E6C9'
    style S3 fill:'#F3E5F5'
```

## 四、工具链设计原则

```mermaid
graph TB
    subgraph 原则 &#123;"工具链设计四原则"&#125;
        P1["1. 数据类型匹配<br/>工具1的输出类型<br/>必须匹配工具2的输入"]
        P2["2. 错误传播<br/>如果工具1失败<br/>工具2不应该继续"]
        P3["3. 可中断<br/>每步可暂停/检查<br/>(Human-in-Loop)"]
        P4["4. 可观测<br/>每步记录输入输出<br/>可追踪可调试"]
    end

    style 原则 fill:'#E3F2FD'
```

## 五、选型建议

| 场景 | 模式 | 原因 |
|------|------|------|
| 固定步骤 | 串联 | 简单直接 |
| 多种问题类型 | 条件分支 | 按类型路由 |
| 需要循环/重试 | LangGraph | 支持复杂控制流 |
| 需要并行 | LangGraph | 支持并行执行 |
| 简单单工具 | 直接调用 | 不需要编排 |
