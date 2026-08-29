# Tool 缓存与工具结果复用指南

> Agent 调用工具是最慢的环节——搜索 200ms、查询数据库 100ms、调用 API 500ms。如果同样的参数已经调用过，为什么要重复执行？Tool 缓存让相同输入直接返回缓存结果，延迟从秒级降到毫秒级，成本降到零。

---

## 1. 工具缓存的价值

### 问题：重复调用

```
用户："北京今天天气怎么样？"
Agent → 调用 weather_api(city="北京") → 300ms → 返回 28°C

用户 5 秒后："那上海呢？顺便再确认下北京"
Agent → 调用 weather_api(city="上海") → 300ms
Agent → 调用 weather_api(city="北京") → 300ms  ← 重复！

优化：北京的结果还在缓存里，直接返回
Agent → 调用 weather_api(city="上海") → 300ms
Agent → 缓存命中 weather_api(city="北京") → 0ms  ← 省了 300ms
```

### 缓存收益

| 场景 | 无缓存 | 有缓存 | 节省 |
|------|--------|--------|------|
| 天气查询（5分钟内重复） | 300ms/次 | 0ms | 100% |
| 数据库查询（同条件） | 100ms/次 | 0ms | 100% |
| API 调用（有配额限制） | 500ms + 配额消耗 | 0ms + 0 配额 | 100% |
| RAG 检索（同查询） | 50ms/次 | 0ms | 100% |
| 代码执行（同代码） | 2s/次 | 0ms | 100% |

---

## 2. 缓存策略

### 策略一：精确缓存

```python
import hashlib
import json
import time
from dataclasses import dataclass
from typing import Any, Callable

@dataclass
class CacheEntry:
    """缓存条目"""
    key: str
    value: Any
    created_at: float
    ttl: float          # 过期时间（秒）
    hit_count: int = 0


class ExactToolCache:
    """精确参数缓存：相同参数直接返回"""

    def __init__(self, default_ttl: float = 300):
        """default_ttl: 默认缓存 5 分钟"""
        self.default_ttl = default_ttl
        self.cache: dict[str, CacheEntry] = &#123;&#125;
        self.stats = &#123;"hits": 0, "misses": 0, "sets": 0&#125;

    def _make_key(self, tool_name: str, args: dict) -> str:
        """生成缓存键"""
        # 规范化参数（排序确保一致性）
        normalized = json.dumps(args, sort_keys=True, ensure_ascii=False)
        key_str = f"&#123;tool_name&#125;:&#123;normalized&#125;"
        return hashlib.sha256(key_str.encode()).hexdigest()[:32]

    def get(self, tool_name: str, args: dict) -> tuple[Any, bool]:
        """获取缓存"""
        key = self._make_key(tool_name, args)

        if key in self.cache:
            entry = self.cache[key]
            # 检查是否过期
            if time.time() - entry.created_at < entry.ttl:
                entry.hit_count += 1
                self.stats["hits"] += 1
                return entry.value, True
            else:
                # 过期，删除
                del self.cache[key]

        self.stats["misses"] += 1
        return None, False

    def set(self, tool_name: str, args: dict, value: Any, ttl: float | None = None):
        """设置缓存"""
        key = self._make_key(tool_name, args)
        self.cache[key] = CacheEntry(
            key=key,
            value=value,
            created_at=time.time(),
            ttl=ttl or self.default_ttl,
        )
        self.stats["sets"] += 1

    def invalidate(self, tool_name: str, args: dict | None = None):
        """使缓存失效"""
        if args is None:
            # 删除该工具的所有缓存
            keys_to_remove = [
                k for k, v in self.cache.items()
                if k.startswith(hashlib.sha256(f"&#123;tool_name&#125;:".encode()).hexdigest()[:8])
            ]
        else:
            key = self._make_key(tool_name, args)
            keys_to_remove = [key] if key in self.cache else []

        for k in keys_to_remove:
            del self.cache[k]

    def clear(self):
        """清空所有缓存"""
        self.cache.clear()
        self.stats = &#123;"hits": 0, "misses": 0, "sets": 0&#125;

    def report(self) -> dict:
        """缓存报告"""
        total = self.stats["hits"] + self.stats["misses"]
        return &#123;
            **self.stats,
            "hit_rate": f"&#123;self.stats['hits'] / max(total, 1):.1%&#125;",
            "cache_size": len(self.cache),
        &#125;
```

