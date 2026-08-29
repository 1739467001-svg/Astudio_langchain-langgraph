# LLM 网关与多模型 API 管理

> 生产环境中，你会同时用 OpenAI、Claude、通义千问、星火——不同模型各有优势。如果每个模型都直接对接，代码里遍布 if-else 和 API 适配。LLM 网关统一入口，屏蔽差异，支持路由、降级、限流和成本控制。

---

## 一、为什么需要 LLM 网关

```mermaid
graph TB
    subgraph 没有网关 {"没有网关的混乱"}
        APP1["应用代码"] --> O1["OpenAI SDK"]
        APP1 --> O2["Anthropic SDK"]
        APP1 --> O3["讯飞SDK"]
        O1 --> K1["Key管理散乱"]
        O2 --> K2["错误处理各不相同"]
        O3 --> K3["成本无法统一追踪"]
    end

    subgraph 有网关 {"LLM网关统一入口"}
        APP2["应用代码"] --> GW["LLM网关"]
        GW --> M1["OpenAI"]
        GW --> M2["Claude"]
        GW --> M3["通义千问"]
        GW --> M4["星火"]
        GW --> F["统一: 路由/降级/限流/缓存/成本追踪"]
    end

    style 没有网关 fill:#FFCDD2
    style 有网关 fill:#C8E6C9
    style GW fill:#1565C0,color:#fff,stroke-width:3px
```

---

## 二、网关核心功能

```mermaid
graph TB
    subgraph 功能 {"LLM网关核心功能"}
        F1["统一API<br/>一套接口调所有模型"]
        F2["智能路由<br/>按复杂度/成本选模型"]
        F3["自动降级<br/>主模型失败→备用模型"]
        F4["统一限流<br/>防止任何模型超配额"]
        F5["语义缓存<br/>跨模型共享缓存"]
        F6["成本追踪<br/>统一Token计费"]
        F7["密钥管理<br/>集中存储轮换"]
        F8["可观测性<br/>统一日志和追踪"]
    end

    style 功能 fill:#E3F2FD
```

---

## 三、网关架构

```mermaid
graph TB
    subgraph 架构 {"LLM网关架构"}
        CLIENT["客户端"] --> AUTH["认证层<br/>API Key验证"]
        AUTH --> CACHE{"缓存层<br/>语义缓存"}
        CACHE -->|命中| RESP["返回"]
        CACHE -->|未命中| ROUTER["路由层<br/>选模型"]
        ROUTER --> PROVIDER["模型提供者层"]
        PROVIDER --> P1["OpenAI"]
        PROVIDER --> P2["Claude"]
        PROVIDER --> P3["通义千问"]
        PROVIDER --> P4["星火"]
        PROVIDER --> FALLBACK["降级链<br/>失败→下一个"]
        PROVIDER --> RESP
        AUTH --> RATE["限流层<br/>令牌桶"]
        RATE --> ROUTER
    end

    style ROUTER fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style CACHE fill:#C8E6C9
    style FALLBACK fill:#FFCDD2
```

---

## 四、实现

### 4.1 统一模型接口

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any
import time

@dataclass
class LLMResponse:
    """统一响应格式"""
    content: str
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: float
    cost_usd: float
    provider: str

class ModelProvider(ABC):
    """模型提供者抽象接口。"""

    @abstractmethod
    async def invoke(self, messages: list[dict], **kwargs) -> LLMResponse:
        """调用模型"""
        pass

    @abstractmethod
    def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """估算成本"""
        pass

class OpenAIProvider(ModelProvider):
    """OpenAI模型提供者。"""

    PRICING = {
        "gpt-4o": {"input": 2.50, "output": 10.00},
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    }

    def __init__(self, api_key: str):
        from langchain_openai import ChatOpenAI
        self.api_key = api_key
        self._clients = {}

    def _get_client(self, model: str) -> ChatOpenAI:
        if model not in self._clients:
            self._clients[model] = ChatOpenAI(model=model, api_key=self.api_key)
        return self._clients[model]

    async def invoke(self, messages: list[dict], model: str = "gpt-4o", **kwargs) -> LLMResponse:
        client = self._get_client(model)
        start = time.time()
        response = await client.ainvoke(messages)

        input_tokens = response.usage_metadata.get("input_tokens", 0)
        output_tokens = response.usage_metadata.get("output_tokens", 0)
        latency = (time.time() - start) * 1000
        cost = self.estimate_cost(input_tokens, output_tokens)

        return LLMResponse(
            content=response.content,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=round(latency, 2),
            cost_usd=cost,
            provider="openai",
        )

    def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        return (input_tokens / 1_000_000 * self.PRICING["gpt-4o"]["input"] +
                output_tokens / 1_000_000 * self.PRICING["gpt-4o"]["output"])

