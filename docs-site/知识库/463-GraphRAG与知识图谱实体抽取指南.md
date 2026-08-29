# GraphRAG 与知识图谱实体抽取指南

> 传统 RAG 只能做"相似文档检索"——问"A 和 B 有什么关系"时无法回答，因为关系信息散落在不同文档中。GraphRAG 把文档构建成知识图谱：实体是节点、关系是边，检索时不只找相似文本，还能沿着关系边"走"到关联信息。本指南详解知识图谱构建、实体关系抽取、图检索策略，以及与向量 RAG 的混合方案。

---

## 1. GraphRAG vs 传统 RAG

### 核心差异

```
传统向量 RAG：
  用户问 "张三和李四是什么关系？"
  → 向量检索 "张三" → 找到含张三的文档
  → 但文档里没提李四 → 无法回答

GraphRAG：
  用户问 "张三和李四是什么关系？"
  → 图谱查询：张三-[同事]->李四
  → 直接返回关系
  → 还能查：张三-[部门]->技术部-[负责人]->李四
```

### 能力对比

| 维度 | 向量 RAG | GraphRAG |
|------|---------|----------|
| 相似检索 | ★★★★★ | ★★★ |
| 关系推理 | ★ | ★★★★★ |
| 多跳查询 | ❌ | ★★★★★ |
| 实体汇总 | ❌ | ★★★★ |
| 构建成本 | 低 | 高 |
| 维护成本 | 低 | 中 |
| 适合 | 事实查询 | 关系推理 |

---

## 2. 知识图谱构建

### 实体关系抽取

```python
from langchain_openai import ChatOpenAI
from dataclasses import dataclass
import json

@dataclass
class EntityExtractor:
    """实体关系抽取器"""

    async def extract_from_text(self, text: str) -> dict:
        """从文本中抽取实体和关系"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""从以下文本中抽取实体和关系，返回 JSON 格式。

文本:
&#123;text&#125;

抽取格式:
&#123;&#123;
  "entities": [
    &#123;&#123;"name": "实体名", "type": "Person/Organization/Location/Concept/Event", "description": "描述"&#125;&#125;
  ],
  "relations": [
    &#123;&#123;"source": "实体A", "target": "实体B", "relation": "关系类型", "description": "关系描述"&#125;&#125;
  ]
&#125;&#125;

常见关系类型：works_for, located_in, created, part_of, manages, collaborates_with, competitor_of, subsidiary_of
只抽取文本中明确提到的事实，不要推测。"""

        response = await llm.ainvoke(prompt)

        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            result = &#123;"entities": [], "relations": []&#125;

        return result

    async def extract_batch(self, documents: list) -> dict:
        """批量抽取"""
        all_entities = []
        all_relations = []

        for doc in documents:
            result = await self.extract_from_text(doc)
            all_entities.extend(result["entities"])
            all_relations.extend(result["relations"])

        # 去重（同名实体合并）
        unique_entities = self._merge_entities(all_entities)
        unique_relations = self._dedupe_relations(all_relations)

        return &#123;
            "entities": unique_entities,
            "relations": unique_relations,
            "stats": &#123;
                "total_entities": len(unique_entities),
                "total_relations": len(unique_relations),
                "entity_types": self._count_types(unique_entities),
                "relation_types": self._count_relation_types(unique_relations),
            &#125;,
        &#125;

    def _merge_entities(self, entities: list) -> list:
        """合并同名实体"""
        merged = &#123;&#125;
        for e in entities:
            name = e["name"]
            if name in merged:
                # 合并描述
                existing_desc = merged[name].get("description", "")
                new_desc = e.get("description", "")
                if new_desc and new_desc not in existing_desc:
                    merged[name]["description"] = existing_desc + " " + new_desc
            else:
                merged[name] = e
        return list(merged.values())

    def _dedupe_relations(self, relations: list) -> list:
        """关系去重"""
        seen = set()
        unique = []
        for r in relations:
            key = (r["source"], r["target"], r["relation"])
            if key not in seen:
                seen.add(key)
                unique.append(r)
        return unique
```

### 图谱存储

