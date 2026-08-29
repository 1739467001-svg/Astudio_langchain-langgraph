# 学习课程 04：Memory 与对话管理最新

> 学习课程 04 有 309 行。这篇基于 v0.3 更新——LangGraph Checkpointer 替代旧 Memory。

---

## 一、v0.3 记忆架构

```mermaid
graph TB
    subgraph 记忆 {"LangGraph记忆"}
        SHORT["短期记忆<br/>Checkpointer<br/>thread_id内对话历史"]
        LONG["长期记忆<br/>Store<br/>跨thread_id用户画像"]
    end

    style SHORT fill:#E3F2FD
    style LONG fill:#FFF3E0
```

---

## 二、Checkpointer 实现

```python
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

# 创建带记忆的Agent
agent = create_react_agent(
    llm,
    tools=[search_tool],
    checkpointer=MemorySaver(),
)

# 同一thread_id共享记忆
config = {"configurable": {"thread_id": "conv-1"}}

# 第一轮
result1 = agent.invoke(
    {"messages": [{"role": "user", "content": "我叫张三"}]},
    config,
)

# 第二轮——记得张三
result2 = agent.invoke(
    {"messages": [{"role": "user", "content": "我叫什么？"}]},
    config,
)
# → "你叫张三"

# 不同thread_id——不记得
result3 = agent.invoke(
    {"messages": [{"role": "user", "content": "我叫什么？"}]},
    {"configurable": {"thread_id": "conv-2"}},
)
# → "不知道"
```

---

## 三、长期记忆 Store

```python
from langgraph.store.memory import InMemoryStore

store = InMemoryStore()

agent = create_react_agent(
    llm,
    tools=[search_tool],
    checkpointer=MemorySaver(),
    store=store,
)

# 存储跨会话数据
store.put("user-001", "profile", {
    "name": "张三",
    "preferences": {"language": "zh", "style": "技术性"},
})

# 任何thread_id都能读取
profile = store.get("user-001", "profile")
```

---

## 四、生产级持久化

```python
# 生产用PostgreSQL（不用MemorySaver）
from langgraph.checkpoint.postgres import PostgresSaver

checkpointer = PostgresSaver.from_conn_string(
    "postgresql://user:pass@localhost:5432/langgraph"
)
checkpointer.setup()  # 自动建表

agent = create_react_agent(
    llm,
    tools,
    checkpointer=checkpointer,
    store=store,
)
```

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 用Checkpointer | 短期记忆（对话历史） | ★★★ |
| 用Store | 长期记忆（用户画像） | ★★☆ |
| thread_id隔离 | 每个对话独立 | ★★★ |
| 生产用PostgresSaver | 不用MemorySaver | ★★★ |
| 超限时清理 | RemoveMessage | ★★☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解短期vs长期记忆 | ☐ |
| 能用Checkpointer | ☐ |
| 能用Store | ☐ |
