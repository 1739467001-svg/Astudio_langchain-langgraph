# Agent 工具结果缓存与去重

> Agent 执行中经常重复调用同一工具同一参数——搜索同一个关键词、查询同一个 API。每次都重新执行，浪费时间。工具结果缓存让相同调用直接返回缓存结果，大幅减少延迟和成本。

---

## 一、为什么需要工具结果缓存

```mermaid
graph TB
    subgraph 没有缓存 &#123;"无缓存：重复调用"&#125;
        U1["用户A: 搜索'Python教程'"] --> T1["调用search工具<br/>500ms"]
        U2["用户B: 搜索'Python教程'"] --> T2["调用search工具<br/>500ms"]
        U3["Agent内部: 再次搜索'Python教程'"] --> T3["调用search工具<br/>500ms"]
        TOTAL1["总计: 1500ms, 3次API调用"]
    end

    subgraph 有缓存 &#123;"有缓存：命中返回"&#125;
        U4["用户A: 搜索'Python教程'"] --> T4["调用search工具<br/>500ms → 缓存"]
        U5["用户B: 搜索'Python教程'"] --> T5["✅ 缓存命中<br/>5ms"]
        U6["Agent: 再次搜索"] --> T6["✅ 缓存命中<br/>5ms"]
        TOTAL2["总计: 510ms, 1次API调用"]
    end

    style 没有缓存 fill:#FFCDD2
    style 有缓存 fill:#C8E6C9
```

---

## 二、缓存架构

```mermaid
graph TB
    subgraph 架构 &#123;"工具结果缓存架构"&#125;
        CALL["工具调用"] --> KEY["生成缓存键<br/>tool_name + 参数hash"]
        KEY --> CHECK&#123;"缓存命中？"&#125;
        CHECK -->|命中| RETURN["返回缓存<br/>~5ms"]
        CHECK -->|未命中| EXEC["执行工具<br/>~500ms"]
        EXEC --> STORE["存入缓存"]
        STORE --> RETURN2["返回结果"]
    end

    style CHECK fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style RETURN fill:#C8E6C9
```

---

## 三、实现

```python
import hashlib
import time
import json
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable
import asyncio

@dataclass
class CachedResult:
    """缓存的工具结果。"""
    value: Any
    created_at: float
    ttl: float  # 生存时间(秒)
    hit_count: int = 0

    @property
    def is_expired(self) -> bool:
        return time.time() - self.created_at > self.ttl

class ToolResultCache:
    """工具结果缓存器。

    根据工具名+参数生成缓存键，
    相同调用直接返回缓存结果。

    特点：
    - 精确匹配（tool_name + 参数hash）
    - TTL过期（防止数据过时）
    - 可选语义匹配（相似参数也命中）
    - 线程安全（asyncio.Lock）
    """

    def __init__(self, default_ttl: float = 300):  # 默认5分钟
        self.cache: dict[str, CachedResult] = &#123;&#125;
        self.default_ttl = default_ttl
        self._lock = asyncio.Lock()
        self.stats = &#123;"hits": 0, "misses": 0&#125;

    def _make_key(self, tool_name: str, args: dict) -> str:
        """生成缓存键。"""
        # 参数排序后hash，确保顺序不影响
        sorted_args = json.dumps(args, sort_keys=True, ensure_ascii=False)
        args_hash = hashlib.md5(sorted_args.encode()).hexdigest()
        return f"&#123;tool_name&#125;:&#123;args_hash&#125;"

    async def get_or_execute(
        self,
        tool_name: str,
        args: dict,
        execute_func: Callable,
        ttl: float | None = None,
    ) -> Any:
        """获取缓存或执行工具。

        Args:
            tool_name: 工具名称
            args: 工具参数
            execute_func: 实际执行函数
            ttl: 缓存TTL（None用默认）

        Returns:
            工具结果（缓存或新执行）
        """
        key = self._make_key(tool_name, args)
        ttl = ttl or self.default_ttl

        async with self._lock:
            # 检查缓存
            if key in self.cache:
                cached = self.cache[key]
                if not cached.is_expired:
                    cached.hit_count += 1
                    self.stats["hits"] += 1
                    return cached.value
                else:
                    del self.cache[key]

        # 执行工具（不加锁，允许并发）
        self.stats["misses"] += 1
        result = await execute_func(**args)

        # 存入缓存
        async with self._lock:
            self.cache[key] = CachedResult(
                value=result,
                created_at=time.time(),
                ttl=ttl,
            )

        return result

    def invalidate(self, tool_name: str, args: dict = None):
        """失效缓存。"""
        if args:
            key = self._make_key(tool_name, args)
            self.cache.pop(key, None)
        else:
            # 失效该工具的所有缓存
            keys_to_remove = [k for k in self.cache if k.startswith(f"&#123;tool_name&#125;:")]
            for k in keys_to_remove:
                del self.cache[k]

    def clear(self):
        """清空所有缓存。"""
        self.cache.clear()

    def stats_report(self) -> dict:
        """缓存统计。"""
        total = self.stats["hits"] + self.stats["misses"]
        hit_rate = self.stats["hits"] / total if total > 0 else 0
        return &#123;
            **self.stats,
            "hit_rate": round(hit_rate, 4),
            "cache_size": len(self.cache),
            "total_calls": total,
        &#125;
```

