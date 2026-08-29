# Agent 记忆架构与长期记忆系统指南

> 人类有短期记忆和长期记忆——短期记忆记住刚才的对话，长期记忆记住去年聊过什么。Agent 的记忆也需要分层：工作记忆保持当前上下文，情景记忆存储过往交互，语义记忆沉淀用户偏好。本指南系统讲解 Agent 记忆的心理学模型、四层记忆架构、LangGraph Store 实现，以及长期记忆的生产实践。

---

## 1. Agent 记忆的心理学模型

### 人脑记忆分类

```
人脑记忆系统：
  感觉记忆 (< 1秒)
    → 瞬间感知，几乎瞬间遗忘

  短期/工作记忆 (30秒-数分钟)
    → 当前正在处理的信息
    → 容量有限（7±2 个信息块）

  长期记忆
    → 情景记忆：个人经历（"上次用户问了什么"）
    → 语义记忆：知识事实（"用户偏好中文回答"）
    → 程序记忆：技能方法（"如何调用搜索工具"）
```

### Agent 记忆映射

| 人脑记忆 | Agent 对应 | 实现 | 生命周期 |
|---------|-----------|------|---------|
| 工作记忆 | 当前对话上下文 | messages 列表 | 会话内 |
| 短期记忆 | 最近 N 轮对话 | 滑动窗口 | 会话内 |
| 情景记忆 | 历史交互记录 | 向量检索 | 跨会话 |
| 语义记忆 | 用户偏好/事实 | KV Store | 永久 |
| 程序记忆 | 工具使用经验 |few-shot 示例 | 永久 |

---

## 2. 四层记忆架构

```mermaid
graph TB
    subgraph "Agent 四层记忆系统"
        WM["工作记忆<br/>当前对话上下文<br/>MessagesState"]
        SM["短期记忆<br/>最近 N 轮摘要<br/>滑动窗口"]
        EM["情景记忆<br/>历史交互<br/>向量检索"]
        SEM["语义记忆<br/>用户偏好/事实<br/>KV Store"]
    end

    INPUT["用户输入"] --> WM
    WM -->|"超出窗口"| SM
    SM -->|"重要交互"| EM
    EM -->|"提取偏好"| SEM

    SEM -->|"注入上下文"| WM
    EM -->|"回忆相关历史"| WM

    style WM fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style SM fill:#FFF9C4,stroke:#F9A825
    style EM fill:#F3E5F5,stroke:#7B1FA2
    style SEM fill:#C8E6C9,stroke:#2E7D32
```

### 各层职责

| 层级 | 存储 | 容量 | 检索方式 | 更新频率 |
|------|------|------|---------|---------|
| 工作记忆 | 内存 | 当前会话 | 直接访问 | 每次交互 |
| 短期记忆 | 内存/缓存 | 最近N轮 | 滑动窗口 | 每轮 |
| 情景记忆 | 向量库 | 无限 | 语义检索 | 重要交互时 |
| 语义记忆 | KV Store | 无限 | Key 查找 | 偏好变化时 |

---

## 3. 工作记忆与短期记忆

### 对话窗口管理

```python
from langgraph.graph import StateGraph, MessagesState
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

# === 基础：消息列表就是工作记忆 ===
# LangGraph 的 MessagesState 自动管理消息列表

# === 短期记忆：滑动窗口 ===
@dataclass
class SlidingWindowMemory:
    """滑动窗口短期记忆"""
    max_messages: int = 20    # 保留最近 20 条
    summarize_threshold: int = 15  # 超过 15 条时触发摘要

    def apply(self, messages: list) -> list:
        """应用滑动窗口"""
        if len(messages) <= self.max_messages:
            return messages

        # 保留系统消息 + 最近 N 条
        system_msgs = [m for m in messages if m["role"] == "system"]
        non_system = [m for m in messages if m["role"] != "system"]

        # 如果需要摘要
        if len(non_system) > self.summarize_threshold:
            summary = self.summarize_old_messages(non_system[:-self.max_messages])
            recent = non_system[-self.max_messages:]
            return system_msgs + [
                &#123;"role": "system", "content": f"之前对话摘要：&#123;summary&#125;"&#125;
            ] + recent

        return system_msgs + non_system[-self.max_messages:]

    async def summarize_old_messages(self, old_messages: list) -> str:
        """摘要旧消息"""
        text = "\n".join([f"&#123;m['role']&#125;: &#123;m['content']&#125;" for m in old_messages])
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        response = await llm.ainvoke(
            f"用200字以内总结以下对话：\n&#123;text&#125;"
        )
        return response.content
```

### Token 感知的上下文管理

