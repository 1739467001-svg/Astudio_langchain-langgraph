# LangGraph 子图模式与状态隔离

> 复杂工作流不应该是一个巨大的图。把功能模块拆成子图——每个子图独立管理状态、可单独测试、可复用。这份指南覆盖子图的创建、状态映射、嵌套组合和常见模式。

---

## 一、为什么需要子图

```mermaid
graph TB
    subgraph 问题 &#123;"单一大图的问题"&#125;
        P1["100+节点的大图<br/>难以理解"]
        P2["状态字段混杂<br/>所有节点共享所有字段"]
        P3["无法复用<br/>功能模块不能独立使用"]
        P4["测试困难<br/>要测试整个图"]
    end

    subgraph 解决 &#123;"子图模式"&#125;
        S1["功能拆分为子图<br/>各管各的"]
        S2["状态隔离<br/>子图有独立State"]
        S3["可复用<br/>子图可被多个图引用"]
        S4["可独立测试<br/>子图单独测试"]
    end

    style 问题 fill:#FFCDD2
    style 解决 fill:#C8E6C9
```

---

## 二、子图核心概念

```mermaid
graph TB
    subgraph 主图 &#123;"主图"&#125;
        START["START"] --> NODE_A["节点A"]
        NODE_A --> SUBGRAPH["子图节点<br/>(编译的StateGraph)"]
        SUBGRAPH --> NODE_B["节点B"]
        NODE_B --> END["END"]
    end

    subgraph 子图内部 &#123;"子图内部"&#125;
        SUB_START["子START"] --> S1["子节点1"]
        S1 --> S2["子节点2"]
        S2 --> SUB_END["子END"]
    end

    SUBGRAPH -.->|"内部执行"| 子图内部

    style SUBGRAPH fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style 子图内部 fill:#E3F2FD
```

---

## 三、基本用法

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

# === 定义子图 ===
class ResearchState(TypedDict):
    query: str
    findings: list[str]
    summary: str

async def search_node(state: ResearchState) -> dict:
    return &#123;"findings": [f"关于&#123;state['query']&#125;的发现"]&#125;

async def summarize_node(state: ResearchState) -> dict:
    findings = "\n".join(state["findings"])
    return &#123;"summary": f"总结: &#123;findings[:100]&#125;"&#125;

# 构建子图
research_subgraph = StateGraph(ResearchState)
research_subgraph.add_node("search", search_node)
research_subgraph.add_node("summarize", summarize_node)
research_subgraph.add_edge(START, "search")
research_subgraph.add_edge("search", "summarize")
research_subgraph.add_edge("summarize", END)
research_compiled = research_subgraph.compile()

# === 定义主图 ===
class MainState(TypedDict):
    messages: Annotated[list, add_messages]
    topic: str
    research_summary: str
    final_report: str

async def prepare_node(state: MainState) -> dict:
    """准备节点：从消息提取主题。"""
    last_msg = state["messages"][-1].content
    return &#123;"topic": last_msg&#125;

