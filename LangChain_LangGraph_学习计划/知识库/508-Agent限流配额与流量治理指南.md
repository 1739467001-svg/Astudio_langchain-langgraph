# Agent 限流配额与流量治理指南

> 1000 个用户同时调 Agent——API 每分钟只允许 500 次。谁等待？谁拒绝？VIP 优先还是公平排队？限流配额就是解决"有限资源怎么分配"的问题。本指南系统讲解限流算法、多维度配额、优先级调度、流量整形。

---

## 1. 限流算法

### 四种算法对比

```mermaid
graph TB
    RL["限流算法"]

    RL --> TOKEN["令牌桶<br/>允许突发<br/>匀速补充令牌"]
    RL --> LEAKY["漏桶<br/>匀速处理<br/>不允许突发"]
    RL --> FIXED["固定窗口<br/>简单<br/>临界点双倍"]
    RL --> SLIDE["滑动窗口<br/>精确<br/>实现复杂"]

    style RL fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style TOKEN fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

### 算法实现

```python
import time
from collections import deque
from dataclasses import dataclass, field

@dataclass
class TokenBucket:
    """令牌桶：允许突发流量"""
    capacity: int = 100         # 桶容量（最大突发）
    refill_rate: float = 10.0   # 每秒补充令牌
    tokens: float = 100
    last_refill: float = field(default_factory=time.time)

    def allow(self) -> bool:
        """是否允许请求"""
        now = time.time()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False

@dataclass
class SlidingWindow:
    """滑动窗口：精确限流"""
    max_requests: int = 100
    window_seconds: int = 60
    requests: deque = field(default_factory=deque)

    def allow(self) -> bool:
        """是否允许"""
        now = time.time()
        # 清理过期请求
        while self.requests and self.requests[0] <= now - self.window_seconds:
            self.requests.popleft()

        if len(self.requests) < self.max_requests:
            self.requests.append(now)
            return True
        return False
```

---

## 2. 多维度配额

```python
@dataclass
class MultiDimensionQuota:
    """多维度配额管理"""

    # 按用户/租户/全局三层配额
    user_quotas = {
        "free": {"rpm": 10, "tpm": 10000, "daily": 100},
        "pro": {"rpm": 100, "tpm": 100000, "daily": 5000},
        "enterprise": {"rpm": 1000, "tpm": 1000000, "daily": 50000},
    }

    # 限流器实例
    user_limiters: dict = field(default_factory=dict)
    global_limiter: SlidingWindow = field(default_factory=lambda: SlidingWindow(500, 60))

    async def check(self, user_id: str, tier: str, tokens: int = 100) -> dict:
        """检查配额"""
        # 1. 用户级检查
        if user_id not in self.user_limiters:
            quota = self.user_quotas.get(tier, self.user_quotas["free"])
            self.user_limiters[user_id] = {
                "rpm": SlidingWindow(quota["rpm"], 60),
                "tpm": TokenBucket(capacity=quota["tpm"], refill_rate=quota["tpm"]/60),
                "daily_count": 0,
                "daily_limit": quota["daily"],
                "daily_reset": time.time() + 86400,
            }

        limiter = self.user_limiters[user_id]

        # 日配额重置
        if time.time() > limiter["daily_reset"]:
            limiter["daily_count"] = 0
            limiter["daily_reset"] = time.time() + 86400

        # 检查 RPM
        if not limiter["rpm"].allow():
            return {"allowed": False, "reason": "用户RPM超限"}

        # 检查 TPM
        if limiter["tpm"].tokens < tokens:
            return {"allowed": False, "reason": "用户TPM超限"}

        # 检查日配额
        if limiter["daily_count"] >= limiter["daily_limit"]:
            return {"allowed": False, "reason": "日配额用尽"}

        # 2. 全局检查
        if not self.global_limiter.allow():
            return {"allowed": False, "reason": "全局RPM超限"}

        # 3. 扣费
        limiter["tpm"].tokens -= tokens
        limiter["daily_count"] += 1

        return {
            "allowed": True,
            "remaining_rpm": len(limiter["rpm"].requests),
            "remaining_tpm": int(limiter["tpm"].tokens),
            "remaining_daily": limiter["daily_limit"] - limiter["daily_count"],
        }
```

---

## 3. 优先级调度

```python
@dataclass
class PriorityScheduler:
    """优先级调度"""

    async def schedule(self, request: dict) -> dict:
        """按优先级调度"""
        priority = request.get("priority", "normal")
        tier = request.get("tier", "free")

        # 优先级映射
        priority_order = {"critical": 0, "high": 1, "normal": 2, "low": 3, "batch": 4}

        # VIP 用户优先
        if tier == "enterprise":
            return {"action": "immediate", "reason": "企业用户"}

        # 关键任务优先
        if priority == "critical":
            return {"action": "immediate", "reason": "关键任务"}

        # 普通：检查队列
        queue_size = await self._get_queue_size()
        if queue_size > 100:
            if priority_order.get(priority, 3) >= 3:
                return {"action": "reject", "reason": "队列满+低优先级"}
            return {"action": "queue", "estimated_wait": queue_size * 2}

        return {"action": "process", "reason": "正常处理"}

    async def _get_queue_size(self) -> int:
        return 0
```

---

## 4. 流量整形

```python
@dataclass
class TrafficShaper:
    """流量整形：平滑流量"""

    async def smooth_requests(self, requests: list, max_concurrent: int = 10):
        """平滑请求"""
        semaphore = asyncio.Semaphore(max_concurrent)
        results = []

        async def process_with_limit(req):
            async with semaphore:
                return await self._process(req)

        tasks = [process_with_limit(req) for req in requests]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return results

    async def rate_smoothing(self, batch: list, interval_ms: int = 100):
        """速率平滑：每 interval_ms 处理一个"""
        results = []
        for req in batch:
            result = await self._process(req)
            results.append(result)
            await asyncio.sleep(interval_ms / 1000)  # 间隔
        return results

    async def _process(self, req):
        return f"processed: {req}"
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四种限流算法 | ☐ |
| 实现了令牌桶 | ☐ |
| 实现了滑动窗口 | ☐ |
| 实现了多维度配额（用户+全局） | ☐ |
| 实现了优先级调度 | ☐ |
| 实现了流量整形 | ☐ |
| 配置了 RPM/TPM/日配额 | ☐ |
| 有限流拒绝响应 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 78 | 流量整形与请求队列 | 流量 |
| 108 | 断路器模式 | 熔断 |
| 109 | 流量整形 | 整形 |
| 166 | API 限流与流量管理 | 限流 |
| 198 | API 限流与流量管理 | 限流 |
| 269 | 流量整形 | 整形 |
| 329 | 多租户限流 | 租户 |
| 359 | 多租户资源配额与限流 | 配额 |
| 405 | 多租户隔离与资源配额 | 隔离 |
| 456 | 多 Agent 博弈与资源调度 | 调度 |
| 473 | Agent 可靠性与韧性 | 韧性 |
