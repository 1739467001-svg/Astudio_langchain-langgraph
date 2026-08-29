# Agent 知识管理与企业搜索深度指南

> 企业有海量文档但"找不到、用不上、不更新"——Agent 能构建企业知识大脑：智能搜索、知识图谱、自动问答、知识推荐。本指南深度讲解企业知识管理架构、智能搜索、知识图谱构建、知识推荐。

---

## 1. 企业知识管理架构

```mermaid
graph TB
    SOURCES["知识来源<br/>文档/邮件/Wiki/数据库"] --> INGEST["知识摄入<br/>分块+向量化"]
    INGEST --> INDEX["索引层<br/>向量库+关键词库+图谱"]
    INDEX --> SEARCH["智能搜索<br/>语义+关键词+图谱混合"]
    SEARCH --> ANSWER["企业问答<br/>RAG+引用"]
    INDEX --> RECOMMEND["知识推荐<br/>按角色/场景"]

    style INGEST fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style SEARCH fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style ANSWER fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 2. 企业智能搜索

```python
@dataclass
class EnterpriseSearch:
    """企业智能搜索"""

    async def search(self, query: str, user_id: str = "",
                     filters: dict = None, top_k: int = 10) -> dict:
        """混合搜索"""
        # 1. 意图理解
        intent = await self._understand_intent(query)

        # 2. 并行搜索
        vec_results, kw_results, graph_results = await asyncio.gather(
            self._vector_search(query, filters, top_k * 2),
            self._keyword_search(query, filters, top_k * 2),
            self._graph_search(query, top_k),
        )

        # 3. RRF 融合
        fused = self._rrf_fuse(vec_results, kw_results, graph_results)

        # 4. 权限过滤
        filtered = await self._filter_by_permissions(fused, user_id)

        # 5. 排序优化
        ranked = await self._rerank(query, filtered[:top_k])

        return {
            "query": query,
            "intent": intent,
            "results": ranked,
            "total": len(filtered),
            "sources": list(set(r["source"] for r in ranked)),
        }

    async def _understand_intent(self, query: str) -> dict:
        """理解搜索意图"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        response = await llm.ainvoke(f"""分析搜索意图。

查询: {query}

输出 JSON:
{{
    "intent": "查找文档/查找答案/查找人/查找数据",
    "keywords": ["关键词"],
    "filters": {{"department": "...", "date_range": "...", "doc_type": "..."}},
    "query_type": "factual/analytical/navigational"
}}""")
        return json.loads(response.content)

    def _rrf_fuse(self, *result_lists) -> list:
        """RRF 融合"""
        k = 60
        scores = {}
        for results in result_lists:
            for rank, doc in enumerate(results, 1):
                doc_id = doc.get("id", str(hash(str(doc))))
                scores[doc_id] = scores.get(doc_id, 0) + 1.0 / (k + rank)

        sorted_ids = sorted(scores.items(), key=lambda x: -x[1])
        return [{"id": did, "score": s} for did, s in sorted_ids]

    async def _filter_by_permissions(self, results: list, user_id: str) -> list:
        """权限过滤"""
        user_perms = await self._get_user_permissions(user_id)
        return [r for r in results if r.get("access_level", "public") in user_perms]

    async def _rerank(self, query: str, docs: list) -> list:
        """重排序"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        response = await llm.ainvoke(
            f"对搜索结果按相关性排序。只返回编号(逗号分隔)。\n查询:{query}\n结果:{[d.get('title','') for d in docs]}"
        )
        return docs  # 简化
```

---

## 3. 知识图谱构建

```python
@dataclass
class EnterpriseKnowledgeGraph:
    """企业知识图谱"""

    async def build_from_documents(self, docs: list) -> dict:
        """从文档构建知识图谱"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        all_entities = []
        all_relations = []

        for doc in docs[:50]:
            response = await llm.ainvoke(f"""提取实体和关系。

文档: {doc[:1500]}

输出 JSON:
{{
    "entities": [{{"name": "...", "type": "person/org/project/product/concept"}}],
    "relations": [{{"source": "...", "target": "...", "relation": "负责/属于/关联/使用"}}]
}}""")
            try:
                data = json.loads(response.content)
                all_entities.extend(data["entities"])
                all_relations.extend(data["relations"])
            except:
                pass

        # 去重
        unique_entities = self._dedupe_entities(all_entities)
        unique_relations = self._dedupe_relations(all_relations)

        return {
            "nodes": unique_entities,
            "edges": unique_relations,
            "stats": {
                "total_entities": len(unique_entities),
                "total_relations": len(unique_relations),
                "entity_types": self._count_types(unique_entities),
            },
        }

    def _dedupe_entities(self, entities: list) -> list:
        seen = set()
        unique = []
        for e in entities:
            key = e["name"].lower()
            if key not in seen:
                seen.add(key)
                unique.append(e)
        return unique

    def _dedupe_relations(self, relations: list) -> list:
        seen = set()
        unique = []
        for r in relations:
            key = (r["source"], r["target"], r["relation"])
            if key not in seen:
                seen.add(key)
                unique.append(r)
        return unique

    def _count_types(self, entities: list) -> dict:
        from collections import Counter
        return dict(Counter(e["type"] for e in entities))
```

---

## 4. 知识推荐

```python
@dataclass
class KnowledgeRecommender:
    """知识推荐器"""

    async def recommend(self, user_id: str, current_context: str = "") -> list:
        """按角色和场景推荐知识"""
        user_profile = await self._get_profile(user_id)

        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.5)

        response = await llm.ainvoke(f"""推荐相关知识。

用户角色: {user_profile.get('role', 'general')}
部门: {user_profile.get('department', '')}
当前任务: {current_context[:200]}
历史浏览: {json.dumps(user_profile.get('history', [])[-5:], ensure_ascii=False)}

推荐 5 篇可能相关的知识主题。输出 JSON 数组。""")

        return json.loads(response.content)
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了企业智能搜索（混合检索） | ☐ |
| 实现了意图理解 | ☐ |
| 实现了权限过滤 | ☐ |
| 实现了知识图谱构建 | ☐ |
| 实现了知识推荐 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 68 | RAG 数据治理 | 数据治理 |
| 494 | 混合搜索 | 搜索 |
| 520 | 搜索增强 | 搜索 |
| 551 | 图书馆与知识管理 | 图书馆 |
| 566 | 知识图谱推理 | 图谱 |
