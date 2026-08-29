# LangGraph 持久化与状态恢复深度

> Checkpointer 是 LangGraph 最被低估的特性——它不只是"保存对话历史"，更是中断恢复、时间旅行、多线程隔离和调试回放的基础。这份指南深入 Checkpointer 的内部原理、生产配置和高级用法。

---

## 一、Checkpointer 的价值

```mermaid
graph TB
    subgraph 没有检查点 &#123;"没有Checkpointer"&#125;
        N1["执行到第5步崩溃"] --> N2["❌ 从头重新执行<br/>浪费前4步的计算"]
        N3["想回到第3步修改"] --> N4["❌ 不可能"]
        N5["两个用户同时对话"] --> N6["❌ 状态混在一起"]
    end

    subgraph 有检查点 &#123;"有Checkpointer"&#125;
        Y1["执行到第5步崩溃"] --> Y2["✅ 从第5步恢复<br/>不重复前4步"]
        Y3["想回到第3步修改"] --> Y4["✅ 时间旅行"]
        Y5["两个用户同时对话"] --> Y6["✅ thread_id隔离"]
    end

    style 没有检查点 fill:#FFCDD2
    style 有检查点 fill:#C8E6C9
```

---

## 二、四种 Checkpointer

```mermaid
graph TB
    ROOT["Checkpointer类型"] --> C1["MemorySaver<br/>内存<br/>开发用<br/>重启丢失"]
    ROOT --> C2["SqliteSaver<br/>SQLite<br/>单机生产<br/>轻量持久"]
    ROOT --> C3["PostgresSaver<br/>PostgreSQL<br/>生产推荐<br/>多实例共享"]
    ROOT --> C4["RedisSaver<br/>Redis<br/>高速场景<br/>可设TTL"]

    style ROOT fill:#1565C0,color:#fff
    style C3 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

| 类型 | 持久性 | 性能 | 多实例 | 适合场景 |
|------|--------|------|--------|----------|
| MemorySaver | ❌ 重启丢失 | 最快 | ❌ | 开发测试 |
| SqliteSaver | ✅ 文件 | 快 | ❌ | 单机生产 |
| PostgresSaver | ✅ 数据库 | 中 | ✅ | 生产推荐 |
| RedisSaver | ✅ 可TTL | 快 | ✅ | 高速场景 |

---

## 三、生产配置

```python
# 生产环境：PostgreSQL Checkpointer
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.checkpost.postgres import PostgresSaver
from psycopg_pool import ConnectionPool

# 连接池配置（生产推荐）
pool = ConnectionPool(
    conninfo="postgresql://user:pass@localhost:5432/langgraph",
    max_size=20,          # 最大连接数
    min_size=5,           # 最小连接数
    timeout=30,           # 连接超时
)

checkpointer = PostgresSaver(pool)
# 自动创建表
checkpointer.setup()

# 用于Agent
from langgraph.prebuilt import create_react_agent
agent = create_react_agent(
    model,
    tools,
    checkpointer=checkpointer,
)
```

---

## 四、thread_id：多会话隔离

```mermaid
graph TB
    subgraph 隔离 &#123;"thread_id隔离机制"&#125;
        U1["用户A<br/>thread=001"] --> CP["Checkpointer"]
        U2["用户B<br/>thread=002"] --> CP
        U3["用户C<br/>thread=003"] --> CP
        CP --> S1["State(thread=001)<br/>用户A的对话"]
        CP --> S2["State(thread=002)<br/>用户B的对话"]
        CP --> S3["State(thread=003)<br/>用户C的对话"]
    end

    style 隔离 fill:#E3F2FD
    style CP fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
```

```python
# 每个用户/对话用独立thread_id
config_user_a = &#123;"configurable": &#123;"thread_id": "user-001-session-1"&#125;&#125;
config_user_b = &#123;"configurable": &#123;"thread_id": "user-002-session-1"&#125;&#125;

# 用户A的对话
result = agent.invoke(
    &#123;"messages": [&#123;"role": "user", "content": "我叫张三"&#125;]&#125;,
    config_user_a,
)

# 用户B的对话——互不影响
result = agent.invoke(
    &#123;"messages": [&#123;"role": "user", "content": "我叫李四"&#125;]&#125;,
    config_user_b,
)

# 用户A再次对话——记得自己是张三
result = agent.invoke(
    &#123;"messages": [&#123;"role": "user", "content": "我叫什么？"&#125;]&#125;,
    config_user_a,
)
# → "你叫张三"

# 用户A开新会话——不记得之前
config_user_a_new = &#123;"configurable": &#123;"thread_id": "user-001-session-2"&#125;&#125;
result = agent.invoke(
    &#123;"messages": [&#123;"role": "user", "content": "我叫什么？"&#125;]&#125;,
    config_user_a_new,
)
# → "不知道你的名字"
```

---

## 五、状态检查与操作

```python
class StateInspector:
    """状态检查器：查看和操作检查点。"""

    @staticmethod
    def get_current_state(agent, thread_id: str) -> dict:
        """获取当前状态。"""
        config = &#123;"configurable": &#123;"thread_id": thread_id&#125;&#125;
        state = agent.get_state(config)
        return &#123;
            "values": state.values,
            "next": state.next,           # 下一步要执行的节点
            "config": state.config,
            "metadata": state.metadata,
        &#125;

    @staticmethod
    def get_state_history(agent, thread_id: str) -> list[dict]:
        """获取所有检查点历史。"""
        config = &#123;"configurable": &#123;"thread_id": thread_id&#125;&#125;
        history = list(agent.get_state_history(config))

        return [
            &#123;
                "checkpoint_id": s.config["configurable"]["checkpoint_id"],
                "next": s.next,
                "values_keys": list(s.values.keys()) if s.values else [],
            &#125;
            for s in history
        ]

    @staticmethod
    def update_state(agent, thread_id: str, updates: dict) -> dict:
        """外部修改状态。"""
        config = &#123;"configurable": &#123;"thread_id": thread_id&#125;&#125;
        agent.update_state(config, values=updates)
        return &#123;"status": "updated", "updates": updates&#125;

    @staticmethod
    def resume_from_checkpoint(
        agent,
        thread_id: str,
        checkpoint_id: str,
    ) -> dict:
        """从指定检查点恢复执行。"""
        config = &#123;
            "configurable": &#123;
                "thread_id": thread_id,
                "checkpoint_id": checkpoint_id,
            &#125;
        &#125;
        # 传入None表示继续执行
        result = agent.invoke(None, config)
        return result