---

## 四、与 LangChain Tool 集成

```python
from langchain_core.tools import tool, BaseTool
from functools import wraps

def cached_tool(cache: ToolResultCache, ttl: float = 300):
    """工具结果缓存装饰器。

    用法：
    @cached_tool(cache, ttl=600)
    @tool
    def search(query: str) -> str:
        return "搜索结果"
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(**kwargs):
            return await cache.get_or_execute(
                tool_name=func.name if hasattr(func, 'name') else func.__name__,
                args=kwargs,
                execute_func=func,
                ttl=ttl,
            )
        return wrapper
    return decorator

# 使用
cache = ToolResultCache(default_ttl=300)

@cached_tool(cache, ttl=600)  # 搜索结果缓存10分钟
@tool
async def search_web(query: str) -> str:
    """搜索网络"""
    # 实际搜索逻辑
    await asyncio.sleep(0.5)  # 模拟延迟
    return f"搜索结果: &#123;query&#125;"

@cached_tool(cache, ttl=3600)  # 天气缓存1小时
@tool
async def get_weather(city: str) -> str:
    """获取天气"""
    await asyncio.sleep(0.3)
    return f"&#123;city&#125;: 晴25°C"

# Agent调用时自动缓存
# 第一次调用：实际执行
result1 = await search_web.ainvoke(&#123;"query": "Python教程"&#125;)  # 500ms
# 第二次相同调用：缓存命中
result2 = await search_web.ainvoke(&#123;"query": "Python教程"&#125;)  # 5ms
```

---

## 五、缓存策略

```mermaid
graph TB
    subgraph 策略 &#123;"按工具类型设置TTL"&#125;
        S1["搜索工具<br/>TTL=10分钟<br/>搜索结果变化不快"]
        S2["天气工具<br/>TTL=1小时<br/>天气不会突然变"]
        S3["数据库查询<br/>TTL=5分钟<br/>数据可能更新"]
        S4["实时API<br/>TTL=0<br/>不缓存(如股价)"]
        S5["计算工具<br/>TTL=∞<br/>计算结果不变"]
    end

    style 策略 fill:#E3F2FD
```

```python
TOOL_TTL_CONFIG = &#123;
    "search_web": 600,        # 搜索: 10分钟
    "get_weather": 3600,      # 天气: 1小时
    "query_database": 300,    # 数据库: 5分钟
    "calculate": float('inf'),# 计算: 永久
    "real_time_price": 0,     # 实时: 不缓存
    "file_read": 60,          # 文件: 1分钟
&#125;

class SmartToolCache(ToolResultCache):
    """智能工具缓存：按工具类型自动设置TTL。"""

    def __init__(self):
        super().__init__(default_ttl=300)
        self.tool_ttls = TOOL_TTL_CONFIG

    async def get_or_execute(self, tool_name, args, execute_func, ttl=None):
        # 自动根据工具名选择TTL
        if ttl is None:
            ttl = self.tool_ttls.get(tool_name, self.default_ttl)

        # TTL=0表示不缓存
        if ttl == 0:
            return await execute_func(**args)

        return await super().get_or_execute(tool_name, args, execute_func, ttl)
```

---

## 六、效果评估

```python
class CacheEffectivenessEvaluator:
    """缓存效果评估器。"""

    @staticmethod
    async def evaluate(
        cache: ToolResultCache,
        tool_calls: list[dict],  # [&#123;tool, args&#125;]
    ) -> dict:
        """评估缓存效果。"""
        total_with_cache = 0
        total_without_cache = 0
        cache.clear()

        for call in tool_calls:
            tool_name = call["tool"]
            args = call["args"]

            # 模拟无缓存（每次实际执行）
            start = time.time()
            await cache.get_or_execute(tool_name, args, lambda **a: asyncio.sleep(0.5), ttl=0)
            total_without_cache += time.time() - start

        cache.clear()

        # 有缓存
        for call in tool_calls:
            tool_name = call["tool"]
            args = call["args"]
            start = time.time()
            await cache.get_or_execute(tool_name, args, lambda **a: asyncio.sleep(0.5))
            total_with_cache += time.time() - start

        stats = cache.stats_report()
        return &#123;
            "total_calls": len(tool_calls),
            "cache_hits": stats["hits"],
            "hit_rate": stats["hit_rate"],
            "time_without_cache_s": round(total_without_cache, 2),
            "time_with_cache_s": round(total_with_cache, 2),
            "speedup": round(total_without_cache / max(total_with_cache, 0.001), 1),
        &#125;
```

---

## 七、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 搜索结果缓存10分钟 | 搜索结果变化不快 | ★★★ |
| 计算结果永久缓存 | 相同输入结果不变 | ★★★ |
| 实时数据不缓存 | 股价/库存等 | ★★★ |
| Agent内部调用缓存 | Agent可能重复调同一工具 | ★★☆ |
| 定期清理过期缓存 | 防止内存膨胀 | ★★☆ |
| 监控缓存命中率 | <20%说明策略有问题 | ★★☆ |

---

## 八、检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了工具结果缓存 | ☐ |
| 按工具类型设置TTL | ☐ |
| 能与LangChain Tool集成 | ☐ |
| 实时数据不缓存 | ☐ |
| 有缓存命中率监控 | ☐ |
ENDOF
```

替换：
```
