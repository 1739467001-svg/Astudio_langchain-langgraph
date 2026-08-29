# Agent 通信协议指南

> 多 Agent 系统中，Agent 之间如何通信是个核心问题。不像人类对话那样随意，Agent 通信需要明确的协议——消息格式、寻址方式、同步异步、错误处理——才能保证多 Agent 协作的可靠性和可追溯性。

---

## 1. 为什么需要通信协议

### 无协议的问题

```
Agent A（研究）→ "帮我查一下竞争对手的价格" → Agent B（搜索）
Agent B 不知道是谁发的、什么格式、急不急、需要什么粒度
结果：格式混乱、丢失上下文、无法追踪
```

### 有协议的通信

```
Agent A → Message{
  from: "research_agent",
  to: "search_agent",
  type: "task_request",
  content: {"query": "竞争对手价格", "depth": "detailed"},
  reply_to: "msg_001",
  priority: "normal",
  deadline: 30000,  # 30秒超时
}
Agent B 收到 → 执行 → 返回结果 Message{
  from: "search_agent",
  to: "research_agent",
  type: "task_result",
  content: {"results": [...]},
  in_reply_to: "msg_001",
  status: "success",
}
```

---

## 2. 消息格式定义

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Any
import uuid
import time


class MessageType(Enum):
    """消息类型"""
    TASK_REQUEST = "task_request"      # 任务请求
    TASK_RESULT = "task_result"        # 任务结果
    QUERY = "query"                     # 信息查询
    RESPONSE = "response"              # 信息回复
    NOTIFICATION = "notification"       # 通知（无需回复）
    HANDSHAKE = "handshake"            # 握手（能力发现）
    ERROR = "error"                     # 错误报告
    CANCEL = "cancel"                   # 取消任务
    HEARTBEAT = "heartbeat"            # 心跳


class MessagePriority(Enum):
    """消息优先级"""
    LOW = 1
    NORMAL = 5
    HIGH = 8
    URGENT = 10


class MessageStatus(Enum):
    """消息状态"""
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


@dataclass
class AgentMessage:
    """Agent 间通信消息"""
    # 标识
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    # 寻址
    from_agent: str = ""           # 发送者 ID
    to_agent: str = ""             # 接收者 ID
    # 类型与状态
    type: MessageType = MessageType.TASK_REQUEST
    priority: MessagePriority = MessagePriority.NORMAL
    status: MessageStatus = MessageStatus.PENDING
    # 内容
    content: dict[str, Any] = field(default_factory=dict)
    # 关联
    reply_to: str | None = None     # 回复的消息 ID
    conversation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    # 时序
    timestamp: float = field(default_factory=time.time)
    deadline: float | None = None    # 超时时间戳
    # 元数据
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "from": self.from_agent,
            "to": self.to_agent,
            "type": self.type.value,
            "priority": self.priority.value,
            "status": self.status.value,
            "content": self.content,
            "reply_to": self.reply_to,
            "conversation_id": self.conversation_id,
            "timestamp": self.timestamp,
            "deadline": self.deadline,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AgentMessage":
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            from_agent=data["from"],
            to_agent=data["to"],
            type=MessageType(data.get("type", "task_request")),
            priority=MessagePriority(data.get("priority", 5)),
            status=MessageStatus(data.get("status", "pending")),
            content=data.get("content", {}),
            reply_to=data.get("reply_to"),
            conversation_id=data.get("conversation_id", str(uuid.uuid4())),
            timestamp=data.get("timestamp", time.time()),
            deadline=data.get("deadline"),
            metadata=data.get("metadata", {}),
        )
```

---

## 3. 通信模式

### 模式一：请求-响应（同步）

```python
class RequestResponseChannel:
    """请求-响应通信通道"""

    def __init__(self):
        self.pending: dict[str, AgentMessage] = {}  # 待回复的请求
        self.completed: dict[str, AgentMessage] = {}  # 已完成的回复

    async def send_request(
        self,
        message: AgentMessage,
        timeout: float = 30.0,
    ) -> AgentMessage | None:
        """发送请求并等待响应"""
        self.pending[message.id] = message

        # 等待响应
        start = time.time()
        while time.time() - start < timeout:
            if message.id in self.completed:
                return self.completed.pop(message.id)
            await asyncio.sleep(0.1)

        # 超时
        message.status = MessageStatus.TIMEOUT
        return None

    def send_response(self, response: AgentMessage):
        """发送响应"""
        original_id = response.reply_to
        if original_id in self.pending:
            del self.pending[original_id]
        self.completed[original_id] = response