```

---

## 六、中断恢复

```mermaid
sequenceDiagram
    participant U as 用户
    participant A as Agent
    participant CP as Checkpointer

    U->>A: 任务请求
    A->>CP: 保存状态(checkpoint-1)
    A->>A: 执行步骤1
    A->>CP: 保存状态(checkpoint-2)
    A->>A: 执行步骤2 → interrupt()
    CP-->>U: 暂停，等待输入
    Note over U: 用户处理...
    U->>A: Command(resume=data)
    A->>CP: 加载checkpoint-2
    A->>A: 从步骤2继续
    A->>CP: 保存状态(checkpoint-3)
    A-->>U: 完成
```

```python
from langgraph.types import interrupt, Command
from langgraph.checkpoint.memory import MemorySaver

# 中断恢复示例
@tool
def send_email(to: str, subject: str) -> str:
    """发邮件——需审批"""
    approval = interrupt(&#123;"type": "email", "to": to, "subject": subject&#125;)
    if approval.get("approved"):
        return f"已发送给&#123;to&#125;"
    return "被拒绝"

agent = create_react_agent(
    model, [send_email],
    checkpointer=MemorySaver(),
)

config = &#123;"configurable": &#123;"thread_id": "email-1"&#125;&#125;

# 第一次调用——中断在send_email
result1 = agent.invoke(
    &#123;"messages": [&#123;"role": "user", "content": "给老板发请假邮件"&#125;]&#125;,
    config,
)
# → 返回interrupt信息

# 检查当前状态
state = agent.get_state(config)
print(f"当前暂停在: &#123;state.next&#125;")  # → ['tools']

# 恢复——传入审批结果
result2 = agent.invoke(
    Command(resume=&#123;"approved": True&#125;),
    config,
)
# → 从断点继续，send_email收到approval
```

---

## 七、时间旅行

```python
class TimeTravel:
    """时间旅行：回到历史检查点。"""

    @staticmethod
    def travel_to(agent, thread_id: str, target_checkpoint_id: str):
        """回到指定检查点。

        用途：
        1. 调试：回到出错前重新执行
        2. 修改：回到某步修改状态后重跑
        3. 对比：不同路径的结果对比
        """
        # 获取历史
        config = &#123;"configurable": &#123;"thread_id": thread_id&#125;&#125;
        history = list(agent.get_state_history(config))

        # 找到目标检查点
        target = None
        for state in history:
            cid = state.config["configurable"].get("checkpoint_id")
            if cid == target_checkpoint_id:
                target = state
                break

        if not target:
            return &#123;"error": "检查点不存在"&#125;

        # 从该检查点重新执行
        result = agent.invoke(
            None,  # None表示继续执行
            &#123;
                "configurable": &#123;
                    "thread_id": thread_id,
                    "checkpoint_id": target_checkpoint_id,
                &#125;
            &#125;
        )
        return result
```

---

## 八、Store：长期记忆

```mermaid
graph TB
    subgraph 两层存储 &#123;"两层存储体系"&#125;
        CP["Checkpointer<br/>短期记忆<br/>线程内<br/>对话历史+中间状态"]
        ST["Store<br/>长期记忆<br/>跨线程<br/>用户画像+偏好"]
    end

    U1["对话A thread=1"] --> CP
    U2["对话B thread=1"] --> CP
    U3["对话C thread=2"] --> CP
    U1 & U2 & U3 --> ST

    style CP fill:#E3F2FD
    style ST fill:#FFF3E0
```

```python
from langgraph.store.memory import InMemoryStore

# Store：跨线程长期记忆
store = InMemoryStore()

agent = create_react_agent(
    model,
    tools,
    checkpointer=MemorySaver(),  # 短期（线程内）
    store=store,                   # 长期（跨线程）
)

# 在线程A中存储用户信息
store.put("user-001", "profile", &#123;
    "name": "张三",
    "preferences": &#123;"language": "zh", "style": "technical"&#125;,
&#125;)

# 在线程B中读取（跨线程共享）
profile = store.get("user-001", "profile")
# → &#123;name: 张三, preferences: &#123;...&#125;&#125;
```

---

## 九、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 生产用PostgresSaver | MemorySaver重启丢失 | ★★★ |
| thread_id用用户ID+会话ID | 避免冲突 | ★★★ |
| interrupt必须配checkpointer | 没有检查点无法恢复 | ★★★ |
| 定期清理旧检查点 | 防止存储膨胀 | ★★☆ |
| Store用于跨会话记忆 | 用户画像/偏好 | ★★☆ |
| 时间旅行用于调试 | 生产慎用回退 | ★☆☆ |

---

## 十、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四种Checkpointer | ☐ |
| 配置了PostgresSaver | ☐ |
| 理解thread_id隔离 | ☐ |
| 能查看和操作状态 | ☐ |
| 能实现中断恢复 | ☐ |
| 理解时间旅行 | ☐ |
| 理解Store长期记忆 | ☐ |
