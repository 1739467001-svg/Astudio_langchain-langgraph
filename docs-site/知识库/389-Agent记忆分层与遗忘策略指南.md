# Agent 记忆分层与遗忘策略指南

> 记忆不是越多越好——全记住会撑爆上下文、降低检索效率、还会记住错误信息。这篇指南讲透记忆分层、主动遗忘机制和记忆巩固策略。

---

## 一、记忆分层与遗忘架构

```mermaid
graph TB
    INPUT["新信息进入"] --> WORKING["工作记忆<br/>即时+容量小"]
    WORKING --> CONSOLIDATE&#123;"记忆巩固<br/>值得长期存?"&#125;
    CONSOLIDATE -->|是| LONG_TERM["长期记忆<br/>Store/向量库"]
    CONSOLIDATE -->|否| FORGET["主动遗忘<br/>丢弃或压缩"]

    LONG_TERM --> DECAY&#123;"遗忘策略"&#125;
    DECAY -->|时间衰减| TTL["TTL过期"]
    DECAY -->|使用频率| LFU["低频遗忘"]
    DECAY -->|相关性| RELEVANCE["低相关遗忘"]
    DECAY -->|容量限制| LRU["最旧遗忘"]

    style CONSOLIDATE fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style FORGET fill:#FFE0B2,stroke:#E65100
    style LONG_TERM fill:#E3F2FD,stroke:#1565C0
```

---

## 二、分层记忆与遗忘实现

```python
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from collections import defaultdict
import time
import math

class MemoryTier(str, Enum):
    WORKING = "working"       # 工作记忆：当前对话
    SHORT_TERM = "short_term"  # 短期记忆：最近会话摘要
    LONG_TERM = "long_term"   # 长期记忆：持久化
    EPISODIC = "episodic"     # 情景记忆：关键事件

class ForgettingStrategy(str, Enum):
    TTL = "ttl"               # 时间到就忘
    LRU = "lru"               # 最久没用的先忘
    LFU = "lfu"               # 用得少的先忘
    DECAY = "decay"           # 时间衰减
    RELEVANCE = "relevance"   # 低相关先忘
    HYBRID = "hybrid"         # 混合

@dataclass
class MemoryItem:
    """记忆条目。"""
    memory_id: str
    content: str
    tier: MemoryTier
    created_at: float = field(default_factory=time.monotonic)
    last_accessed: float = field(default_factory=time.monotonic)
    access_count: int = 0
    importance: float = 0.5      # 0-1 重要度
    ttl_seconds: float = 3600   # 默认1小时
    tags: list[str] = field(default_factory=list)

    @property
    def age_seconds(self) -> float:
        return time.monotonic() - self.created_at

    @property
    def idle_seconds(self) -> float:
        return time.monotonic() - self.last_accessed

    @property
    def is_expired(self) -> bool:
        return self.age_seconds > self.ttl_seconds

    def access(self):
        """访问记忆。"""
        self.last_accessed = time.monotonic()
        self.access_count += 1

    def retention_score(self, strategy: ForgettingStrategy = ForgettingStrategy.HYBRID) -> float:
        """计算保留分数——越低越应该遗忘。"""
        if strategy == ForgettingStrategy.TTL:
            return 0.0 if self.is_expired else 1.0

        elif strategy == ForgettingStrategy.LRU:
            return 1.0 / (1.0 + self.idle_seconds / 60)  # 空闲越久分数越低

        elif strategy == ForgettingStrategy.LFU:
            return min(self.access_count / 10.0, 1.0)  # 访问越多分数越高

        elif strategy == ForgettingStrategy.DECAY:
            # 指数衰减：importance * exp(-age/halflife)
            half_life = 3600  # 1小时半衰期
            return self.importance * math.exp(-self.age_seconds / half_life)

        elif strategy == ForgettingStrategy.RELEVANCE:
            return self.importance

        else:  # HYBRID
            decay = math.exp(-self.age_seconds / 7200)  # 2小时半衰期
            frequency = min(self.access_count / 5.0, 1.0)
            recency = 1.0 / (1.0 + self.idle_seconds / 60)
            return self.importance * 0.4 + decay * 0.2 + frequency * 0.2 + recency * 0.2


class TieredMemory:
    """分层记忆系统。"""

    def __init__(self, max_per_tier: dict = None, forgetting: ForgettingStrategy = ForgettingStrategy.HYBRID):
        self.max_per_tier = max_per_tier or &#123;
            MemoryTier.WORKING: 50,
            MemoryTier.SHORT_TERM: 100,
            MemoryTier.LONG_TERM: 500,
            MemoryTier.EPISODIC: 200,
        &#125;
        self.forgetting = forgetting
        self._memories: dict[MemoryTier, dict[str, MemoryItem]] = &#123;
            tier: &#123;&#125; for tier in MemoryTier
        &#125;
        self._next_id = 0
        self._forget_stats = &#123;"total_forgotten": 0, "by_strategy": defaultdict(int)&#125;

    def add(self, content: str, tier: MemoryTier, importance: float = 0.5,
            ttl: float = None, tags: list[str] = None) -> MemoryItem:
        """添加记忆。"""
        self._next_id += 1
        item = MemoryItem(
            memory_id=f"mem-&#123;self._next_id:06d&#125;",
            content=content,
            tier=tier,
            importance=importance,
            ttl_seconds=ttl or self._default_ttl(tier),
            tags=tags or [],
        )
        self._memories[tier][item.memory_id] = item

        # 检查容量——超限时触发遗忘
        if len(self._memories[tier]) > self.max_per_tier[tier]:
            self._forget(tier)

        return item

    def _default_ttl(self, tier: MemoryTier) -> float:
        return &#123;
            MemoryTier.WORKING: 600,      # 10分钟
            MemoryTier.SHORT_TERM: 3600,  # 1小时
            MemoryTier.LONG_TERM: 86400 * 7,  # 7天
            MemoryTier.EPISODIC: 86400 * 30,  # 30天
        &#125;.get(tier, 3600)

    def retrieve(self, tier: MemoryTier, query: str = None, limit: int = 5) -> list[MemoryItem]:
        """检索记忆。"""
        items = list(self._memories[tier].values())

        # 过滤过期
        items = [i for i in items if not i.is_expired]

        # 按保留分数排序
        items.sort(key=lambda i: i.retention_score(self.forgetting), reverse=True)

        # 简单关键词匹配
        if query:
            query_lower = query.lower()
            matched = [i for i in items if query_lower in i.content.lower()]
            if matched:
                items = matched

        # 访问并返回
        result = items[:limit]
        for item in result:
            item.access()
        return result

    def _forget(self, tier: MemoryTier):
        """执行遗忘策略。"""
        items = list(self._memories[tier].values())

        # 先清理过期
        expired = [i for i in items if i.is_expired]
        for item in expired:
            del self._memories[tier][item.memory_id]
            self._forget_stats["total_forgotten"] += 1
            self._forget_stats["by_strategy"]["ttl"] += 1

        # 如果还不够，按保留分数最低的遗忘
        if len(self._memories[tier]) > self.max_per_tier[tier]:
            items = list(self._memories[tier].values())
            items.sort(key=lambda i: i.retention_score(self.forgetting))
            excess = len(self._memories[tier]) - self.max_per_tier[tier]
            for item in items[:excess]:
                del self._memories[tier][item.memory_id]
                self._forget_stats["total_forgotten"] += 1
                self._forget_stats["by_strategy"][self.forgetting.value] += 1

    def consolidate(self, from_tier: MemoryTier, to_tier: MemoryTier, threshold: float = 0.6):
        """记忆巩固——将重要记忆从低层提升到高层。"""
        items = list(self._memories[from_tier].values())
        for item in items:
            if item.importance >= threshold and item.access_count >= 2:
                # 提升到更高层
                item.tier = to_tier
                item.ttl_seconds = self._default_ttl(to_tier)
                self._memories[to_tier][item.memory_id] = item
                del self._memories[from_tier][item.memory_id]

    def get_stats(self) -> dict:
        return &#123;
            "by_tier": &#123;tier.value: len(items) for tier, items in self._memories.items()&#125;,
            "total": sum(len(items) for items in self._memories.values()),
            "forgotten": self._forget_stats["total_forgotten"],
            "forget_reasons": dict(self._forget_stats["by_strategy"]),
        &#125;
```

