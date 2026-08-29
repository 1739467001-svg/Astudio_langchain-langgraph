# Agent 情景记忆与语义记忆深度指南

> 人脑有两种长期记忆：情景记忆记住"上次发生了什么"、语义记忆记住"用户喜欢什么"。Agent 也需要这两种记忆——情景记忆存储历史交互、语义记忆沉淀用户偏好。本指南深度讲解两种记忆的区别、实现、检索、遗忘与巩固。

---

## 1. 情景记忆 vs 语义记忆

### 对比

```mermaid
graph TB
    MEM["Agent 长期记忆"]

    MEM --> EPISODIC["情景记忆<br/>存储具体事件<br/>'上次用户问了RAG'<br/>时间+内容+上下文"]
    MEM --> SEMANTIC["语义记忆<br/>存储抽象事实<br/>'用户偏好中文回答'<br/>提取的规律/偏好"]

    EPISODIC -->|"提取/巩固"| SEMANTIC

    style MEM fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style EPISODIC fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style SEMANTIC fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

### 职责区分

| 维度 | 情景记忆 | 语义记忆 |
|------|---------|---------|
| 存储内容 | 具体交互事件 | 抽象事实/偏好 |
| 时间信息 | 有（何时发生） | 无（一般性） |
| 检索方式 | 语义相似+时间 | Key 查找 |
| 更新频率 | 每次交互 | 偏好变化时 |
| 数据量 | 大（无限增长） | 小（精炼） |
| 示例 | "用户10月1日问了RAG" | "用户关注RAG/Agent" |

---

## 2. 情景记忆实现

```python
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