### 策略二：带语义的缓存

```python
class SemanticToolCache:
    """语义缓存：相似参数也命中"""

    def __init__(
        self,
        default_ttl: float = 300,
        similarity_threshold: float = 0.95,
    ):
        self.default_ttl = default_ttl
        self.similarity_threshold = similarity_threshold
        self.cache: list[CacheEntry] = []
        self.stats = &#123;"hits": 0, "misses": 0, "semantic_hits": 0&#125;

    def _embed(self, text: str) -> list[float]:
        """简单嵌入（实际用 embedding 模型）"""
        # 实际应该用 OpenAIEmbeddings 或类似
        from langchain_openai import OpenAIEmbeddings
        embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        return embeddings.embed_query(text)

    def _cosine_sim(self, a: list[float], b: list[float]) -> float:
        import numpy as np
        a_arr = np.array(a)
        b_arr = np.array(b)
        return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))

    def get(self, tool_name: str, args: dict) -> tuple[Any, bool]:
        """语义查找缓存"""
        query_text = json.dumps(&#123;"tool": tool_name, "args": args&#125;, ensure_ascii=False)
        query_emb = self._embed(query_text)

        best_sim = 0
        best_entry = None

        for entry in self.cache:
            # 只匹配同工具
            if entry.value.get("_tool_name") != tool_name:
                continue

            # 检查过期
            if time.time() - entry.created_at >= entry.ttl:
                continue

            sim = self._cosine_sim(query_emb, entry.key)
            if sim > best_sim:
                best_sim = sim
                best_entry = entry

        if best_entry and best_sim >= self.similarity_threshold:
            best_entry.hit_count += 1
            self.stats["hits"] += 1
            self.stats["semantic_hits"] += 1
            return best_entry.value.get("result"), True

        self.stats["misses"] += 1
        return None, False
```

---

## 3. 缓存装饰器

```python
from functools import wraps
from typing import Callable

def cached_tool(
    cache: ExactToolCache,
    ttl: float | None = None,
    cacheable: Callable[[dict], bool] | None = None,
):
    """工具缓存装饰器

    Args:
        cache: 缓存实例
        ttl: 缓存时间（秒）
        cacheable: 判断是否可缓存的函数
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 构造参数字典
            tool_name = func.__name__
            call_args = &#123;**dict(zip(func.__code__.co_varnames, args)), **kwargs&#125;

            # 检查是否可缓存
            if cacheable and not cacheable(call_args):
                return func(*args, **kwargs)

            # 尝试缓存命中
            cached_value, hit = cache.get(tool_name, call_args)
            if hit:
                return cached_value

            # 执行工具
            result = func(*args, **kwargs)

            # 写入缓存
            cache.set(tool_name, call_args, result, ttl)

            return result
        return wrapper
    return decorator


# 使用示例
tool_cache = ExactToolCache(default_ttl=300)

@cached_tool(cache=tool_cache, ttl=600)  # 缓存 10 分钟
def search_web(query: str, max_results: int = 10) -> list[dict]:
    """搜索工具"""
    # 实际调用搜索 API
    import time
    time.sleep(0.3)  # 模拟网络延迟
    return [&#123;"title": f"结果 &#123;i&#125;", "url": f"https://example.com/&#123;i&#125;"&#125; for i in range(max_results)]

# 第一次调用：缓存未命中
result1 = search_web("Python 教程")  # 300ms

# 第二次调用相同参数：缓存命中
result2 = search_web("Python 教程")  # 0ms

# 不同参数：缓存未命中
result3 = search_web("Java 教程")  # 300ms

print(tool_cache.report())
# &#123;'hits': 1, 'misses': 2, 'sets': 2, 'hit_rate': '33.3%', 'cache_size': 2&#125;
```

---

## 4. LangChain 工具缓存集成

