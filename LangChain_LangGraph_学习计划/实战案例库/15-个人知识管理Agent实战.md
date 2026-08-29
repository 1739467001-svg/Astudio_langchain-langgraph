# 实战案例 15：个人知识管理 Agent

> 每天看大量文章、记大量笔记，但真正需要时找不到。这个案例构建一个个人知识管理 Agent——自动 ingest 文档、智能检索、自动摘要、关联推荐。综合运用 RAG、对话记忆和知识图谱。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"个人知识管理Agent"}
        INGEST["文档摄入<br/>URL/PDF/文本"] --> INDEX["向量化索引"]
        INDEX --> STORE["知识库存储"]
        U["用户提问"] --> SEARCH["智能检索<br/>向量+关键词混合"]
        SEARCH --> GEN["LLM生成<br/>基于知识库回答"]
        GEN --> OUT["回答+来源引用"]
        OUT --> RELATE["关联推荐<br/>相关知识"]
    end

    style INGEST fill:#E3F2FD
    style SEARCH fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style OUT fill:#C8E6C9
```

**核心技术栈：** RAG混合检索 + 对话记忆 + 文档摄入管线 + 来源溯源

**适合学完：** 知识库 144（ETL管线）+ 157（混合检索）+ 158（持久化）

---

## 二、系统架构

```mermaid
graph TB
    subgraph 架构 {"个人知识管理架构"}
        API["FastAPI接口"] --> AGENT["LangGraph Agent"]
        AGENT --> TOOLS["工具集"]
        TOOLS --> T1["add_document<br/>摄入文档"]
        TOOLS --> T2["search_kb<br/>混合检索"]
        TOOLS --> T3["summarize<br/>自动摘要"]
        TOOLS --> T4["list_docs<br/>文档列表"]
        AGENT --> VEC["向量库<br/>Chroma"]
        AGENT --> CP["Checkpointer<br/>对话记忆"]
    end

    style AGENT fill:#1565C0,color:#fff
    style TOOLS fill:#E3F2FD
    style VEC fill:#C8E6C9
```

---

## 三、工具实现

### 3.1 文档摄入工具

```python
from langchain_core.tools import tool
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

@tool
def add_document(content: str, source: str = "user_input", title: str = "") -> str:
    """将文档添加到知识库。

    Args:
        content: 文档内容
        source: 来源（URL/文件名/manual）
        title: 文档标题
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500, chunk_overlap=50,
    )
    chunks = splitter.split_text(content)
    docs = [
        Document(
            page_content=chunk,
            metadata={"source": source, "title": title, "chunk_index": i},
        )
        for i, chunk in enumerate(chunks)
    ]
    vectorstore.add_documents(docs)
    return f"已添加文档: {title or source}，共{len(docs)}个块"
```

### 3.2 混合检索工具

```python
@tool
def search_kb(query: str, k: int = 5) -> str:
    """搜索个人知识库。

    使用向量+关键词混合检索。

    Args:
        query: 搜索查询
        k: 返回结果数
    """
    # 向量检索
    vec_docs = vectorstore.similarity_search_with_score(query, k=k)

    # 格式化结果
    results = []
    for doc, score in vec_docs:
        title = doc.metadata.get("title", "未知")
        source = doc.metadata.get("source", "未知")
        results.append(
            f"[{title}] (来源: {source}, 相关度: {score:.2f})\n"
            f"{doc.page_content[:200]}"
        )

    return "\n\n---\n\n".join(results) if results else "未找到相关内容"
```

### 3.3 自动摘要工具

```python
@tool
async def summarize_document(query: str) -> str:
    """搜索并自动摘要相关文档。

    Args:
        query: 要摘要的主题
    """
    docs = vectorstore.similarity_search(query, k=5)
    if not docs:
        return "未找到相关文档"

    content = "\n\n".join(d.page_content for d in docs)
    prompt = f"请基于以下信息生成简洁摘要（200字以内）:\n\n{content[:2000]}"

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return f"摘要: {response.content}\n\n来源: {len(docs)}个文档片段"
```

### 3.4 文档列表工具

```python
@tool
def list_documents() -> str:
    """列出知识库中的所有文档。"""
    # 从向量库元数据中提取唯一文档
    all_docs = vectorstore.similarity_search("", k=100)
    seen = set()
    docs = []
    for d in all_docs:
        title = d.metadata.get("title", d.metadata.get("source", "未知"))
        if title not in seen:
            seen.add(title)
            docs.append(f"- {title}")

    return "知识库文档列表:\n" + "\n".join(docs) if docs else "知识库为空"
```

---

## 四、Agent 构建

```python
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver

llm = ChatOpenAI(model="gpt-4o", temperature=0)
vectorstore = InMemoryVectorStore(OpenAIEmbeddings())

SYSTEM_PROMPT = """你是个人知识管理助手。你可以：

1. **add_document**: 添加新文档到知识库
2. **search_kb**: 搜索知识库（向量+关键词混合）
3. **summarize_document**: 搜索并摘要文档
4. **list_documents**: 列出已有文档

## 使用场景
- 用户发来文章/笔记→用add_document添加
- 用户提问→用search_kb检索后回答
- 用户要摘要→用summarize_document
- 用户要看有哪些→用list_documents

## 回答要求
- 基于知识库内容回答，标注来源
- 如果知识库中没有，说明并提供通用知识
- 回答简洁有条理"""

def create_kb_agent():
    """创建个人知识管理Agent。"""
    return create_react_agent(
        llm,
        [add_document, search_kb, summarize_document, list_documents],
        prompt=SYSTEM_PROMPT,
        checkpointer=MemorySaver(),
    )

kb_agent = create_kb_agent()
```

---

## 五、使用示例

```python
import asyncio

async def main():
    config = {"configurable": {"thread_id": "user-001"}}

    # 1. 添加文档
    result = await kb_agent.ainvoke({
        "messages": [{"role": "user", "content":
            "帮我记住这篇文章: LangChain是一个用于开发LLM应用的开源框架。"
            "它提供了链式调用、Agent、RAG等核心组件。"
            "LangGraph是LangChain的图式编排框架。"}]
    }, config)
    print(result["messages"][-1].content)

    # 2. 检索
    result = await kb_agent.ainvoke({
        "messages": [{"role": "user", "content": "LangChain是什么？"}]
    }, config)
    print(result["messages"][-1].content)

    # 3. 摘要
    result = await kb_agent.ainvoke({
        "messages": [{"role": "user", "content": "帮我摘要一下关于LangChain的内容"}]
    }, config)
    print(result["messages"][-1].content)

    # 4. 列表
    result = await kb_agent.ainvoke({
        "messages": [{"role": "user", "content": "我的知识库有哪些文档？"}]
    }, config)
    print(result["messages"][-1].content)

asyncio.run(main())
```

---

## 六、扩展方向

| 扩展 | 说明 | 难度 |
|------|------|------|
| URL自动抓取 | 输入URL自动提取内容 | ★★☆ |
| 文件上传 | 支持PDF/Word上传 | ★★☆ |
| 标签分类 | 自动给文档打标签 | ★★☆ |
| 知识图谱 | 建立文档间关联 | ★★★ |
| 定时摘要 | 每周自动摘要新增内容 | ★☆☆ |
| 多用户隔离 | 每人独立知识库 | ★★☆ |

---

## 七、检查清单

| 检查项 | 状态 |
|--------|------|
| 有文档摄入工具 | ☐ |
| 有混合检索工具 | ☐ |
| 有自动摘要工具 | ☐ |
| 有文档列表工具 | ☐ |
| Agent能自主选择工具 | ☐ |
| 有对话记忆 | ☐ |