```python
@dataclass
class TokenAwareMemory:
    """基于 Token 预算的上下文管理"""
    max_tokens: int = 8000      # 上下文最大 Token
    reserved_for_response: int = 1000  # 预留给回答的 Token
    tokenizer: object = None

    def fit_to_budget(self, messages: list) -> list:
        """在 Token 预算内裁剪消息"""
        budget = self.max_tokens - self.reserved_for_response

        # 保留系统消息
        system_msgs = [m for m in messages if m["role"] == "system"]
        system_tokens = self.count_tokens(system_msgs)

        remaining_budget = budget - system_tokens

        # 从最新消息往前保留
        non_system = [m for m in messages if m["role"] != "system"]
        kept = []
        for msg in reversed(non_system):
            msg_tokens = self.count_tokens([msg])
            if remaining_budget - msg_tokens < 0:
                break
            kept.insert(0, msg)
            remaining_budget -= msg_tokens

        # 如果丢弃了消息，添加摘要提示
        dropped_count = len(non_system) - len(kept)
        if dropped_count > 0:
            kept.insert(0, &#123;
                "role": "system",
                "content": f"[已省略 &#123;dropped_count&#125; 条较早的对话]"
            &#125;)

        return system_msgs + kept

    def count_tokens(self, messages: list) -> int:
        """估算 Token 数"""
        total = 0
        for msg in messages:
            total += len(msg.get("content", "")) // 3  # 粗估：1 Token ≈ 3 字符
        return total
```

---

## 4. 情景记忆：跨会话历史

### 向量化存储

```python
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

@dataclass
class EpisodicMemory:
    """情景记忆：存储和检索历史交互"""

    def __post_init__(self):
        self.vectorstore = Chroma(
            collection_name="episodic_memory",
            embedding_function=OpenAIEmbeddings(model="text-embedding-3-small"),
            persist_directory="./memory/episodic",
        )

    async def store(self, user_id: str, interaction: dict):
        """存储一次交互"""
        # 交互内容：用户问题 + AI回答 + 时间 + 元数据
        content = f"用户: &#123;interaction['query']&#125;\nAI: &#123;interaction['response']&#125;"

        self.vectorstore.add_texts(
            texts=[content],
            metadatas=[&#123;
                "user_id": user_id,
                "timestamp": interaction["timestamp"],
                "topic": interaction.get("topic", ""),
                "satisfaction": interaction.get("satisfaction", ""),
            &#125;],
        )

    async def recall(self, user_id: str, query: str, top_k: int = 3) -> list:
        """回忆相关历史交互"""
        results = self.vectorstore.similarity_search(
            query,
            k=top_k,
            filter=&#123;"user_id": user_id&#125;,  # 只查当前用户
        )

        memories = []
        for doc in results:
            memories.append(&#123;
                "content": doc.page_content,
                "metadata": doc.metadata,
                "relevance": "high" if doc.metadata.get("score", 0) > 0.8 else "medium",
            &#125;)

        return memories

    async def recall_by_time(self, user_id: str, days: int = 7) -> list:
        """按时间范围回忆"""
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        # 需要向量库支持时间过滤
        results = self.vectorstore.similarity_search(
            "",  # 空 query
            k=20,
            filter=&#123;"user_id": user_id&#125;,
        )
        return [r for r in results if r.metadata.get("timestamp", "") >= cutoff]
```

### 在对话中注入历史记忆

```python
async def memory_enhanced_chat(query: str, user_id: str):
    """带记忆增强的对话"""

    # 1. 回忆相关历史
    memories = await episodic_memory.recall(user_id, query)

    # 2. 获取用户偏好
    preferences = await semantic_memory.get_preferences(user_id)

    # 3. 构建增强上下文
    memory_context = ""
    if memories:
        memory_context = "之前的对话历史:\n"
        for m in memories:
            memory_context += f"- &#123;m['content']&#125;\n"

    if preferences:
        memory_context += f"\n用户偏好: &#123;preferences&#125;\n"

    # 4. 构建消息
    messages = [
        SystemMessage(content=f"""你是用户的个人助手。

&#123;memory_context&#125;

请基于历史交互和用户偏好回答。"""),
        HumanMessage(content=query),
    ]

    # 5. 调用 LLM
    response = await llm.ainvoke(messages)

    # 6. 存储这次交互到情景记忆
    await episodic_memory.store(user_id, &#123;
        "query": query,
        "response": response.content,
        "timestamp": datetime.utcnow().isoformat(),
    &#125;)

    return response.content
```

---

## 5. 语义记忆：用户偏好

### LangGraph Store 实现

