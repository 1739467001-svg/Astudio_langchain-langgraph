# Agent 跨平台与多端部署指南

> 用户通过网页、手机 App、微信小程序、飞书、钉钉、Slack 各种渠道访问 Agent。同一个 Agent 需要适配不同平台的消息格式、交互方式、认证体系和展示限制。本指南系统讲解跨平台架构、渠道适配器模式、消息格式转换，以及各平台的特殊处理。

---

## 1. 跨平台架构

### 渠道适配器模式

```mermaid
graph TB
    subgraph "用户渠道"
        WEB["Web"]
        APP["手机App"]
        WX["微信小程序"]
        FS["飞书"]
        DT["钉钉"]
        SLACK["Slack"]
    end

    subgraph "适配层"
        ADAPT["渠道适配器<br/>消息格式转换<br/>认证映射"]
    end

    subgraph "核心 Agent"
        AGENT["LangGraph Agent<br/>统一逻辑"]
    end

    WEB --> ADAPT
    APP --> ADAPT
    WX --> ADAPT
    FS --> ADAPT
    DT --> ADAPT
    SLACK --> ADAPT
    ADAPT --> AGENT

    style ADAPT fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style AGENT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

### 平台差异

| 维度 | Web | App | 小程序 | 飞书 | 钉钉 |
|------|-----|-----|--------|------|------|
| 消息格式 | HTML | JSON | XML | JSON | JSON |
| 流式支持 | SSE | WebSocket | 轮询 | WebSocket | WebSocket |
| 文件上传 | multipart | multipart | 临时链接 | API | API |
| 认证 | OAuth | Token | 微信登录 | 飞书OAuth | 钉钉OAuth |
| 卡片消息 | HTML | 自定义 | 不支持 | ✅ | ✅ |
| 最大文本 | 无限 | 配置 | 20万字符 | 30万 | 30万 |
| Markdown | 完整 | 有限 | 不支持 | 部分支持 | 部分支持 |

---

## 2. 消息格式转换

### 统一消息模型

```python
from dataclasses import dataclass, field
from enum import Enum

class MessageType(Enum):
    TEXT = "text"
    IMAGE = "image"
    CARD = "card"
    FILE = "file"
    BUTTONS = "buttons"
    LIST = "list"

@dataclass
class UnifiedMessage:
    """统一消息模型"""
    type: MessageType
    content: str = ""           # 文本内容
    title: str = ""              # 标题
    image_url: str = ""          # 图片URL
    buttons: list = field(default_factory=list)  # 按钮列表
    file_url: str = ""           # 文件URL
    metadata: dict = field(default_factory=dict)

@dataclass
class MessageConverter:
    """消息格式转换器"""

    def to_web(self, message: UnifiedMessage) -> dict:
        """转为 Web 格式"""
        if message.type == MessageType.TEXT:
            return {"type": "text", "content": message.content}
        elif message.type == MessageType.CARD:
            return {
                "type": "card",
                "title": message.title,
                "content": message.content,
                "buttons": message.buttons,
            }
        elif message.type == MessageType.IMAGE:
            return {"type": "image", "url": message.image_url}

    def to_feishu(self, message: UnifiedMessage) -> dict:
        """转为飞书格式"""
        if message.type == MessageType.TEXT:
            return {"msg_type": "text", "content": {"text": message.content}}
        elif message.type == MessageType.CARD:
            return {
                "msg_type": "interactive",
                "card": {
                    "elements": [
                        {"tag": "div", "text": {"content": message.content, "tag": "lark_md"}},
                        {"tag": "action", "actions": [
                            {"tag": "button", "text": {"content": b["text"], "tag": "plain_text"},
                             "url": b.get("url", ""), "type": "primary"}
                            for b in message.buttons
                        ]}
                    ],
                    "header": {"title": {"content": message.title, "tag": "plain_text"}},
                }
            }
        elif message.type == MessageType.IMAGE:
            return {"msg_type": "image", "content": {"image_key": message.image_url}}

    def to_dingtalk(self, message: UnifiedMessage) -> dict:
        """转为钉钉格式"""
        if message.type == MessageType.TEXT:
            return {"msgtype": "text", "text": {"content": message.content}}
        elif message.type == MessageType.CARD:
            return {
                "msgtype": "actionCard",
                "actionCard": {
                    "title": message.title,
                    "text": message.content,
                    "btns": [{"title": b["text"], "actionURL": b.get("url", "")} for b in message.buttons],
                }
            }
        elif message.type == MessageType.IMAGE:
            return {"msgtype": "markdown", "markdown": {"title": "图片", "text": f"![图片]({message.image_url})"}}

    def to_wechat_mini(self, message: UnifiedMessage) -> dict:
        """转为微信小程序格式"""
        if message.type == MessageType.TEXT:
            return {"type": "text", "tts": False, "content": message.content}
        elif message.type == MessageType.IMAGE:
            return {"type": "image", "url": message.image_url}
        elif message.type == MessageType.BUTTONS:
            return {
                "type": "template",
                "template": {
                    "buttons": [{"text": b["text"], "url": b.get("url", "")} for b in message.buttons]
                }
            }