async def research_node(state: MainState) -> dict:
    """研究节点：调用子图。"""
    # 调用子图，传入子图需要的State
    result = await research_compiled.ainvoke(&#123;
        "query": state["topic"],
        "findings": [],
        "summary": "",
    &#125;)
    return &#123;"research_summary": result["summary"]&#125;

async def report_node(state: MainState) -> dict:
    """报告节点：基于研究结果写报告。"""
    return &#123;"final_report": f"报告: &#123;state['research_summary']&#125;"&#125;

# 构建主图
main_graph = StateGraph(MainState)
main_graph.add_node("prepare", prepare_node)
main_graph.add_node("research", research_node)
main_graph.add_node("report", report_node)
main_graph.add_edge(START, "prepare")
main_graph.add_edge("prepare", "research")
main_graph.add_edge("research", "report")
main_graph.add_edge("report", END)

main_app = main_graph.compile()
```

---

## 四、状态映射

```mermaid
graph TB
    subgraph 映射 &#123;"主图State → 子图State映射"&#125;
        MAIN["主图State<br/>&#123;messages, topic, research_summary, final_report&#125;"]
        MAIN -->|"提取query"| SUB["子图State<br/>&#123;query, findings, summary&#125;"]
        SUB -->|"取回summary"| MAIN

        NOTE["主图和子图State结构不同<br/>需要手动映射字段"]
    end

    style 映射 fill:#E3F2FD
    style NOTE fill:#FFF9C4
```

```python
async def research_with_mapping(state: MainState) -> dict:
    """带状态映射的子图调用。

    主图State和子图State结构不同，
    需要手动做字段映射。
    """
    # 主图→子图：映射字段
    subgraph_input = &#123;
        "query": state["topic"],  # 主图的topic→子图的query
        "findings": [],
        "summary": "",
    &#125;

    # 调用子图
    result = await research_compiled.ainvoke(subgraph_input)

    # 子图→主图：映射回字段
    return &#123;
        "research_summary": result["summary"],  # 子图的summary→主图的research_summary
    &#125;
```

---

## 五、常见子图模式

### 5.1 RAG 子图

```python
# RAG子图：可复用的检索增强生成模块
class RAGState(TypedDict):
    question: str
    retrieved_docs: list[str]
    answer: str

async def retrieve_node(state: RAGState) -> dict:
    # 检索逻辑
    return &#123;"retrieved_docs": ["doc1", "doc2"]&#125;

async def generate_node(state: RAGState) -> dict:
    # 生成逻辑
    docs = "\n".join(state["retrieved_docs"])
    return &#123;"answer": f"基于&#123;docs&#125;的回答"&#125;

def build_rag_subgraph(vectorstore):
    graph = StateGraph(RAGState)
    graph.add_node("retrieve", retrieve_node)
    graph.add_node("generate", generate_node)
    graph.add_edge(START, "retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", END)
    return graph.compile()

# 这个RAG子图可以被任何主图复用
```

### 5.2 Agent 子图

```python
# Agent子图：可复用的工具调用Agent
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI

def build_agent_subgraph(tools: list):
    """创建可复用的Agent子图。"""
    return create_react_agent(
        ChatOpenAI(model="gpt-4o", streaming=True),
        tools,
    )

# 在主图中使用
research_agent = build_agent_subgraph([search_tool])
analysis_agent = build_agent_subgraph([analyze_tool, calculate_tool])
```

### 5.3 审批子图

```python
from langgraph.types import interrupt

class ApprovalState(TypedDict):
    content: str
    approved: bool
    feedback: str

async def request_approval(state: ApprovalState) -> dict:
    """请求人工审批。"""
    approval = interrupt(&#123;
        "type": "approval",
        "content": state["content"],
    &#125;)
    return &#123;
        "approved": approval.get("approved", False),
        "feedback": approval.get("feedback", ""),
    &#125;

def build_approval_subgraph():
    graph = StateGraph(ApprovalState)
    graph.add_node("approve", request_approval)
    graph.add_edge(START, "approve")
    graph.add_edge("approve", END)
    return graph.compile(checkpointer=MemorySaver())
```

---

## 六、子图嵌套

```mermaid
graph TB
    subgraph 主图 &#123;"主图"&#125;
        P1["准备"] --> RAG_SUB["RAG子图"]
        RAG_SUB --> AGENT_SUB["Agent子图"]
        AGENT_SUB --> APPROVAL_SUB["审批子图"]
        APPROVAL_SUB --> P2["报告"]
    end

    style RAG_SUB fill:#E3F2FD
    style AGENT_SUB fill:#FFF3E0
    style APPROVAL_SUB fill:#FFCDD2
```

```python
def build_complex_workflow():
    """多子图嵌套的复杂工作流。"""
    rag_sub = build_rag_subgraph(vectorstore)
    agent_sub = build_agent_subgraph([search_tool])
    approval_sub = build_approval_subgraph()

    class ComplexState(TypedDict):
        question: str
        rag_answer: str
        agent_answer: str
        approved: bool
        final: str

    async def rag_step(state: ComplexState) -> dict:
        result = await rag_sub.ainvoke(&#123;"question": state["question"], "retrieved_docs": [], "answer": ""&#125;)
        return &#123;"rag_answer": result["answer"]&#125;

    async def agent_step(state: ComplexState) -> dict:
        result = await agent_sub.ainvoke(&#123;"messages": [&#123;"role": "user", "content": state["rag_answer"]&#125;]&#125;)
        last_msg = result["messages"][-1].content
        return &#123;"agent_answer": last_msg&#125;

    async def approval_step(state: ComplexState) -> dict:
        result = await approval_sub.ainvoke(&#123;"content": state["agent_answer"], "approved": False, "feedback": ""&#125;)
        return &#123;"approved": result["approved"]&#125;

    async def final_step(state: ComplexState) -> dict:
        if state["approved"]:
            return &#123;"final": state["agent_answer"]&#125;
        return &#123;"final": "未通过审批"&#125;

    graph = StateGraph(ComplexState)
    graph.add_node("rag", rag_step)
    graph.add_node("agent", agent_step)
    graph.add_node("approval", approval_step)
    graph.add_node("final", final_step)
    graph.add_edge(START, "rag")
    graph.add_edge("rag", "agent")
    graph.add_edge("agent", "approval")
    graph.add_edge("approval", "final")
    graph.add_edge("final", END)

    return graph.compile(checkpointer=MemorySaver())
```

---

## 七、子图测试

```python
import pytest

class TestRAGSubgraph:
    """RAG子图独立测试。"""

    @pytest.mark.asyncio
    async def test_rag_returns_answer(self):
        """测试RAG子图能返回答案。"""
        rag = build_rag_subgraph(mock_vectorstore)
        result = await rag.ainvoke(&#123;
            "question": "测试问题",
            "retrieved_docs": [],
            "answer": "",
        &#125;)
        assert "answer" in result
        assert len(result["answer"]) > 0

    @pytest.mark.asyncio
    async def test_rag_empty_docs(self):
        """测试无检索结果时。"""
        rag = build_rag_subgraph(mock_vectorstore)
        result = await rag.ainvoke(&#123;
            "question": "无结果查询",
            "retrieved_docs": [],
            "answer": "",
        &#125;)
        # 应该有兜底处理
        assert result["answer"]  # 即使无文档也应有回答
```

---

## 八、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 功能模块拆子图 | 检索、生成、审批各自独立 | ★★★ |
| 子图State独立 | 不要共享全部字段 | ★★★ |
| 手动映射字段 | 主子图State结构不同要映射 | ★★★ |
| 子图可独立测试 | 不需要启动整个图 | ★★☆ |
| 子图可复用 | 同一子图被多个工作流使用 | ★★☆ |
| 审批子图带checkpointer | interrupt需要检查点 | ★★☆ |

---

## 九、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解子图的概念和优势 | ☐ |
| 能创建和调用子图 | ☐ |
| 能做主子图状态映射 | ☐ |
| 实现了RAG/Agent/审批子图 | ☐ |
| 能多子图嵌套 | ☐ |
| 能独立测试子图 | ☐ |