```python
@dataclass
class KnowledgeGraph:
    """知识图谱存储（内存版，生产用 Neo4j）"""

    nodes: dict = field(default_factory=dict)  # &#123;name: &#123;type, description&#125;&#125;
    edges: list = field(default_factory=list)    # [&#123;source, target, relation&#125;]

    def build_from_extraction(self, extraction: dict):
        """从抽取结果构建图谱"""
        # 添加节点
        for entity in extraction["entities"]:
            self.nodes[entity["name"]] = &#123;
                "type": entity["type"],
                "description": entity.get("description", ""),
            &#125;

        # 添加边
        for relation in extraction["relations"]:
            # 确保两端节点存在
            if relation["source"] not in self.nodes:
                self.nodes[relation["source"]] = &#123;"type": "Unknown", "description": ""&#125;
            if relation["target"] not in self.nodes:
                self.nodes[relation["target"]] = &#123;"type": "Unknown", "description": ""&#125;

            self.edges.append(relation)

    def find_neighbors(self, entity: str, depth: int = 1) -> list:
        """查找邻居（BFS）"""
        visited = &#123;entity&#125;
        frontier = [entity]
        result = []

        for d in range(depth):
            next_frontier = []
            for node in frontier:
                for edge in self.edges:
                    if edge["source"] == node and edge["target"] not in visited:
                        visited.add(edge["target"])
                        next_frontier.append(edge["target"])
                        result.append(&#123;
                            "entity": edge["target"],
                            "relation": edge["relation"],
                            "from": node,
                            "depth": d + 1,
                        &#125;)
                    elif edge["target"] == node and edge["source"] not in visited:
                        visited.add(edge["source"])
                        next_frontier.append(edge["source"])
                        result.append(&#123;
                            "entity": edge["source"],
                            "relation": edge["relation"],
                            "from": node,
                            "depth": d + 1,
                        &#125;)
            frontier = next_frontier

        return result

    def find_path(self, source: str, target: str, max_depth: int = 5) -> list:
        """查找两实体间路径"""
        if source not in self.nodes or target not in self.nodes:
            return []

        # BFS 找路径
        from collections import deque
        queue = deque([(source, [source])])
        visited = &#123;source&#125;

        while queue:
            current, path = queue.popleft()
            if len(path) > max_depth:
                continue

            if current == target:
                return path

            for edge in self.edges:
                neighbor = None
                if edge["source"] == current:
                    neighbor = edge["target"]
                elif edge["target"] == current:
                    neighbor = edge["source"]

                if neighbor and neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, path + [neighbor]))

        return []

    def get_subgraph(self, entity: str, depth: int = 2) -> dict:
        """获取子图"""
        neighbors = self.find_neighbors(entity, depth)
        subgraph_nodes = &#123;entity: self.nodes.get(entity, &#123;&#125;)&#125;
        subgraph_edges = []

        for n in neighbors:
            subgraph_nodes[n["entity"]] = self.nodes.get(n["entity"], &#123;&#125;)
            subgraph_edges.append(&#123;
                "source": n["from"],
                "target": n["entity"],
                "relation": n["relation"],
            &#125;)

        return &#123;"nodes": subgraph_nodes, "edges": subgraph_edges&#125;
```

---

## 3. Neo4j 集成

### Cypher 查询

```python
from neo4j import AsyncGraphDatabase

@dataclass
class Neo4jGraphStore:
    """Neo4j 图存储"""

    def __init__(self, uri: str, user: str, password: str):
        self.driver = AsyncGraphDatabase.driver(uri, auth=(user, password))

    async def create_entity(self, name: str, entity_type: str, description: str = ""):
        """创建实体节点"""
        async with self.driver.session() as session:
            await session.run(
                "MERGE (n:Entity &#123;name: $name&#125;) "
                "SET n.type = $type, n.description = $desc",
                name=name, type=entity_type, desc=description,
            )

    async def create_relation(self, source: str, target: str, relation: str):
        """创建关系"""
        async with self.driver.session() as session:
            await session.run(
                "MATCH (a:Entity &#123;name: $source&#125;), (b:Entity &#123;name: $target&#125;) "
                "MERGE (a)-[r:RELATION &#123;type: $rel&#125;]->(b)",
                source=source, target=target, rel=relation,
            )

    async def find_relations(self, entity: str, depth: int = 2) -> list:
        """查找关系（多跳）"""
        async with self.driver.session() as session:
            result = await session.run(
                f"MATCH (n:Entity &#123;&#123;name: $name&#125;&#125;)-[r*1..&#123;depth&#125;]-(m:Entity) "
                "RETURN m.name AS entity, m.type AS type, "
                "relationships(r) AS rels",
                name=entity,
            )
            return [record.data() async for record in result]

    async def find_shortest_path(self, source: str, target: str) -> list:
        """最短路径"""
        async with self.driver.session() as session:
            result = await session.run(
                "MATCH p = shortestPath((a:Entity &#123;name: $source&#125;)-[*..6]-(b:Entity &#123;name: $target&#125;)) "
                "RETURN [node in nodes(p) | node.name] AS path",
                source=source, target=target,
            )
            records = [r async for r in result]
            return records[0]["path"] if records else []
```

