# 知识图谱构建与 GraphRAG 实践

> 向量检索擅长"找相似"，但不懂"关系"。当用户问"张三的同事是谁"，向量库无能为力——这需要实体间的关系图谱。GraphRAG 把知识图谱和向量检索结合，既懂语义相似又懂实体关系。这份指南从零构建知识图谱并实现 GraphRAG。

---

## 一、GraphRAG vs 纯向量 RAG

```mermaid
graph TB
    subgraph 向量RAG &#123;"纯向量RAG"&#125;
        VQ["查询: '张三的同事'"] --> VEC["向量检索<br/>找语义相似的文档"]
        VEC --> VR["返回: 张三的简介<br/>❌ 没有同事关系"]
    end

    subgraph GraphRAG &#123;"GraphRAG"&#125;
        GQ["查询: '张三的同事'"] --> GRAPH["图谱查询<br/>找张三→works_with→?"]
        GRAPH --> GR["返回: 李四、王五<br/>✅ 精确的关系信息"]
        GQ --> VEC2["向量检索补充<br/>语义相关文档"]
        GR & VEC2 --> MERGE["合并: 关系+语义"]
    end

    style 向量RAG fill:#FFCDD2
    style GraphRAG fill:#C8E6C9
```

---

## 二、知识图谱基本概念

```mermaid
graph TB
    subgraph 图谱 &#123;"知识图谱三要素"&#125;
        E["Entity 实体<br/>节点<br/>如: 张三、AI部"]
        R["Relation 关系<br/>边<br/>如: works_in"]
        A["Attribute 属性<br/>如: age=30"]
    end

    subgraph 示例 &#123;"图表示例"&#125;
        ZS["张三<br/>&#123;age:30,role:工程师&#125;"] -->|"works_in"| AI["AI部"]
        LS["李四"] -->|"works_in"| AI
        ZS -->|"colleague_of"| LS
        AI -->|"part_of"| COMPANY["公司"]
    end

    style 图谱 fill:#E3F2FD
    style 示例 fill:#C8E6C9
```

---

## 三、图谱构建流程

```mermaid
graph TB
    subgraph 构建 &#123;"知识图谱构建流程"&#125;
        D1["原始文档"] --> EXTRACT["实体抽取<br/>LLM提取实体"]
        EXTRACT --> REL["关系抽取<br/>LLM提取实体间关系"]
        REL --> CLEAN["清洗去重<br/>合并同义实体"]
        CLEAN --> STORE["存储<br/>图数据库/内存图"]
        STORE --> INDEX["索引<br/>向量化实体描述<br/>用于检索"]
    end

    subgraph 查询 &#123;"查询流程"&#125;
        Q["用户问题"] --> QENT["识别问题中的实体"]
        QENT --> QSEARCH["图谱检索<br/>找相关实体和关系"]
        QSEARCH --> QVEC["向量检索<br/>补充语义信息"]
        QSEARCH & QVEC --> QMERGE["合并结果"]
        QMERGE --> GEN["LLM生成回答"]
    end

    style 构建 fill:#E3F2FD
    style 查询 fill:#FFF3E0
    style EXTRACT fill:#FFF9C4
```

---

## 四、实体与关系抽取

```python
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage
import json, re
from dataclasses import dataclass, field

@dataclass
class Entity:
    """实体"""
    name: str
    type: str          # person/organization/concept
    description: str = ""
    attributes: dict = field(default_factory=dict)

@dataclass
class Relation:
    """关系"""
    source: str       # 源实体名
    target: str       # 目标实体名
    relation: str     # 关系类型
    description: str = ""

EXTRACT_PROMPT = """从以下文本中提取实体和关系。

文本:
&#123;text&#125;

输出JSON格式:
```json
&#123;&#123;
  "entities": [
    &#123;&#123;"name": "实体名", "type": "person/organization/concept", "description": "描述"&#125;&#125;
  ],
  "relations": [
    &#123;&#123;"source": "源实体", "target": "目标实体", "relation": "关系类型", "description": "描述"&#125;&#125;
  ]
&#125;&#125;
```

注意：
1. 实体名要标准化（如"张三"而非"小张"）
2. 关系类型要简洁（如works_in, colleague_of, manages）
3. 只提取文本中明确提及的实体和关系"""

async def extract_entities_and_relations(
    llm: BaseChatModel,
    text: str,
) -> tuple[list[Entity], list[Relation]]:
    """用LLM从文本中提取实体和关系。"""
    prompt = EXTRACT_PROMPT.format(text=text[:2000])
    response = await llm.ainvoke([HumanMessage(content=prompt)])

    # 解析JSON
    json_match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if not json_match:
        return [], []

    data = json.loads(json_match.group())

    entities = [
        Entity(
            name=e["name"],
            type=e.get("type", "concept"),
            description=e.get("description", ""),
        )
        for e in data.get("entities", [])
    ]

    relations = [
        Relation(
            source=r["source"],
            target=r["target"],
            relation=r["relation"],
            description=r.get("description", ""),
        )
        for r in data.get("relations", [])
    ]

    return entities, relations
```

