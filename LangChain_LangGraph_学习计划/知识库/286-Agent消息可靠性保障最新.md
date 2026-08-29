# Agent 消息可靠性保障最新

> 知识库 94 有 176 行、知识库 214 有深度。这篇整合为最新——不丢/不重/不乱序。

---

## 一、三保证

```mermaid
graph TB
    M1["不丢: 至少一次投递"]
    M2["不重: 幂等处理"]
    M3["不乱序: 序列号"]

    style M1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、实现

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import hashlib

class MsgStatus(str, Enum):
    PENDING = "pending"
    DELIVERED = "delivered"
    ACKED = "acknowledged"
    FAILED = "failed"

@dataclass
class AgentMessage:
    message_id: str
    source: str
    target: str
    content: str
    sequence: int = 0
    status: MsgStatus = MsgStatus.PENDING
    retry_count: int = 0
    max_retries: int = 3

class ReliableMessageQueue:
    """可靠消息队列。"""

    def __init__(self):
        self._queue: list[AgentMessage] = []
        self._delivered: dict[str, AgentMessage] = {}
        self._acked: set[str] = set()
        self._seq: int = 0

    def send(self, source: str, target: str, content: str) -> str:
        """发送消息。"""
        self._seq += 1
        msg = AgentMessage(
            message_id=hashlib.md5(f"{source}{target}{self._seq}".encode()).hexdigest()[:12],
            source=source, target=target, content=content, sequence=self._seq,
        )
        self._queue.append(msg)
        return msg.message_id

    def receive(self, target: str) -> AgentMessage | None:
        """接收消息（按序列号顺序）。"""
        pending = [m for m in self._queue if m.target == target and m.status == MsgStatus.PENDING]
        if not pending:
            return None
        pending.sort(key=lambda m: m.sequence)
        msg = pending[0]
        msg.status = MsgStatus.DELIVERED
        self._delivered[msg.message_id] = msg
        return msg

    def acknowledge(self, message_id: str):
        """确认消息已处理。"""
        self._acked.add(message_id)
        self._queue = [m for m in self._queue if m.message_id != message_id]

    def retry_failed(self) -> list[str]:
        """重试未确认的消息。"""
        retried = []
        for msg in self._delivered.values():
            if msg.message_id not in self._acked:
                msg.retry_count += 1
                if msg.retry_count <= msg.max_retries:
                    msg.status = MsgStatus.PENDING
                    self._queue.append(msg)
                    retried.append(msg.message_id)
                else:
                    msg.status = MsgStatus.FAILED
        return retried


class IdempotencyHandler:
    """幂等处理器——防止重复处理。"""

    def __init__(self):
        self._processed: set[str] = set()

    def should_process(self, message_id: str) -> bool:
        if message_id in self._processed:
            return False
        self._processed.add(message_id)
        return True
```

---

## 三、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 消息有唯一ID | 可追溯去重 | ★★★ |
| 接收后要ACK | 确保处理成功 | ★★★ |
| 未确认要重试 | 防丢失 | ★★★ |
| 幂等处理 | 防重复 | ★★★ |

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有消息队列 | ☐ |
| 有ACK确认 | ☐ |
| 有幂等处理 | ☐ |
