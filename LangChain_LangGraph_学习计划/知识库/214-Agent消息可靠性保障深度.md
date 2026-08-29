# Agent 消息可靠性保障深度

> 多 Agent 系统中，消息传递可能丢失、重复、乱序。Agent A 发消息给 Agent B，B 没收到怎么办？收到两次怎么办？顺序不对怎么办？

---

## 一、消息可靠性三保证

```mermaid
graph TB
    subgraph 三保证 {"消息可靠性"}
        A1["不丢消息<br/>至少一次投递"]
        A2["不重消息<br/>幂等处理"]
        A3["不乱序<br/>顺序保证"]
    end

    style 三保证 fill:#E3F2FD
    style A1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、实现

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
import hashlib

class MessageStatus(str, Enum):
    PENDING = "pending"
    DELIVERED = "delivered"
    ACKNOWLEDGED = "acknowledged"
    FAILED = "failed"

@dataclass
class AgentMessage:
    """Agent间消息。"""
    message_id: str           # 唯一消息ID
    source: str               # 发送方Agent
    target: str               # 接收方Agent
    content: Any              # 消息内容
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    sequence: int = 0         # 序列号（保证顺序）
    status: MessageStatus = MessageStatus.PENDING
    retry_count: int = 0
    max_retries: int = 3

class MessageQueue:
    """可靠消息队列。"""

    def __init__(self):
        self._queue: list[AgentMessage] = []
        self._delivered: dict[str, AgentMessage] = {}  # 已投递
        self._acknowledged: set[str] = set()  # 已确认
        self._sequence_counter: int = 0

    def send(self, source: str, target: str, content: Any) -> str:
        """发送消息。"""
        self._sequence_counter += 1
        msg = AgentMessage(
            message_id=hashlib.md5(f"{source}{target}{self._sequence_counter}".encode()).hexdigest()[:12],
            source=source,
            target=target,
            content=content,
            sequence=self._sequence_counter,
        )
        self._queue.append(msg)
        return msg.message_id

    def receive(self, target: str) -> AgentMessage | None:
        """接收消息（按序列号顺序）。"""
        # 按序列号排序后取第一条目标匹配的
        pending = [m for m in self._queue if m.target == target and m.status == MessageStatus.PENDING]
        if not pending:
            return None

        pending.sort(key=lambda m: m.sequence)
        msg = pending[0]
        msg.status = MessageStatus.DELIVERED
        self._delivered[msg.message_id] = msg
        return msg

    def acknowledge(self, message_id: str):
        """确认消息已处理。"""
        self._acknowledged.add(message_id)
        # 从队列移除
        self._queue = [m for m in self._queue if m.message_id != message_id]

    def retry_failed(self) -> list[str]:
        """重试未确认的消息。"""
        retry_ids = []
        for msg in self._delivered.values():
            if msg.message_id not in self._acknowledged:
                msg.retry_count += 1
                if msg.retry_count <= msg.max_retries:
                    msg.status = MessageStatus.PENDING
                    self._queue.append(msg)
                    retry_ids.append(msg.message_id)
                else:
                    msg.status = MessageStatus.FAILED
        return retry_ids

    def stats(self) -> dict:
        return {
            "pending": sum(1 for m in self._queue if m.status == MessageStatus.PENDING),
            "delivered": len(self._delivered),
            "acknowledged": len(self._acknowledged),
            "failed": sum(1 for m in self._delivered.values() if m.status == MessageStatus.FAILED),
        }


class IdempotencyHandler:
    """幂等处理器——防止重复消息被重复处理。"""

    def __init__(self):
        self._processed: set[str] = set()

    def should_process(self, message_id: str) -> bool:
        """检查是否应该处理（去重）。"""
        if message_id in self._processed:
            return False
        self._processed.add(message_id)
        return True

    def cleanup(self, max_size: int = 10000):
        """清理旧记录。"""
        if len(self._processed) > max_size:
            self._processed = set(list(self._processed)[-max_size//2:])
```

---

## 三、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 消息有唯一ID | 可追溯去重 | ★★★ |
| 接收后要确认(ACK) | 确保处理成功 | ★★★ |
| 未确认要重试 | 防止消息丢失 | ★★★ |
| 幂等处理 | 重复消息不重复处理 | ★★★ |
| 按序列号排序 | 保证顺序 | ★★☆ |

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有消息队列 | ☐ |
| 有ACK确认 | ☐ |
| 有重试机制 | ☐ |
| 有幂等处理 | ☐ |
