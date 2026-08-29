# Agent 语义缓存与智能缓存策略深度指南

> 用户问"Python怎么读文件"和"Python读取文件的方法"是同一个问题——应该命中缓存。传统精确匹配缓存做不到，语义缓存可以。本指南深度讲解语义缓存架构、相似度判断、缓存失效策略、多层缓存体系。

---

## 1. 语义缓存原理

### 精确缓存 vs 语义缓存

```
精确缓存：
  查询: "Python怎么读文件" → 缓存
  查询: "Python读取文件的方法" → 未命中（字面不同）
  命中率: 20-30%

语义缓存：
  查询: "Python怎么读文件" → 缓存
  查询: "Python读取文件的方法" → 命中（语义相似）
  命中率: 50-70%
```

### 缓存架构

```mermaid
graph TB
    Q["用户查询"] --> L1["L1: 精确匹配<br/>字典查找<br/>0ms"]
    L1 -->|"未命中"| L2["L2: 语义匹配<br/>向量相似度<br/>50ms"]
    L2 -->|"未命中"| L3["L3: 前缀缓存<br/>Prompt前缀<br/>免费加速"]
    L3 -->|"未命中"| LLM["LLM 调用<br/>500-5000ms"]
    LLM --> STORE["存入缓存"]

    style L1 fill:#C8E6C9,stroke:#2E7D32
    style L2 fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style L3 fill:#E3F2FD,stroke:#1565C0
    style LLM fill:#FFCCBC,stroke:#D84315
```

---

## 2. 语义缓存实现

```python
from dataclasses import dataclass, field
from langchain_openai import OpenAIEmbeddings
import numpy as np
import time

@dataclass
class SemanticCache:
    """语义缓存"""

    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    cache: list = field(default_factory=list)  # [&#123;query, embedding, answer, timestamp, hits&#125;]

    similarity_threshold: float = 0.92  # 相似度阈值
    max_size: int = 1000                # 最大缓存数
    ttl_seconds: int = 3600             # 过期时间

    async def get(self, query: str) -> dict:
        """查询缓存"""
        # 1. 精确匹配
        for item in self.cache:
            if item["query"] == query:
                if self._is_valid(item):
                    item["hits"] += 1
                    return &#123;"hit": True, "answer": item["answer"], "type": "exact"&#125;
                else:
                    self.cache.remove(item)

        # 2. 语义匹配
        query_embedding = await self._embed(query)

        best_match = None
        best_score = 0

        for item in self.cache:
            if not self._is_valid(item):
                self.cache.remove(item)
                continue

            score = self._cosine_similarity(query_embedding, item["embedding"])
            if score > best_score:
                best_score = score
                best_match = item

        if best_match and best_score >= self.similarity_threshold:
            best_match["hits"] += 1
            return &#123;
                "hit": True,
                "answer": best_match["answer"],
                "type": "semantic",
                "similarity": best_score,
                "original_query": best_match["query"],
            &#125;

        return &#123;"hit": False&#125;

    async def set(self, query: str, answer: str):
        """存入缓存"""
        embedding = await self._embed(query)

        # LRU 淘汰
        if len(self.cache) >= self.max_size:
            # 淘汰命中率最低的
            self.cache.sort(key=lambda x: x["hits"])
            self.cache.pop(0)

        self.cache.append(&#123;
            "query": query,
            "embedding": embedding,
            "answer": answer,
            "timestamp": time.time(),
            "hits": 0,
        &#125;)

    async def _embed(self, text: str) -> list:
        """生成 Embedding"""
        return await self.embeddings.aembed_query(text)

    @staticmethod
    def _cosine_similarity(a: list, b: list) -> float:
        """余弦相似度"""
        a_arr = np.array(a)
        b_arr = np.array(b)
        dot = np.dot(a_arr, b_arr)
        norm = np.linalg.norm(a_arr) * np.linalg.norm(b_arr)
        return dot / norm if norm > 0 else 0

    def _is_valid(self, item: dict) -> bool:
        """检查是否过期"""
        age = time.time() - item["timestamp"]
        return age < self.ttl_seconds

    def stats(self) -> dict:
        """缓存统计"""
        total_hits = sum(item["hits"] for item in self.cache)
        return &#123;
            "cache_size": len(self.cache),
            "total_hits": total_hits,
            "avg_hits_per_item": total_hits / len(self.cache) if self.cache else 0,
            "hit_rate": total_hits / (total_hits + len(self.cache)) if (total_hits + len(self.cache)) > 0 else 0,
        &#125;
```

---

## 3. 缓存失效策略

