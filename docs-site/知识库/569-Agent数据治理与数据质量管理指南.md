# Agent 数据治理与数据质量管理指南

> Agent 的回答质量取决于数据质量——垃圾进垃圾出。本指南深度讲解数据质量维度、数据治理框架、数据血缘追踪、数据质量监控、以及数据治理在 Agent 中的实践。

---

## 1. 数据质量维度

### 六大质量维度

```mermaid
graph TB
    DQ["数据质量维度"]

    DQ --> ACC["准确性<br/>数据是否正确"]
    DQ --> COM["完整性<br/>是否有缺失"]
    DQ --> CON["一致性<br/>多源是否一致"]
    DQ --> TIM["时效性<br/>是否最新"]
    DQ --> UNI["唯一性<br/>是否有重复"]
    DQ --> VAL["有效性<br/>是否符合格式"]

    style DQ fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style ACC fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 2. 数据质量检查

```python
@dataclass
class DataQualityChecker:
    """数据质量检查器"""

    async def check_all(self, data: list, schema: dict = None) -> dict:
        """全面质量检查"""
        results = &#123;&#125;

        results["completeness"] = self._check_completeness(data)
        results["uniqueness"] = self._check_uniqueness(data)
        results["validity"] = await self._check_validity(data, schema)
        results["consistency"] = self._check_consistency(data)
        results["timeliness"] = self._check_timeliness(data)

        total_score = sum(results.values()) / len(results)
        results["overall_score"] = total_score
        results["grade"] = "A" if total_score > 0.9 else "B" if total_score > 0.8 else "C" if total_score > 0.6 else "D"

        return results

    def _check_completeness(self, data: list) -> float:
        """完整性检查"""
        if not data:
            return 0
        total_fields = sum(len(d) for d in data)
        filled_fields = sum(1 for d in data for v in d.values() if v is not None and v != "")
        return filled_fields / total_fields if total_fields > 0 else 0

    def _check_uniqueness(self, data: list) -> float:
        """唯一性检查"""
        if not data:
            return 0
        # 基于内容哈希去重
        import hashlib
        seen = set()
        duplicates = 0
        for d in data:
            h = hashlib.md5(json.dumps(d, sort_keys=True, default=str).encode()).hexdigest()
            if h in seen:
                duplicates += 1
            seen.add(h)
        return 1 - duplicates / len(data)

    async def _check_validity(self, data: list, schema: dict) -> float:
        """有效性检查"""
        if not schema or not data:
            return 0.8

        valid_count = 0
        for d in data:
            is_valid = True
            for field, rules in schema.items():
                if field in d:
                    value = d[field]
                    if rules.get("type") == "str" and not isinstance(value, str):
                        is_valid = False
                    if rules.get("min") and isinstance(value, (int, float)) and value < rules["min"]:
                        is_valid = False
            if is_valid:
                valid_count += 1

        return valid_count / len(data)

    def _check_consistency(self, data: list) -> float:
        """一致性检查"""
        # 检查同一字段在不同记录中的类型一致性
        if not data:
            return 0
        field_types = &#123;&#125;
        for d in data:
            for k, v in d.items():
                if k not in field_types:
                    field_types[k] = set()
                field_types[k].add(type(v).__name__)

        consistent = sum(1 for types in field_types.values() if len(types) == 1)
        return consistent / len(field_types) if field_types else 0

    def _check_timeliness(self, data: list) -> float:
        """时效性检查"""
        if not data:
            return 0
        now = datetime.utcnow()
        fresh_count = 0
        for d in data:
            ts = d.get("timestamp") or d.get("updated_at") or d.get("date")
            if ts:
                try:
                    dt = datetime.fromisoformat(str(ts))
                    age_days = (now - dt).days
                    if age_days < 30:
                        fresh_count += 1
                except:
                    pass
        return fresh_count / len(data)
```

---

## 3. 数据血缘追踪

```python
@dataclass
class DataLineageTracker:
    """数据血缘追踪"""

    async def track(self, data_id: str) -> dict:
        """追踪数据血缘"""
        return &#123;
            "data_id": data_id,
            "lineage": &#123;
                "source": &#123;
                    "system": "CRM",
                    "table": "customers",
                    "record_id": data_id,
                    "extracted_at": "2025-08-01T10:00:00Z",
                &#125;,
                "transformations": [
                    &#123;"step": 1, "action": "cleaned", "field": "phone", "detail": "格式化手机号"&#125;,
                    &#123;"step": 2, "action": "enriched", "field": "region", "detail": "根据手机号添加地区"&#125;,
                    &#123;"step": 3, "action": "embedded", "field": "profile", "detail": "向量化存入向量库"&#125;,
                ],
                "consumers": [
                    &#123;"system": "RAG Agent", "usage": "客服问答"&#125;,
                    &#123;"system": "推荐 Agent", "usage": "个性化推荐"&#125;,
                ],
            &#125;,
            "quality": &#123;"score": 0.92, "grade": "A"&#125;,
            "last_updated": "2025-08-28T12:00:00Z",
        &#125;

    async def impact_analysis(self, source_table: str) -> dict:
        """影响分析：源表变更影响哪些下游"""
        return &#123;
            "source": source_table,
            "impacted_systems": ["RAG Agent", "推荐 Agent", "分析报表"],
            "impacted_agents": ["客服 Agent", "销售 Agent"],
            "estimated_impact": "高",
            "recommended_action": "通知所有下游消费者",
        &#125;
```

---

## 4. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解六大质量维度 | ☐ |
| 实现了数据质量检查 | ☐ |
| 实现了数据血缘追踪 | ☐ |
| 实现了影响分析 | ☐ |
| 有数据质量评分 | ☐ |

---

## 5. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 68 | RAG 数据治理 | 基础 |
| 455 | Agent 数据管道 | 管道 |
| 496 | Agent 经验沉淀 | 经验 |
| 567 | 企业搜索 | 搜索 |
| 566 | 知识图谱推理 | 图谱 |