### 使用示例

```python
import asyncio

async def main():
    memory = TieredMemory(
        max_per_tier=&#123;MemoryTier.WORKING: 5, MemoryTier.SHORT_TERM: 10, MemoryTier.LONG_TERM: 20, MemoryTier.EPISODIC: 10&#125;,
        forgetting=ForgettingStrategy.HYBRID,
    )

    # 添加工作记忆
    for i in range(8):  # 超过容量5，触发遗忘
        mem = memory.add(
            content=f"用户问了问题&#123;i&#125;",
            tier=MemoryTier.WORKING,
            importance=0.3 if i < 5 else 0.8,
            tags=["question"],
        )

    print(f"添加后统计: &#123;memory.get_stats()&#125;")

    # 访问某些记忆（提高其保留分数）
    items = memory.retrieve(MemoryTier.WORKING, "问题")
    print(f"检索到 &#123;len(items)&#125; 条工作记忆")
    for item in items:
        print(f"  [&#123;item.memory_id&#125;] &#123;item.content&#125; (score=&#123;item.retention_score():.2f&#125;)")

    # 巩固重要记忆
    memory.consolidate(MemoryTier.WORKING, MemoryTier.SHORT_TERM, threshold=0.7)
    print(f"\n巩固后: &#123;memory.get_stats()&#125;")

asyncio.run(main())
```

---

## 三、遗忘策略对比

| 策略 | 原理 | 优点 | 缺点 | 适用 |
|------|------|------|------|------|
| TTL | 到期就忘 | 简单 | 可能忘重要的 | 临时信息 |
| LRU | 最久没用先忘 | 常用保留 | 冷门但重要的会丢 | 缓存 |
| LFU | 用得少先忘 | 热点保留 | 新记忆没机会 | 高频访问 |
| 衰减 | 时间指数衰减 | 平滑 | 调参复杂 | 通用 |
| 相关性 | 重要度低先忘 | 保留关键 | 主观 | 关键信息 |
| 混合 | 多维度综合 | 平衡 | 计算多 | 生产 |

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 分层不同TTL | 工作记忆短，长期记忆长 | ★★★ |
| 混合遗忘策略 | 重要性+时间+频率 | ★★★ |
| 记忆巩固机制 | 重要记忆自动升级 | ★★★ |
| 容量上限 | 每层有上限触发遗忘 | ★★☆ |
| 访问时刷新 | 被检索的记忆延长生命 | ★★☆ |
| 遗忘统计 | 可追踪遗忘量和原因 | ★☆☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有分层记忆 | ☐ |
| 有遗忘策略 | ☐ |
| 有记忆巩固 | ☐ |
| 有保留分数 | ☐ |
| 有容量限制 | ☐ |
| 有遗忘统计 | ☐ |
