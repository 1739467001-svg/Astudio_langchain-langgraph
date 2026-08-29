# Agent 消息可靠性保障

> 多 Agent 通信中，消息可能丢失、重复、乱序。这份指南覆盖消息可靠性的保障机制。

---

## 一、消息可靠性风险

```mermaid
graph TB
    subgraph 风险 &#123;"Agent消息通信的四种风险"&#125;
        R1["❌ 消息丢失<br/>Agent B没收到Agent A的消息"]
        R2["❌ 消息重复<br/>Agent B收到两次相同的消息"]
        R3["❌ 消息乱序<br/>Agent B收到消息的顺序不对"]
        R4["❌ 消息损坏<br/>消息内容被篡改或截断"]
    end

    style 风险 fill:'#FFCDD2'
```

## 二、保障机制

```mermaid
graph TB
    subgraph 保障 &#123;"四种保障机制"&#125;
        S1["1. 消息ID+去重<br/>防止重复处理"]
        S2["2. 确认机制<br/>收到后确认，未确认则重发"]
        S3["3. 序列号<br/>保证顺序"]
        S4["4. 校验<br/>验证消息完整性"]
    end

    style 保障 fill:'#C8E6C9'
```

## 三、实现

### 3.1 可靠消息信封

```python
import uuid
from datetime import datetime
from pydantic import BaseModel

class MessageEnvelope(BaseModel):
    """可靠消息信封"""
    message_id: str = ""           # 唯一ID（去重用）
    sequence: int = 0              # 序列号（排序用）
    sender: str = ""               # 发送者
    receiver: str = ""             # 接收者
    content: str = ""              # 消息内容
    timestamp: str = ""            # 时间戳
    reply_to: str = ""             # 回复哪条消息
    acknowledged: bool = False      # 是否已确认

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.message_id:
            self.message_id = str(uuid.uuid4())
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()

def send_message(sender: str, receiver: str, content: str, sequence: int = 0) -> MessageEnvelope:
    """发送可靠消息"""
    return MessageEnvelope(
        sender=sender,
        receiver=receiver,
        content=content,
        sequence=sequence,
    )
```

### 3.2 可靠消息处理器

```python
class ReliableMessageHandler:
    """可靠消息处理器（去重+排序+确认）"""
    def __init__(self):
        self.processed_ids = set()    # 已处理的消息ID（去重）
        self.last_sequence = 0         # 上一个序列号
        self.pending = &#123;&#125;              # 待处理的消息（序列号乱序时缓冲）

    def receive(self, msg: MessageEnvelope) -> tuple[bool, str]:
        """接收消息：返回(是否处理, 原因)"""
        # 1. 去重
        if msg.message_id in self.processed_ids:
            return False, "duplicate"

        # 2. 检查序列号
        if msg.sequence > self.last_sequence + 1:
            # 乱序：缓冲，等待前序消息
            self.pending[msg.sequence] = msg
            return False, "buffered"

        # 3. 处理消息
        self._process(msg)
        self.processed_ids.add(msg.message_id)
        self.last_sequence = msg.sequence

        # 4. 处理缓冲中的后续消息
        while (self.last_sequence + 1) in self.pending:
            next_msg = self.pending.pop(self.last_sequence + 1)
            self._process(next_msg)
            self.processed_ids.add(next_msg.message_id)
            self.last_sequence += 1

        return True, "processed"

    def _process(self, msg: MessageEnvelope):
        """实际处理消息（子类重写）"""
        print(f"📨 处理消息: &#123;msg.sender&#125;→&#123;msg.receiver&#125;: &#123;msg.content[:50]&#125;")

    def acknowledge(self, msg: MessageEnvelope) -> str:
        """确认消息"""
        return f"ACK:&#123;msg.message_id&#125;"
```

### 3.3 在 LangGraph 中使用

```python
from typing import TypedDict, Annotated
from operator import add
from langchain_core.messages import AnyMessage

class ReliableAgentState(TypedDict):
    messages: Annotated[list, add]
    message_log: list       # 消息日志（记录所有消息）
    pending_acks: dict      # 待确认的消息

def agent_a_node(state: ReliableAgentState) -> dict:
    """Agent A：发送消息给B"""
    msg = send_message("agent_a", "agent_b", "研究结果完成", sequence=len(state.get("message_log", [])))
    return &#123;
        "messages": [msg],
        "message_log": [&#123;"id": msg.message_id, "from": "a", "to": "b", "content": msg.content&#125;],
        "pending_acks": &#123;msg.message_id: False&#125;,
    &#125;

def agent_b_node(state: ReliableAgentState) -> dict:
    """Agent B：接收并确认消息"""
    last_msg = state["messages"][-1]
    # 确认
    ack_id = last_msg.message_id
    updated_acks = &#123;k: (v or k == ack_id) for k, v in state.get("pending_acks", &#123;&#125;).items()&#125;

    return &#123;
        "pending_acks": updated_acks,
        "messages": [],  # B不产生新消息
    &#125;
```

## 四、消息丢失检测

```python
def detect_missing_messages(log: list, expected_seq: range) -> list[int]:
    """检测丢失的序列号"""
    received_seqs = &#123;entry["sequence"] for entry in log&#125;
    return [s for s in expected_seq if s not in received_seqs]

# 使用
log = [
    &#123;"sequence": 1, "content": "消息1"&#125;,
    &#123;"sequence": 3, "content": "消息3"&#125;,  # 序列号2丢失
    &#123;"sequence": 4, "content": "消息4"&#125;,
]
missing = detect_missing_messages(log, range(1, 5))
# [2] → 序列号2的消息丢失了
```

## 五、保障策略选择

| 场景 | 需要哪些保障 | 复杂度 |
|------|------------|--------|
| 简单Agent对话 | 无需 | ★☆☆ |
| 多Agent异步通信 | 去重+确认 | ★★★ |
| 需要顺序保证 | 去重+确认+序列号 | ★★★★ |
| 高可靠性要求 | 全部四种 | ★★★★★ |