class SparkProvider(ModelProvider):
    """讯飞星火模型提供者。"""

    PRICING = {"spark-pro": {"input": 0.5, "output": 0.5}}  # 简化定价

    def __init__(self, app_id: str, api_key: str, api_secret: str):
        self.app_id = app_id
        self.api_key = api_key
        self.api_secret = api_secret

    async def invoke(self, messages: list[dict], **kwargs) -> LLMResponse:
        # 实际调用星火API
        start = time.time()
        # response = await spark_client.ainvoke(messages)
        # 简化示例
        latency = (time.time() - start) * 1000
        return LLMResponse(
            content="[星火响应]",
            model="spark-pro",
            input_tokens=0,
            output_tokens=0,
            latency_ms=round(latency, 2),
            cost_usd=0,
            provider="spark",
        )

    def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        return (input_tokens + output_tokens) / 1_000_000 * self.PRICING["spark-pro"]["input"]
```

### 4.2 智能路由器

```python
from enum import Enum

class RouteStrategy(str, Enum):
    FIXED = "fixed"           # 固定模型
    COST_FIRST = "cost"       # 优先成本
    QUALITY_FIRST = "quality" # 优先质量
    ROUND_ROBIN = "round_robin"  # 轮询
    COMPLEXITY = "complexity"  # 按复杂度

class ModelRouter:
    """智能模型路由器。"""

    def __init__(self, providers: dict[str, ModelProvider]):
        self.providers = providers
        self._round_robin_idx = 0
        self.routes = {
            RouteStrategy.COST_FIRST: ["gpt-4o-mini", "gpt-4o"],
            RouteStrategy.QUALITY_FIRST: ["gpt-4o", "gpt-4o-mini"],
            RouteStrategy.COMPLEXITY: None,  # 动态判断
        }

    def route(
        self,
        messages: list[dict],
        strategy: RouteStrategy = RouteStrategy.COMPLEXITY,
    ) -> tuple[str, str]:
        """选择模型和提供者。

        Returns:
            (provider_name, model_name)
        """
        if strategy == RouteStrategy.FIXED:
            return "openai", "gpt-4o"

        elif strategy == RouteStrategy.COST_FIRST:
            return "openai", "gpt-4o-mini"

        elif strategy == RouteStrategy.QUALITY_FIRST:
            return "openai", "gpt-4o"

        elif strategy == RouteStrategy.ROUND_ROBIN:
            models = [("openai", "gpt-4o"), ("openai", "gpt-4o-mini")]
            choice = models[self._round_robin_idx % len(models)]
            self._round_robin_idx += 1
            return choice

        elif strategy == RouteStrategy.COMPLEXITY:
            # 根据输入复杂度自动选择
            last_msg = messages[-1].get("content", "") if messages else ""
            if len(last_msg) < 50 or any(w in last_msg for w in ["你好", "谢谢", "是什么"]):
                return "openai", "gpt-4o-mini"
            return "openai", "gpt-4o"

        return "openai", "gpt-4o"
```

### 4.3 降级链

```mermaid
graph TB
    subgraph 降级 {"自动降级链"}
        REQ["请求"] --> P1["主模型: GPT-4o"]
        P1 -->|成功| OK["返回结果"]
        P1 -->|失败/超时/限流| P2["备用1: Claude"]
        P2 -->|成功| OK
        P2 -->|失败| P3["备用2: GPT-4o-mini"]
        P3 -->|成功| OK
        P3 -->|失败| P4["备用3: 星火"]
        P4 -->|成功| OK
        P4 -->|失败| FAIL["❌ 全部失败<br/>返回兜底错误"]
    end

    style P1 fill:#E3F2FD
    style P2 fill:#FFF3E0
    style P3 fill:#FFF9C4
    style P4 fill:#C8E6C9
    style FAIL fill:#FFCDD2
```

```python
class FallbackChain:
    """模型降级链。"""

    def __init__(self, gateway):
        self.gateway = gateway

    async def invoke_with_fallback(
        self,
        messages: list[dict],
        primary: tuple[str, str],        # (provider, model)
        fallbacks: list[tuple[str, str]], # [(provider, model), ...]
        max_retries: int = 1,
    ) -> LLMResponse:
        """带降级的调用。"""
        chain = [primary] + fallbacks

        last_error = None
        for provider_name, model_name in chain:
            for attempt in range(max_retries + 1):
                try:
                    response = await self.gateway._invoke_provider(
                        provider_name, model_name, messages
                    )
                    if attempt > 0:
                        response.content = f"[降级到{model_name}] " + response.content
                    return response
                except Exception as e:
                    last_error = e
                    continue

        # 全部失败
        return LLMResponse(
            content=f"所有模型不可用，最后错误: {last_error}",
            model="none",
            input_tokens=0,
            output_tokens=0,
            latency_ms=0,
            cost_usd=0,
            provider="error",
        )