```

---

## 3. 渠道适配器

```python
@dataclass
class ChannelAdapter:
    """渠道适配器基类"""

    platform: str = "base"

    async def receive(self, raw_request: dict) -> UnifiedMessage:
        """接收并转换为统一格式"""
        raise NotImplementedError

    async def send(self, message: UnifiedMessage) -> dict:
        """发送消息"""
        raise NotImplementedError

    async def send_stream(self, message_generator):
        """发送流式消息"""
        raise NotImplementedError

    async def verify_webhook(self, request: dict) -> bool:
        """验证 Webhook 签名"""
        raise NotImplementedError

    async def get_user_info(self, user_id: str) -> dict:
        """获取用户信息"""
        raise NotImplementedError


@dataclass
class WebAdapter(ChannelAdapter):
    """Web 渠道适配器"""

    platform = "web"

    async def receive(self, raw_request: dict) -> UnifiedMessage:
        """接收 Web 请求"""
        return UnifiedMessage(
            type=MessageType.TEXT,
            content=raw_request.get("message", ""),
            metadata={"session_id": raw_request.get("session_id", "")},
        )

    async def send(self, message: UnifiedMessage) -> dict:
        """发送到 Web"""
        converter = MessageConverter()
        return converter.to_web(message)

    async def send_stream(self, message_generator):
        """SSE 流式"""
        async for chunk in message_generator:
            yield f"data: {json.dumps({'token': chunk})}\n\n"