---

## 4. GraphRAG 检索

### 混合检索

```python
@dataclass
class GraphRAGRetriever:
    """GraphRAG：向量检索 + 图谱检索混合"""

    def __init__(self, vectorstore, graph: KnowledgeGraph):
        self.vectorstore = vectorstore
        self.graph = graph

    async def retrieve(self, query: str, top_k: int = 5) -> dict:
        """混合检索"""
        # 1. 识别查询中的实体
        entities = await self._extract_query_entities(query)

        # 2. 向量检索（语义相似）
        vector_results = await self.vectorstore.asimilarity_search(query, k=top_k)

        # 3. 图谱检索（关系推理）
        graph_results = []
        for entity in entities:
            neighbors = self.graph.find_neighbors(entity, depth=2)
            graph_results.extend(neighbors)

        # 4. 路径查找（多跳）
        paths = []
        if len(entities) >= 2:
            path = self.graph.find_path(entities[0], entities[1])
            if path:
                paths.append(&#123;"path": path, "entities": entities[:2]&#125;)

        # 5. 子图提取
        subgraphs = []
        for entity in entities[:3]:
            subgraph = self.graph.get_subgraph(entity, depth=1)
            if subgraph["edges"]:
                subgraphs.append(subgraph)

        return &#123;
            "query": query,
            "entities_found": entities,
            "vector_results": [&#123;"content": r.page_content[:200]&#125; for r in vector_results],
            "graph_neighbors": graph_results[:10],
            "paths": paths,
            "subgraphs": subgraphs,
            "combined_context": self._build_context(vector_results, graph_results, paths),
        &#125;

    async def _extract_query_entities(self, query: str) -> list:
        """从查询中识别已知实体"""
        entities = []
        for name in self.graph.nodes:
            if name in query:
                entities.append(name)
        return entities

    def _build_context(self, vector_results, graph_results, paths) -> str:
        """构建混合上下文"""
        parts = []

        if vector_results:
            parts.append("相关文档:")
            for r in vector_results[:3]:
                parts.append(f"  - &#123;r.page_content[:150]&#125;")

        if graph_results:
            parts.append("\n图谱关系:")
            for g in graph_results[:5]:
                parts.append(f"  - &#123;g['from']&#125; -[&#123;g['relation']&#125;]-> &#123;g['entity']&#125;")

        if paths:
            parts.append("\n推理路径:")
            for p in paths:
                parts.append(f"  - &#123;' → '.join(p['path'])&#125;")

        return "\n".join(parts)
```

---

## 5. 图谱构建管线

```python
@dataclass
class GraphBuildPipeline:
    """知识图谱构建管线"""

    async def build_from_documents(self, documents: list) -> KnowledgeGraph:
        """从文档构建知识图谱"""
        # 1. 实体关系抽取
        extractor = EntityExtractor()
        extraction = await extractor.extract_batch(documents)

        # 2. 构建图谱
        graph = KnowledgeGraph()
        graph.build_from_extraction(extraction)

        # 3. 增量更新（已有图谱时）
        # graph.merge(new_extraction)

        return graph

    async def build_from_api(self, data_source: str) -> KnowledgeGraph:
        """从 API 数据构建"""
        # 采集文档
        docs = await collect_documents(data_source)
        return await self.build_from_documents(docs)
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解 GraphRAG vs 向量 RAG | ☐ |
| 实现了实体关系抽取 | ☐ |
| 实现了知识图谱存储 | ☐ |
| 能做邻居查找 | ☐ |
| 能做多跳路径查找 | ☐ |
| 实现了混合检索 | ☐ |
| 能构建图谱管线 | ☐ |
| 了解 Neo4j 集成 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 26 | 知识图谱 RAG 图解 | GraphRAG 基础 |
| 36 | GraphRAG 知识图谱增强 | GraphRAG |
| 135 | 知识图谱构建与 GraphRAG 实践 | 图谱构建 |
| 164 | 知识图谱融合 | 图谱融合 |
| 196 | RAG 知识图谱融合深度 | 融合深度 |
| 217 | GraphRAG 知识图谱增强 | GraphRAG |
| 249 | GraphRAG 图解 | 图解 |
| 292 | 知识图谱深度 | 深度 |
| 313 | 知识图谱融合 | 融合 |
| 430 | Agentic RAG | 自适应检索 |
