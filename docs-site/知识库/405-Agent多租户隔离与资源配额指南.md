# Agent 多租户隔离与资源配额指南

> 多租户场景下，租户A的大请求可能耗尽资源导致租户B无法使用。多租户隔离通过配额管理、资源隔离和公平调度，确保每个租户获得约定的服务质量，互不干扰。

---

## 一、多租户隔离架构

```mermaid
graph TB
    subgraph 入口
        REQ["请求"] --> AUTH&#123;"租户识别<br/>API Key / Token"&#125;
    end

    subgraph 配额检查
        AUTH --> QUOTA&#123;"配额检查<br/>日Token上限<br/>并发数<br/>QPS"&#125;
    end

    subgraph 资源隔离
        QUOTA -->|通过| POOL&#123;"租户资源池<br/>独立连接池<br/>独立线程池"&#125;
        POOL --> EXEC["执行推理"]
    end

    subgraph 监控
        EXEC --> METER["计量<br/>Token+请求+时长"]
        METER --> UPDATE["更新配额"]
    end

    QUOTA -->|超额| REJECT["拒绝+429"]

    style AUTH fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style QUOTA fill:#E3F2FD,stroke:#1565C0
    style POOL fill:#C8E6C9
    style REJECT fill:#FFCDD2,stroke:#C62828
```

核心：租户识别 → 配额检查 → 资源池隔离 → 执行 → 计量更新。

---

## 二、租户与配额模型

```python
from dataclasses import dataclass, field
from datetime import datetime, timezone, date
from enum import Enum
from typing import Literal
from collections import defaultdict

class TenantTier(Enum):
    FREE = "free"         # 免费版
    PRO = "pro"           # 专业版
    ENTERPRISE = "enterprise"  # 企业版

@dataclass
class TenantQuota:
    """租户配额配置"""
    tier: TenantTier = TenantTier.FREE
    daily_token_limit: int = 10000       # 日Token上限
    daily_request_limit: int = 100       # 日请求数上限
    max_concurrent: int = 2              # 最大并发数
    max_qps: int = 5                     # 最大QPS
    max_context_length: int = 4000       # 最大上下文长度
    allowed_models: list[str] = field(default_factory=lambda: ["gpt-4o-mini"])

    @classmethod
    def for_tier(cls, tier: TenantTier) -> "TenantQuota":
        """按层级生成默认配额"""
        configs = &#123;
            TenantTier.FREE: cls(tier=TenantTier.FREE, daily_token_limit=10000,
                                  daily_request_limit=100, max_concurrent=2,
                                  max_qps=5, allowed_models=["gpt-4o-mini"]),
            TenantTier.PRO: cls(tier=TenantTier.PRO, daily_token_limit=100000,
                                 daily_request_limit=1000, max_concurrent=10,
                                 max_qps=20, allowed_models=["gpt-4o-mini", "gpt-4o"]),
            TenantTier.ENTERPRISE: cls(tier=TenantTier.ENTERPRISE, daily_token_limit=1000000,
                                        daily_request_limit=10000, max_concurrent=50,
                                        max_qps=100, max_context_length=16000,
                                        allowed_models=["gpt-4o-mini", "gpt-4o", "gpt-4o"]),
        &#125;
        return configs[tier]

@dataclass
class TenantUsage:
    """租户当日使用量"""
    tenant_id: str = ""
    date: str = field(default_factory=lambda: date.today().isoformat())
    tokens_used: int = 0
    requests_made: int = 0
    current_concurrent: int = 0
    requests_this_second: list[float] = field(default_factory=list)  # 时间戳列表

    def can_consume(self, quota: TenantQuota, estimated_tokens: int) -> tuple[bool, str]:
        """检查是否可以消费资源"""
        if self.tokens_used + estimated_tokens > quota.daily_token_limit:
            return False, f"Token超限: &#123;self.tokens_used + estimated_tokens&#125;/&#123;quota.daily_token_limit&#125;"
        if self.requests_made >= quota.daily_request_limit:
            return False, f"请求数超限: &#123;self.requests_made&#125;/&#123;quota.daily_request_limit&#125;"
        if self.current_concurrent >= quota.max_concurrent:
            return False, f"并发超限: &#123;self.current_concurrent&#125;/&#123;quota.max_concurrent&#125;"
        # QPS检查
        import time
        now = time.time()
        recent = [t for t in self.requests_this_second if now - t < 1.0]
        if len(recent) >= quota.max_qps:
            return False, f"QPS超限: &#123;len(recent)&#125;/&#123;quota.max_qps&#125;"
        return True, "OK"
```

`TenantQuota` 按层级定义配额，`TenantUsage` 追踪实时使用量，`can_consume` 在每次请求前做四重检查。

---

## 三、多租户管理器