```

### 4.4 完整网关

```python
class LLMGateway:
    """LLM网关——统一入口。"""

    def __init__(self):
        self.providers: dict[str, ModelProvider] = {}
        self.router = None
        self.fallback = None
        self.cost_tracker: list[dict] = []
        self.rate_limiter = TokenBucketRateLimiter(rate=100, capacity=200)

    def register_provider(self, name: str, provider: ModelProvider):
        self.providers[name] = provider
        if not self.router:
            self.router = ModelRouter(self.providers)
            self.fallback = FallbackChain(self)

    async def invoke(
        self,
        messages: list[dict],
        strategy: RouteStrategy = RouteStrategy.COMPLEXITY,
        enable_fallback: bool = True,
    ) -> LLMResponse:
        """统一调用入口。"""
        # 1. 限流
        if not self.rate_limiter.allow():
            return LLMResponse(
                content="请求过于频繁，请稍后再试",
                model="rate_limited", input_tokens=0, output_tokens=0,
                latency_ms=0, cost_usd=0, provider="gateway",
            )

        # 2. 路由
        provider_name, model_name = self.router.route(messages, strategy)

        # 3. 降级调用
        if enable_fallback:
            fallbacks = [("openai", "gpt-4o-mini")]
            if provider_name == "openai" and model_name == "gpt-4o":
                fallbacks = [("openai", "gpt-4o-mini")]
            response = await self.fallback.invoke_with_fallback(
                messages,
                primary=(provider_name, model_name),
                fallbacks=fallbacks,
            )
        else:
            response = await self._invoke_provider(provider_name, model_name, messages)

        # 4. 成本追踪
        self.cost_tracker.append({
            "provider": response.provider,
            "model": response.model,
            "cost": response.cost_usd,
            "tokens": response.input_tokens + response.output_tokens,
            "timestamp": time.time(),
        })

        return response

    async def _invoke_provider(
        self, provider_name: str, model_name: str, messages: list[dict]
    ) -> LLMResponse:
        provider = self.providers.get(provider_name)
        if not provider:
            raise ValueError(f"Provider {provider_name} not found")
        return await provider.invoke(messages, model=model_name)

    def cost_report(self) -> dict:
        """成本报告。"""
        from collections import defaultdict
        by_model = defaultdict(lambda: {"cost": 0, "calls": 0, "tokens": 0})
        for entry in self.cost_tracker:
            by_model[entry["model"]]["cost"] += entry["cost"]
            by_model[entry["model"]]["calls"] += 1
            by_model[entry["model"]]["tokens"] += entry["tokens"]
        return {
            "total_cost": round(sum(e["cost"] for e in self.cost_tracker), 4),
            "total_calls": len(self.cost_tracker),
            "by_model": {k: dict(v) for k, v in by_model.items()},
        }


class TokenBucketRateLimiter:
    """令牌桶限流器。"""

    def __init__(self, rate: float, capacity: int):
        self.rate = rate         # 每秒补充令牌数
        self.capacity = capacity # 桶容量
        self.tokens = capacity
        self.last_refill = time.time()

    def allow(self) -> bool:
        now = time.time()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.last_refill = now

        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False
```

---

## 五、使用示例

```python
import asyncio

async def main():
    gateway = LLMGateway()

    # 注册模型提供者
    gateway.register_provider("openai", OpenAIProvider(api_key="sk-..."))
    # gateway.register_provider("spark", SparkProvider(...))

    # 统一调用——不需要关心用哪个模型
    response = await gateway.invoke([
        {"role": "user", "content": "你好"}
    ])
    print(f"回答: {response.content}")
    print(f"模型: {response.model}, 成本: ${response.cost_usd:.6f}")

    # 成本报告
    print(f"成本报告: {gateway.cost_report()}")

asyncio.run(main())
```

---

## 六、与 LangChain 集成

```python
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage

class GatewayChatModel(BaseChatModel):
    """将网关适配为LangChain兼容的ChatModel。"""

    gateway: LLMGateway = None

    def __init__(self, gateway: LLMGateway):
        super().__init__()
        self.gateway = gateway

    def _generate(self, messages, **kwargs):
        # 转换消息格式
        msg_dicts = [{"role": m.type, "content": m.content} for m in messages]
        import asyncio
        response = asyncio.run(self.gateway.invoke(msg_dicts))
        # 转换为LangChain格式
        from langchain_core.outputs import ChatResult, ChatGeneration
        from langchain_core.messages import AIMessage
        return ChatResult(generations=[
            ChatGeneration(message=AIMessage(content=response.content))
        ])

    @property
    def _llm_type(self):
        return "gateway"

# 使用：与标准LangChain ChatModel完全一致
# model = GatewayChatModel(gateway)
# agent = create_react_agent(model, tools)
```

---

## 七、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 生产必须用网关 | 统一管理多个模型 | ★★★ |
| 必须有降级链 | 主模型失败自动切换 | ★★★ |
| 限流保护所有模型 | 防止超配额 | ★★★ |
| 统一成本追踪 | 知道花了多少钱 | ★★☆ |
| 密钥集中管理 | 安全+轮换方便 | ★★☆ |
| 复杂度路由省钱 | 80%走小模型 | ★★☆ |

---

## 八、检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了统一模型接口 | ☐ |
| 实现了智能路由 | ☐ |
| 实现了降级链 | ☐ |
| 实现了限流 | ☐ |
| 有成本追踪 | ☐ |
| 能适配为LangChain ChatModel | ☐ |
