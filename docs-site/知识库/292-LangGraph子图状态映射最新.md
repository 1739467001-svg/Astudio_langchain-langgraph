# LangGraph 子图状态映射最新

> 知识库 100 仅 148 行、知识库 152 有深度。这篇整合为最新——子图创建、状态映射和嵌套组合。

---

## 一、子图架构

```mermaid
graph TB
    subgraph 主图 &#123;"主图"&#125;
        P["准备"] --> SUB["子图节点<br/>(编译的StateGraph)"]
        SUB --> R["报告"]
    end

    subgraph 子图内部 &#123;"子图内部"&#125;
        S1["子节点1"] --> S2["子节点2"]
    end

    SUB -.->|内部执行| 子图内部

    style SUB fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
```

---

## 二、实现

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class ChildState(TypedDict):
    query: str
    results: Annotated[list[str], add]
    summary: str

class MainState(TypedDict):
    messages: Annotated[list, add_messages]
    task: str
    child_result: str

class SubgraphBuilder:
    """子图构建器。"""

    @staticmethod
    def build_rag_subgraph(vectorstore, llm):
        """构建RAG子图（可复用）。"""
        async def retrieve(state: ChildState) -> dict:
            docs = await vectorstore.asimilarity_search(state["query"], k=3)
            return &#123;"results": [d.page_content[:200] for d in docs]&#125;

        async def generate(state: ChildState) -> dict:
            from langchain_core.messages import HumanMessage
            context = "\n".join(state["results"])
            resp = await llm.ainvoke([HumanMessage(content=f"基于:\n&#123;context&#125;\n\n问题: &#123;state['query']&#125;")])
            return &#123;"summary": resp.content&#125;

        graph = StateGraph(ChildState)
        graph.add_node("retrieve", retrieve)
        graph.add_node("generate", generate)
        graph.add_edge(START, "retrieve")
        graph.add_edge("retrieve", "generate")
        graph.add_edge("generate", END)
        return graph.compile()

    @staticmethod
    def build_approval_subgraph():
        """构建审批子图。"""
        from langgraph.types import interrupt

        class ApprovalState(TypedDict):
            content: str
            approved: bool

        async def request_approval(state: ApprovalState) -> dict:
            approval = interrupt(&#123;"content": state["content"], "question": "批准?"&#125;)
            return &#123;"approved": approval.get("approved", False)&#125;

        graph = StateGraph(ApprovalState)
        graph.add_node("approve", request_approval)
        graph.add_edge(START, "approve")
        graph.add_edge("approve", END)
        return graph.compile(checkpointer=MemorySaver())


class StateMapper:
    """状态映射器——主图与子图的State转换。"""

    @staticmethod
    def main_to_child(main_state: MainState) -> ChildState:
        """主图→子图：提取子图需要的字段。"""
        return &#123;
            "query": main_state.get("task", ""),
            "results": [],
            "summary": "",
        &#125;

    @staticmethod
    def child_to_main(child_result: dict) -> dict:
        """子图→主图：提取主图需要的字段。"""
        return &#123;"child_result": child_result.get("summary", "")&#125;
```

---

## 三、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 功能模块拆子图 | 可复用 | ★★★ |
| 子图State独立 | 不共享全部字段 | ★★★ |
| 手动映射字段 | 主子图State不同 | ★★★ |
| 子图可独立测试 | 不需启动整个图 | ★★☆ |

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有子图构建器 | ☐ |
| 有状态映射器 | ☐ |
