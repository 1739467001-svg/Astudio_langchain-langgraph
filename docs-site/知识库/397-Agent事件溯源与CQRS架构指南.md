# Agent 事件溯源与 CQRS 架构指南

> 传统 CRUD 直接覆盖状态，丢失了"为什么变成这样"的历史。事件溯源（Event Sourcing）把每次状态变更记录为不可变事件流，CQRS 将读写分离——查询走只读视图、写入走命令侧。Agent 场景天然适合这套架构：决策轨迹、工具调用、状态跃迁都可以是事件。

---

## 一、整体架构

```mermaid
graph TB
    CMD["命令 Command"] --> CMDH&#123;"命令处理器<br/>CommandHandler"&#125;
    CMDH --> VALIDATE["校验+业务规则"]
    VALIDATE --> APPEND["追加事件到 EventStore"]
    APPEND --> BUS["事件总线 EventBus"]
    BUS --> PROJ1["投影 Projection A<br/>读模型"]
    BUS --> PROJ2["投影 Projection B<br/>审计/分析"]
    QUERY["查询 Query"] --> READMODEL["只读视图 ReadModel"]

    style CMDH fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style APPEND fill:#E3F2FD,stroke:#1565C0
    style READMODEL fill:#C8E6C9
    style BUS fill:#FFE0B2
```

核心思想：写入只追加事件、读取走预投影视图，读写模型彻底分离。

---

## 二、事件与命令定义

```python
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

@dataclass(frozen=True)
class DomainEvent:
    """所有事件的基类，不可变"""
    event_id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    aggregate_id: str = ""
    event_type: str = ""
    payload: dict[str, Any] = field(default_factory=dict)

# --- Agent 领域事件 ---
@dataclass(frozen=True)
class ToolInvoked(DomainEvent):
    event_type: str = "ToolInvoked"

@dataclass(frozen=True)
class DecisionMade(DomainEvent):
    event_type: str = "DecisionMade"

@dataclass(frozen=True)
class StateTransitioned(DomainEvent):
    event_type: str = "StateTransitioned"

# --- 命令 ---
@dataclass(frozen=True)
class InvokeToolCommand:
    aggregate_id: str
    tool_name: str
    arguments: dict[str, Any]

@dataclass(frozen=True)
class MakeDecisionCommand:
    aggregate_id: str
    reasoning: str
    action: str
```

事件是不可变的 `frozen=True` dataclass，每个事件自带 `event_id` 和 `timestamp`，方便追踪和重放。

---

## 三、EventStore 实现

```python
import asyncio
from collections import defaultdict

class EventStore:
    """事件存储：只追加、不可变、按聚合根ID分组"""

    def __init__(self):
        self._streams: dict[str, list[DomainEvent]] = defaultdict(list)
        self._subscribers: list = []

    async def append(self, aggregate_id: str, events: list[DomainEvent]) -> None:
        """追加事件并通知订阅者"""
        self._streams[aggregate_id].extend(events)
        for sub in self._subscribers:
            await sub(events)

    async def load(self, aggregate_id: str) -> list[DomainEvent]:
        """加载聚合根的完整事件流"""
        return list(self._streams.get(aggregate_id, []))

    def subscribe(self, handler) -> None:
        """订阅事件流，用于投影构建"""
        self._subscribers.append(handler)

    async def replay(self, aggregate_id: str) -> list[DomainEvent]:
        """重放事件流，用于调试和恢复状态"""
        events = await self.load(aggregate_id)
        print(f"重放 &#123;len(events)&#125; 个事件 for &#123;aggregate_id&#125;")
        return events
```

EventStore 只做追加和读取，不做修改和删除——这是事件溯源的核心约束。

---

## 四、CommandHandler 与 Aggregate

