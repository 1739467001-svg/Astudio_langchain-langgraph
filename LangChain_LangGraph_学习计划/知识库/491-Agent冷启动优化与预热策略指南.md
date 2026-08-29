# Agent 冷启动优化与预热策略指南

> Agent 服务启动后第一个请求要等 10 秒——模型加载、向量库连接、Embedding 缓存都是冷的。冷启动不仅影响用户体验，还影响 K8s 健康检查通过率。本指南系统讲解冷启动原因分析、预热策略、模型预加载、缓存预热，以及渐进式就绪。

---

## 1. 冷启动原因分析

### 冷启动阶段

```mermaid
graph TB
    START["进程启动"] --> LOAD["模型加载<br/>2-10秒<br/>权重加载到GPU"]
    LOAD --> CONNECT["连接初始化<br/>1-3秒<br/>DB/向量库/Redis"]
    CONNECT --> EMBED["Embedding 预热<br/>1-5秒<br/>首次向量化"]
    EMBED --> WARM["预热请求<br/>1-3秒<br/>首次LLM调用"]
    WARM --> READY["✅ 就绪<br/>接受用户请求"]

    style LOAD fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style WARM fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style READY fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

### 各阶段耗时

| 阶段 | 本地模型 | 云 API | 优化空间 |
|------|---------|--------|---------|
| 模型加载 | 2-30秒 | 0秒 | 预加载 |
| 连接初始化 | 1-3秒 | 1-3秒 | 连接池 |
| Embedding 预热 | 1-5秒 | 0.5-2秒 | 预计算 |
| 首次 LLM 调用 | 0.5-5秒 | 0.5-3秒 | 预热请求 |
| 总冷启动 | 5-40秒 | 2-8秒 | |

---

## 2. 预热策略

### 模型预加载

```python
import asyncio
from dataclasses import dataclass

@dataclass
class ModelPreloader:
    """模型预加载器"""

    async def preload(self):
        """启动时预加载"""
        tasks = [
            self._preload_llm(),
            self._preload_embedding(),
            self._preload_vectorstore(),
            self._preload_cache(),
        ]
        await asyncio.gather(*tasks)
        print("✅ 预热完成")

    async def _preload_llm(self):
        """预加载 LLM"""
        print("预热 LLM...")
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        # 发送一个简单请求触发连接建立
        await llm.ainvoke("Hi")
        print("  LLM 就绪")

    async def _preload_embedding(self):
        """预加载 Embedding 模型"""
        print("预热 Embedding...")
        embeddings = OpenAIEmbeddings()
        # 触发首次向量化
        await embeddings.aembed_query("test")
        print("  Embedding 就绪")

    async def _preload_vectorstore(self):
        """预加载向量库连接"""
        print("预热向量库...")
        # 建立连接池
        await vectorstore.ensure_connection()
        # 预加载索引
        await vectorstore preload_index()
        print("  向量库就绪")

    async def _preload_cache(self):
        """预热缓存"""
        print("预热缓存...")
        # 加载热门查询的缓存
        hot_queries = await db.get_hot_queries(limit=100)
        for query in hot_queries:
            cached = await semantic_cache.get(query)
            if not cached:
                # 预计算并缓存
                result = await llm.ainvoke(query)
                await semantic_cache.set(query, result.content)
        print(f"  缓存预热: {len(hot_queries)} 条")
```

### 渐进式就绪

```python
@dataclass
class ProgressiveReadiness:
    """渐进式就绪：逐个组件就绪"""

    components = {
        "llm": {"ready": False, "required": True},
        "embedding": {"ready": False, "required": True},
        "vectorstore": {"ready": False, "required": True},
        "cache": {"ready": False, "required": False},  # 非必须
        "monitoring": {"ready": False, "required": False},
    }

    async def warmup_sequence(self):
        """预热序列"""
        # 必须组件先就绪
        for name, info in self.components.items():
            if info["required"]:
                await self._warmup_component(name)
                self.components[name]["ready"] = True

        # 非必须组件后台预热
        for name, info in self.components.items():
            if not info["required"] and not info["ready"]:
                asyncio.create_task(self._background_warmup(name))

    async def _warmup_component(self, name: str):
        """预热单个组件"""
        warmup_funcs = {
            "llm": self._warmup_llm,
            "embedding": self._warmup_embedding,
            "vectorstore": self._warmup_vectorstore,
            "cache": self._warmup_cache,
            "monitoring": self._warmup_monitoring,
        }
        func = warmup_funcs.get(name)
        if func:
            await func()

    async def _background_warmup(self, name: str):
        """后台预热"""
        try:
            await self._warmup_component(name)
            self.components[name]["ready"] = True
        except Exception as e:
            print(f"后台预热 {name} 失败: {e}")

    def is_ready(self) -> bool:
        """是否就绪（所有必须组件就绪）"""
        return all(
            info["ready"] for info in self.components.values()
            if info["required"]
        )

    def get_readiness(self) -> dict:
        """获取就绪状态"""
        return {
            name: {
                "ready": info["ready"],
                "required": info["required"],
            }
            for name, info in self.components.items()
        }
