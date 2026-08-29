# GraphRAG 知识图谱增强最新

> 知识库 36 有 266 行、知识库 135 讲了图谱构建、知识库 196 讲了融合。这篇整合为 GraphRAG 最新实践——从图谱构建到混合检索到查询路由。

---

## 一、GraphRAG 完整流程

```mermaid
graph TB
    subgraph 离线 {"离线建图"}
        D1["文档"] --> EXTRACT["实体抽取"]
        EXTRACT --> REL["关系抽取"]
        REL --> STORE["存入图库"]
        STORE --> VEC["同时建向量索引"]
    end

    subgraph 在线 {"在线查询"}
        Q["查询"] --> ROUTE{"含关系词?"}
        ROUTE -->|是| GRAPH["图谱查询"]
        ROUTE -->|否| VEC_SEARCH["向量检索"]
        GRAPH & VEC_SEARCH --> FUSE["融合"]
        FUSE --> LLM["生成"]
    end

    style ROUTE fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style LLM fill:#C8E6C9
```

---

## 二、实体关系抽取

```python
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage
import json, re

EXTRACT_PROMPT = """从以下文本中提取实体和关系。

文本:
{text}

输出JSON:
```json
{{
  "entities": [{{"name": "...", "type": "person/org/concept", "description": "..."}}],
  "relations": [{{"source": "...", "target": "...", "relation": "...", "description": "..."}}]
}}
```"""

async def extract_graph_data(llm: BaseChatModel, text: str) -> dict:
    """LLM抽取实体和关系。"""
    prompt = EXTRACT_PROMPT.format(text=text[:1500])
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\{.*\}', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"entities": [], "relations": []}
```

---

## 三、混合查询

```python
class GraphRAGQuery:
    """GraphRAG混合查询。"""

    def __init__(self, graph_store, vectorstore, llm):
        self.graph = graph_store
        self.vector = vectorstore
        self.llm = llm

    async def query(self, question: str) -> str:
        """混合查询。"""
        # 1. 判断查询类型
        has_relation = any(w in question for w in ["的同事", "的关系", "属于", "管理"])

        results = []

        # 2. 向量检索
        vec_docs = await self.vector.asimilarity_search(question, k=3)
        results.extend([d.page_content[:200] for d in vec_docs])

        # 3. 图谱查询（如有关系词）
        if has_relation:
            graph_results = self._query_graph(question)
            results.extend(graph_results)

        # 4. 生成
        context = "\n".join(results[:6])
        from langchain_core.messages import HumanMessage
        response = await self.llm.ainvoke([HumanMessage(
            content=f"基于以下信息回答:\n{context[:2000]}\n\n问题: {question}"
        )])
        return response.content

    def _query_graph(self, question: str) -> list[str]:
        """图谱查询。"""
        # 简化：返回实体关系
        return [f"[图谱] {question}的关联信息"]
```

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 实体名标准化 | 同义合并 | ★★★ |
| 向量+图谱混合 | 语义+关系互补 | ★★★ |
| 按查询特征路由 | 关系查询走图谱 | ★★☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有实体抽取 | ☐ |
| 有混合查询 | ☐ |