@dataclass
class EpisodicMemory:
    """情景记忆：存储和检索历史交互"""

    def __init__(self):
        self.vectorstore = Chroma(
            collection_name="episodic_memory",
            embedding_function=OpenAIEmbeddings(model="text-embedding-3-small"),
            persist_directory="./memory/episodic",
        )

    async def store(self, user_id: str, interaction: dict):
        """存储一次交互事件"""
        content = f"用户: &#123;interaction['query']&#125;\nAI: &#123;interaction['response']&#125;"

        self.vectorstore.add_texts(
            texts=[content],
            metadatas=[&#123;
                "user_id": user_id,
                "timestamp": interaction.get("timestamp", datetime.utcnow().isoformat()),
                "topic": interaction.get("topic", ""),
                "rating": interaction.get("rating", ""),
                "tools_used": json.dumps(interaction.get("tools", [])),
                "session_id": interaction.get("session_id", ""),
            &#125;],
        )

    async def recall(self, user_id: str, query: str, top_k: int = 5,
                     time_filter: dict = None) -> list:
        """回忆相关历史交互"""
        filter_dict = &#123;"user_id": user_id&#125;
        if time_filter:
            filter_dict.update(time_filter)

        results = self.vectorstore.similarity_search(
            query, k=top_k, filter=filter_dict,
        )

        memories = []
        for doc in results:
            memories.append(&#123;
                "content": doc.page_content,
                "timestamp": doc.metadata.get("timestamp", ""),
                "topic": doc.metadata.get("topic", ""),
                "relevance_score": 0.9,  # 实际中从向量库获取
            &#125;)

        return memories

    async def recall_by_time(self, user_id: str, days: int = 7) -> list:
        """按时间回忆"""
        all_docs = self.vectorstore.similarity_search("", k=100, filter=&#123;"user_id": user_id&#125;)

        cutoff = datetime.utcnow() - timedelta(days=days)
        recent = [
            d for d in all_docs
            if datetime.fromisoformat(d.metadata.get("timestamp", datetime.utcnow().isoformat())) > cutoff
        ]
        return recent

    async def search_by_topic(self, user_id: str, topic: str) -> list:
        """按主题搜索"""
        return self.vectorstore.similarity_search(
            topic, k=10, filter=&#123;"user_id": user_id, "topic": topic&#125;,
        )
```

---

## 3. 语义记忆实现

```python
@dataclass
class SemanticMemory:
    """语义记忆：存储抽象事实和偏好"""

    def __init__(self):
        self.store = &#123;&#125;  # 实际中用 PostgresStore

    async def store_fact(self, user_id: str, key: str, value: str,
                         confidence: float = 1.0, source: str = ""):
        """存储事实/偏好"""
        if user_id not in self.store:
            self.store[user_id] = &#123;&#125;

        existing = self.store[user_id].get(key)

        self.store[user_id][key] = &#123;
            "value": value,
            "confidence": confidence,
            "updated_at": datetime.utcnow().isoformat(),
            "source": source,  # "explicit"(用户说的) / "inferred"(推断的)
            "previous_value": existing["value"] if existing else None,
        &#125;

    async def get_facts(self, user_id: str) -> dict:
        """获取用户所有事实/偏好"""
        return self.store.get(user_id, &#123;&#125;)

    async def get_fact(self, user_id: str, key: str) -> dict:
        """获取特定事实"""
        return self.store.get(user_id, &#123;&#125;).get(key)

    async def update_preference(self, user_id: str, key: str, value: str):
        """更新偏好"""
        await self.store_fact(user_id, key, value, confidence=1.0, source="explicit")
```

### 自动偏好提取

```python
@dataclass
class PreferenceExtractor:
    """从交互中自动提取偏好（情景→语义）"""

    async def extract(self, user_id: str, interaction: dict) -> dict:
        """从单次交互中提取偏好"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        response = await llm.ainvoke(
            f"""从以下交互中提取用户偏好/事实。只提取明确的信息。

交互:
用户: &#123;interaction['query']&#125;
AI: &#123;interaction.get('response', '')[:500]&#125;

提取格式（JSON，没有就返回空对象）：
&#123;&#123;
    "language": "语言偏好（如果明确）",
    "technical_level": "技术水平（如果可推断）",
    "interests": "兴趣领域（如果明确）",
    "communication_style": "沟通风格偏好（如果明确）",
    "constraints": "限制条件（如'不要用代码'）"
&#125;&#125;"""
        )

        try:
            preferences = json.loads(response.content)
            # 存入语义记忆
            semantic = SemanticMemory()
            for key, value in preferences.items():
                if value:
                    await semantic.store_fact(user_id, key, value,
                                             confidence=0.7, source="inferred")
            return preferences
        except json.JSONDecodeError:
            return &#123;&#125;
```

---

## 4. 记忆巩固

```python
@dataclass
class MemoryConsolidation:
    """记忆巩固：从情景记忆中提取规律→语义记忆"""

    async def consolidate(self, user_id: str):
        """定期巩固：分析历史交互→提取偏好"""
        episodic = EpisodicMemory()

        # 获取所有历史交互
        all_memories = await episodic.recall(user_id, "", top_k=50)

        if len(all_memories) < 10:
            return &#123;"consolidated": 0, "reason": "交互太少"&#125;

        # LLM 分析模式
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        memory_text = "\n".join([
            f"[&#123;m['timestamp'][:10]&#125;] &#123;m['content'][:200]&#125;"
            for m in all_memories
        ])

        response = await llm.ainvoke(
            f"""分析以下用户交互历史，提取用户画像和偏好。

历史交互:
&#123;memory_text&#125;

输出 JSON：
&#123;&#123;
    "language": "偏好语言",
    "technical_level": "技术水平",
    "interests": ["兴趣1", "兴趣2"],
    "communication_style": "风格",
    "frequent_topics": ["常问话题1", "常问话题2"],
    "preferred_response_length": "偏好回答长度",
    "preferred_detail_level": "偏好详细程度"
&#125;&#125;"""
        )

        try:
            profile = json.loads(response.content)
            semantic = SemanticMemory()
            for key, value in profile.items():
                if value:
                    await semantic.store_fact(user_id, key, str(value),
                                             confidence=0.8, source="consolidated")
            return &#123;"consolidated": len(profile), "profile": profile&#125;
        except:
            return &#123;"consolidated": 0&#125;
```

---

## 5. 记忆遗忘

```python
@dataclass
class MemoryForgetting:
    """记忆遗忘策略"""

    async def should_forget(self, memory_item: dict) -> bool:
        """判断是否应该遗忘"""
        timestamp = memory_item.get("timestamp", "")
        if not timestamp:
            return False

        age_days = (datetime.utcnow() - datetime.fromisoformat(timestamp)).days

        # 规则1：超期遗忘
        if age_days > 90:
            return True

        # 规则2：低重要性
        if memory_item.get("rating", 3) <= 1 and age_days > 30:
            return True

        return False

    async def forget(self, user_id: str, memory_ids: list):
        """删除记忆"""
        for mid in memory_ids:
            await vectorstore.delete([mid])

    async def compress_old_memories(self, user_id: str):
        """压缩旧记忆：多条相似→合并为一条摘要"""
        old_memories = await self._get_old_memories(user_id, days=60)

        if len(old_memories) < 5:
            return

        # LLM 合并相似记忆
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        memory_text = "\n".join([m.page_content[:200] for m in old_memories])

        response = await llm.ainvoke(
            f"将以下多条记忆合并为一条摘要：\n&#123;memory_text&#125;"
        )

        # 存入新记忆
        await EpisodicMemory().store(user_id, &#123;
            "query": "[合并记忆]",
            "response": response.content,
            "timestamp": datetime.utcnow().isoformat(),
            "topic": "consolidated",
        &#125;)

        # 删除旧记忆
        await self.forget(user_id, [m.metadata.get("id") for m in old_memories])
```

---

## 6. 在对话中注入记忆

```python
async def memory_enhanced_chat(query: str, user_id: str) -> str:
    """带记忆增强的对话"""
    episodic = EpisodicMemory()
    semantic = SemanticMemory()

    # 1. 回忆相关历史（情景记忆）
    memories = await episodic.recall(user_id, query, top_k=3)

    # 2. 获取用户画像（语义记忆）
    facts = await semantic.get_facts(user_id)

    # 3. 构建增强 Prompt
    memory_context = ""
    if memories:
        memory_context = "相关历史交互:\n" + "\n".join([m["content"][:150] for m in memories])

    fact_context = ""
    if facts:
        fact_context = "用户画像:\n" + "\n".join([f"- &#123;k&#125;: &#123;v['value']&#125;" for k, v in facts.items()])

    system_prompt = f"""你是用户的个人助手。

&#123;memory_context&#125;
&#123;fact_context&#125;

请结合历史记忆和用户画像回答。"""

    llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
    response = await llm.ainvoke([
        &#123;"role": "system", "content": system_prompt&#125;,
        &#123;"role": "user", "content": query&#125;,
    ])

    # 4. 存入情景记忆
    await episodic.store(user_id, &#123;
        "query": query,
        "response": response.content,
        "timestamp": datetime.utcnow().isoformat(),
    &#125;)

    # 5. 定期提取偏好
    if random.random() < 0.1:  # 10% 概率
        await PreferenceExtractor().extract(user_id, &#123;
            "query": query,
            "response": response.content,
        &#125;)

    return response.content
```

---

## 7. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解情景 vs 语义记忆 | ☐ |
| 实现了情景记忆（向量存储+检索） | ☐ |
| 实现了语义记忆（KV Store） | ☐ |
| 实现了自动偏好提取 | ☐ |
| 实现了记忆巩固 | ☐ |
| 实现了记忆遗忘 | ☐ |
| 实现了旧记忆压缩 | ☐ |
| 在对话中注入了记忆 | ☐ |

---

## 8. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 04 | Memory 机制 | Memory |
| 05 | Memory 机制图解 | 图解 |
| 45 | Agent 记忆与规划 | 记忆 |
| 60 | 记忆遗忘与压缩策略 | 遗忘 |
| 85 | 记忆遗忘与压缩 | 压缩 |
| 90 | Agent 记忆架构设计 | 架构 |
| 122 | Agent 记忆架构设计 | 设计 |
| 167 | Agent 记忆持久化 | 持久化 |
| 199 | Agent 记忆持久化与跨会话 | 跨会话 |
| 245 | 记忆遗忘 | 遗忘 |
| 320 | 记忆持久化 | 持久化 |
| 350 | Agent 记忆持久化 | 持久化 |
| 359 | 记忆分层与遗忘策略 | 分层 |
| 389 | 记忆分层与遗忘策略 | 策略 |
| 446 | Agent 记忆架构与长期记忆 | 记忆架构 |
| 496 | Agent 经验沉淀与组织知识库 | 经验沉淀 |
