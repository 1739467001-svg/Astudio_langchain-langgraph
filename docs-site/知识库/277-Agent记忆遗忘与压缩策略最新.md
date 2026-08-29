# Agent 记忆遗忘与压缩策略最新

> 知识库 85 有 168 行。这篇讲透——什么时候遗忘、如何压缩、重要性衰减。

---

## 一、遗忘策略

```mermaid
graph TB
    subgraph 遗忘 &#123;"4种遗忘策略"&#125;
        F1["TTL过期<br/>超过时间→降权/删除"]
        F2["容量限制<br/>超过上限→删最旧"]
        F3["重要性衰减<br/>旧记忆权重↓"]
        F4["冲突更新<br/>新事实覆盖旧"]
    end

    style F1 fill:#FFF9C4
    style F3 fill:#C8E6C9
```

---

## 二、实现

```python
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict

@dataclass
class MemoryItem:
    """记忆条目。"""
    key: str
    value: str
    importance: float = 1.0
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    last_accessed: str = field(default_factory=lambda: datetime.now().isoformat())
    access_count: int = 0

class MemoryManager:
    """记忆管理器——遗忘+压缩+巩固。"""

    TTL_DAYS = &#123;"preferences": 90, "facts": 30, "summaries": 7&#125;
    MAX_ITEMS = 1000

    def __init__(self):
        self.memories: dict[str, MemoryItem] = &#123;&#125;

    def add(self, key: str, value: str, importance: float = 1.0):
        """添加记忆。"""
        self.memories[key] = MemoryItem(key=key, value=value, importance=importance)
        if len(self.memories) > self.MAX_ITEMS:
            self._evict_oldest()

    def get(self, key: str) -> str | None:
        """获取记忆（更新访问时间）。"""
        item = self.memories.get(key)
        if item:
            item.last_accessed = datetime.now().isoformat()
            item.access_count += 1
            return item.value
        return None

    def decay_importance(self, decay_rate: float = 0.01):
        """重要性衰减——旧记忆权重降低。"""
        now = datetime.now()
        for item in self.memories.values():
            created = datetime.fromisoformat(item.created_at)
            age_days = (now - created).days
            item.importance = max(0.1, item.importance * (1 - decay_rate * age_days))

    def expire_old(self):
        """TTL过期——删除超时记忆。"""
        now = datetime.now()
        expired = []
        for key, item in list(self.memories.items()):
            category = "facts"  # 简化
            ttl = self.TTL_DAYS.get(category, 30)
            created = datetime.fromisoformat(item.created_at)
            if (now - created).days > ttl and item.importance < 0.3:
                expired.append(key)
                del self.memories[key]
        return expired

    def _evict_oldest(self):
        """容量限制——删除最旧记忆。"""
        sorted_items = sorted(self.memories.items(), key=lambda x: x[1].last_accessed)
        for key, _ in sorted_items[:len(self.memories) // 10]:
            del self.memories[key]

    def consolidate(self, new_facts: list[dict]) -> dict:
        """巩固——多次出现的事实提升置信度。"""
        for fact in new_facts:
            key = fact["key"]
            if key in self.memories:
                self.memories[key].importance = min(1.0, self.memories[key].importance + 0.1)
            else:
                self.add(key, fact["value"])

    def stats(self) -> dict:
        return &#123;
            "total": len(self.memories),
            "avg_importance": round(sum(m.importance for m in self.memories.values()) / max(len(self.memories), 1), 2),
        &#125;
```

---

## 三、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 有TTL过期 | 防止过时信息 | ★★★ |
| 有容量限制 | 防止膨胀 | ★★★ |
| 重要性衰减 | 旧记忆权重降 | ★★☆ |
| 多次出现巩固 | 提升置信度 | ★★☆ |

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有遗忘策略 | ☐ |
| 有压缩管理 | ☐ |
