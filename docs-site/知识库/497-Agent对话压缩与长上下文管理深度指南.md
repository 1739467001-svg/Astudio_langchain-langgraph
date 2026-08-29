# Agent 对话压缩与长上下文管理深度指南

> 用户和 Agent 聊了 100 轮——上下文 10 万 Token，但模型窗口只有 8000。直接截断会丢失早期重要信息，全量送进去成本爆炸。本指南深度讲解对话压缩策略：摘要压缩、关键信息提取、滑动窗口、分层记忆，以及 Token 预算动态分配。

---

## 1. 对话压缩策略对比

### 五种策略

```mermaid
graph TB
    COMP["对话压缩策略"]

    COMP --> TRUNC["直接截断<br/>保留最近N轮<br/>简单但丢信息"]
    COMP --> SUMM["摘要压缩<br/>LLM总结旧消息<br/>保留要点"]
    COMP --> EXTRACT["关键信息提取<br/>提取实体/事实<br/>结构化保留"]
    COMP --> LAYER["分层记忆<br/>工作+短期+长期<br/>分而治之"]
    COMP --> HYBRID["混合策略<br/>截断+摘要+提取<br/>生产推荐"]

    style COMP fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style HYBRID fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style LAYER fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

### 策略效果对比

| 策略 | 信息保留率 | Token节省 | 实现复杂度 | 延迟 |
|------|-----------|---------|-----------|------|
| 直接截断 | 30-50% | 高 | 低 | 0ms |
| 摘要压缩 | 70-85% | 中 | 中 | 500ms |
| 关键信息提取 | 80-90% | 中高 | 中 | 300ms |
| 分层记忆 | 90%+ | 高 | 高 | 0ms（预计算） |
| 混合策略 | 85-95% | 高 | 中高 | 300ms |

---

## 2. 摘要压缩

### 多级摘要

```python
from langchain_openai import ChatOpenAI
from dataclasses import dataclass
import tiktoken

@dataclass
class ConversationCompressor:
    """对话压缩器"""

    tokenizer = tiktoken.encoding_for_model("gpt-4o")

    def count_tokens(self, messages: list) -> int:
        """计算 Token 数"""
        total = 0
        for msg in messages:
            total += len(self.tokenizer.encode(msg.get("content", "")))
            total += 4  # 每条消息开销
        return total

    async def compress_if_needed(self, messages: list, max_tokens: int = 6000) -> list:
        """如果超出限制则压缩"""
        current_tokens = self.count_tokens(messages)

        if current_tokens <= max_tokens:
            return messages  # 不需要压缩

        # 计算需要压缩多少
        excess_ratio = current_tokens / max_tokens
        print(f"当前 &#123;current_tokens&#125; tokens，目标 &#123;max_tokens&#125;，压缩比 &#123;excess_ratio:.1f&#125;x")

        # 混合策略：保留最近 N 轮 + 摘要旧消息 + 提取关键信息
        return await self._hybrid_compress(messages, max_tokens)

    async def _hybrid_compress(self, messages: list, max_tokens: int) -> list:
        """混合压缩：截断+摘要+提取"""
        # 预算分配
        system_budget = max_tokens * 0.10    # 系统消息 10%
        recent_budget = max_tokens * 0.40    # 最近消息 40%
        summary_budget = max_tokens * 0.30   # 摘要 30%
        key_info_budget = max_tokens * 0.20  # 关键信息 20%

        # 1. 分离系统消息和对话消息
        system_msgs = [m for m in messages if m["role"] == "system"]
        conversation = [m for m in messages if m["role"] != "system"]

        # 2. 保留最近 N 轮（在 recent_budget 内）
        recent = []
        recent_tokens = 0
        for msg in reversed(conversation):
            msg_tokens = len(self.tokenizer.encode(msg.get("content", "")))
            if recent_tokens + msg_tokens > recent_budget:
                break
            recent.insert(0, msg)
            recent_tokens += msg_tokens

        # 3. 需要压缩的旧消息
        old_messages = conversation[:len(conversation) - len(recent)]

        if not old_messages:
            return system_msgs + recent

        # 4. LLM 摘要旧消息
        summary = await self._summarize(old_messages, summary_budget)

        # 5. 提取关键信息
        key_info = await self._extract_key_info(old_messages, key_info_budget)

        # 6. 组装
        compressed = system_msgs + [
            &#123;"role": "system", "content": f"之前对话摘要:\n&#123;summary&#125;"&#125;,
            &#123;"role": "system", "content": f"关键信息:\n&#123;key_info&#125;"&#125;,
            &#123;"role": "system", "content": f"[已省略 &#123;len(old_messages)&#125; 条较早的对话]"&#125;,
        ] + recent

        # 验证
        final_tokens = self.count_tokens(compressed)
        print(f"压缩后: &#123;final_tokens&#125; tokens（原 &#123;self.count_tokens(messages)&#125;）")

        return compressed

    async def _summarize(self, messages: list, token_budget: int) -> str:
        """LLM 摘要"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        max_chars = token_budget * 3  # 粗估

        text = "\n".join([
            f"&#123;m['role']&#125;: &#123;m['content'][:300]&#125;"
            for m in messages
        ])

        prompt = f"""总结以下对话，保留：
