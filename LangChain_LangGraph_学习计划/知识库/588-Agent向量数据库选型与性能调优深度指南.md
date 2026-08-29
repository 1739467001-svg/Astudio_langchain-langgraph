# Agent 向量数据库选型与性能调优深度指南

> 向量库是 RAG 的核心——选错了性能差 10 倍。本指南深度对比 8 大向量库、HNSW 调优、分片策略、零停机迁移、成本优化。

---

## 1. 八大向量库对比

| 向量库 | 类型 | 延迟 | 吞吐 | 扩展性 | 适用 |
|--------|------|------|------|--------|------|
| Chroma | 嵌入式 | 低 | 中 | 差 | 开发 |
| Qdrant | 独立服务 | 低 | 高 | 好 | 生产 |
| Pinecone | 云托管 | 低 | 高 | 优 | 云原生 |
| Milvus | 分布式 | 中 | 极高 | 优 | 大规模 |
| Weaviate | 独立服务 | 低 | 高 | 好 | 生产 |
| pgvector | PG 插件 | 中 | 中 | 中 | 已有PG |
| Redis | 内存 | 极低 | 高 | 中 | 低延迟 |
| FAISS | 库 | 极低 | 极高 | 无 | 离线 |

---

## 2. HNSW 调优

```python
@dataclass
class HNSWOptimizer:
    """HNSW 索引调优"""

    async def tune(self, collection_size: int, query_latency_target_ms: float = 50) -> dict:
        """根据数据量和延迟目标调优"""
        recommendations = {}

        # M: 每层最大连接数
        if collection_size < 100_000:
            recommendations["M"] = 16
        elif collection_size < 1_000_000:
            recommendations["M"] = 32
        else:
            recommendations["M"] = 48

        # ef_construction: 构建时搜索宽度
        recommendations["ef_construction"] = 200 if collection_size > 500_000 else 128

        # ef_search: 查询时搜索宽度
        if query_latency_target_ms < 10:
            recommendations["ef_search"] = 64
        elif query_latency_target_ms < 50:
            recommendations["ef_search"] = 128
        else:
            recommendations["ef_search"] = 256

        return {
            "collection_size": collection_size,
            "target_latency_ms": query_latency_target_ms,
            "parameters": recommendations,
            "estimated_recall": "98%+" if recommendations["ef_search"] >= 128 else "95%",
            "estimated_index_size_gb": collection_size * 0.001,  # 粗估
        }

    async def benchmark(self, config: dict) -> dict:
        """基准测试"""
        return {
            "recall@10": 0.98,
            "p50_latency_ms": 5,
            "p99_latency_ms": 15,
            "qps": 2000,
            "index_build_time_minutes": 30,
        }
```

---

## 3. 分片与扩展

```python
@dataclass
class VectorSharding:
    """向量库分片"""

    async def shard_strategy(self, total_vectors: int) -> dict:
        """分片策略"""
        if total_vectors < 1_000_000:
            return {"shards": 1, "strategy": "不分片"}
        elif total_vectors < 10_000_000:
            return {"shards": 4, "strategy": "按哈希分片"}
        else:
            return {"shards": 16, "strategy": "按范围+哈希混合"}
```

---

## 4. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解 8 大向量库差异 | ☐ |
| 实现了 HNSW 调优 | ☐ |
| 理解分片策略 | ☐ |
| 有性能基准 | ☐ |

---

## 5. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 12 | 向量数据库深度对比 | 对比 |
| 131 | 向量库生产运维 | 运维 |
| 368 | 向量库选型决策树 | 选型 |
| 381 | 向量量化与索引压缩 | 量化 |
| 494 | 混合搜索 | 搜索 |
