# LLM 应用 API 限流与流量管理

> LLM API 调用是按量计费的——如果用户突然涌入，不仅成本飙升，还可能触发 API 限流导致服务不可用。这份指南讲透令牌桶、漏桶、优先级队列和自适应限流。

---

## 一、限流算法对比

```mermaid
graph TB
    subgraph 算法 &#123;"4种限流算法"&#125;
        A1["令牌桶<br/>允许突发<br/>推荐"]
        A2["漏桶<br/>匀速处理<br/>保护后端"]
        A3["滑动窗口<br/>精确控制<br/>复杂"]
        A4["并发限制<br/>控制同时请求数<br/>简单"]
    end

    style A1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、令牌桶实现

```python
import time
from dataclasses import dataclass
from collections import defaultdict

@dataclass
class TokenBucket:
    """令牌桶限流器。

    核心原理：
    - 桶容量=最大突发量
    - 速率=每秒补充令牌数
    - 请求消耗1个令牌
    - 无令牌则拒绝/排队
    """
    capacity: int        # 桶容量（最大突发）
    rate: float          # 每秒补充令牌数
    tokens: float = 0    # 当前令牌数
    last_refill: float = 0

    def __post_init__(self):
        self.tokens = self.capacity
        self.last_refill = time.time()

    def _refill(self):
        """补充令牌。"""
        now = time.time()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.last_refill = now

    def try_acquire(self, tokens: int = 1) -> bool:
        """尝试获取令牌。"""
        self._refill()
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

    def wait_time(self, tokens: int = 1) -> float:
        """估算等待时间。"""
        self._refill()
        if self.tokens >= tokens:
            return 0
        needed = tokens - self.tokens
        return needed / self.rate if self.rate > 0 else float('inf')


class TieredRateLimiter:
    """分级限流器——按用户等级设置不同限制。"""

    TIERS = &#123;
        "free": TokenBucket(capacity=5, rate=1),      # 免费: 1 QPS, 突发5
        "basic": TokenBucket(capacity=20, rate=5),     # 基础: 5 QPS, 突发20
        "premium": TokenBucket(capacity=100, rate=20), # 高级: 20 QPS, 突发100
        "enterprise": TokenBucket(capacity=500, rate=100),  # 企业: 100 QPS
    &#125;

    def __init__(self):
        self.buckets: dict[str, TokenBucket] = &#123;&#125;

    def get_bucket(self, user_id: str, tier: str = "free") -> TokenBucket:
        """获取用户的令牌桶。"""
        key = f"&#123;user_id&#125;:&#123;tier&#125;"
        if key not in self.buckets:
            template = self.TIERS.get(tier, self.TIERS["free"])
            self.buckets[key] = TokenBucket(
                capacity=template.capacity,
                rate=template.rate,
            )
        return self.buckets[key]

    def allow(self, user_id: str, tier: str = "free") -> bool:
        """检查是否允许请求。"""
        bucket = self.get_bucket(user_id, tier)
        return bucket.try_acquire()
```

---

## 三、优先级队列

```mermaid
graph TB
    subgraph 队列 &#123;"优先级队列"&#125;
        HIGH["高优先级<br/>付费用户<br/>先处理"]
        MED["中优先级<br/>普通用户"]
        LOW["低优先级<br/>免费用户<br/>可降级"]
    end

    HIGH --> WORKER["Worker池"]
    MED --> WORKER
    LOW --> WORKER

    style HIGH fill:#FFCDD2
    style LOW fill:#E3F2FD
```

```python
import asyncio
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

class Priority(int, Enum):
    HIGH = 0      # 数值越小优先级越高
    MEDIUM = 1
    LOW = 2

@dataclass(order=True)
class PriorityTask:
    """优先级任务。"""
    priority: int
    task_id: str = field(compare=False)
    data: Any = field(default=None, compare=False)

class PriorityQueue:
    """优先级请求队列。

    高优先级请求先处理，
    低优先级可降级或排队。
    """

    def __init__(self, max_concurrent: int = 10):
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._max_concurrent = max_concurrent
        self._workers: list[asyncio.Task] = []

    async def submit(self, task: PriorityTask):
        """提交任务。"""
        await self._queue.put(task)

    async def start_workers(self, handler: callable):
        """启动工作协程。"""
        for i in range(self._max_concurrent):
            worker = asyncio.create_task(self._worker(handler, i))
            self._workers.append(worker)

    async def _worker(self, handler: callable, worker_id: int):
        """工作协程。"""
        while True:
            task = await self._queue.get()
            try:
                await handler(task.data)
            except Exception as e:
                pass
            finally:
                self._queue.task_done()

    @property
    def pending(self) -> int:
        return self._queue.qsize()
```

---

## 四、自适应限流

```python
class AdaptiveRateLimiter:
    """自适应限流器——根据系统负载动态调整。"""

    def __init__(self, initial_rate: float = 10, min_rate: float = 1, max_rate: float = 100):
        self.rate = initial_rate
        self.min_rate = min_rate
        self.max_rate = max_rate
        self.error_count = 0
        self.success_count = 0

    def record_success(self):
        """记录成功。"""
        self.success_count += 1
        # 成功率高→逐步提升限制
        if self.success_count > 10 and self.error_count / max(self.success_count, 1) < 0.05:
            self.rate = min(self.max_rate, self.rate * 1.1)
            self.success_count = 0
            self.error_count = 0

    def record_error(self):
        """记录错误。"""
        self.error_count += 1
        # 错误率高→降低限制
        if self.error_count > 3:
            self.rate = max(self.min_rate, self.rate * 0.5)
            self.error_count = 0

    def allow(self) -> bool:
        """是否允许请求。"""
        bucket = TokenBucket(capacity=int(self.rate), rate=self.rate)
        return bucket.try_acquire()

    def stats(self) -> dict:
        return &#123;
            "current_rate": round(self.rate, 2),
            "min_rate": self.min_rate,
            "max_rate": self.max_rate,
            "success_count": self.success_count,
            "error_count": self.error_count,
        &#125;
```

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 用令牌桶 | 允许突发，适合LLM场景 | ★★★ |
| 按用户等级限流 | 付费/免费不同限制 | ★★★ |
| 有优先级队列 | 高优先级先处理 | ★★☆ |
| 自适应限流 | 根据负载动态调整 | ★★☆ |
| 限流要返回友好的429 | 不要直接拒绝 | ★★★ |
| 监控限流触发率 | 调整限制参数 | ★★☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 有令牌桶限流器 | ☐ |
| 有分级限流 | ☐ |
| 有优先级队列 | ☐ |
| 有自适应限流 | ☐ |
