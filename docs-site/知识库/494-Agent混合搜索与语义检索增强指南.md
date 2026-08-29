# Agent 混合搜索与语义检索增强指南

> 纯向量检索擅长语义相似但不擅长精确匹配——搜"Python 3.11"可能返回 Python 3.9 的文档。纯关键词检索擅长精确匹配但不理解同义词——搜"深度学习"找不到"神经网络"的内容。混合搜索把两者结合。本指南系统讲解混合检索架构、RRF 融合、查询重写、多路召回。

---

## 1. 混合搜索架构

### 多路召回+融合

```mermaid
graph TB
    Q["用户查询"] --> VEC["向量检索<br/>语义相似<br/>Top-K=10"]
    Q --> KW["关键词检索<br/>精确匹配<br/>Top-K=10"]
    Q --> SEM["语义检索<br/>同义词扩展<br/>Top-K=5"]

    VEC --> FUSE["RRF 融合<br/>排序合并"]
    KW --> FUSE
    SEM --> FUSE

    FUSE --> RERANK["重排序<br/>Cross-Encoder"]
    RERANK --> TOP["Top-5<br/>最终结果"]

    style FUSE fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style RERANK fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style TOP fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

### 检索方式对比

| 方式 | 优势 | 劣势 | 适合 |
|------|------|------|------|
| 向量检索 | 语义相似、理解同义词 | 精确匹配弱、专有名词差 | 概念查询 |
| 关键词检索 | 精确匹配、代码/ID | 不理解同义 | 精确查找 |
| 语义扩展 | 同义词、相关概念 | 可能引入噪声 | 模糊查询 |
| 混合检索 | 兼顾语义+精确 | 实现复杂 | 通用推荐 |

---

## 2. RRF 融合

### Reciprocal Rank Fusion

```python
@dataclass
class RRFFusion:
    """RRF（倒数排名融合）"""

    k: int = 60  # RRF 平滑参数（通常 60）

    def fuse(self, result_lists: dict) -> list:
        """
        融合多路检索结果

        result_lists = &#123;
            "vector": [doc1, doc2, doc3, ...],
            "keyword": [doc3, doc1, doc4, ...],
            "semantic": [doc2, doc5, doc1, ...],
        &#125;
        """
        # 计算每个文档的 RRF 分数
        scores = &#123;&#125;

        for method, docs in result_lists.items():
            for rank, doc in enumerate(docs, 1):
                doc_id = self._get_doc_id(doc)
                # RRF 公式: 1 / (k + rank)
                rrf_score = 1.0 / (self.k + rank)

                if doc_id in scores:
                    scores[doc_id]["score"] += rrf_score
                    scores[doc_id]["found_in"].append(method)
                    scores[doc_id]["ranks"][method] = rank
                else:
                    scores[doc_id] = &#123;
                        "doc": doc,
                        "score": rrf_score,
                        "found_in": [method],
                        "ranks": &#123;method: rank&#125;,
                    &#125;

        # 按 RRF 分数排序
        sorted_results = sorted(scores.values(), key=lambda x: -x["score"])

        return sorted_results

    def _get_doc_id(self, doc) -> str:
        if isinstance(doc, dict):
            return doc.get("id", str(hash(doc.get("content", ""))))
        return str(hash(doc.page_content if hasattr(doc, "page_content") else str(doc)))

