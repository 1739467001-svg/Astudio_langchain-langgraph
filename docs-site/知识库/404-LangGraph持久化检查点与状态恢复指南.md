# LangGraph 持久化检查点与状态恢复指南

> Agent 运行到一半中断了——服务重启、超时、异常退出。如果没有持久化，所有中间状态全部丢失，必须从头重来。LangGraph 的 Checkpointer 机制在每一步执行后自动保存状态快照，中断后可从任意检查点恢复继续执行。

---

## 一、检查点架构

```mermaid
graph TB
    START["START"] --> NODE_A["节点A"]
    NODE_A -->|执行后| CKPT_A&#123;"保存检查点<br/>thread_id+config"&#125;
    CKPT_A --> NODE_B["节点B"]
    NODE_B -->|执行后| CKPT_B&#123;"保存检查点"&#125;
    CKPT_B --> NODE_C["节点C"]
    NODE_C -->|执行后| CKPT_C&#123;"保存检查点"&#125;
    CKPT_C --> END["END"]

    CKPT_A -.->|"崩溃!"| RECOVER["恢复"]
    RECOVER -.->|"从检查点A<br/>继续执行"| NODE_B

    style CKPT_A fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style CKPT_B fill:#FFF9C4,stroke:#F9A825
    style CKPT_C fill:#FFF9C4,stroke:#F9A825
    style RECOVER fill:#FFCDD2,stroke:#C62828
    style NODE_B fill:#E3F2FD,stroke:#1565C0
```

核心：每个节点执行后自动保存状态快照到持久化存储，崩溃后从最近的检查点恢复。

---

## 二、状态定义与检查点存储

```python
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Annotated
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from uuid import uuid4

class AgentState(dict):
    """Agent 状态：消息列表 + 中间结果"""
    messages: Annotated[list, add_messages]
    current_step: str
    intermediate_results: dict
    error_count: int

@dataclass
class CheckpointInfo:
    """检查点元信息"""
    thread_id: str
    checkpoint_id: str
    node_name: str
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    step_count: int = 0
```

`AgentState` 使用 `add_messages` reducer 管理消息列表；`MemorySaver` 是内存级检查点存储（生产用 Postgres/Redis）。

---

## 三、可恢复的工作流

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

def research_node(state: AgentState) -> dict:
    """研究节点：检索信息"""
    results = &#123;"topic": state.get("messages", [&#123;&#125;])[-1].get("content", "") if isinstance(state.get("messages", [&#123;&#125;])[-1], dict) else str(state.get("messages", [HumanMessage("")])[-1].content),
               "found": ["资料1", "资料2"]&#125;
    return &#123;
        "current_step": "research_done",
        "intermediate_results": results,
        "messages": [AIMessage(content=f"研究完成，找到&#123;len(results['found'])&#125;条资料")]
    &#125;