```python
from langchain_core.tools import tool, BaseTool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

# 全局工具缓存
tool_cache = ExactToolCache(default_ttl=300)

@tool
def get_weather(city: str) -> str:
    """获取指定城市的天气信息"""
    cached, hit = tool_cache.get("get_weather", &#123;"city": city&#125;)
    if hit:
        return f"[缓存] &#123;city&#125;: &#123;cached&#125;"

    # 模拟 API 调用
    import time
    time.sleep(0.3)
    weather = f"28°C 晴"  # 实际从 API 获取
    tool_cache.set("get_weather", &#123;"city": city&#125;, weather)
    return f"&#123;city&#125;: &#123;weather&#125;"

@tool
def search_knowledge_base(query: str, top_k: int = 5) -> str:
    """搜索知识库"""
    cached, hit = tool_cache.get("search_kb", &#123;"query": query, "top_k": top_k&#125;)
    if hit:
        return f"[缓存] &#123;cached[:100]&#125;..."

    # 实际检索
    import time
    time.sleep(0.1)
    result = f"关于 &#123;query&#125; 的知识库内容..."
    tool_cache.set("search_kb", &#123;"query": query, "top_k": top_k&#125;, result)
    return result

# 创建 Agent
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
agent = create_react_agent(llm, [get_weather, search_knowledge_base])

# 第一次对话
result1 = agent.invoke(&#123;"messages": [HumanMessage("北京天气怎么样？")]&#125;)

# 第二次对话（包含之前问过的城市）
result2 = agent.invoke(&#123;"messages": [HumanMessage("北京和上海的天气怎么样？")]&#125;)
# 北京：缓存命中！上海：新查询

print(tool_cache.report())
```

---

## 5. 缓存失效策略

```python
class CacheInvalidationManager:
    """缓存失效管理器"""

    def __init__(self, cache: ExactToolCache):
        self.cache = cache
        # 工具 → 失效策略 映射
        self.invalidation_rules: dict[str, dict] = &#123;
            # 天气：5 分钟过期
            "get_weather": &#123;"strategy": "ttl", "ttl": 300&#125;,
            # 知识库搜索：1 小时过期
            "search_knowledge_base": &#123;"strategy": "ttl", "ttl": 3600&#125;,
            # 数据库查询：数据变更时失效
            "query_database": &#123;"strategy": "event", "events": ["db_update", "db_insert"]&#125;,
            # 用户信息：实时
            "get_user_profile": &#123;"strategy": "never"&#125;,  # 不缓存
            # 搜索引擎结果：30 分钟
            "web_search": &#123;"strategy": "ttl", "ttl": 1800&#125;,
            # 代码执行：永不缓存（结果可能不确定）
            "execute_code": &#123;"strategy": "never"&#125;,
        &#125;

    def should_cache(self, tool_name: str, result: Any) -> bool:
        """判断工具结果是否应该缓存"""
        rule = self.invalidation_rules.get(tool_name, &#123;"strategy": "ttl", "ttl": 300&#125;)

        if rule["strategy"] == "never":
            return False

        # 错误结果不缓存
        if isinstance(result, Exception) or (isinstance(result, str) and "error" in result.lower()):
            return False

        # 空结果不缓存（可能是临时问题）
        if not result:
            return False

        return True

    def get_ttl(self, tool_name: str) -> float:
        """获取工具的缓存 TTL"""
        rule = self.invalidation_rules.get(tool_name, &#123;"strategy": "ttl", "ttl": 300&#125;)
        return rule.get("ttl", 300)

    def on_event(self, event: str):
        """事件触发缓存失效"""
        for tool_name, rule in self.invalidation_rules.items():
            if rule.get("strategy") == "event" and event in rule.get("events", []):
                self.cache.invalidate(tool_name)
                print(f"事件 &#123;event&#125; 触发 &#123;tool_name&#125; 缓存失效")


# 不同工具的缓存策略
```

### 缓存策略对比

| 策略 | 适用 | 优点 | 缺点 |
|------|------|------|------|
| TTL 过期 | 天气/搜索/汇率 | 简单可靠 | 可能有短暂过期数据 |
| 事件触发 | 数据库/用户数据 | 实时性好 | 需要事件系统 |
| 永不缓存 | 代码执行/随机 | 安全 | 无缓存收益 |
| LRU 淘汰 | 通用 | 控制内存 | 命中率可能降低 |
| 手动失效 | 管理操作 | 精确控制 | 需要人工干预 |

---

## 6. 多级缓存

