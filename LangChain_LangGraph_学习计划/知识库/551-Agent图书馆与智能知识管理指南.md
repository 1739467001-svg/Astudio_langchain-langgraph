# Agent 图书馆与智能知识管理指南

> 图书馆有百万藏书——读者找不到书、图书分类困难、推荐不准确。Agent 能智能检索、个性化推荐、自动编目、知识图谱构建。本指南系统讲解图书馆 Agent 架构、智能检索、阅读推荐、自动编目、知识管理。

---

## 1. 图书馆 Agent 架构

### 工作流

```mermaid
graph TB
    QUERY["读者查询"] --> SEARCH["智能检索<br/>语义+元数据"]
    SEARCH --> RECOMMEND["阅读推荐<br/>个性化"]
    BOOK["新书入库"] --> CATALOG["自动编目<br/>分类+标签"]
    CATALOG --> KG["知识图谱<br/>作者/主题/关联"]
    QUERY --> QA["知识问答<br/>基于全书内容"]

    style SEARCH fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style CATALOG fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style RECOMMEND fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 智能检索

```python
@dataclass
class LibrarySearch:
    """图书馆智能检索"""

    async def search(self, query: str, filters: dict = None) -> dict:
        """智能检索"""
        # 1. 理解查询意图
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        intent = await llm.ainvoke(
            f"理解检索意图。查询: {query}\n输出JSON: {{\"intent\": \"找书/找主题/找作者/找答案\", \"keywords\": [], \"subject\": \"...\"}}"
        )
        intent_data = json.loads(intent.content)

        # 2. 混合检索
        # 向量检索（语义相似）
        vec_results = await vectorstore.asimilarity_search(query, k=10)
        # 元数据检索（作者/分类/ISBN）
        meta_results = await self._search_metadata(intent_data, filters)

        # 3. 融合排序
        merged = self._merge_results(vec_results, meta_results)

        # 4. 生成摘要
        if intent_data.get("intent") == "找答案":
            answer = await self._answer_question(query, merged[:5])
        else:
            answer = None

        return {
            "query": query,
            "intent": intent_data,
            "results": [{"title": r.metadata.get("title", ""), "author": r.metadata.get("author", ""),
                         "isbn": r.metadata.get("isbn", ""), "location": r.metadata.get("location", ""),
                         "available": r.metadata.get("available", True)} for r in merged[:10]],
            "answer": answer,
            "total": len(merged),
        }

    async def _search_metadata(self, intent: dict, filters: dict) -> list:
        """元数据检索"""
        return []  # 实际中查 OPAC 系统

    def _merge_results(self, vec: list, meta: list) -> list:
        seen = set()
        merged = []
        for r in vec + meta:
            key = r.metadata.get("isbn", str(hash(r.page_content)))
            if key not in seen:
                seen.add(key)
                merged.append(r)
        return merged

    async def _answer_question(self, query: str, docs: list) -> str:
        """基于书籍内容回答"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)
        context = "\n".join([d.page_content[:500] for d in docs])
        response = await llm.ainvoke(f"基于以下书籍内容回答：{query}\n\n参考：\n{context}")
        return response.content
```

---

## 3. 阅读推荐

```python
@dataclass
class ReadingRecommender:
    """阅读推荐器"""

    async def recommend(self, reader_id: str, history: list,
                       preferences: dict = None) -> dict:
        """个性化推荐"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.5)

        response = await llm.ainvoke(f"""推荐图书。

读者历史: {json.dumps(history[-10:], ensure_ascii=False)}
偏好: {json.dumps(preferences or {}, ensure_ascii=False)}

输出 JSON:
{{
    "recommendations": [
        {{
            "title": "书名", "author": "作者",
            "reason": "推荐理由",
            "match_score": 0.9,
            "category": "分类",
            "difficulty": "入门/进阶/专业",
            "estimated_reading_hours": 8
        }}
    ],
    "reading_path": ["建议阅读顺序"],
    "related_topics": ["相关主题"]
}}""")

        return json.loads(response.content)
```

---

## 4. 自动编目

```python
@dataclass
class AutoCataloger:
    """自动编目器"""

    async def catalog(self, book_info: dict, full_text: str = None) -> dict:
        """自动编目"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        response = await llm.ainvoke(f"""图书自动编目。

图书信息: {json.dumps(book_info, ensure_ascii=False)}
内容摘要: {full_text[:2000] if full_text else '无'}

输出 JSON:
{{
    "title": "书名",
    "author": "作者",
    "isbn": "ISBN",
    "publisher": "出版社",
    "publish_date": "出版日期",
    "category": "中图法分类号",
    "subject_headings": ["主题词"],
    "tags": ["标签"],
    "abstract": "内容摘要(200字)",
    "table_of_contents": ["目录"],
    "language": "语言",
    "pages": 0,
    "reading_level": "入门/进阶/专业",
    "recommended_audience": ["推荐读者群"],
    "related_books": ["关联图书"]
}}""")

        return json.loads(response.content)
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了智能检索（语义+元数据） | ☐ |
| 实现了知识问答 | ☐ |
| 实现了阅读推荐 | ☐ |
| 实现了自动编目 | ☐ |
| 有意图理解 | ☐ |
| 有阅读路径推荐 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 46 | 智能图书馆 Agent | 图书馆 |
| 494 | Agent 混合搜索 | 搜索 |
| 520 | Agent 搜索增强 | 搜索 |
| 463 | GraphRAG | 知识图谱 |
| 522 | Agent 教育 | 教育 |
| 545 | Agent 新闻媒体 | 媒体 |