```python
from langgraph.store.memory import InMemoryStore
from langgraph.checkpoint.memory import MemorySaver

# LangGraph 内置的 Store 用于长期记忆
store = InMemoryStore()  # 生产环境用 PostgresStore

# === 存储用户偏好 ===
async def save_preference(user_id: str, key: str, value: str):
    """保存用户偏好"""
    store.put(
        namespace=("preferences", user_id),
        key=key,
        value=&#123;"content": value, "updated_at": datetime.utcnow().isoformat()&#125;,
    )

# === 读取用户偏好 ===
async def get_preferences(user_id: str) -> dict:
    """获取用户所有偏好"""
    items = store.search(namespace=("preferences", user_id))
    prefs = &#123;&#125;
    for item in items:
        prefs[item.key] = item.value["content"]
    return prefs

# 使用
await save_preference("user_001", "language", "中文")
await save_preference("user_001", "response_style", "简洁")
await save_preference("user_001", "interests", "AI, 编程, 音乐")

prefs = await get_preferences("user_001")
# &#123;"language": "中文", "response_style": "简洁", "interests": "AI, 编程, 音乐"&#125;
```

### 自动偏好提取

```python
async def extract_and_save_preferences(user_id: str, conversation: list):
    """从对话中自动提取偏好"""
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    conversation_text = "\n".join([
        f"&#123;m['role']&#125;: &#123;m['content'][:100]&#125;" for m in conversation[-10:]
    ])

    response = await llm.ainvoke(
        f"""从以下对话中提取用户偏好，返回 JSON：
        &#123;&#123;
            "language": "用户偏好的语言",
            "response_style": "回答风格偏好",
            "interests": "感兴趣的领域",
            "communication_preference": "沟通偏好"
        &#125;&#125;

        对话:
        &#123;conversation_text&#125;

        只提取明确表达的偏好，不确定的留空。"""
    )

    try:
        prefs = json.loads(response.content)
        for key, value in prefs.items():
            if value:
                await save_preference(user_id, key, value)
    except json.JSONDecodeError:
        pass  # 提取失败就跳过
```

---

## 6. 记忆遗忘机制

### 主动遗忘策略

```python
@dataclass
class MemoryForgetting:
    """记忆遗忘策略"""

    async def should_forget(self, memory_item: dict) -> bool:
        """判断是否应该遗忘"""
        # 规则1：过期遗忘
        age_days = (datetime.utcnow() - datetime.fromisoformat(
            memory_item.get("timestamp", datetime.utcnow().isoformat())
        )).days
        if age_days > 90:  # 90天前的记忆
            return True

        # 规则2：低重要性遗忘
        if memory_item.get("importance", 0) < 0.3:
            return True

        # 规则3：低访问频率遗忘
        if memory_item.get("access_count", 0) < 2 and age_days > 30:
            return True

        return False

    async def consolidate(self, user_id: str):
        """记忆巩固：合并相似记忆"""
        all_memories = await episodic_memory.recall_all(user_id)

        # 用 LLM 合并相似记忆
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        # 找到相似的记忆对
        for i, m1 in enumerate(all_memories):
            for j, m2 in enumerate(all_memories[i+1:], i+1):
                similarity = self.compute_similarity(m1, m2)
                if similarity > 0.85:
                    # 合并
                    merged = await llm.ainvoke(
                        f"合并以下两条相似记忆为一条：\n1. &#123;m1['content']&#125;\n2. &#123;m2['content']&#125;"
                    )
                    # 删除旧的，存入新的
                    await episodic_memory.delete(m1["id"])
                    await episodic_memory.delete(m2["id"])
                    await episodic_memory.store(user_id, &#123;
                        "query": "合并记忆",
                        "response": merged.content,
                        "timestamp": datetime.utcnow().isoformat(),
                    &#125;)
                    break  # 合并后重新开始

    def compute_similarity(self, m1: dict, m2: dict) -> float:
        """计算两个记忆的相似度"""
        # 简化版：基于关键词重叠
        words1 = set(m1["content"].split())
        words2 = set(m2["content"].split())
        if not words1 or not words2:
            return 0
        return len(words1 & words2) / len(words1 | words2)
```

---

## 7. LangGraph 完整记忆 Agent