@dataclass
class FeishuAdapter(ChannelAdapter):
    """飞书渠道适配器"""

    platform = "feishu"
    app_id: str = ""
    app_secret: str = ""

    async def receive(self, raw_request: dict) -> UnifiedMessage:
        """接收飞书事件"""
        event = raw_request.get("event", {})
        message = event.get("message", {})
        content = json.loads(message.get("content", "{}"))

        return UnifiedMessage(
            type=MessageType.TEXT,
            content=content.get("text", ""),
            metadata={
                "chat_id": message.get("chat_id", ""),
                "user_id": event.get("sender", {}).get("sender_id", {}).get("open_id", ""),
                "message_id": message.get("message_id", ""),
            },
        )

    async def send(self, message: UnifiedMessage) -> dict:
        """发送到飞书"""
        converter = MessageConverter()
        feishu_msg = converter.to_feishu(message)

        # 获取 token
        token = await self._get_token()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://open.feishu.cn/open-apis/im/v1/messages",
                headers={"Authorization": f"Bearer {token}"},
                params={"receive_id_type": "chat_id"},
                json={
                    "receive_id": message.metadata.get("chat_id", ""),
                    "msg_type": feishu_msg["msg_type"],
                    "content": json.dumps(feishu_msg["content"]),
                },
            )
        return response.json()

    async def _get_token(self) -> str:
        """获取飞书 access_token"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
                json={"app_id": self.app_id, "app_secret": self.app_secret},
            )
        return response.json().get("tenant_access_token", "")


@dataclass
class DingtalkAdapter(ChannelAdapter):
    """钉钉渠道适配器"""

    platform = "dingtalk"
    webhook_url: str = ""

    async def receive(self, raw_request: dict) -> UnifiedMessage:
        """接收钉钉消息"""
        return UnifiedMessage(
            type=MessageType.TEXT,
            content=raw_request.get("text", {}).get("content", "").strip(),
            metadata={
                "conversation_id": raw_request.get("conversationId", ""),
                "sender_staff_id": raw_request.get("senderStaffId", ""),
            },
        )

    async def send(self, message: UnifiedMessage) -> dict:
        """发送到钉钉"""
        converter = MessageConverter()
        dingtalk_msg = converter.to_dingtalk(message)

        async with httpx.AsyncClient() as client:
            response = await client.post(self.webhook_url, json=dingtalk_msg)
        return response.json()
```

---

## 4. 统一 Agent 路由

```python
from langgraph.graph import StateGraph, START, END

class MultiChannelState(TypedDict):
    platform: str
    raw_request: dict
    unified_message: UnifiedMessage
    agent_response: str
    formatted_response: dict

# 渠道注册
adapters = {
    "web": WebAdapter(),
    "feishu": FeishuAdapter(app_id="cli_xxx", app_secret="xxx"),
    "dingtalk": DingtalkAdapter(webhook_url="https://oapi.dingtalk.com/robot/send?access_token=xxx"),
}

async def adapt_inbound_node(state: MultiChannelState):
    """入站适配：平台格式 → 统一格式"""
    adapter = adapters.get(state["platform"], WebAdapter())
    message = await adapter.receive(state["raw_request"])
    return {"unified_message": message}

async def agent_node(state: MultiChannelState):
    """Agent 处理"""
    message = state["unified_message"]
    response = await agent.ainvoke(message.content, session_id=message.metadata.get("session_id", ""))
    return {"agent_response": response.content}

async def adapt_outbound_node(state: MultiChannelState):
    """出站适配：统一格式 → 平台格式"""
    adapter = adapters.get(state["platform"], WebAdapter())

    response_message = UnifiedMessage(
        type=MessageType.TEXT,
        content=state["agent_response"],
        metadata=state["unified_message"].metadata,
    )

    formatted = await adapter.send(response_message)
    return {"formatted_response": formatted}

# 构建多渠道 Agent
graph = StateGraph(MultiChannelState)
graph.add_node("adapt_in", adapt_inbound_node)
graph.add_node("agent", agent_node)
graph.add_node("adapt_out", adapt_outbound_node)
graph.add_edge(START, "adapt_in")
graph.add_edge("adapt_in", "agent")
graph.add_edge("agent", "adapt_out")
graph.add_edge("adapt_out", END)

multi_channel_agent = graph.compile()
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解渠道适配器模式 | ☐ |
| 实现了统一消息模型 | ☐ |
| 实现了消息格式转换器 | ☐ |
| 实现了 Web 适配器 | ☐ |
| 实现了飞书适配器 | ⁯ |
| 实现了钉钉适配器 | ☐ |
| 实现了多渠道路由 | ☐ |
| 处理了平台差异 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 24 | 前后端集成教程 | 前后端 |
| 38 | 多语言与翻译 Agent | 多语言 |
| 98 | 流式输出前端集成 | 前端 |
| 130 | 流式输出前端集成指南 | 前端 |
| 162 | 国际化与多语言部署 | 国际化 |
| 185 | Agent 多语言处理 | 多语言 |
| 217 | Agent 多语言处理 | 多语言 |
| 309 | 多语言处理 | 多语言 |
| 440 | Agent 前端与聊天 UI | 前端 |
| 452 | 低代码 Agent 平台 | Dify 渠道 |
| 461 | 企业 Agent 集成 | 企业集成 |
| 482 | Agent API 设计 | API 设计 |
