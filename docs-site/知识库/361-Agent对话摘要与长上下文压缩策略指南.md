# Agent 对话摘要与长上下文压缩策略指南

> 对话越长，Token 消耗越大、延迟越高、注意力越分散。这篇指南讲透对话摘要生成、滑动窗口、渐进式压缩和关键信息保留策略，让 Agent 在超长对话中保持高质量。

---

## 一、长上下文问题与策略

```mermaid
graph TB
    CONV["对话历史<br/>持续增长"] --> CHECK&#123;"超过窗口<br/>阈值?"&#125;
    CHECK -->|否| DIRECT["直接使用<br/>全量上下文"]
    CHECK -->|是| STRATEGY&#123;"选择压缩策略"&#125;

    STRATEGY -->|近期重要| SLIDING["滑动窗口<br/>保留最近N轮"]
    STRATEGY -->|需要全局| SUMMARIZE["摘要压缩<br/>LLM生成摘要"]
    STRATEGY -->|混合| HYBRID["混合策略<br/>摘要+近期原文"]

    SLIDING & SUMMARIZE & HYBRID --> REBUILD["重建上下文<br/>摘要+近期消息"]
    REBUILD --> LLM["送入LLM"]

    style CHECK fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style SUMMARIZE fill:#E3F2FD,stroke:#1565C0
    style REBUILD fill:#C8E6C9
```

---

## 二、压缩策略实现