```

### 模式二：发布-订阅（异步）

```python
class PubSubChannel:
    """发布-订阅通信通道"""

    def __init__(self):
        self.subscribers: dict[str, list[str]] = {}  # topic → [agent_ids]
        self.message_queue: dict[str, list[AgentMessage]] = {}  # agent_id → [messages]

    def subscribe(self, topic: str, agent_id: str):
        """订阅主题"""
        if topic not in self.subscribers:
            self.subscribers[topic] = []
        self.subscribers[topic].append(agent_id)
        if agent_id not in self.message_queue:
            self.message_queue[agent_id] = []

    def unsubscribe(self, topic: str, agent_id: str):
        """取消订阅"""
        if topic in self.subscribers:
            self.subscribers[topic] = [
                a for a in self.subscribers[topic] if a != agent_id
            ]

    def publish(self, topic: str, message: AgentMessage):
        """发布消息到主题"""
        subscribers = self.subscribers.get(topic, [])
        for agent_id in subscribers:
            if agent_id != message.from_agent:  # 不发给自己
                self.message_queue[agent_id].append(message)

    def consume(self, agent_id: str, max_count: int = 10) -> list[AgentMessage]:
        """消费消息"""
        messages = self.message_queue.get(agent_id, [])
        consumed = messages[:max_count]
        self.message_queue[agent_id] = messages[max_count:]
        return consumed
```

### 模式三：直接消息（点对点）

```python
class DirectMessageChannel:
    """点对点直接通信"""

    def __init__(self):
        self.queues: dict[str, list[AgentMessage]] = {}
        self.agent_registry: dict[str, dict] = {}  # agent_id → capabilities

    def register_agent(self, agent_id: str, capabilities: list[str]):
        """注册 Agent 及其能力"""
        self.agent_registry[agent_id] = {
            "id": agent_id,
            "capabilities": capabilities,
            "online": True,
            "last_heartbeat": time.time(),
        }
        self.queues[agent_id] = []

    def send(self, message: AgentMessage) -> bool:
        """发送消息到指定 Agent"""
        target = message.to_agent
        if target not in self.agent_registry:
            return False
        if not self.agent_registry[target]["online"]:
            return False
        self.queues[target].append(message)
        return True

    def receive(self, agent_id: str) -> list[AgentMessage]:
        """接收消息"""
        messages = self.queues.get(agent_id, [])
        self.queues[agent_id] = []
        return messages

    def heartbeat(self, agent_id: str):
        """心跳"""
        if agent_id in self.agent_registry:
            self.agent_registry[agent_id]["last_heartbeat"] = time.time()

    def check_health(self, timeout: float = 60):
        """检查所有 Agent 健康状态"""
        now = time.time()
        for agent_id, info in self.agent_registry.items():
            if now - info["last_heartbeat"] > timeout:
                info["online"] = False
```

---

## 4. 能力发现与握手

```python
class CapabilityDiscovery:
    """Agent 能力发现协议"""

    def __init__(self, channel: DirectMessageChannel):
        self.channel = channel
        self.capabilities: dict[str, list[str]] = {}  # agent_id → capabilities

    def discover(self, agent_id: str) -> list[str] | None:
        """发现 Agent 的能力"""
        # 发送握手请求
        handshake = AgentMessage(
            from_agent="discovery",
            to_agent=agent_id,
            type=MessageType.HANDSHAKE,
            content={"request": "capabilities"},
        )
        self.channel.send(handshake)

        # 等待响应
        import time
        time.sleep(0.5)
        messages = self.channel.receive("discovery")

        for msg in messages:
            if msg.type == MessageType.HANDSHAKE and msg.reply_to == handshake.id:
                caps = msg.content.get("capabilities", [])
                self.capabilities[agent_id] = caps
                return caps

        return None

    def find_agent_by_capability(self, capability: str) -> str | None:
        """根据能力查找 Agent"""
        for agent_id, caps in self.capabilities.items():
            if capability in caps:
                return agent_id
        return None

    def broadcast_discovery(self) -> dict[str, list[str]]:
        """广播发现所有在线 Agent 的能力"""
        results = {}
        for agent_id in self.channel.agent_registry:
            caps = self.discover(agent_id)
            if caps:
                results[agent_id] = caps
        return results