---

## 五、图谱存储与查询

```python
from collections import defaultdict

class KnowledgeGraph:
    """内存知识图谱。

    生产环境可用Neo4j/NebulaGraph等图数据库。
    """

    def __init__(self):
        self.entities: dict[str, Entity] = &#123;&#125;
        # 邻接表: &#123;entity_name: [(relation, target_name)]&#125;
        self.adjacency: dict[str, list[tuple[str, str]]] = defaultdict(list)
        self.relation_descriptions: dict[tuple[str, str, str], str] = &#123;&#125;

    def add_entity(self, entity: Entity):
        """添加实体"""
        if entity.name in self.entities:
            # 合并属性
            existing = self.entities[entity.name]
            existing.attributes.update(entity.attributes)
            if entity.description and not existing.description:
                existing.description = entity.description
        else:
            self.entities[entity.name] = entity

    def add_relation(self, relation: Relation):
        """添加关系"""
        # 确保两端实体存在
        if relation.source not in self.entities:
            self.add_entity(Entity(name=relation.source, type="unknown"))
        if relation.target not in self.entities:
            self.add_entity(Entity(name=relation.target, type="unknown"))

        self.adjacency[relation.source].append((relation.relation, relation.target))
        self.relation_descriptions[
            (relation.source, relation.relation, relation.target)
        ] = relation.description

    def get_neighbors(
        self,
        entity_name: str,
        relation_type: str | None = None,
        depth: int = 1,
    ) -> list[dict]:
        """获取实体的邻居（支持多跳查询）。

        Args:
            entity_name: 起始实体
            relation_type: 限定关系类型（None=所有关系）
            depth: 查询深度（几跳）

        Returns:
            邻居列表 [&#123;entity, relation, depth&#125;]
        """
        if entity_name not in self.entities:
            return []

        visited = &#123;entity_name&#125;
        result = []
        frontier = [(entity_name, 0)]

        while frontier:
            current, current_depth = frontier.pop(0)
            if current_depth >= depth:
                continue

            for rel, target in self.adjacency.get(current, []):
                if relation_type and rel != relation_type:
                    continue
                if target not in visited:
                    visited.add(target)
                    result.append(&#123;
                        "entity": target,
                        "relation": rel,
                        "depth": current_depth + 1,
                        "description": self.entities.get(target, Entity(name=target, type="")).description,
                    &#125;)
                    frontier.append((target, current_depth + 1))

        return result

    def find_path(self, start: str, end: str, max_depth: int = 4) -> list[str] | None:
        """查找两个实体间的最短路径。"""
        if start not in self.entities or end not in self.entities:
            return None

        from collections import deque
        queue = deque([(start, [start])])
        visited = &#123;start&#125;

        while queue:
            current, path = queue.popleft()
            if len(path) > max_depth:
                continue

            for rel, target in self.adjacency.get(current, []):
                if target == end:
                    return path + [target]
                if target not in visited:
                    visited.add(target)
                    queue.append((target, path + [target]))

        return None

    def get_entity_info(self, entity_name: str) -> dict:
        """获取实体的完整信息。"""
        if entity_name not in self.entities:
            return &#123;"error": "实体不存在"&#125;

        entity = self.entities[entity_name]
        neighbors = self.get_neighbors(entity_name)

        return &#123;
            "name": entity.name,
            "type": entity.type,
            "description": entity.description,
            "attributes": entity.attributes,
            "relations": [
                &#123;"relation": n["relation"], "target": n["entity"]&#125;
                for n in neighbors
            ],
        &#125;

    def stats(self) -> dict:
        """图谱统计。"""
        return &#123;
            "entity_count": len(self.entities),
            "relation_count": sum(len(v) for v in self.adjacency.values()),
            "entity_types": self._count_types(),
        &#125;

    def _count_types(self) -> dict:
        counts = &#123;&#125;
        for e in self.entities.values():
            counts[e.type] = counts.get(e.type, 0) + 1
        return counts
```

---

## 六、GraphRAG 实现