```python
from dataclasses import dataclass, field
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from datetime import datetime
from enum import Enum
import hashlib

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

class CompressionStrategy(str, Enum):
    SLIDING_WINDOW = "sliding_window"
    SUMMARIZE = "summarize"
    PROGRESSIVE = "progressive"
    HYBRID = "hybrid"

@dataclass
class CompressedContext:
    """压缩后的上下文。"""
    summary: str = ""
    recent_messages: list = field(default_factory=list)
    key_facts: list[str] = field(default_factory=list)
    compressed_at: str = field(default_factory=lambda: datetime.now().isoformat())
    original_count: int = 0
    compressed_count: int = 0

    @property
    def compression_ratio(self) -> float:
        if self.original_count == 0:
            return 0.0
        return 1 - (self.compressed_count / self.original_count)

    def to_messages(self) -> list:
        """转换为可送入LLM的消息列表。"""
        messages = []
        if self.summary:
            messages.append(SystemMessage(content=f"对话摘要：\n&#123;self.summary&#125;"))
        if self.key_facts:
            facts_text = "\n".join(f"- &#123;f&#125;" for f in self.key_facts)
            messages.append(SystemMessage(content=f"关键信息：\n&#123;facts_text&#125;"))
        messages.extend(self.recent_messages)
        return messages


class ConversationCompressor:
    """对话压缩器。"""

    def __init__(self, llm, max_messages: int = 20, keep_recent: int = 6, summarize_threshold: int = 12):
        self.llm = llm
        self.max_messages = max_messages
        self.keep_recent = keep_recent
        self.summarize_threshold = summarize_threshold

    def _estimate_tokens(self, messages: list) -> int:
        """粗略估算Token数。"""
        return sum(len(str(m.content)) // 4 for m in messages)

    async def compress(self, messages: list, strategy: CompressionStrategy = CompressionStrategy.HYBRID) -> CompressedContext:
        """压缩对话历史。"""
        if len(messages) <= self.summarize_threshold:
            return CompressedContext(
                recent_messages=messages,
                original_count=len(messages),
                compressed_count=len(messages),
            )

        if strategy == CompressionStrategy.SLIDING_WINDOW:
            return self._sliding_window(messages)
        elif strategy == CompressionStrategy.SUMMARIZE:
            return await self._summarize_all(messages)
        elif strategy == CompressionStrategy.PROGRESSIVE:
            return await self._progressive_compress(messages)
        else:  # HYBRID
            return await self._hybrid_compress(messages)

    def _sliding_window(self, messages: list) -> CompressedContext:
        """滑动窗口——只保留最近N条。"""
        recent = messages[-self.keep_recent:]
        return CompressedContext(
            recent_messages=recent,
            original_count=len(messages),
            compressed_count=len(recent),
        )

    async def _summarize_all(self, messages: list) -> CompressedContext:
        """全量摘要。"""
        # 将消息对转为文本
        conv_text = self._messages_to_text(messages)
        summary = await self._generate_summary(conv_text)
        return CompressedContext(
            summary=summary,
            original_count=len(messages),
            compressed_count=1,
        )

    async def _progressive_compress(self, messages: list) -> CompressedContext:
        """渐进式压缩——每次压缩一批最旧的消息。"""
        recent = messages[-self.keep_recent:]
        to_compress = messages[:-self.keep_recent]

        # 按批次压缩
        batch_size = 6
        summaries = []
        for i in range(0, len(to_compress), batch_size):
            batch = to_compress[i:i+batch_size]
            batch_text = self._messages_to_text(batch)
            summary = await self._generate_summary(batch_text)
            summaries.append(summary)

        combined_summary = "\n\n".join(summaries)
        return CompressedContext(
            summary=combined_summary,
            recent_messages=recent,
            original_count=len(messages),
            compressed_count=len(recent) + 1,
        )

    async def _hybrid_compress(self, messages: list) -> CompressedContext:
        """混合策略——摘要旧消息+提取关键事实+保留近期原文。"""
        recent = messages[-self.keep_recent:]
        old_messages = messages[:-self.keep_recent]

        # 1. 生成摘要
        old_text = self._messages_to_text(old_messages)
        summary = await self._generate_summary(old_text)

        # 2. 提取关键事实
        key_facts = await self._extract_key_facts(old_text)

        return CompressedContext(
            summary=summary,
            recent_messages=recent,
            key_facts=key_facts,
            original_count=len(messages),
            compressed_count=len(recent) + 2,
        )

    def _messages_to_text(self, messages: list) -> str:
        """消息列表转文本。"""
        lines = []
        for msg in messages:
            role = "用户" if isinstance(msg, HumanMessage) else "助手" if isinstance(msg, AIMessage) else "系统"
            content = msg.content if isinstance(msg.content, str) else str(msg.content)
            lines.append(f"&#123;role&#125;: &#123;content[:200]&#125;")
        return "\n".join(lines)

    async def _generate_summary(self, text: str) -> str:
        """生成摘要。"""
        response = await self.llm.ainvoke([
            SystemMessage(content="你是对话摘要器。将对话历史压缩为简洁摘要，保留关键信息、决策和上下文。"),
            HumanMessage(content=f"请总结以下对话：\n&#123;text&#125;"),
        ])
        return response.content

    async def _extract_key_facts(self, text: str) -> list[str]:
        """提取关键事实。"""
        response = await self.llm.ainvoke([
            SystemMessage(content="提取对话中的关键事实和决策。每条一行，简洁。最多5条。"),
            HumanMessage(content=f"对话内容：\n&#123;text&#125;"),
        ])
        facts = [line.strip().strip("- ") for line in response.content.split("\n") if line.strip()]
        return facts[:5]


class ConversationManager:
    """对话管理器——自动触发压缩。"""

    def __init__(self, llm, max_tokens: int = 8000, compress_at: int = 6000):
        self.llm = llm
        self.max_tokens = max_tokens
        self.compress_at = compress_at
        self.compressor = ConversationCompressor(llm)
        self._context = CompressedContext()
        self._raw_messages: list = []

    async def add_message(self, message):
        """添加消息——自动检测是否需要压缩。"""
        self._raw_messages.append(message)
        token_count = self.compressor._estimate_tokens(self._raw_messages)

        if token_count > self.compress_at:
            self._context = await self.compressor.compress(
                self._raw_messages, CompressionStrategy.HYBRID
            )
            # 压缩后，raw_messages 重建为压缩后的
            compressed_msgs = self._context.to_messages()
            self._raw_messages = compressed_msgs[:]

    def get_context_messages(self) -> list:
        """获取当前上下文消息。"""
        if self._context.summary or self._context.key_facts:
            return self._context.to_messages()
        return self._raw_messages

    def get_stats(self) -> dict:
        """获取统计信息。"""
        return &#123;
            "raw_count": len(self._raw_messages),
            "has_summary": bool(self._context.summary),
            "key_facts_count": len(self._context.key_facts),
            "compression_ratio": self._context.compression_ratio,
            "estimated_tokens": self.compressor._estimate_tokens(self._raw_messages),
        &#125;
```

---

## 三、策略对比

| 策略 | 压缩率 | 信息保留 | LLM调用 | 延迟 | 适用场景 |
|------|--------|----------|---------|------|----------|
| 滑动窗口 | 高 | 低（丢旧信息） | 0 | 极低 | 短期对话 |
| 全量摘要 | 极高 | 中（摘要损失） | 1 | 中 | 超长对话 |
| 渐进式 | 高 | 高（分批保留） | N | 高 | 中长对话 |
| 混合 | 中高 | 高（摘要+原文+事实） | 2 | 中 | 生产环境 |

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 设置压缩阈值 | 不是每轮都压缩 | ★★★ |
| 混合策略优先 | 摘要+事实+近期原文 | ★★★ |
| 提取关键事实 | 防止摘要丢失关键信息 | ★★★ |
| 保留近期N轮原文 | 近期上下文最重要 | ★★☆ |
| 监控压缩率 | 过高说明信息丢失 | ★★☆ |
| 可选回退原始 | 保留原始历史可回溯 | ★☆☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有滑动窗口策略 | ☐ |
| 有摘要策略 | ☐ |
| 有渐进式压缩 | ☐ |
| 有混合策略 | ☐ |
| 有关键事实提取 | ☐ |
| 有自动压缩触发 | ☐ |
| 有压缩统计 | ☐ |
