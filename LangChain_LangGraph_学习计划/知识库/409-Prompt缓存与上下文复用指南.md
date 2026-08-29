# Prompt 缓存与上下文复用指南

> Agent 每次调用 LLM 都重新处理完整的系统提示 + 对话历史 + 检索文档，这造成了巨大的重复计算和成本浪费。Prompt 缓存通过缓存已处理的前缀，让后续请求只计算新增部分，延迟降低 5-10 倍，成本降低 50-90%。

---

## 1. Prompt 缓存原理

### 问题：重复计算

```
请求 1: [系统提示2000T] + [历史3000T] + [用户问题100T] = 5100 Token 输入
请求 2: [系统提示2000T] + [历史3000T] + [历史新增200T] + [用户问题100T] = 5300 Token 输入
请求 3: [系统提示2000T] + [历史3000T] + [历史新增400T] + [用户问题100T] = 5500 Token 输入

问题：系统提示 + 旧历史 重复处理了 3 次
```

### 缓存方案

```
请求 1: [系统提示2000T] + [历史3000T] + [问题100T]
         ↑ 缓存(Cache Write)      ↑ 正常计算

请求 2: [系统提示2000T] + [历史3000T] + [新增200T] + [问题100T]
         ↑ 缓存命中(Cache Read)     ↑ 只算这部分

请求 3: [系统提示2000T] + [历史3000T] + [新增400T] + [问题100T]
         ↑ 缓存命中(Cache Read)     ↑ 只算这部分
```

### 成本对比

| 方式 | 输入 Token | 单价 | 成本（每百万Token） |
|------|-----------|------|---------------------|
| 无缓存 | 5000 | $2.50 | $12.50 |
| 缓存命中 | 5000 (4000缓存) | Read $0.30 | $1.20 + $3.00 = $4.20 |
| 节省 | — | — | 66% |

---

## 2. 各厂商缓存支持

### OpenAI Prompt Caching

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

# OpenAI 自动缓存，无需额外配置
# 但需要确保前缀稳定（系统提示放在最前面）
llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0,  # temperature=0 更容易命中缓存
)

# 最佳实践：系统提示 + Few-Shot 示例放最前面（作为可缓存前缀）
prompt = ChatPromptTemplate.from_messages([
    ("system", """你是一个专业的客服助手。
请遵循以下规则：
1. 礼貌回答
2. 准确引用知识库
3. 无法回答时坦诚说明

<知识库>
{knowledge_base}
</知识库>

<Few-Shot 示例>
用户：退货流程
助手：退货流程如下：1. 登录账户 2. 找到订单 3. 点击退货...
</Few-Shot>"""),
    # 以上部分是可缓存的前缀（稳定不变）
    # 以下部分是变化的内容
    ("placeholder", "{chat_history}"),
    ("human", "{user_input}"),
])

chain = prompt | llm

# 第一次调用：写入缓存
result1 = chain.invoke({
    "knowledge_base": kb_content,  # 稳定内容
    "chat_history": [msg1, msg2],
    "user_input": "退货流程是什么？",
})
# 缓存写入：system + kb + few_shot 部分被缓存

# 第二次调用：命中缓存（只要 kb_content 不变）
result2 = chain.invoke({
    "knowledge_base": kb_content,  # 相同内容
    "chat_history": [msg1, msg2, msg3, msg4],  # 历史增长
    "user_input": "退货需要多久？",
})
# 缓存命中：省去 system + kb + few_shot 的处理
```

### Anthropic Prompt Caching

```python
from langchain_anthropic import ChatAnthropic

# Anthropic 需要显式标记缓存点
llm = ChatAnthropic(
    model="claude-3-5-sonnet-20241022",
    # 通过 cache_control 标记
)

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

# 方式一：在系统消息中标记缓存
system_msg = SystemMessage(
    content=[
        {
            "type": "text",
            "text": "你是一个专业助手。以下是知识库内容：\n" + kb_content,
            "cache_control": {"type": "ephemeral"},  # 标记为可缓存
        }
    ]
)

# 方式二：在对话历史中标记
messages = [
    system_msg,
    HumanMessage("第一个问题"),
    AIMessage("第一个回答"),
    # 标记历史为可缓存
    HumanMessage(content=[
        {"type": "text", "text": "第二个问题", "cache_control": {"type": "ephemeral"}}
    ]),
]

result = llm.invoke(messages)
# 第一次：cache write（费用是正常输入的 1.25 倍）
# 后续：cache read（费用是正常输入的 0.1 倍，节省 90%）
```

### 缓存命中条件

| 条件 | 说明 |
|------|------|
| 前缀完全一致 | 从第一个 token 开始，直到缓存断点 |
| 最小 Token 数 | OpenAI: 1024+ / Anthropic: 1024+ |
| TTL | OpenAI: 5-10min / Anthropic: 5min(ephemeral) |
| 模型一致 | 同一模型才能命中 |

---

## 3. 生产级缓存管理器

```python
from dataclasses import dataclass, field
from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.language_models import BaseChatModel
import hashlib
import time
from typing import Any

