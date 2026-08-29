# LangGraph 消息总线与节点间通信指南

> LangGraph 的图节点之间默认只能通过共享 State 传递数据。但有时候你需要节点之间的松耦合通信——一个节点发事件，另一个节点异步消费。这篇指南讲透消息总线模式、事件驱动节点通信和 pub/sub 架构。

---

## 一、消息总线架构

```mermaid
graph TB
    subgraph 图 &#123;"LangGraph 图"&#125;
        N1["节点A: 数据获取"] --> BUS["消息总线"]
        N2["节点B: 分析推理"] --> BUS
        N3["节点C: 报告生成"] --> BUS
        N4["节点D: 日志记录"] --> BUS
    end

    BUS -->|订阅: data_fetched| N2
    BUS -->|订阅: analysis_done| N3
    BUS -->|订阅: *| N4

    style BUS fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style N1 fill:#E3F2FD
    style N3 fill:#C8E6C9
```

共享 State 的问题：所有节点都能读到所有数据，耦合度高。消息总线让节点之间通过**事件名**通信，发布者不需要知道谁在听，订阅者不需要知道谁在发。

---

## 二、消息总线实现

```python
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict
import asyncio
from typing import Any, Callable, Awaitable

@dataclass
class Message:
    """消息。"""
    topic: str
    payload: Any
    sender: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    metadata: dict = field(default_factory=dict)

class MessageBus:
    """异步消息总线——pub/sub 模式。"""

    def __init__(self):
        self._subscribers: dict[str, list[Callable]] = defaultdict(list)
        self._history: list[Message] = []
        self._max_history = 1000

    def subscribe(self, topic: str, handler: Callable[[Message], Awaitable[None]]):
        """订阅主题。"""
        self._subscribers[topic].append(handler)

    def unsubscribe(self, topic: str, handler: Callable):
        """取消订阅。"""
        if topic in self._subscribers:
            self._subscribers[topic] = [h for h in self._subscribers[topic] if h != handler]

    async def publish(self, topic: str, payload: Any, sender: str = "", **metadata):
        """发布消息。"""
        msg = Message(topic=topic, payload=payload, sender=sender, metadata=metadata)
        self._history.append(msg)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

        # 通知订阅者
        handlers = self._subscribers.get(topic, [])
        # 同时通知通配订阅者
        wildcard_handlers = self._subscribers.get("*", [])
        all_handlers = handlers + wildcard_handlers

        for handler in all_handlers:
            try:
                await handler(msg)
            except Exception as e:
                # 不让一个订阅者失败影响其他
                print(f"订阅者处理失败: &#123;e&#125;")

    def get_history(self, topic: str = None, limit: int = 10) -> list[Message]:
        """获取消息历史。"""
        msgs = self._history
        if topic:
            msgs = [m for m in msgs if m.topic == topic or topic == "*"]
        return msgs[-limit:]

    def clear(self):
        """清空历史。"""
        self._history.clear()


# 全局消息总线实例
bus = MessageBus()
```

### LangGraph 节点集成

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

class WorkflowState(TypedDict):
    query: str
    data: str
    analysis: str
    report: str
    logs: list[str]

# 节点A：数据获取——发布 data_fetched 事件
async def fetch_data(state: WorkflowState) -> WorkflowState:
    data = f"获取到关于'&#123;state['query']&#125;'的数据..."
    state["data"] = data
    state["logs"].append(f"[fetch_data] 获取数据完成")

    # 发布事件
    await bus.publish("data_fetched", &#123;"query": state["query"], "data": data&#125;, sender="fetch_data")
    return state

# 节点B：分析推理——发布 analysis_done 事件
async def analyze(state: WorkflowState) -> WorkflowState:
    response = await llm.ainvoke(f"分析以下数据：&#123;state['data']&#125;")
    analysis = response.content
    state["analysis"] = analysis
    state["logs"].append(f"[analyze] 分析完成")

    await bus.publish("analysis_done", &#123;"analysis": analysis&#125;, sender="analyze")
    return state

# 节点C：报告生成——订阅 analysis_done
async def generate_report(state: WorkflowState) -> WorkflowState:
    report = f"# 分析报告\n\n## 查询\n&#123;state['query']&#125;\n\n## 分析\n&#123;state['analysis']&#125;"
    state["report"] = report
    state["logs"].append(f"[generate_report] 报告生成完成")

    await bus.publish("report_generated", &#123;"report": report&#125;, sender="generate_report")
    return state

# 消息总线订阅者——日志记录器
async def log_handler(msg: Message):
    print(f"[LOG] &#123;msg.sender&#125; -> &#123;msg.topic&#125;: &#123;str(msg.payload)[:80]&#125;")

# 审计订阅者——记录所有事件
audit_log: list[dict] = []
async def audit_handler(msg: Message):
    audit_log.append(&#123;
        "topic": msg.topic,
        "sender": msg.sender,
        "timestamp": msg.timestamp,
        "payload_size": len(str(msg.payload)),
    &#125;)

# 注册订阅者
bus.subscribe("data_fetched", log_handler)
bus.subscribe("analysis_done", log_handler)
bus.subscribe("report_generated", log_handler)
bus.subscribe("*", audit_handler)  # 通配订阅

# 构建图
graph_builder = StateGraph(WorkflowState)
graph_builder.add_node("fetch", fetch_data)
graph_builder.add_node("analyze", analyze)
graph_builder.add_node("report", generate_report)

graph_builder.add_edge(START, "fetch")
graph_builder.add_edge("fetch", "analyze")
graph_builder.add_edge("analyze", "report")
graph_builder.add_edge("report", END)

workflow = graph_builder.compile()
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await workflow.ainvoke(&#123;
        "query": "分析2024年AI市场趋势",
        "data": "",
        "analysis": "",
        "report": "",
        "logs": [],
    &#125;)
    print(result["report"][:500])
    print(f"\n审计日志条数: &#123;len(audit_log)&#125;")

asyncio.run(main())
```

---

## 四、通信模式对比

| 模式 | 耦合度 | 灵活性 | 适用场景 | 复杂度 |
|------|--------|--------|----------|--------|
| 共享State | 高 | 低 | 简单线性流程 | 低 |
| 消息总线 | 低 | 高 | 多节点松耦合 | 中 |
| 直接调用 | 中 | 低 | 固定调用链 | 低 |
| 事件溯源 | 极低 | 极高 | 审计+回放 | 高 |
| 共享State+总线 | 中 | 高 | 生产环境 | 中 |

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 事件名用动词过去式 | data_fetched 而非 fetch_data | ★★★ |
| 订阅者异常隔离 | 一个失败不影响其他 | ★★★ |
| 保留消息历史 | 供审计和回放 | ★★☆ |
| 通配订阅用于审计 | "*" 订阅所有事件 | ★★☆ |
| 消息幂等 | 订阅者可重复执行不报错 | ★★☆ |
| 限制历史大小 | 防内存膨胀 | ★☆☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 有消息总线 | ☐ |
| 支持 pub/sub | ☐ |
| 支持通配订阅 | ☐ |
| 有消息历史 | ☐ |
| 订阅者异常隔离 | ☐ |
| 与 LangGraph 节点集成 | ☐ |