```python
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

class GraphRAG:
    """GraphRAG: 知识图谱 + 向量检索混合。

    检索策略：
    1. 识别查询中的实体
    2. 从图谱获取实体关系（精确信息）
    3. 同时用向量检索获取相关文档（语义信息）
    4. 合并两种结果交给LLM
    """

    def __init__(
        self,
        graph: KnowledgeGraph,
        llm: BaseChatModel,
        embeddings: Embeddings,
        vectorstore: InMemoryVectorStore = None,
    ):
        self.graph = graph
        self.llm = llm
        self.vectorstore = vectorstore or InMemoryVectorStore(embeddings)
        # 实体名→向量索引（用实体描述做向量化）
        self.entity_vectorstore = InMemoryVectorStore(embeddings)

    async def build_entity_index(self):
        """构建实体向量索引。"""
        docs = [
            Document(
                page_content=f"&#123;e.name&#125;: &#123;e.description&#125;",
                metadata=&#123;"entity_name": e.name, "type": e.type&#125;,
            )
            for e in self.graph.entities.values()
            if e.description
        ]
        if docs:
            await self.entity_vectorstore.aadd_documents(docs)

    async def retrieve(self, query: str, k: int = 5) -> dict:
        """混合检索：图谱+向量。"""
        # 1. 实体识别（用LLM从查询中提取实体名）
        entities = await self._identify_entities(query)

        # 2. 图谱查询：获取相关实体和关系
        graph_results = []
        for entity_name in entities:
            if entity_name in self.graph.entities:
                info = self.graph.get_entity_info(entity_name)
                graph_results.append(info)
                # 扩展到2跳邻居
                neighbors = self.graph.get_neighbors(entity_name, depth=2)
                for n in neighbors:
                    graph_results.append(&#123;
                        "entity": n["entity"],
                        "relation": n["relation"],
                        "depth": n["depth"],
                    &#125;)

        # 3. 向量检索：补充语义相关文档
        vector_results = await self.vectorstore.asimilarity_search(query, k=k)

        # 4. 实体向量检索：找语义相似的实体
        entity_results = await self.entity_vectorstore.asimilarity_search(query, k=3)

        return &#123;
            "query": query,
            "identified_entities": entities,
            "graph_info": graph_results,
            "vector_docs": [d.page_content[:200] for d in vector_results],
            "similar_entities": [
                d.metadata.get("entity_name") for d in entity_results
            ],
        &#125;

    async def _identify_entities(self, query: str) -> list[str]:
        """从查询中识别实体名。"""
        # 方法1: 精确匹配已知的实体名
        found = []
        for entity_name in self.graph.entities:
            if entity_name in query:
                found.append(entity_name)

        if found:
            return found

        # 方法2: 用LLM识别实体
        prompt = f"""从以下查询中提取可能的人名、组织名或概念名。

查询: &#123;query&#125;

已知实体: &#123;list(self.graph.entities.keys())[:20]&#125;

提取查询中涉及的实体名（每行一个，只输出实体名）:"""

        response = await self.llm.ainvoke([HumanMessage(content=prompt)])
        lines = [l.strip() for l in response.content.split("\n") if l.strip()]
        return lines[:5]

    async def answer(self, query: str) -> str:
        """GraphRAG问答。"""
        # 混合检索
        context = await self.retrieve(query)

        # 构建上下文
        graph_text = "\n".join(
            f"- 实体: &#123;r.get('name', r.get('entity', ''))&#125;, "
            f"关系: &#123;r.get('relations', r.get('relation', ''))&#125;"
            for r in context["graph_info"][:10]
        )
        vector_text = "\n".join(context["vector_docs"][:3])

        prompt = f"""基于知识图谱和文档信息回答问题。

## 知识图谱信息
&#123;graph_text&#125;

## 相关文档
&#123;vector_text&#125;

## 问题
&#123;query&#125;

回答:"""

        response = await self.llm.ainvoke([HumanMessage(content=prompt)])
        return response.content
```

---

## 七、使用示例

```python
import asyncio

async def main():
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings

    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    embeddings = OpenAIEmbeddings()

    # 1. 构建知识图谱
    graph = KnowledgeGraph()

    # 2. 从文档中抽取实体和关系
    docs = [
        "张三是AI部门的工程师，他和李四是同事关系。李四是AI部门的负责人。",
        "AI部门是公司的一个部门，公司总部在北京。",
        "王五也工作在AI部门，是张三的组长。王五直接向CTO汇报。",
    ]

    for doc in docs:
        entities, relations = await extract_entities_and_relations(llm, doc)
        for e in entities:
            graph.add_entity(e)
        for r in relations:
            graph.add_relation(r)

    print(f"图谱统计: &#123;graph.stats()&#125;")

    # 3. 构建GraphRAG
    rag = GraphRAG(graph, llm, embeddings)
    await rag.build_entity_index()

    # 4. 查询
    result = await rag.retrieve("张三的同事是谁？")
    print(f"识别实体: &#123;result['identified_entities']&#125;")
    print(f"图谱信息: &#123;result['graph_info']&#125;")

    # 5. 问答
    answer = await rag.answer("张三的同事是谁？")
    print(f"回答: &#123;answer&#125;")

asyncio.run(main())
```

---

## 八、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 实体名标准化 | "张三"和"小张"要合并 | ★★★ |
| 关系类型规范化 | 统一用英文如works_in | ★★★ |
| 图谱+向量混合 | 图谱找关系，向量找语义 | ★★★ |
| 定期更新图谱 | 新文档要增量抽取 | ★★☆ |
| 实体消歧 | 同名不同实体要区分 | ★★☆ |
| 生产用图数据库 | Neo4j/NebulaGraph | ★★☆ |

---

## 九、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解知识图谱三要素 | ☐ |
| 能用LLM抽取实体和关系 | ☐ |
| 实现了知识图谱存储 | ☐ |
| 能做多跳邻居查询 | ☐ |
| 能找实体间最短路径 | ☐ |
| 实现了GraphRAG混合检索 | ☐ |
