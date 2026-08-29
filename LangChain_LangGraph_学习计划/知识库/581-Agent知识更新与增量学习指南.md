# Agent 知识更新与增量学习指南

> 世界在变——新产品发布、政策更新、价格变动。Agent 的知识库如何跟上？本指南讲解知识增量更新、漂移检测、自动重新索引、以及增量学习。

---

## 1. 知识更新架构

```mermaid
graph LR
    CHANGE["数据变更"] --> DETECT["变更检测<br/>CRC/时间戳/哈希"]
    DETECT --> UPDATE["增量更新<br/>新增/修改/删除"]
    UPDATE --> REINDEX["重新索引<br/>仅变更部分"]
    REINDEX --> VALIDATE["验证<br/>一致性检查"]
    VALIDATE --> INVALIDATE["缓存失效<br/>清除旧答案"]

    style DETECT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style UPDATE fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style INVALIDATE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 增量更新实现

```python
@dataclass
class IncrementalKnowledgeUpdater:
    """增量知识更新器"""

    async def detect_changes(self, source_docs: list,
                              indexed_docs: list) -> dict:
        """检测变更"""
        import hashlib

        source_map = {}
        for doc in source_docs:
            key = doc.get("id", hashlib.md5(doc.get("content", "").encode()).hexdigest()[:8])
            source_map[key] = {
                "content": doc.get("content", ""),
                "hash": hashlib.md5(doc.get("content", "").encode()).hexdigest(),
                "updated_at": doc.get("updated_at", ""),
            }

        indexed_map = {}
        for doc in indexed_docs:
            key = doc.get("id", "")
            indexed_map[key] = {
                "hash": doc.get("hash", ""),
                "content": doc.get("content", ""),
            }

        added, modified, deleted = [], [], []

        for key, source in source_map.items():
            if key not in indexed_map:
                added.append({"id": key, "content": source["content"]})
            elif source["hash"] != indexed_map[key]["hash"]:
                modified.append({"id": key, "content": source["content"]})

        for key in indexed_map:
            if key not in source_map:
                deleted.append({"id": key})

        return {
            "added": len(added), "modified": len(modified), "deleted": len(deleted),
            "details": {"add": added, "modify": modified, "delete": deleted},
            "total_changes": len(added) + len(modified) + len(deleted),
        }

    async def apply_updates(self, changes: dict, vectorstore) -> dict:
        """应用增量更新"""
        stats = {"added": 0, "modified": 0, "deleted": 0}

        for doc in changes["details"]["add"]:
            await vectorstore.add_texts([doc["content"]], metadatas=[{"id": doc["id"]}])
            stats["added"] += 1

        for doc in changes["details"]["modify"]:
            await vectorstore.delete(filter={"id": doc["id"]})
            await vectorstore.add_texts([doc["content"]], metadatas=[{"id": doc["id"]}])
            stats["modified"] += 1

        for doc in changes["details"]["delete"]:
            await vectorstore.delete(filter={"id": doc["id"]})
            stats["deleted"] += 1

        return stats

    async def detect_drift(self, recent_queries: list,
                            avg_relevance_score: float) -> dict:
        """检测知识漂移"""
        if avg_relevance_score < 0.5:
            return {"drift_detected": True, "severity": "high",
                    "action": "建议全量重建索引", "avg_score": avg_relevance_score}
        elif avg_relevance_score < 0.7:
            return {"drift_detected": True, "severity": "medium",
                    "action": "建议增量更新", "avg_score": avg_relevance_score}
        return {"drift_detected": False, "avg_score": avg_relevance_score}

    async def invalidate_cache(self, changed_doc_ids: list) -> dict:
        """缓存失效"""
        return {"invalidated": len(changed_doc_ids), "reason": "知识更新"}
```

---

## 3. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了变更检测 | ☐ |
| 实现了增量更新 | ☐ |
| 实现了漂移检测 | ☐ |
| 实现了缓存失效 | ☐ |

---

## 4. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 44 | 知识库增量更新 | 增量 |
| 218 | 增量更新 | 更新 |
| 455 | Agent 数据管道 | 管道 |
| 498 | 语义缓存 | 缓存 |
| 560 | 自进化与持续学习 | 进化 |
