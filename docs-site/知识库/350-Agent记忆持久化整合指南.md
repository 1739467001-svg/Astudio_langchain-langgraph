# Agent 记忆持久化整合指南

> 7 篇提及记忆持久化。这篇整合为完整指南——短期记忆(Checkpointer)+长期记忆(Store)+情景记忆(向量库)。

---

## 一、三层记忆

```mermaid
graph TB
    subgraph 记忆 &#123;"三层记忆"&#125;
        SHORT["短期记忆<br/>Checkpointer<br/>thread_id内对话"]
        LONG["长期记忆<br/>Store<br/>跨thread_id画像"]
        EPISODIC["情景记忆<br/>向量库<br/>过去经验"]
    end

    style SHORT fill:#E3F2FD
    style LONG fill:#FFF3E0
    style EPISODIC fill:#C8E6C9
```

---

## 二、实现

```python
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.memory import InMemoryStore
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class UserProfile:
    """用户画像——长期记忆。"""
    user_id: str
    name: str = ""
    preferences: dict = field(default_factory=dict)
    facts: dict = field(default_factory=dict)
    session_summaries: list[str] = field(default_factory=list)

    def get_profile_text(self) -> str:
        lines = []
        if self.name: lines.append(f"姓名: &#123;self.name&#125;")
        for k, v in self.preferences.items():
            lines.append(f"&#123;k&#125;: &#123;v&#125;")
        for k, v in self.facts.items():
            lines.append(f"&#123;k&#125;: &#123;v&#125;")
        return "\n".join(lines) if lines else "无已知信息"

class MemorySystem:
    """完整记忆系统——整合三层。"""

    def __init__(self):
        self.checkpointer = MemorySaver()    # 短期
        self.store = InMemoryStore()          # 长期
        self.episodic: dict[str, list] = &#123;&#125;  # 情景

    async def save_user_memory(self, user_id: str, profile: UserProfile):
        """保存长期记忆。"""
        import json
        self.store.put(user_id, "profile", json.dumps(&#123;
            "name": profile.name,
            "preferences": profile.preferences,
            "facts": profile.facts,
            "summaries": profile.session_summaries,
        &#125;, ensure_ascii=False))

    async def load_user_memory(self, user_id: str) -> UserProfile:
        """加载长期记忆。"""
        import json
        data = self.store.get(user_id, "profile")
        if data:
            parsed = json.loads(data) if isinstance(data, str) else data
            return UserProfile(
                user_id=user_id,
                name=parsed.get("name", ""),
                preferences=parsed.get("preferences", &#123;&#125;),
                facts=parsed.get("facts", &#123;&#125;),
                session_summaries=parsed.get("summaries", []),
            )
        return UserProfile(user_id=user_id)

    def add_episode(self, user_id: str, task: str, result: str, success: bool):
        """添加情景记忆。"""
        if user_id not in self.episodic:
            self.episodic[user_id] = []
        self.episodic[user_id].append(&#123;
            "task": task[:100], "result": result[:100], "success": success,
            "timestamp": datetime.now().isoformat(),
        &#125;)

    def recall_episodes(self, user_id: str, k: int = 3) -> list[dict]:
        """回忆情景记忆。"""
        episodes = self.episodic.get(user_id, [])
        return [e for e in episodes if e["success"]][-k:]
```

---

## 三、最佳实践

| 层 | 存储 | 用途 | 优先级 |
|----|------|------|--------|
| 短期 | Checkpointer | 对话历史 | ★★★ |
| 长期 | Store | 用户画像 | ★★☆ |
| 情景 | 向量库 | 过去经验 | ★☆☆ |

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有三层记忆 | ☐ |
| 有整合系统 | ☐ |