```python
@dataclass
class CacheInvalidation:
    """缓存失效策略"""

    # 失效原因
    invalidation_rules = &#123;
        "time": "超过 TTL 过期",
        "version": "Prompt 版本变更",
        "model": "模型切换",
        "data": "知识库数据更新",
        "manual": "手动清除",
        "size": "LRU 淘汰",
    &#125;

    async def invalidate_on_prompt_change(self, prompt_version: str):
        """Prompt 变更时失效"""
        # 所有缓存标记为 prompt_version，版本不匹配则失效
        cache_items = await db.cache.find(&#123;&#125;).to_list(None)
        invalidated = 0
        for item in cache_items:
            if item.get("prompt_version", "") != prompt_version:
                await db.cache.delete_one(&#123;"_id": item["_id"]&#125;)
                invalidated += 1
        return &#123;"invalidated": invalidated, "reason": "prompt_version_change"&#125;

    async def invalidate_on_data_update(self, updated_docs: list):
        """知识库更新时失效相关缓存"""
        # 找到引用了被更新文档的缓存项
        for doc_id in [d["id"] for d in updated_docs]:
            await db.cache.delete_many(&#123;"source_docs": doc_id&#125;)

    async def selective_invalidation(self, query_pattern: str):
        """选择性失效"""
        # 失效特定主题的缓存
        await db.cache.delete_many(&#123;"query_topic": query_pattern&#125;)
```

---

## 4. 多层缓存

```python
@dataclass
class MultiLayerCache:
    """多层缓存体系"""

    async def get(self, query: str) -> dict:
        """多层查询"""
        # L1: 精确匹配（内存，0ms）
        result = await self._l1_exact_get(query)
        if result:
            return &#123;**result, "layer": "L1_exact", "latency_ms": 0&#125;

        # L2: 语义匹配（内存向量，50ms）
        result = await self._l2_semantic_get(query)
        if result:
            # 提升到 L1
            await self._l1_exact_set(query, result["answer"])
            return &#123;**result, "layer": "L2_semantic", "latency_ms": 50&#125;

        # L3: Prompt 前缀缓存（API层，0ms）
        # Anthropic/OpenAI 自动处理
        # 无需手动

        # 未命中 → 调用 LLM
        return &#123;"hit": False&#125;

    async def set(self, query: str, answer: str):
        """多层存储"""
        # 同时存入 L1 和 L2
        await self._l1_exact_set(query, answer)
        await self._l2_semantic_set(query, answer)

    async def _l1_exact_get(self, query: str):
        """L1 精确匹配"""
        # Redis 或内存字典
        pass

    async def _l1_exact_set(self, query: str, answer: str):
        pass

    async def _l2_semantic_get(self, query: str):
        """L2 语义匹配"""
        pass

    async def _l2_semantic_set(self, query: str, answer: str):
        pass
```

---

## 5. 缓存命中率优化

```python
@dataclass
class CacheOptimizer:
    """缓存优化器"""

    async def analyze_cache_effectiveness(self) -> dict:
        """分析缓存效果"""
        stats = &#123;
            "total_requests": 0,
            "l1_hits": 0,
            "l2_hits": 0,
            "misses": 0,
            "cache_savings": 0.0,  # 节省的成本
        &#125;

        # 计算节省
        # 每次命中节省一次 LLM 调用成本
        avg_llm_cost = 0.01  # $0.01/次
        total_hits = stats["l1_hits"] + stats["l2_hits"]
        stats["cache_savings"] = total_hits * avg_llm_cost

        stats["hit_rate"] = total_hits / stats["total_requests"] if stats["total_requests"] > 0 else 0

        return &#123;
            **stats,
            "recommendations": self._recommend(stats),
        &#125;

    def _recommend(self, stats: dict) -> list:
        recs = []
        hit_rate = stats.get("hit_rate", 0)

        if hit_rate < 0.2:
            recs.append("命中率低，考虑降低相似度阈值")
        elif hit_rate > 0.8:
            recs.append("命中率高，考虑提高阈值避免误命中")

        if stats.get("l1_hits", 0) < stats.get("l2_hits", 0):
            recs.append("L2 命中多于 L1，考虑增加 L1 缓存大小")

        return recs
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解语义缓存原理 | ☐ |
| 实现了语义缓存（Embedding+余弦相似度） | ☐ |
| 实现了多层缓存（L1精确+L2语义） | ☐ |
| 实现了缓存失效策略 | ☐ |
| 实现了 LRU 淘汰 | ☐ |
| 实现了 TTL 过期 | ☐ |
| 有缓存效果分析 | ☐ |
| 配置了 Prompt 变更失效 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 20 | 缓存策略 | 缓存 |
| 26 | 缓存策略专题 | 缓存 |
| 84 | 优雅关闭与重启 | 关闭 |
| 116 | 语义缓存层设计 | 设计 |
| 129 | 工具结果缓存与去重 | 工具缓存 |
| 161 | 工具结果缓存 | 缓存 |
| 355 | 语义缓存 | 缓存 |
| 379 | Prompt 缓存与上下文复用 | Prompt缓存 |
| 386 | Tool 缓存与结果复用 | 工具缓存 |
| 475 | Agent 性能调优 | 性能 |