```python
class AgentAggregate:
    """Agent 聚合根：从事件流重建状态"""

    def __init__(self, aggregate_id: str):
        self.aggregate_id = aggregate_id
        self.tool_call_count = 0
        self.last_action: str | None = None
        self.decision_history: list[str] = []

    def apply(self, event: DomainEvent) -> None:
        """应用单个事件，更新内存状态"""
        if event.event_type == "ToolInvoked":
            self.tool_call_count += 1
            self.last_action = event.payload.get("tool_name")
        elif event.event_type == "DecisionMade":
            self.decision_history.append(event.payload.get("action", ""))
        elif event.event_type == "StateTransitioned":
            self.last_action = event.payload.get("to_state")

    @classmethod
    async def from_events(cls, store: EventStore, aggregate_id: str) -> "AgentAggregate":
        """从事件流重建聚合根状态"""
        agg = cls(aggregate_id)
        for event in await store.load(aggregate_id):
            agg.apply(event)
        return agg


class CommandHandler:
    """命令处理器：校验+产生事件+持久化"""

    def __init__(self, store: EventStore):
        self.store = store

    async def handle_invoke_tool(self, cmd: InvokeToolCommand) -> DomainEvent:
        agg = await AgentAggregate.from_events(self.store, cmd.aggregate_id)
        # 业务规则校验：工具调用不超过 100 次
        if agg.tool_call_count >= 100:
            raise ValueError(f"工具调用次数超限: &#123;agg.tool_call_count&#125;")
        event = ToolInvoked(
            aggregate_id=cmd.aggregate_id,
            payload=&#123;"tool_name": cmd.tool_name, "arguments": cmd.arguments&#125;
        )
        await self.store.append(cmd.aggregate_id, [event])
        return event

    async def handle_make_decision(self, cmd: MakeDecisionCommand) -> DomainEvent:
        event = DecisionMade(
            aggregate_id=cmd.aggregate_id,
            payload=&#123;"reasoning": cmd.reasoning, "action": cmd.action&#125;
        )
        await self.store.append(cmd.aggregate_id, [event])
        return event
```

聚合根从事件流重建状态（`from_events`），CommandHandler 负责校验后产生事件并追加到 EventStore。

---

## 五、CQRS 读模型与投影

```python
class ReadModel:
    """只读视图：为查询优化，可随时从事件流重建"""

    def __init__(self):
        self._tool_call_summary: dict[str, int] = defaultdict(int)
        self._decision_log: list[dict] = []

    async def handle_event(self, events: list[DomainEvent]) -> None:
        """投影处理器：消费事件更新读模型"""
        for evt in events:
            if evt.event_type == "ToolInvoked":
                tool = evt.payload.get("tool_name", "unknown")
                self._tool_call_summary[tool] += 1
            elif evt.event_type == "DecisionMade":
                self._decision_log.append(&#123;
                    "action": evt.payload.get("action"),
                    "timestamp": evt.timestamp
                &#125;)

    def get_tool_stats(self) -> dict[str, int]:
        return dict(self._tool_call_summary)

    def get_decision_log(self) -> list[dict]:
        return list(self._decision_log)


# --- 组装与运行 ---
async def main():
    store = EventStore()
    read_model = ReadModel()
    store.subscribe(read_model.handle_event)

    handler = CommandHandler(store)
    agent_id = "agent-001"

    # 写入侧：发送命令
    await handler.handle_invoke_tool(InvokeToolCommand(agent_id, "search", &#123;"q": "LangGraph"&#125;))
    await handler.handle_invoke_tool(InvokeToolCommand(agent_id, "search", &#123;"q": "CQRS"&#125;))
    await handler.handle_make_decision(MakeDecisionCommand(agent_id, "找到答案", "回答用户"))

    # 读取侧：查询只读视图
    print("工具统计:", read_model.get_tool_stats())
    print("决策日志:", read_model.get_decision_log())

    # 重放：从事件流恢复完整状态
    agg = await AgentAggregate.from_events(store, agent_id)
    print(f"重建状态: 调用&#123;agg.tool_call_count&#125;次, 决策&#123;agg.decision_history&#125;")

asyncio.run(main())
```

输出：

```text
工具统计: &#123;'search': 2&#125;
决策日志: [&#123;'action': '回答用户', 'timestamp': '2025-01-15T...'&#125;]
重建状态: 调用2次, 决策['回答用户']
```

---

## 六、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 事件不可变 | 追加后不修改删除 | ★★★ |
| 读写分离 | 写走命令、读走投影 | ★★★ |
| 投影可重建 | 读模型丢失后可从事件流恢复 | ★★★ |
| 事件版本化 | 加 version 字段兼容演进 | ★★☆ |
| 快照优化 | 聚合根事件过多时定期快照 | ★★☆ |
| 幂等投影 | 事件可能重复投递需幂等 | ★★★ |

---

## 七、检查清单

| 检查项 | 状态 |
|--------|------|
| 有不可变事件定义 | ☐ |
| 有 EventStore 追加存储 | ☐ |
| 有 CommandHandler 校验 | ☐ |
| 有聚合根从事件重建 | ☐ |
| 有只读读模型投影 | ☐ |
| 有事件重放能力 | ☐ |
