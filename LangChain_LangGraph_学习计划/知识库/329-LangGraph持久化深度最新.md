# LangGraph 持久化深度最新

> 知识库 55 仅 109 行、知识库 158 有深度。这篇整合为最新——四种 Checkpointer、thread_id 和 Store。

---

## 一、四种 Checkpointer

```mermaid
graph TB
    ROOT["Checkpointer"] --> C1["MemorySaver<br/>内存/开发"]
    ROOT --> C2["SqliteSaver<br/>SQLite/单机"]
    ROOT --> C3["PostgresSaver<br/>PostgreSQL/生产"]
    ROOT --> C4["RedisSaver<br/>Redis/高速"]

    style C3 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、生产配置

```python
# 生产用PostgreSQL
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool

pool = ConnectionPool(
    conninfo="postgresql://user:pass@localhost:5432/langgraph",
    max_size=20, min_size=5,
)
checkpointer = PostgresSaver(pool)
checkpointer.setup()  # 自动建表

# 创建Agent
from langgraph.prebuilt import create_react_agent
agent = create_react_agent(
    llm, tools,
    checkpointer=checkpointer,
    store=InMemoryStore(),  # 长期记忆
)
```

---

## 三、thread_id 隔离

```python
# 每个用户每个会话用唯一thread_id
config = {"configurable": {"thread_id": f"user-{user_id}-session-{session_id}"}}

# 同一thread_id共享记忆
result1 = agent.invoke({"messages": [...]}, config)
result2 = agent.invoke({"messages": [...]}, config)  # 记得result1

# 不同thread_id——隔离
config2 = {"configurable": {"thread_id": "other-session"}}
result3 = agent.invoke({"messages": [...]}, config2)  # 不记得result1
```

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 生产用PostgresSaver | 不用MemorySaver | ★★★ |
| thread_id唯一 | 对话隔离 | ★★★ |
| interrupt必配checkpointer | 否则无法恢复 | ★★★ |
| Store用于长期记忆 | 跨线程 | ★★☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有四种Checkpointer | ☐ |
| 有生产配置 | ☐ |