```python
from langgraph.graph import StateGraph, START, END
from langgraph.store.memory import InMemoryStore
from langgraph.checkpoint.memory import MemorySaver
from typing import TypedDict

class MemoryAgentState(TypedDict):
    messages: list
    user_id: str
    recalled_memories: list    # 回忆的历史
    user_preferences: dict      # 用户偏好
    response: str

# 全局记忆组件
episodic_memory = EpisodicMemory()
store = InMemoryStore()

async def recall_node(state: MemoryAgentState):
    """回忆节点：检索相关历史和偏好"""
    query = state["messages"][-1]["content"]
    user_id = state["user_id"]

    # 并行检索
    memories = await episodic_memory.recall(user_id, query)
    prefs = await get_preferences(user_id)

    return &#123;
        "recalled_memories": memories,
        "user_preferences": prefs,
    &#125;

async def respond_node(state: MemoryAgentState):
    """回答节点：结合记忆回答"""
    memories = state.get("recalled_memories", [])
    prefs = state.get("user_preferences", &#123;&#125;)

    # 构建增强 Prompt
    memory_text = ""
    if memories:
        memory_text = "历史交互:\n" + "\n".join([m["content"] for m in memories[:3]])

    pref_text = ""
    if prefs:
        pref_text = f"用户偏好: &#123;prefs&#125;"

    system_content = f"""你是用户的个人助手。

&#123;memory_text&#125;
&#123;pref_text&#125;

请结合历史记忆和用户偏好回答。"""
    messages = [&#123;"role": "system", "content": system_content&#125;] + state["messages"]
    llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
    response = await llm.ainvoke(messages)

    return &#123;"response": response.content, "messages": state["messages"] + [
        &#123;"role": "assistant", "content": response.content&#125;
    ]&#125;

async def memorize_node(state: MemoryAgentState):
    """记忆节点：存储这次交互"""
    query = state["messages"][-1]["content"]
    response = state["response"]
    user_id = state["user_id"]

    # 存入情景记忆
    await episodic_memory.store(user_id, &#123;
        "query": query,
        "response": response,
        "timestamp": datetime.utcnow().isoformat(),
    &#125;)

    # 定期提取偏好
    if len(state["messages"]) % 10 == 0:
        await extract_and_save_preferences(user_id, state["messages"])

    return &#123;&#125;

# 构建记忆 Agent
graph = StateGraph(MemoryAgentState)
graph.add_node("recall", recall_node)
graph.add_node("respond", respond_node)
graph.add_node("memorize", memorize_node)

graph.add_edge(START, "recall")
graph.add_edge("recall", "respond")
graph.add_edge("respond", "memorize")
graph.add_edge("memorize", END)

# 编译时传入 Checkpointer（工作记忆）和 Store（长期记忆）
memory_agent = graph.compile(
    checkpointer=MemorySaver(),
    store=store,
)
```

---

## 8. 生产部署

### PostgresStore 持久化

```python
from langgraph.store.postgres import PostgresStore
from langgraph.checkpoint.postgres import PostgresSaver

# 生产环境用 Postgres
DB_URL = "postgresql://user:pass@localhost/langgraph"

# Store（语义记忆/偏好）
store = PostgresStore.from_conn_string(DB_URL)
# Checkpointer（工作记忆/检查点）
checkpointer = PostgresSaver.from_conn_string(DB_URL)

# 创建表
await store.setup()
await checkpointer.setup()

# 编译 Agent
agent = graph.compile(
    checkpointer=checkpointer,
    store=store,
)
```

### 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四层记忆架构 | ☐ |
| 实现了滑动窗口短期记忆 | ☐ |
| 实现了 Token 感知裁剪 | ☐ |
| 实现了情景记忆（向量检索） | ☐ |
| 实现了语义记忆（偏好存储） | ☐ |
| 用 LangGraph Store 管理长期记忆 | ☐ |
| 实现了自动偏好提取 | ☐ |
| 实现了记忆遗忘/巩固 | ☐ |
| 配置了 PostgresStore 持久化 | ☐ |
| 在对话中注入了历史记忆 | ☐ |

---

## 9. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 04 | Memory 机制 | Memory 基础 |
| 05 | Memory 机制图解 | Memory 可视化 |
| 45 | Agent 记忆与规划 | 记忆+规划 |
| 60 | 记忆遗忘与压缩策略 | 遗忘策略 |
| 85 | Agent 记忆遗忘与压缩 | 遗忘压缩 |
| 90 | Agent 记忆架构设计 | 记忆架构 |
| 122 | Agent 记忆架构设计 | 记忆设计 |
| 167 | Agent 记忆持久化 | 持久化 |
| 199 | Agent 记忆持久化与跨会话 | 跨会话 |
| 245 | 记忆遗忘 | 遗忘 |
| 320 | 记忆持久化 | 持久化 |
| 350 | Agent 记忆持久化整合指南 | 持久化整合 |
| 359 | 记忆分层与遗忘策略 | 分层遗忘 |
| 389 | 记忆分层与遗忘策略指南 | 分层遗忘 |
| 404 | LangGraph 持久化检查点 | 检查点持久化 |
