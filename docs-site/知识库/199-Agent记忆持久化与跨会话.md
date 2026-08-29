# Agent 记忆持久化与跨会话

> Agent 记得上次对话——这需要持久化存储。但存什么、怎么存、如何检索、什么时候遗忘？这份指南深入 Agent 记忆的持久化工程实践。

---

## 一、记忆持久化架构

```mermaid
graph TB
    subgraph 架构 &#123;"Agent记忆持久化"&#125;
        S1["短期记忆<br/>Checkpointer<br/>线程内对话历史"] --> STORE1["PostgreSQL<br/>按thread_id"]
        S2["长期记忆<br/>Store<br/>跨线程用户画像"] --> STORE2["Redis/PG<br/>按user_id"]
        S3["情景记忆<br/>向量库<br/>过去经验"] --> STORE3["向量库<br/>语义检索"]
        S4["事实记忆<br/>KV存储<br/>已知信息"] --> STORE4["Redis<br/>快速查询"]
    end

    style 架构 fill:#E3F2FD
    style S2 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、跨会话记忆实现

```python
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional
import json

@dataclass
class CrossSessionMemory:
    """跨会话记忆管理器。

    让Agent记住用户跨会话的信息：
    - 用户偏好（语言/风格/习惯）
    - 已知事实（姓名/职业/需求）
    - 历史交互摘要
    """

    user_id: str
    preferences: dict = field(default_factory=dict)
    facts: dict = field(default_factory=dict)
    session_summaries: list[str] = field(default_factory=list)
    last_interaction: str = ""

    def update_preference(self, key: str, value: str):
        """更新偏好。"""
        self.preferences[key] = &#123;
            "value": value,
            "updated_at": datetime.now().isoformat(),
        &#125;

    def add_fact(self, key: str, value: str, source: str = "user"):
        """添加事实。"""
        self.facts[key] = &#123;
            "value": value,
            "source": source,
            "confidence": 0.5 if source == "inferred" else 0.9,
            "updated_at": datetime.now().isoformat(),
        &#125;

    def add_session_summary(self, summary: str):
        """添加会话摘要。"""
        self.session_summaries.append(summary)
        # 只保留最近10个会话摘要
        if len(self.session_summaries) > 10:
            self.session_summaries = self.session_summaries[-10:]

    def get_user_profile(self) -> str:
        """生成用户画像文本。"""
        lines = [f"## 用户画像 (ID: &#123;self.user_id&#125;)"]

        if self.preferences:
            lines.append("### 偏好")
            for k, v in self.preferences.items():
                lines.append(f"- &#123;k&#125;: &#123;v['value']&#125;")

        if self.facts:
            lines.append("### 已知信息")
            for k, v in self.facts.items():
                lines.append(f"- &#123;k&#125;: &#123;v['value']&#125; (置信度: &#123;v['confidence']&#125;)")

        if self.session_summaries:
            lines.append("### 近期对话摘要")
            for s in self.session_summaries[-3:]:
                lines.append(f"- &#123;s[:100]&#125;")

        return "\n".join(lines)


class MemoryPersistenceManager:
    """记忆持久化管理器。"""

    def __init__(self, store=None):
        self.store = store  # 实际用Redis/PostgreSQL
        self._cache: dict[str, CrossSessionMemory] = &#123;&#125;

    async def load(self, user_id: str) -> CrossSessionMemory:
        """加载用户记忆。"""
        if user_id in self._cache:
            return self._cache[user_id]

        # 从存储加载
        if self.store:
            data = await self.store.aget(user_id, "memory")
            if data:
                memory = CrossSessionMemory(user_id=user_id)
                parsed = json.loads(data) if isinstance(data, str) else data
                memory.preferences = parsed.get("preferences", &#123;&#125;)
                memory.facts = parsed.get("facts", &#123;&#125;)
                memory.session_summaries = parsed.get("summaries", [])
                self._cache[user_id] = memory
                return memory

        memory = CrossSessionMemory(user_id=user_id)
        self._cache[user_id] = memory
        return memory

    async def save(self, user_id: str):
        """保存用户记忆。"""
        memory = self._cache.get(user_id)
        if not memory or not self.store:
            return

        data = json.dumps(&#123;
            "preferences": memory.preferences,
            "facts": memory.facts,
            "summaries": memory.session_summaries,
        &#125;, ensure_ascii=False)
        await self.store.aput(user_id, "memory", data)

    async def extract_and_store(self, user_id: str, conversation: str, llm):
        """从对话中自动提取信息并存储。"""
        from langchain_core.messages import HumanMessage

        prompt = f"""从以下对话中提取用户信息和偏好。只提取明确提及的。

对话:
&#123;conversation[:1500]&#125;

输出JSON:
```json
&#123;&#123;
  "facts": [&#123;&#123;"key": "姓名", "value": "张三"&#125;&#125;],
  "preferences": [&#123;&#123;"key": "回答风格", "value": "简洁"&#125;&#125;]
&#125;&#125;
```
没有新信息则返回空数组。"""

        response = await llm.ainvoke([HumanMessage(content=prompt)])
        import re
        match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
        if match:
            data = json.loads(match.group())
            memory = await self.load(user_id)
            for fact in data.get("facts", []):
                memory.add_fact(fact["key"], fact["value"])
            for pref in data.get("preferences", []):
                memory.update_preference(pref["key"], pref["value"])
            await self.save(user_id)
```

---

## 三、记忆遗忘策略

```mermaid
graph TB
    subgraph 遗忘 &#123;"记忆遗忘策略"&#125;
        F1["TTL过期<br/>事实超过30天→降权"]
        F2["容量限制<br/>摘要只保留10个"]
        F3["重要性衰减<br/>旧记忆权重降低"]
        F4["冲突更新<br/>新事实覆盖旧事实"]
    end

    style 遗忘 fill:#FFF3E0
```

```python
class MemoryForgettingManager:
    """记忆遗忘管理器。"""

    TTL_DAYS = &#123;
        "preferences": 90,     # 偏好保留90天
        "facts": 30,            # 事实保留30天
        "summaries": 7,         # 摘要保留7天
    &#125;

    @staticmethod
    def should_forget(item: dict, item_type: str) -> bool:
        """判断是否应该遗忘。"""
        ttl = MemoryForgettingManager.TTL_DAYS.get(item_type, 30)
        updated = item.get("updated_at", "")
        if not updated:
            return False
        try:
            updated_time = datetime.fromisoformat(updated)
            age = (datetime.now() - updated_time).days
            return age > ttl
        except (ValueError, TypeError):
            return False

    @staticmethod
    def decay_importance(importance: float, age_days: float, decay_rate: float = 0.01) -> float:
        """重要性随时间衰减。"""
        return max(0.1, importance * (1 - decay_rate * age_days))
```

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 跨会话用Store | 超越Checkpointer的线程限制 | ★★★ |
| 自动提取用户信息 | 从对话中学习 | ★★★ |
| 有遗忘机制 | 防止记忆膨胀 | ★★☆ |
| 用户可查看和删除 | 隐私合规 | ★★★ |
| 冲突时新覆盖旧 | 保持信息最新 | ★★☆ |
| 置信度管理 | 推断的<用户明确说的 | ★★☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有跨会话记忆 | ☐ |
| 有自动提取 | ☐ |
| 有遗忘策略 | ☐ |
| 有持久化存储 | ☐ |
