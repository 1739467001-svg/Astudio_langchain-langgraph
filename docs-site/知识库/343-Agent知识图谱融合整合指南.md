# Agent 知识图谱融合整合指南

> 6 篇提及。这篇整合为完整指南——从图谱构建到融合检索到冲突解决。

---

## 一、整合架构

```mermaid
graph TB
    subgraph 融合 &#123;"知识图谱融合"&#125;
        BUILD["图谱构建<br/>实体抽取+关系抽取"] --> STORE["存储<br/>图库+向量库"]
        STORE --> QUERY["混合查询<br/>向量+图谱并行"]
        QUERY --> FUSE["结果融合<br/>RRF+冲突解决"]
        FUSE --> GEN["LLM生成<br/>基于融合上下文"]
    end

    style QUERY fill:#FFF9C4
    style GEN fill:#C8E6C9
```

---

## 二、实现

```python
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage
from dataclasses import dataclass, field
import json, re

@dataclass
class Entity:
    name: str
    entity_type: str = "concept"
    description: str = ""

@dataclass
class Relation:
    source: str
    target: str
    relation: str
    description: str = ""

class KnowledgeGraph:
    """简易知识图谱。"""
    def __init__(self):
        self.entities: dict[str, Entity] = &#123;&#125;
        self.relations: list[Relation] = []

    def add_entity(self, entity: Entity):
        self.entities[entity.name] = entity

    def add_relation(self, rel: Relation):
        self.relations.append(rel)

    def get_neighbors(self, entity_name: str, depth: int = 1) -> list[dict]:
        """获取邻居。"""
        neighbors = []
        for rel in self.relations:
            if rel.source == entity_name:
                neighbors.append(&#123;"entity": rel.target, "relation": rel.relation&#125;)
            elif rel.target == entity_name:
                neighbors.append(&#123;"entity": rel.source, "relation": rel.relation&#125;)
        return neighbors


class GraphRAGIntegrator:
    """知识图谱融合整合器。"""

    def __init__(self, llm: BaseChatModel, vectorstore, graph: KnowledgeGraph):
        self.llm = llm
        self.vector = vectorstore
        self.graph = graph

    async def retrieve(self, query: str, k: int = 5) -> dict:
        """混合检索——向量+图谱。"""
        # 1. 向量检索
        vec_docs = await self.vector.asimilarity_search(query, k=k)
        vec_texts = [d.page_content[:200] for d in vec_docs]

        # 2. 图谱查询
        graph_info = ""
        # 从查询中提取实体名
        for entity_name in self.graph.entities:
            if entity_name in query:
                neighbors = self.graph.get_neighbors(entity_name)
                if neighbors:
                    graph_info += f"\n[图谱] &#123;entity_name&#125;: " + ", ".join(
                        f"&#123;n['relation']&#125;→&#123;n['entity']&#125;" for n in neighbors[:3]
                    )

        # 3. 融合
        return &#123;
            "vector_results": vec_texts,
            "graph_info": graph_info,
            "fused_context": "\n".join(vec_texts) + graph_info,
        &#125;

    async def answer(self, query: str) -> str:
        """融合问答。"""
        context = await self.retrieve(query)
        prompt = f"基于以下信息回答:\n&#123;context['fused_context'][:2000]&#125;\n\n问题: &#123;query&#125;"
        response = await self.llm.ainvoke([HumanMessage(content=prompt)])
        return response.content
```

---

## 三、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 向量+图谱并行 | 互补 | ★★★ |
| 图谱关系置信度更高 | 精确 | ★★★ |
| 冲突时图谱优先 | 可靠 | ★★☆ |

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有融合检索器 | ☐ |
| 有图谱查询 | ☐ |
