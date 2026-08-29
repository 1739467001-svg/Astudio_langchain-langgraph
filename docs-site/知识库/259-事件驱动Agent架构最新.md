# 事件驱动 Agent 架构最新

> 知识库 66 有 211 行、知识库 205 有深度。这篇整合为最新——事件总线、定时触发、主动推送和与 LangGraph 集成。

---

## 一、事件驱动核心

```mermaid
graph TB
    subgraph 事件 &#123;"事件驱动架构"&#125;
        SRC["事件源<br/>Webhook/定时/消息"] --> BUS["事件总线"]
        BUS --> SUB["Agent订阅"]
        SUB --> ACT["执行处理"]
        ACT --> PUSH["主动推送结果"]
    end

    style BUS fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style PUSH fill:#C8E6C9
```

---

## 二、实现

```python
import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Callable

class EventType(str, Enum):
    USER_MESSAGE = "user_message"
    FILE_UPLOADED = "file_uploaded"
    TIMER = "timer"
    AGENT_COMPLETE = "agent_complete"
    EXTERNAL = "external"

@dataclass
class Event:
    event_id: str
    event_type: EventType
    payload: dict = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

class EventBus:
    """事件总线——发布订阅模式。"""

    def __init__(self):
        self._subscribers: dict[EventType, list[Callable]] = &#123;&#125;
        self._log: list[Event] = []

    def subscribe(self, event_type: EventType, handler: Callable):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)

    async def publish(self, event: Event):
        self._log.append(event)
        handlers = self._subscribers.get(event.event_type, [])
        for handler in handlers:
            try:
                await handler(event)
            except Exception:
                pass  # 一个失败不影响其他

    def recent_events(self, limit: int = 10) -> list[Event]:
        return self._log[-limit:]


class TimerEventSource:
    """定时事件源。"""

    def __init__(self, bus: EventBus):
        self.bus = bus
        self._timers: list[asyncio.Task] = []

    def add_daily(self, hour: int, task: str):
        async def loop():
            while True:
                await asyncio.sleep(86400)  # 简化：每日
                await self.bus.publish(Event(
                    event_id=f"timer_&#123;datetime.now().strftime('%Y%m%d')&#125;",
                    event_type=EventType.TIMER,
                    payload=&#123;"task": task&#125;,
                ))
        self._timers.append(asyncio.create_task(loop()))

    def stop_all(self):
        for t in self._timers:
            t.cancel()
        self._timers.clear()


class EventDrivenAgent:
    """事件驱动的Agent。"""

    def __init__(self, bus: EventBus):
        self.bus = bus
        self.bus.subscribe(EventType.USER_MESSAGE, self._handle_message)
        self.bus.subscribe(EventType.FILE_UPLOADED, self._handle_file)
        self.bus.subscribe(EventType.TIMER, self._handle_timer)

    async def _handle_message(self, event: Event):
        msg = event.payload.get("message", "")
        # 处理消息...

    async def _handle_file(self, event: Event):
        path = event.payload.get("file_path", "")
        # 自动处理文件（如加入知识库）...

    async def _handle_timer(self, event: Event):
        task = event.payload.get("task", "")
        # 执行定时任务...

    async def push_to_user(self, user_id: str, message: str):
        """主动推送消息给用户。"""
        await self.bus.publish(Event(
            event_id=f"push_&#123;datetime.now().strftime('%H%M%S')&#125;",
            event_type=EventType.AGENT_COMPLETE,
            payload=&#123;"user_id": user_id, "message": message&#125;,
        ))
```

---

## 三、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 事件总线解耦 | 生产者消费者分离 | ★★★ |
| 处理器要容错 | 一个失败不影响其他 | ★★★ |
| 定时用事件 | 灵活可配置 | ★★☆ |
| 主动推送 | 不等用户问 | ★★☆ |
| 事件日志 | 可审计 | ★★☆ |

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有事件总线 | ☐ |
| 有定时事件 | ☐ |
| 有主动推送 | ☐ |