1. 讨论的核心话题
2. 已确定的事实（用户提供的具体信息）
3. 未解决的问题
4. 用户的偏好和要求

字数限制: &#123;max_chars&#125; 字以内

对话:
&#123;text&#125;"""

        response = await llm.ainvoke(prompt)
        return response.content

    async def _extract_key_info(self, messages: list, token_budget: int) -> str:
        """提取关键信息"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        text = "\n".join([
            f"&#123;m['role']&#125;: &#123;m['content'][:200]&#125;"
            for m in messages
        ])

        prompt = f"""从以下对话中提取关键信息，输出结构化列表：

- 用户姓名/身份: 
- 用户需求: 
- 已知事实/数据: 
- 用户偏好: 
- 待办事项: 
- 重要决定: 

对话:
&#123;text&#125;"""

        response = await llm.ainvoke(prompt)
        return response.content
```

---

## 3. 增量摘要

```python
@dataclass
class IncrementalSummarizer:
    """增量摘要：每 N 轮更新一次摘要"""

    summary_interval: int = 10  # 每 10 轮摘要一次
    current_summary: str = ""
    unsummarized_count: int = 0

    async def add_message(self, message: dict):
        """添加消息并检查是否需要更新摘要"""
        self.unsummarized_count += 1

        if self.unsummarized_count >= self.summary_interval:
            # 触发增量摘要
            await self._update_summary()
            self.unsummarized_count = 0

    async def _update_summary(self):
        """增量更新摘要"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        if self.current_summary:
            prompt = f"""更新对话摘要。

当前摘要:
&#123;self.current_summary&#125;

最近 &#123;self.summary_interval&#125; 条新消息:
&#123;self._get_recent_messages()&#125;

请整合更新摘要，保持简洁。"""
        else:
            prompt = f"""总结以下对话:
&#123;self._get_recent_messages()&#125;"""

        response = await llm.ainvoke(prompt)
        self.current_summary = response.content

    def _get_recent_messages(self) -> str:
        return "（实际中获取最近的消息）"
```

---

## 4. Token 预算动态分配

```python
@dataclass
class DynamicTokenBudget:
    """动态 Token 预算分配"""

    def allocate(self, max_tokens: int, context: dict) -> dict:
        """根据上下文动态分配"""
        # 基础分配
        allocation = &#123;
            "system_prompt": max_tokens * 0.10,
            "user_preferences": max_tokens * 0.05,
            "conversation_summary": max_tokens * 0.25,
            "key_facts": max_tokens * 0.15,
            "recent_messages": max_tokens * 0.35,
            "retrieval_docs": max_tokens * 0.10,
        &#125;

        # 动态调整
        has_retrieval = context.get("has_retrieval", False)
        if has_retrieval:
            # 有检索结果时，减少对话历史，增加检索
            allocation["recent_messages"] *= 0.8
            allocation["retrieval_docs"] *= 2.0

        conversation_length = context.get("conversation_length", 0)
        if conversation_length > 50:
            # 长对话：更多摘要空间
            allocation["conversation_summary"] *= 1.5
            allocation["recent_messages"] *= 0.7

        # 确保输出空间
        output_reserve = max_tokens * 0.15
        total_input = sum(allocation.values())
        if total_input + output_reserve > max_tokens:
            # 按比例缩减
            scale = (max_tokens - output_reserve) / total_input
            allocation = &#123;k: int(v * scale) for k, v in allocation.items()&#125;

        return allocation
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解五种压缩策略 | ☐ |
| 实现了混合压缩（截断+摘要+提取） | ☐ |
| 实现了增量摘要 | ☐ |
| 实现了 Token 预算动态分配 | ☐ |
| 能按 Token 精确裁剪 | ☐ |
| 有压缩前后效果对比 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 04 | Memory 与对话管理 | Memory |
| 21 | Token 与上下文窗口管理 | 窗口管理 |
| 27 | 上下文窗口与 Token 管理 | 窗口 |
| 74 | RAG 上下文组装与压缩 | 组装压缩 |
| 85 | 记忆遗忘与压缩策略 | 压缩 |
| 125 | Token 优化与上下文压缩 | 优化 |
| 176 | 上下文窗口管理 | 窗口 |
| 183 | 上下文组装 | 组装 |
| 215 | RAG 上下文组装与压缩深度 | 深度 |
| 234 | 上下文组装 | 组装 |
| 361 | Agent 对话摘要与长上下文压缩 | 摘要 |
| 474 | Agent 会话管理与上下文工程 | 上下文工程 |