```

---

## 5. 生产级通信总线

```python
class AgentCommunicationBus:
    """生产级 Agent 通信总线"""

    def __init__(self):
        self.direct_channel = DirectMessageChannel()
        self.pubsub_channel = PubSubChannel()
        self.discovery = CapabilityDiscovery(self.direct_channel)
        self.message_log: list[dict] = []
        self.conversations: dict[str, list[AgentMessage]] = {}

    def register_agent(self, agent_id: str, capabilities: list[str]):
        """注册新 Agent"""
        self.direct_channel.register_agent(agent_id, capabilities)

    def send_task(
        self,
        from_agent: str,
        to_agent: str,
        task: dict,
        priority: MessagePriority = MessagePriority.NORMAL,
        timeout: float = 30,
    ) -> dict | None:
        """发送任务请求并等待结果"""
        msg = AgentMessage(
            from_agent=from_agent,
            to_agent=to_agent,
            type=MessageType.TASK_REQUEST,
            content=task,
            priority=priority,
            deadline=time.time() + timeout,
        )

        self.direct_channel.send(msg)
        self._log(msg)

        # 等待响应
        start = time.time()
        while time.time() - start < timeout:
            responses = self.direct_channel.receive(from_agent)
            for resp in responses:
                if resp.reply_to == msg.id and resp.type == MessageType.TASK_RESULT:
                    self._log(resp)
                    return resp.content
            time.sleep(0.1)

        # 超时
        timeout_msg = AgentMessage(
            from_agent=to_agent,
            to_agent=from_agent,
            type=MessageType.ERROR,
            status=MessageStatus.TIMEOUT,
            content={"error": "timeout", "original_task": task},
            reply_to=msg.id,
        )
        self._log(timeout_msg)
        return None

    def notify(self, from_agent: str, topic: str, content: dict):
        """发布通知（无需回复）"""
        msg = AgentMessage(
            from_agent=from_agent,
            to_agent="*",
            type=MessageType.NOTIFICATION,
            content=content,
        )
        self.pubsub_channel.publish(topic, msg)
        self._log(msg)

    def _log(self, msg: AgentMessage):
        """记录消息日志"""
        entry = msg.to_dict()
        self.message_log.append(entry)

        # 按对话分组
        conv_id = msg.conversation_id
        if conv_id not in self.conversations:
            self.conversations[conv_id] = []
        self.conversations[conv_id].append(msg)

    def get_conversation(self, conversation_id: str) -> list[AgentMessage]:
        """获取一次对话的完整记录"""
        return self.conversations.get(conversation_id, [])

    def get_agent_stats(self, agent_id: str) -> dict:
        """获取 Agent 通信统计"""
        sent = [m for m in self.message_log if m["from"] == agent_id]
        received = [m for m in self.message_log if m["to"] == agent_id]
        return {
            "messages_sent": len(sent),
            "messages_received": len(received),
            "avg_response_time": self._avg_response_time(agent_id),
            "error_rate": len([m for m in received if m.get("status") == "failed"]) / max(len(received), 1),
        }

    def _avg_response_time(self, agent_id: str) -> float:
        """计算平均响应时间"""
        times = []
        for conv in self.conversations.values():
            for i in range(0, len(conv) - 1, 2):
                if conv[i].to_agent == agent_id and conv[i+1].from_agent == agent_id:
                    times.append(conv[i+1].timestamp - conv[i].timestamp)
        return sum(times) / len(times) if times else 0
```

---

## 6. 多 Agent 协作示例

```python
# 场景：研究 Agent 协调搜索 Agent 和分析 Agent
bus = AgentCommunicationBus()

# 注册三个 Agent
bus.register_agent("research_agent", ["coordination", "synthesis"])
bus.register_agent("search_agent", ["web_search", "data_retrieval"])
bus.register_agent("analysis_agent", ["data_analysis", "report_generation"])

# 研究 Agent 协调多 Agent 工作
def research_workflow(query: str) -> str:
    """研究工作流：搜索 → 分析 → 综合"""
    # 1. 向搜索 Agent 发送搜索任务
    search_result = bus.send_task(
        from_agent="research_agent",
        to_agent="search_agent",
        task={"query": query, "max_results": 10},
        timeout=15,
    )

    if not search_result:
        return "搜索超时"

    # 2. 向分析 Agent 发送分析任务
    analysis_result = bus.send_task(
        from_agent="research_agent",
        to_agent="analysis_agent",
        task={"data": search_result.get("results", []), "query": query},
        timeout=30,
    )

    if not analysis_result:
        return "分析超时"

    # 3. 综合结果
    return f"研究发现：{analysis_result.get('summary', '无结果')}"

# 通知所有 Agent 任务完成
bus.notify("research_agent", "task_complete", {"query": query, "status": "done"})
```

---

## 7. 协议设计原则

| 原则 | 说明 |
|------|------|
| 明确寻址 | from/to 必须清晰，支持点对点和广播 |
| 消息可追溯 | 每条消息有 ID，回复有 reply_to |
| 超时处理 | 每个请求有 deadline，超时自动降级 |
| 能力发现 | Agent 注册能力，动态路由任务 |
| 幂等性 | 相同请求多次执行结果一致 |
| 有序保证 | 同一对话内消息有序 |
| 错误传播 | 错误信息要有足够上下文 |

### 通信模式选择

| 模式 | 场景 | 示例 |
|------|------|------|
| 请求-响应 | 需要结果 | 搜索→返回结果 |
| 发布-订阅 | 广播通知 | 状态更新通知 |
| 点对点 | 直接协作 | Agent A 调用 Agent B |
| 请求队列 | 削峰填谷 | 大量搜索任务排队 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有消息格式定义 | ☐ |
| 有消息 ID 和 reply_to | ☐ |
| 有超时处理 | ☐ |
| 有能力发现 | ☐ |
| 有心跳机制 | ☐ |
| 有消息日志 | ☐ |
| 有对话追踪 | ☐ |
| 有错误传播 | ☐ |
| 有通信统计 | ☐ |