@dataclass
class CacheStats:
    """缓存统计"""
    cache_writes: int = 0       # 缓存写入次数
    cache_hits: int = 0         # 缓存命中次数
    cache_misses: int = 0      # 缓存未命中
    tokens_cached: int = 0     # 缓存的 Token 数
    tokens_saved: int = 0      # 节省的 Token 数
    cost_saved: float = 0.0    # 节省的费用

    def hit_rate(self) -> float:
        total = self.cache_hits + self.cache_misses
        return self.cache_hits / total if total > 0 else 0

    def report(self) -> str:
        return (
            f"缓存命中率: {self.hit_rate():.1%}\n"
            f"写入次数: {self.cache_writes}\n"
            f"命中次数: {self.cache_hits}\n"
            f"节省Token: {self.tokens_saved:,}\n"
            f"节省费用: ${self.cost_saved:.2f}"
        )


class PromptCacheManager:
    """Prompt 缓存管理器"""

    def __init__(
        self,
        llm: BaseChatModel,
        system_prompt: str,
        knowledge_base: str = "",
        cache_ttl: int = 300,  # 5 分钟
        input_price_per_m: float = 2.50,
        cache_read_price_per_m: float = 0.30,
    ):
        self.llm = llm
        self.system_prompt = system_prompt
        self.knowledge_base = knowledge_base
        self.cache_ttl = cache_ttl
        self.input_price = input_price_per_m
        self.cache_read_price = cache_read_price_per_m
        self.stats = CacheStats()

        # 计算可缓存前缀的 hash
        self._cache_prefix = self._build_cache_prefix()
        self._prefix_hash = self._hash(self._cache_prefix)
        self._last_cache_time = 0

    def _build_cache_prefix(self) -> str:
        """构建可缓存前缀"""
        parts = [self.system_prompt]
        if self.knowledge_base:
            parts.append(f"\n<知识库>\n{self.knowledge_base}\n</知识库>")
        return "\n".join(parts)

    @staticmethod
    def _hash(text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()[:16]

    def _estimate_tokens(self, text: str) -> int:
        """粗略估算 Token 数"""
        # 中文约 1.5 字/token，英文约 4 字符/token
        chinese = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        other = len(text) - chinese
        return int(chinese * 1.5 + other / 4)

    def invoke(
        self,
        messages: list[BaseMessage],
        user_input: str,
    ) -> dict[str, Any]:
        """带缓存的调用"""
        prefix_tokens = self._estimate_tokens(self._cache_prefix)

        # 检查缓存是否过期
        now = time.time()
        cache_expired = now - self._last_cache_time > self.cache_ttl

        if cache_expired or self.stats.cache_writes == 0:
            # 需要写入缓存
            self.stats.cache_writes += 1
            self.stats.tokens_cached += prefix_tokens
            cache_status = "cache_write"
            input_cost = prefix_tokens / 1_000_000 * self.input_price
        else:
            # 缓存命中
            self.stats.cache_hits += 1
            self.stats.tokens_saved += prefix_tokens
            saved = prefix_tokens / 1_000_000 * (self.input_price - self.cache_read_price)
            self.stats.cost_saved += saved
            cache_status = "cache_hit"
            input_cost = prefix_tokens / 1_000_000 * self.cache_read_price

        self._last_cache_time = now

        # 构建完整消息
        full_messages = [
            SystemMessage(content=self._cache_prefix),
            *messages,
            SystemMessage(content=user_input),
        ]

        # 调用 LLM
        response = self.llm.invoke(full_messages)

        return {
            "response": response,
            "cache_status": cache_status,
            "prefix_tokens": prefix_tokens,
            "input_cost": input_cost,
            "cache_stats": self.stats.report(),
        }


# 使用示例
cache_mgr = PromptCacheManager(
    llm=ChatOpenAI(model="gpt-4o", temperature=0),
    system_prompt="你是一个专业的技术文档助手。请准确回答问题并引用来源。",
    knowledge_base=large_kb_content,  # 稳定不变的知识库内容
)

# 第一次调用：写入缓存
result1 = cache_mgr.invoke([], "什么是 RAG？")
print(f"缓存状态: {result1['cache_status']}")  # cache_write

# 后续调用：命中缓存
result2 = cache_mgr.invoke([msg1], "RAG 和微调有什么区别？")
print(f"缓存状态: {result2['cache_status']}")  # cache_hit
print(result2["cache_stats"])
```

---

## 4. 缓存友好的 Prompt 设计

### 原则：稳定内容在前，变化内容在后

```python
# ✅ 缓存友好：稳定前缀在前面
good_prompt = ChatPromptTemplate.from_messages([
    ("system", "{stable_system_prompt}"),     # 稳定
    ("system", "{stable_knowledge_base}"),     # 稳定
    ("placeholder", "{chat_history}"),         # 增长但前缀不变
    ("human", "{user_input}"),                 # 变化
])

# ❌ 缓存不友好：变化内容在前
bad_prompt = ChatPromptTemplate.from_messages([
    ("human", "{user_input}"),                 # 变化内容在最前，无法缓存
    ("system", "{stable_system_prompt}"),      # 稳定但在后面
    ("system", "{stable_knowledge_base}"),
])

# ❌ 缓存不友好：前缀包含时间戳或随机值
bad_prompt2 = ChatPromptTemplate.from_messages([
    ("system", "当前时间: {current_time}\n{stable_system}"),  # 时间戳破坏缓存
    ("human", "{user_input}"),
])
```

### Few-Shot 示例的缓存策略

```python
# Few-Shot 示例放系统提示中（可缓存）
CACHEABLE_SYSTEM = """你是一个情感分析助手。

示例：
输入：今天天气真好 → 输出：正面
输入：我很难过 → 输出：负面
输入：一般般吧 → 输出：中性

请分析以下文本的情感。"""

# 每次请求只需发送新文本
chain = ChatPromptTemplate.from_messages([
    ("system", CACHEABLE_SYSTEM),  # 可缓存
    ("human", "{text}"),
]) | llm
```

---

## 5. Agent 多轮对话的缓存优化

```python
class CachedAgentConversation:
    """带缓存的 Agent 多轮对话"""

    def __init__(
        self,
        llm: BaseChatModel,
        system_prompt: str,
        tools: list,
    ):
        self.llm = llm
        self.system_prompt = system_prompt
        self.tools = tools
        self.conversation: list[BaseMessage] = []
        self._cache_prefix_tokens = 0

    def chat(self, user_input: str) -> str:
        # 计算可缓存前缀（系统提示 + 已有历史）
        cacheable_prefix = len(self.conversation) > 0

        # 添加用户消息
        self.conversation.append(HumanMessage(user_input))

        # 调用 LLM（系统提示 + 历史 + 新消息）
        messages = [
            SystemMessage(self.system_prompt),
            *self.conversation,
        ]

        response = self.llm.invoke(messages)

        # 添加回复到历史
        self.conversation.append(response)

        return response.content

# 多轮对话中，系统提示 + 旧历史 会被缓存
# 只有最新一轮的对话需要重新处理
```

### 缓存层次

```
第1轮: [系统提示] + [用户1]
       ↑ 缓存写入

第2轮: [系统提示] + [用户1] + [AI1] + [用户2]
       ↑ 缓存命中           ↑ 新增

第3轮: [系统提示] + [用户1] + [AI1] + [用户2] + [AI2] + [用户3]
       ↑ 缓存命中(前4条)                      ↑ 新增
```

---

## 6. 缓存监控与调优

```python
class CacheMonitor:
    """缓存监控面板"""

    def __init__(self):
        self.records: list[dict] = []

    def record(self, call_data: dict):
        self.records.append({
            **call_data,
            "timestamp": time.time(),
        })

    def dashboard(self) -> dict:
        if not self.records:
            return {"status": "no_data"}

        total = len(self.records)
        hits = sum(1 for r in self.records if r.get("cache_status") == "cache_hit")
        writes = sum(1 for r in self.records if r.get("cache_status") == "cache_write")

        total_tokens = sum(r.get("prefix_tokens", 0) for r in self.records)
        saved_tokens = sum(
            r.get("prefix_tokens", 0) for r in self.records
            if r.get("cache_status") == "cache_hit"
        )

        return {
            "total_calls": total,
            "cache_hit_rate": f"{hits/total:.1%}",
            "cache_writes": writes,
            "cache_hits": hits,
            "total_prefix_tokens": total_tokens,
            "saved_tokens": saved_tokens,
            "estimated_savings_pct": f"{saved_tokens/max(total_tokens,1):.1%}",
        }
```

---

## 7. 配置参考

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| 系统提示长度 | 500-5000 Token | 越长缓存收益越大 |
| 知识库注入 | 放系统提示中 | 作为可缓存前缀 |
| temperature | 0 | 低温度更易命中 |
| 缓存 TTL | 5-10 min | 根据流量调整 |
| 最小缓存 | 1024 Token | 低于此不缓存 |
| Few-Shot | 放系统提示 | 示例也是可缓存前缀 |

### 各厂商缓存定价（参考）

| 厂商 | 正常输入 | 缓存写入 | 缓存读取 | 节省 |
|------|---------|---------|---------|------|
| OpenAI | $2.50/M | $2.50/M | $1.25/M | 50% |
| Anthropic | $3.00/M | $3.75/M | $0.30/M | 90% |
| Google | $1.25/M | $1.25/M | $0.3125/M | 75% |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 稳定内容在 Prompt 最前 | ☐ |
| 无时间戳/随机值在前缀 | ☐ |
| Few-Shot 放系统提示 | ☐ |
| 有缓存命中率监控 | ☐ |
| temperature 设为 0 | ☐ |
| 知识库内容稳定不变 | ☐ |
| 有缓存过期处理 | ☐ |
| 有成本节省统计 | ☐ |