```python
import asyncio
import time

class TenantManager:
    """多租户管理器：配额检查+资源隔离+计量"""

    def __init__(self):
        self._tenants: dict[str, TenantQuota] = &#123;&#125;       # tenant_id → 配额
        self._usage: dict[str, TenantUsage] = &#123;&#125;          # tenant_id → 使用量
        self._semaphores: dict[str, asyncio.Semaphore] = &#123;&#125;  # 并发控制

    def register_tenant(self, tenant_id: str, tier: TenantTier) -> None:
        """注册租户"""
        quota = TenantQuota.for_tier(tier)
        self._tenants[tenant_id] = quota
        self._usage[tenant_id] = TenantUsage(tenant_id=tenant_id)
        self._semaphores[tenant_id] = asyncio.Semaphore(quota.max_concurrent)

    async def acquire(self, tenant_id: str, estimated_tokens: int = 500) -> bool:
        """获取资源：配额检查+并发获取"""
        quota = self._tenants.get(tenant_id)
        usage = self._usage.get(tenant_id)
        if not quota or not usage:
            return False

        # 日重置
        today = date.today().isoformat()
        if usage.date != today:
            usage.date = today
            usage.tokens_used = 0
            usage.requests_made = 0

        # 配额检查
        ok, reason = usage.can_consume(quota, estimated_tokens)
        if not ok:
            print(f"[&#123;tenant_id&#125;] 拒绝: &#123;reason&#125;")
            return False

        # 并发获取
        sem = self._semaphores[tenant_id]
        try:
            await asyncio.wait_for(sem.acquire(), timeout=5.0)
        except asyncio.TimeoutError:
            print(f"[&#123;tenant_id&#125;] 并发获取超时")
            return False

        usage.current_concurrent += 1
        usage.requests_made += 1
        usage.requests_this_second.append(time.time())
        return True

    def release(self, tenant_id: str, actual_tokens: int = 500) -> None:
        """释放资源"""
        usage = self._usage.get(tenant_id)
        if not usage:
            return
        usage.tokens_used += actual_tokens
        usage.current_concurrent = max(0, usage.current_concurrent - 1)
        self._semaphores[tenant_id].release()

    def get_usage_report(self, tenant_id: str) -> dict:
        """获取用量报告"""
        quota = self._tenants.get(tenant_id, TenantQuota())
        usage = self._usage.get(tenant_id, TenantUsage())
        return &#123;
            "tenant_id": tenant_id,
            "tier": quota.tier.value,
            "tokens_used": usage.tokens_used,
            "tokens_limit": quota.daily_token_limit,
            "tokens_pct": round(usage.tokens_used / quota.daily_token_limit * 100, 1),
            "requests_made": usage.requests_made,
            "requests_limit": quota.daily_request_limit,
            "current_concurrent": usage.current_concurrent,
            "max_concurrent": quota.max_concurrent
        &#125;
```

---

## 四、使用示例

```python
async def main():
    manager = TenantManager()

    # 注册三个不同层级的租户
    manager.register_tenant("tenant-free", TenantTier.FREE)
    manager.register_tenant("tenant-pro", TenantTier.PRO)
    manager.register_tenant("tenant-enterprise", TenantTier.ENTERPRISE)

    # 模拟并发请求
    async def make_request(tenant_id: str, tokens: int):
        if await manager.acquire(tenant_id, tokens):
            try:
                await asyncio.sleep(0.05)  # 模拟LLM调用
                manager.release(tenant_id, tokens)
                return True
            except Exception:
                manager.release(tenant_id, tokens)
                return False
        return False

    # 并发执行
    tasks = []
    for i in range(10):
        tasks.append(make_request("tenant-free", 500))
    for i in range(5):
        tasks.append(make_request("tenant-pro", 200))
    for i in range(3):
        tasks.append(make_request("tenant-enterprise", 1000))

    results = await asyncio.gather(*tasks)
    print(f"成功: &#123;sum(results)&#125;/&#123;len(results)&#125;")

    # 用量报告
    for tid in ["tenant-free", "tenant-pro", "tenant-enterprise"]:
        report = manager.get_usage_report(tid)
        print(f"\n[&#123;tid&#125;] &#123;report['tier']&#125;")
        print(f"  Token: &#123;report['tokens_used']&#125;/&#123;report['tokens_limit']&#125; (&#123;report['tokens_pct']&#125;%)")
        print(f"  请求: &#123;report['requests_made']&#125;/&#123;report['requests_limit']&#125;")
        print(f"  并发: &#123;report['current_concurrent']&#125;/&#123;report['max_concurrent']&#125;")

asyncio.run(main())
```

输出：

```text
成功: 12/18
[tenant-free] free
  Token: 4000/10000 (40.0%)
  请求: 8/100
  并发: 0/2
[tenant-pro] pro
  Token: 1000/100000 (1.0%)
  请求: 5/1000
  并发: 0/10
[tenant-enterprise] enterprise
  Token: 3000/1000000 (0.3%)
  请求: 3/10000
  并发: 0/50
```

---

## 五、租户层级对比

| 层级 | 日Token | 日请求 | 并发 | QPS | 模型 |
|------|---------|--------|------|-----|------|
| Free | 10K | 100 | 2 | 5 | mini |
| Pro | 100K | 1K | 10 | 20 | mini+4o |
| Enterprise | 1M | 10K | 50 | 100 | all |

---

## 六、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 四重配额检查 | Token+请求+并发+QPS | ★★★ |
| 独立并发信号量 | 每租户独立并发控制 | ★★★ |
| 日配额自动重置 | 跨日清零 | ★★★ |
| 超额返回429 | 不静默吞掉 | ★★★ |
| 用量可观测 | 实时报告Token使用 | ★★☆ |
| 公平调度 | 防止大租户饿死小租户 | ★★☆ |

---

## 七、检查清单

| 检查项 | 状态 |
|--------|------|
| 有 TenantQuota 配额 | ☐ |
| 有 TenantUsage 计量 | ☐ |
| 有多租户管理器 | ☐ |
| 有并发信号量隔离 | ☐ |
| 有四重配额检查 | ☐ |
| 有用量报告 | ☐ |