```python
class MultiLevelCache:
    """多级缓存：L1 内存 → L2 Redis → L3 源"""

    def __init__(
        self,
        l1_ttl: float = 60,       # L1 内存：1 分钟
        l2_ttl: float = 3600,     # L2 Redis：1 小时
    ):
        self.l1 = ExactToolCache(default_ttl=l1_ttl)  # 内存缓存
        self.l2 = ExactToolCache(default_ttl=l2_ttl)  # Redis 缓存（简化为内存）
        self.stats = &#123;"l1_hits": 0, "l2_hits": 0, "misses": 0&#125;

    def get(self, tool_name: str, args: dict) -> tuple[Any, bool, str]:
        """多级查找：L1 → L2 → 源

        Returns: (value, hit, level)
        """
        # L1 查找
        value, hit = self.l1.get(tool_name, args)
        if hit:
            self.stats["l1_hits"] += 1
            return value, True, "L1"

        # L2 查找
        value, hit = self.l2.get(tool_name, args)
        if hit:
            self.stats["l2_hits"] += 1
            # 回填 L1
            self.l1.set(tool_name, args, value)
            return value, True, "L2"

        self.stats["misses"] += 1
        return None, False, "MISS"

    def set(self, tool_name: str, args: dict, value: Any):
        """写入多级缓存"""
        self.l1.set(tool_name, args, value)
        self.l2.set(tool_name, args, value)

    def report(self) -> dict:
        total = sum(self.stats.values())
        return &#123;
            **self.stats,
            "l1_hit_rate": f"&#123;self.stats['l1_hits'] / max(total, 1):.1%&#125;",
            "l2_hit_rate": f"&#123;self.stats['l2_hits'] / max(total, 1):.1%&#125;",
            "miss_rate": f"&#123;self.stats['misses'] / max(total, 1):.1%&#125;",
        &#125;
```

---

## 7. 缓存监控

```python
class CacheMonitor:
    """缓存监控面板"""

    def __init__(self, cache: ExactToolCache):
        self.cache = cache
        self.history: list[dict] = []

    def snapshot(self) -> dict:
        """获取当前快照"""
        report = self.cache.report()
        self.history.append(&#123;**report, "timestamp": time.time()&#125;)
        return report

    def top_cached_tools(self, n: int = 5) -> list[tuple[str, int]]:
        """获取缓存最多的工具"""
        # 按 tool_name 前缀统计
        from collections import Counter
        tool_counts = Counter()
        for key, entry in self.cache.cache.items():
            # 从 entry 的 value 中提取工具名（如果存储了的话）
            if isinstance(entry.value, dict) and "_tool_name" in entry.value:
                tool_counts[entry.value["_tool_name"]] += 1

        return tool_counts.most_common(n)

    def dashboard(self) -> dict:
        """渲染监控面板"""
        report = self.snapshot()
        return &#123;
            "cache_stats": report,
            "top_tools": self.top_cached_tools(),
            "trend": self.history[-10:],
        &#125;
```

---

## 8. 配置参考

| 工具类型 | 推荐策略 | TTL | 说明 |
|----------|---------|-----|------|
| 天气/汇率 | TTL | 5min | 数据变化不频繁 |
| 知识库搜索 | TTL | 1h | 文档更新后重建索引 |
| 数据库查询 | 事件触发 | — | 数据变更时失效 |
| Web 搜索 | TTL | 30min | 搜索结果变化较快 |
| 代码执行 | 永不缓存 | — | 结果不确定 |
| 用户信息 | 永不/短TTL | 0-60s | 需要实时性 |
| API 调用 | TTL | 按API | 注意配额限制 |

### 缓存大小管理

| 缓存大小 | 策略 | 说明 |
|----------|------|------|
| < 1000 条 | 全保留 | 内存足够 |
| 1000-10000 | LRU | 淘汰最久未用 |
| > 10000 | 分片+LRU | 分片降低锁竞争 |
| > 100000 | Redis | 独立缓存服务 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有精确参数缓存 | ☐ |
| 有 TTL 过期机制 | ☐ |
| 有缓存失效策略 | ☐ |
| 有不可缓存判断（错误/空/随机） | ☐ |
| 有缓存命中率统计 | ☐ |
| 有缓存大小控制 | ☐ |
| 有多级缓存（可选） | ☐ |
| 有缓存监控面板 | ☐ |
