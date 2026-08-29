# 事件驱动 Agent 架构

> 传统 Agent 是"请求-响应"模式，事件驱动 Agent 能响应外部事件、异步处理、多 Agent 通信。

---

## 一、请求-响应 vs 事件驱动

```mermaid
graph TB
    subgraph 请求响应 &#123;"请求-响应模式（传统）"&#125;
        U1["用户提问"] --> A1["Agent处理"]
        A1 --> R1["返回回答"]
        Note1["被动等待用户输入<br/>一次一问一答"]
    end

    subgraph 事件驱动 &#123;"事件驱动模式"&#125;
        E1["事件源<br/>(用户消息/定时器/文件变更/Webhook)"]
        E1 --> QUEUE["事件队列"]
        QUEUE --> A2["Agent处理"]
        A2 --> R2["产生新事件"]
        R2 --> QUEUE
        Note2["主动响应外部事件<br/>异步+多事件源+Agent间通信"]
    end

    style 请求响应 fill:'#E3F2FD'
    style 事件驱动 fill:'#C8E6C9'
```

## 二、事件类型

```mermaid
graph TB
    subgraph 事件类型 &#123;"Agent 可响应的事件类型"&#125;
        E1["👤 用户消息<br/>(聊天/命令/语音)"]
        E2["⏰ 定时事件<br/>(定时摘要/监控)"]
        E3["📁 文件变更<br/>(文档更新→重新索引)"]
        E4["🔗 Webhook<br/>(GitHub提交/Jira变更)"]
        E5["🤖 Agent事件<br/>(其他Agent完成/发现)"]
        E6["📊 数据事件<br/>(数据库变更/新数据)"]
    end

    style 事件类型 fill:'#E3F2FD'
```

## 三、事件驱动架构实现

### 3.1 事件总线

```python
import asyncio
from collections import defaultdict
from typing import Callable, Any

class EventBus:
    """简单的事件总线（发布-订阅模式）"""
    def __init__(self):
        self.handlers = defaultdict(list)

    def subscribe(self, event_type: str, handler: Callable):
        """订阅事件"""
        self.handlers[event_type].append(handler)

    async def publish(self, event_type: str, data: Any):
        """发布事件"""
        for handler in self.handlers.get(event_type, []):
            await handler(data)

# 使用
bus = EventBus()

# Agent订阅事件
async def on_user_message(data):
    """处理用户消息事件"""
    print(f"👤 用户: &#123;data&#125;")
    # 调用LLM处理
    answer = await llm.ainvoke(data)
    # 可能产生新事件
    await bus.publish("agent_response", answer)

async def on_file_change(data):
    """处理文件变更事件"""
    print(f"📁 文件变更: &#123;data&#125;")
    # 触发重新索引
    await bus.publish("reindex_needed", data)

async def on_agent_response(data):
    """处理Agent响应事件"""
    print(f"🤖 Agent: &#123;data&#125;")

# 订阅
bus.subscribe("user_message", on_user_message)
bus.subscribe("file_change", on_file_change)
bus.subscribe("agent_response", on_agent_response)

# 发布事件
asyncio.run(bus.publish("user_message", "你好"))
asyncio.run(bus.publish("file_change", &#123;"file": "doc.pdf", "action": "added"&#125;))
```

### 3.2 事件驱动 LangGraph

```python
from typing import TypedDict, Annotated
from operator import add
from langgraph.graph import StateGraph, START, END

class EventState(TypedDict):
    events: Annotated[list, add]  # 事件队列
    processed: list                # 已处理的事件
    responses: Annotated[list, add]

def event_handler_node(state: EventState) -> dict:
    """处理队列中的事件"""
    events = state.get("events", [])
    if not events:
        return &#123;"responses": ["无待处理事件"]&#125;

    event = events[0]  # 取第一个事件
    responses = []

    if event["type"] == "user_message":
        answer = llm.invoke(event["data"])
        responses.append(f"回复: &#123;answer.content&#125;")
    elif event["type"] == "file_change":
        responses.append(f"文件&#123;event['data']['file']&#125;已变更，将重新索引")

    return &#123;
        "processed": [event],
        "responses": responses,
    &#125;

def has_more_events(state: EventState) -> str:
    remaining = [e for e in state.get("events", []) if e not in state.get("processed", [])]
    return "continue" if remaining else "done"

# 构建图
graph = StateGraph(EventState)
graph.add_node("handler", event_handler_node)
graph.add_edge(START, "handler")
graph.add_conditional_edges("handler", has_more_events, &#123;
    "continue": "handler", "done": END
&#125;)
app = graph.compile()
```

## 四、多 Agent 事件通信

```mermaid
graph TB
    subgraph 多Agent通信 &#123;"事件驱动的多Agent通信"&#125;
        A1["研究Agent"] -->|"发布: research_done"| BUS["事件总线"]
        A2["写作Agent"] -->|"订阅: research_done"| BUS
        A2 -->|"发布: draft_done"| BUS
        A3["审稿Agent"] -->|"订阅: draft_done"| BUS
        A3 -->|"发布: review_done"| BUS
        A1 -->|"订阅: review_done"| BUS
    end

    style BUS fill:'#FFF9C4'
```

```python
# 研究→写作→审稿的事件驱动编排
async def research_agent(event_data):
    """研究Agent：完成研究后发布事件"""
    result = do_research(event_data)
    await bus.publish("research_done", result)

async def writing_agent(research_result):
    """写作Agent：收到研究完成后开始写作"""
    draft = write_draft(research_result)
    await bus.publish("draft_done", draft)

async def review_agent(draft):
    """审稿Agent：收到草稿后审查"""
    review = review_draft(draft)
    if not review["approved"]:
        await bus.publish("revision_needed", review["feedback"])

# 订阅关系
bus.subscribe("research_done", writing_agent)
bus.subscribe("draft_done", review_agent)
bus.subscribe("revision_needed", writing_agent)  # 审稿不通过→重写
```

## 五、事件驱动 vs 请求驱动的选择

```mermaid
graph TD
    Q&#123;"任务特征?"&#125;
    Q -->|"用户主动提问"| REQ["✅ 请求驱动<br/>(传统Agent)"]
    Q -->|"需要响应外部事件"| EVT["✅ 事件驱动"]
    Q -->|"多个Agent异步协作"| EVT
    Q -->|"需要定时执行"| EVT
    Q -->|"固定流程"| REQ

    style REQ fill:'#C8E6C9'
    style EVT fill:'#E3F2FD'
```

## 六、选型建议

| 场景 | 模式 | 原因 |
|------|------|------|
| 聊天机器人 | 请求驱动 | 一问一答 |
| 文档监控系统 | 事件驱动 | 文件变更触发处理 |
| 多Agent协作 | 事件驱动 | Agent间异步通信 |
| 定时摘要 | 事件驱动 | 定时器触发 |
| CI/CD集成 | 事件驱动 | 代码提交触发 |
| 简单FAQ | 请求驱动 | 不需要事件 |