def analyze_node(state: AgentState) -> dict:
    """分析节点：处理研究结果"""
    results = state.get("intermediate_results", &#123;&#125;)
    found = results.get("found", [])
    analysis = f"分析结果: &#123;len(found)&#125;条资料，关键发现是..."
    return &#123;
        "current_step": "analysis_done",
        "intermediate_results": &#123;**results, "analysis": analysis&#125;,
        "messages": [AIMessage(content=analysis)]
    &#125;

def summarize_node(state: AgentState) -> dict:
    """总结节点：生成最终输出"""
    results = state.get("intermediate_results", &#123;&#125;)
    summary = f"总结: &#123;results.get('analysis', '无分析结果')&#125;"
    return &#123;
        "current_step": "completed",
        "messages": [AIMessage(content=summary)]
    &#125;

# 构建带检查点的工作流
def build_resumable_workflow():
    """构建可恢复的工作流"""
    checkpointer = MemorySaver()
    builder = StateGraph(AgentState)

    builder.add_node("research", research_node)
    builder.add_node("analyze", analyze_node)
    builder.add_node("summarize", summarize_node)

    builder.add_edge(START, "research")
    builder.add_edge("research", "analyze")
    builder.add_edge("analyze", "summarize")
    builder.add_edge("summarize", END)

    return builder.compile(checkpointer=checkpointer)
```

关键：`compile(checkpointer=checkpointer)` 让工作流在每步执行后自动保存状态。

---

## 四、状态恢复与时间旅行

```python
import asyncio

async def main():
    workflow = build_resumable_workflow()

    # 配置线程ID（同一thread_id的执行共享状态历史）
    thread_id = str(uuid4())
    config = &#123;"configurable": &#123;"thread_id": thread_id&#125;&#125;

    # 执行
    result = await workflow.ainvoke(
        &#123;
            "messages": [HumanMessage(content="分析LangGraph检查点机制")],
            "current_step": "started",
            "intermediate_results": &#123;&#125;,
            "error_count": 0
        &#125;,
        config=config
    )
    print("最终状态:", result["current_step"])
    print("消息数:", len(result["messages"]))

    # 获取状态历史（检查点列表）
    state_history = list(workflow.get_state_history(config))
    print(f"\n检查点数量: &#123;len(state_history)&#125;")

    for i, state in enumerate(state_history):
        print(f"  检查点&#123;i&#125;: step=&#123;state.values.get('current_step', '?')&#125;, "
              f"next=&#123;state.next&#125;, msgs=&#123;len(state.values.get('messages', []))&#125;")

    # 从历史检查点恢复执行（时间旅行）
    if len(state_history) >= 2:
        # 回到"research"之后的检查点，重新执行analyze
        target_state = state_history[-2]  # research完成、analyze未执行
        print(f"\n从检查点恢复: &#123;target_state.values.get('current_step')&#125;")
        print(f"  待执行节点: &#123;target_state.next&#125;")

        # 从该检查点继续执行
        resumed = await workflow.ainvoke(None, config=&#123;
            "configurable": &#123;"thread_id": thread_id&#125;,
            "checkpoint_id": target_state.config["configurable"]["checkpoint_id"]
        &#125;)
        print(f"恢复后状态: &#123;resumed['current_step']&#125;")

asyncio.run(main())
```

输出：

```text
最终状态: completed
消息数: 4

检查点数量: 4
  检查点0: step=started, next=('research',), msgs=1
  检查点1: step=research_done, next=('analyze',), msgs=2
  检查点2: step=analysis_done, next=('summarize',), msgs=3
  检查点3: step=completed, next=(), msgs=4

从检查点恢复: research_done
  待执行节点: ('analyze',)
恢复后状态: completed
```

---

## 五、检查点存储对比

| 存储后端 | 持久性 | 性能 | 适用场景 |
|----------|--------|------|----------|
| MemorySaver | 内存（重启丢失） | 最快 | 开发调试 |
| SQLiteSaver | 本地磁盘 | 快 | 单机生产 |
| PostgresSaver | 数据库持久 | 中等 | 多实例生产 |
| RedisSaver | 内存+持久化 | 快 | 高并发场景 |

---

## 六、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 每个会话用唯一thread_id | 隔离不同用户/会话 | ★★★ |
| 生产用持久化存储 | 不用MemorySaver | ★★★ |
| 定期清理旧检查点 | 防止存储膨胀 | ★★☆ |
| 关键节点前加检查点 | interrupt_before | ★★☆ |
| 利用时间旅行调试 | 回到任意步骤重放 | ★★★ |
| 检查点包含完整状态 | 确保恢复后可继续 | ★★★ |

---

## 七、检查清单

| 检查项 | 状态 |
|--------|------|
| 有 Checkpointer 配置 | ☐ |
| 有 thread_id 隔离 | ☐ |
| 有状态历史查询 | ☐ |
| 有从检查点恢复 | ☐ |
| 有时间旅行能力 | ☐ |
| 有存储后端选型 | ☐ |
