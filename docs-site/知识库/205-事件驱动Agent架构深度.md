# 事件驱动 Agent 架构深度

> 请求-响应模式简单但局限——用户发消息才响应，不能主动推送。事件驱动让 Agent 能响应外部事件（文件上传、定时触发、其他Agent消息），实现更灵活的交互。

---

## 一、事件驱动 vs 请求-响应

```mermaid
graph TB
    subgraph 请求响应 &#123;"请求-响应"&#125;
        U1["用户发消息"] --> A1["Agent处理"] --> R1["返回"]
        NOTE1["❌ 不能主动推送<br/>❌ 不能响应外部事件"]
    end

    subgraph 事件驱动 &#123;"事件驱动"&#125;
        E1["文件上传事件"] --> AGENT["Agent"]
        E2["定时触发事件"] --> AGENT
        E3["其他Agent消息"] --> AGENT
        E4["用户消息"] --> AGENT
        AGENT --> PUSH["主动推送结果"]

        style 事件驱动 fill:#C8E6C9
    end

    style 请求响应 fill:#FFCDD2
    style 事件驱动 fill:#C8E6C9
```

---

## 二、事件总线架构

```mermaid
graph TB
    subgraph 总线 &#123;"事件总线架构"&#125;
        SRC1["文件上传"] --> BUS["事件总线<br/>(Redis/Kafka)"]
        SRC2["定时器"] --> BUS
        SRC3["用户消息"] --> BUS
        SRC4["Agent完成"] --> BUS
        BUS --> SUB1["Agent A<br/>订阅文件事件"]
        BUS --> SUB2["Agent B<br/>订阅定时事件"]
        BUS --> SUB3["通知服务<br/>订阅完成事件"]
    end

    style BUS fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
```

---

## 三、实现

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Callable, Any
import asyncio

class EventType(str, Enum):
    USER_MESSAGE = "user_message"
    FILE_UPLOADED = "file_uploaded"
    TIMER = "timer"
    AGENT_COMPLETE = "agent_complete"
    TOOL_RESULT = "tool_result"
    EXTERNAL_API = "external_api"

@dataclass
class Event:
    """事件。"""
    event_id: str
    event_type: EventType
    payload: dict = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    source: str = ""

class EventBus:
    """事件总线。

    发布-订阅模式：
    - 事件生产者发布事件
    - 事件消费者订阅感兴趣的事件类型
    - 解耦生产者和消费者
    """

    def __init__(self):
        self._subscribers: dict[EventType, list[Callable]] = &#123;&#125;
        self._event_log: list[Event] = []

    def subscribe(self, event_type: EventType, handler: Callable):
        """订阅事件。"""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)

    async def publish(self, event: Event):
        """发布事件。"""
        self._event_log.append(event)
        handlers = self._subscribers.get(event.event_type, [])
        for handler in handlers:
            try:
                await handler(event)
            except Exception as e:
                pass  # 实际应该记录错误

    def get_recent_events(self, event_type: EventType = None, limit: int = 10) -> list[Event]:
        """获取最近的事件。"""
        events = self._event_log
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        return events[-limit:]


class EventDrivenAgent:
    """事件驱动的Agent。

    与传统请求-响应不同，
    Agent可以响应多种事件源。
    """

    def __init__(self, event_bus: EventBus):
        self.bus = event_bus
        # 订阅感兴趣的事件
        self.bus.subscribe(EventType.USER_MESSAGE, self._handle_user_message)
        self.bus.subscribe(EventType.FILE_UPLOADED, self._handle_file_upload)
        self.bus.subscribe(EventType.TIMER, self._handle_timer)

    async def _handle_user_message(self, event: Event):
        """处理用户消息。"""
        message = event.payload.get("message", "")
        # 处理消息...
        # 完成后发布完成事件
        await self.bus.publish(Event(
            event_id=f"complete_&#123;event.event_id&#125;",
            event_type=EventType.AGENT_COMPLETE,
            payload=&#123;"result": "处理完成", "original_event": event.event_id&#125;,
            source="agent",
        ))

    async def _handle_file_upload(self, event: Event):
        """处理文件上传事件。"""
        file_path = event.payload.get("file_path", "")
        # 自动处理上传的文件（如加入知识库）
        pass

    async def _handle_timer(self, event: Event):
        """处理定时事件。"""
        task = event.payload.get("task", "")
        # 执行定时任务
        pass

    async def send_message(self, user_id: str, message: str):
        """发送消息给用户（主动推送）。"""
        await self.bus.publish(Event(
            event_id=f"push_&#123;datetime.now().strftime('%H%M%S')&#125;",
            event_type=EventType.AGENT_COMPLETE,
            payload=&#123;"user_id": user_id, "message": message&#125;,
            source="agent",
        ))
```

---

## 四、定时事件

```python
import asyncio
from datetime import datetime

class TimerEventSource:
    """定时事件源。"""

    def __init__(self, event_bus: EventBus):
        self.bus = event_bus
        self._timers: list[asyncio.Task] = []

    def add_daily_timer(self, hour: int, minute: int, task: str):
        """添加每日定时器。"""
        async def timer_loop():
            while True:
                now = datetime.now()
                target = now.replace(hour=hour, minute=minute, second=0)
                if target <= now:
                    # 明天
                    import timedelta
                    target = target + timedelta(days=1)
                wait_seconds = (target - now).total_seconds()
                await asyncio.sleep(wait_seconds)
                await self.bus.publish(Event(
                    event_id=f"timer_&#123;datetime.now().strftime('%Y%m%d')&#125;",
                    event_type=EventType.TIMER,
                    payload=&#123;"task": task&#125;,
                    source="timer",
                ))

        self._timers.append(asyncio.create_task(timer_loop()))

    def stop_all(self):
        """停止所有定时器。"""
        for t in self._timers:
            t.cancel()
        self._timers.clear()
```

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 用事件总线解耦 | 生产者消费者分离 | ★★★ |
| 事件有唯一ID | 可追溯 | ★★★ |
| 事件处理要容错 | 一个handler失败不影响其他 | ★★★ |
| 定时任务用事件 | 灵活可配置 | ★★☆ |
| 主动推送用事件 | 不等用户问 | ★★☆ |
| 事件日志记录 | 审计追踪 | ★★☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 有事件总线 | ☐ |
| 有事件订阅 | ☐ |
| 有定时事件源 | ☐ |
| 有主动推送 | ☐ |