# 使用
rrf = RRFFusion(k=60)
fused = rrf.fuse(&#123;
    "vector": vector_results,
    "keyword": keyword_results,
    "semantic": semantic_results,
&#125;)
# 被多路检索同时命中的文档分数更高 → 更相关
```

---

## 3. 查询重写与扩展

### Multi-Query 生成

```python
@dataclass
class QueryRewriter:
    """查询重写器"""

    async def multi_query(self, query: str, num_queries: int = 3) -> list:
        """生成多个变体查询"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

        prompt = f"""为以下查询生成 &#123;num_queries&#125; 个不同的表述方式。
目标是从不同角度检索相关文档。

原查询: &#123;query&#125;

生成的查询（每行一个，不要编号）："""

        response = await llm.ainvoke(prompt)
        queries = [q.strip() for q in response.content.split("\n") if q.strip()]

        return [query] + queries[:num_queries]  # 包含原查询

    async def hyde(self, query: str) -> str:
        """HyDE（Hypothetical Document Embeddings）
        让 LLM 生成一个假设性回答，用回答做向量检索"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

        prompt = f"""请为以下问题写一个简短的可能回答（100字以内）。

问题: &#123;query&#125;

假想回答："""

        response = await llm.ainvoke(prompt)
        # 用假想回答做向量检索（而不是用原问题）
        return response.content

    async def expand_synonyms(self, query: str) -> list:
        """同义词扩展"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        prompt = f"""列出以下查询中的关键词的同义词和相关词。

查询: &#123;query&#125;

输出格式（每行一个，不含原始词）："""

        response = await llm.ainvoke(prompt)
        synonyms = [s.strip() for s in response.content.split("\n") if s.strip()]

        return [query] + synonyms

    async def decompose(self, query: str) -> list:
        """查询分解：把复杂问题拆成子问题"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        prompt = f"""把以下复杂查询分解为可以独立检索的子查询。

查询: &#123;query&#125;

子查询（每行一个，不要编号）："""

        response = await llm.ainvoke(prompt)
        sub_queries = [q.strip() for q in response.content.split("\n") if q.strip()]

        return sub_queries
```

---

## 4. 完整混合检索实现

```python
@dataclass
class HybridRetriever:
    """完整混合检索器"""

    async def retrieve(self, query: str, top_k: int = 5) -> list:
        """混合检索"""
        # 1. 查询重写
        rewriter = QueryRewriter()
        multi_queries = await rewriter.multi_query(query, num_queries=3)
        synonyms = await rewriter.expand_synonyms(query)

        # 2. 多路并行检索
        results = &#123;&#125;

        # 向量检索（多查询）
        vec_results = []
        for q in multi_queries:
            vec_results.extend(await vectorstore.asimilarity_search(q, k=5))
        results["vector"] = self._dedupe(vec_results)[:10]

        # 关键词检索（同义词扩展）
        kw_results = []
        for term in synonyms[:5]:
            kw_results.extend(await self._keyword_search(term, k=5))
        results["keyword"] = self._dedupe(kw_results)[:10]

        # HyDE 检索
        hyde_doc = await rewriter.hyde(query)
        results["hyde"] = await vectorstore.asimilarity_search(hyde_doc, k=5)

        # 3. RRF 融合
        rrf = RRFFusion(k=60)
        fused = rrf.fuse(results)

        # 4. 重排序
        top_candidates = [r["doc"] for r in fused[:top_k * 2]]
        reranked = await self._rerank(query, top_candidates, top_k)

        return reranked

    async def _keyword_search(self, term: str, k: int = 5) -> list:
        """关键词检索"""
        # 使用 BM25 或 Elasticsearch
        from langchain_community.retrievers import BM25Retriever
        bm25 = BM25Retriever.from_documents(all_docs)
        bm25.k = k
        return await bm25.ainvoke(term)

    async def _rerank(self, query: str, docs: list, top_k: int) -> list:
        """重排序"""
        # 使用 Cross-Encoder 重排序
        # Cohere Rerank / BGE-Reranker
        from langchain_community.document_compressors import CohereRerank

        compressor = CohereRerank(top_n=top_k)
        compressed = await compressor.acompress_documents(docs, query)
        return compressed

    def _dedupe(self, docs: list) -> list:
        """去重"""
        seen = set()
        unique = []
        for doc in docs:
            content = doc.page_content if hasattr(doc, "page_content") else str(doc)
            key = content[:100]
            if key not in seen:
                seen.add(key)
                unique.append(doc)
        return unique
```

---

## 5. 检索效果对比

| 方法 | 准确率 | 召回率 | 延迟 | 成本 |
|------|--------|--------|------|------|
| 纯向量 | 75% | 80% | 50ms | 低 |
| 纯关键词 | 70% | 60% | 20ms | 低 |
| 混合+RRF | 85% | 90% | 100ms | 中 |
| 混合+RRF+重排 | 92% | 88% | 300ms | 中高 |
| 混合+HyDE+重排 | 94% | 92% | 500ms | 高 |

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解混合搜索架构 | ☐ |
| 实现了 RRF 融合 | ☐ |
| 实现了 Multi-Query | ☐ |
| 实现了 HyDE | ☐ |
| 实现了同义词扩展 | ☐ |
| 实现了查询分解 | ☐ |
| 实现了重排序 | ☐ |
| 有效果对比基准 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 03 | RAG 全流程图解 | RAG 基础 |
| 16 | 高级 RAG 模式 | 高级 RAG |
| 92 | RAG 高级检索策略 | 检索策略 |
| 124 | RAG 高级检索策略 | 查询重写 |
| 131 | 查询理解流程 | 查询理解 |
| 163 | 查询理解与意图识别 | 意图 |
| 180 | RAG 查询路由 | 路由 |
| 187 | RAG 混合检索调优 | 调优 |
| 219 | RAG 混合检索调优 | 调优 |
| 240 | 检索后处理 | 后处理 |
| 247 | 混合检索 | 混合 |
| 322 | RAG 查询路由 | 路由 |
| 378 | 检索增强排序 | 排序 |
| 407 | RAG 重排序 | 重排 |
| 430 | Agentic RAG | 自适应 |