```

---

## 3. 健康探针配合

```python
from fastapi import FastAPI

app = FastAPI()
readiness = ProgressiveReadiness()

@app.on_event("startup")
async def startup():
    """启动时预热"""
    await readiness.warmup_sequence()

@app.get("/health")
async def liveness():
    """存活探针：进程活着就返回 200"""
    return {"status": "alive"}

@app.get("/ready")
async def ready():
    """就绪探针：所有必须组件就绪才返回 200"""
    if readiness.is_ready():
        return {"status": "ready", "components": readiness.get_readiness()}
    else:
        from fastapi import Response
        return Response(
            status_code=503,
            content=json.dumps({
                "status": "warming_up",
                "components": readiness.get_readiness(),
            }),
        )
```

---

## 4. K8s 启动优化

```yaml
# K8s 启动优化配置
spec:
  containers:
    - name: agent
      # 启动探针（给足预热时间）
      startupProbe:
        httpGet:
          path: /ready
          port: 8000
        initialDelaySeconds: 5
        periodSeconds: 5
        failureThreshold: 30  # 最多等 150 秒
      # 存活探针（启动后生效）
      livenessProbe:
        httpGet:
          path: /health
          port: 8000
        periodSeconds: 30
      # 就绪探针（启动后生效）
      readinessProbe:
        httpGet:
          path: /ready
          port: 8000
        periodSeconds: 10
      # 初始延迟
      lifecycle:
        postStart:
          exec:
            command: ["/bin/sh", "-c", "echo 'Agent starting...'"]
```

---

## 5. 预热性能基准

```python
@dataclass
class WarmupBenchmark:
    """预热性能基准"""

    async def benchmark(self) -> dict:
        """基准测试"""
        # 无预热
        start = time.time()
        cold_agent = create_agent()
        await cold_agent.ainvoke("Hello")
        cold_time = time.time() - start

        # 有预热
        start = time.time()
        warm_agent = create_agent()
        await ModelPreloader().preload()
        await warm_agent.ainvoke("Hello")
        warm_time = time.time() - start

        # 首次请求延迟
        start = time.time()
        await warm_agent.ainvoke("第二个请求")
        warm_second = time.time() - start

        return {
            "cold_start_seconds": cold_time,
            "warm_start_seconds": warm_time,
            "warm_first_request_ms": warm_time * 1000,
            "warm_second_request_ms": warm_second * 1000,
            "improvement": f"{(1 - warm_time/cold_time)*100:.0f}%",
        }
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解冷启动四个阶段 | ☐ |
| 实现了模型预加载 | ☐ |
| 实现了 Embedding 预热 | ☐ |
| 实现了向量库预热 | ☐ |
| 实现了缓存预热 | ☐ |
| 实现了渐进式就绪 | ☐ |
| 配置了 K8s startupProbe | ☐ |
| 有预热性能基准 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 20 | 缓存策略 | 缓存 |
| 69 | 知识库冷启动策略 | 冷启动 |
| 84 | 优雅关闭与重启 | 优雅关闭 |
| 107 | 蓝绿部署与健康探针 | 探针 |
| 216 | 冷启动 | 冷启动 |
| 230 | 冷启动图解 | 图解 |
| 244 | 优雅关闭 | 关闭 |
| 377 | 健康探针与存活检测 | 探针 |
| 479 | Agent 自动扩缩容 | 扩缩容 |
| 489 | Agent 容器化部署 | 部署 |
