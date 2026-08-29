# LangGraph 状态快照与时间旅行指南

> Agent 执行到第 5 步发现第 2 步就走错了——能不能回到第 2 步重新来？LangGraph 的 Checkpointer 天然支持状态快照。这篇指南讲透状态快照、历史回溯和时间旅行调试。

---

## 一、时间旅行架构

```mermaid
graph TB
    S0["Step0: 初始状态"] --> S1["Step1: 工具A<br/>state=&#123;data: 'hello'&#125;"]
    S1 --> S2["Step2: 工具B<br/>state=&#123;data: 'world'&#125;"]
    S2 --> S3["Step3: 工具C<br/>state=&#123;data: 'error!'&#125;"]

    S3 -->|"发现问题"| TRAVEL&#123;"时间旅行<br/>回到Step1"&#125;
    TRAVEL --> S1B["Step1(副本):<br/>修改data='fixed'"]
    S1B --> S2B["Step2(新): 重新执行"]
    S2B --> S3B["Step3(新): 正确结果"]

    style TRAVEL fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style S3 fill:#FFCDD2,stroke:#C62828
    style S3B fill:#C8E6C9
```

LangGraph 的每个 checkpoint 都是一个完整状态快照。你可以列出所有快照、查看任意快照的状态、从任意快照分叉重新执行——这就是"时间旅行"。

---

## 二、状态快照操作

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from typing import TypedDict, Annotated
from langchain_openai import ChatOpenAI
import json

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

class WorkflowState(TypedDict):
    query: str
    step1_result: str
    step2_result: str
    step3_result: str
    logs: list[str]

def step1_search(state: WorkflowState) -> WorkflowState:
    state["step1_result"] = f"搜索结果: &#123;state['query']&#125;"
    state["logs"].append(f"Step1完成: 搜索了'&#123;state['query']&#125;'")
    return state

def step2_analyze(state: WorkflowState) -> WorkflowState:
    data = state.get("step1_result", "")
    state["step2_result"] = f"分析: &#123;data[:30]&#125;..."
    state["logs"].append(f"Step2完成: 分析了数据")
    return state

def step3_report(state: WorkflowState) -> WorkflowState:
    analysis = state.get("step2_result", "")
    state["step3_result"] = f"报告: &#123;analysis&#125;"
    state["logs"].append("Step3完成: 生成报告")
    return state

# 构建——必须使用 checkpointer
checkpointer = MemorySaver()
builder = StateGraph(WorkflowState)
builder.add_node("search", step1_search)
builder.add_node("analyze", step2_analyze)
builder.add_node("report", step3_report)
builder.add_edge(START, "search")
builder.add_edge("search", "analyze")
builder.add_edge("analyze", "report")
builder.add_edge("report", END)

graph = builder.compile(checkpointer=checkpointer)
```

### 快照操作 API

```python
import asyncio

async def main():
    config = &#123;"configurable": &#123;"thread_id": "thread-001"&#125;&#125;

    # 1. 正常执行
    result = await graph.ainvoke(
        &#123;"query": "LangGraph是什么", "step1_result": "", "step2_result": "", "step3_result": "", "logs": []&#125;,
        config=config,
    )
    print("最终结果:", result["step3_result"])

    # 2. 查看所有状态快照
    snapshots = []
    for snapshot in graph.get_state_history(config):
        snapshots.append(&#123;
            "config": snapshot.config,
            "values": snapshot.values,
            "next": snapshot.next,
            "step": len(snapshot.values.get("logs", [])),
        &#125;)

    print(f"\n共 &#123;len(snapshots)&#125; 个快照:")
    for s in reversed(snapshots):
        print(f"  Step &#123;s['step']&#125;: next=&#123;s['next']&#125;, logs=&#123;s['values'].get('logs', [])&#125;")

    # 3. 时间旅行——回到Step1
    step1_snapshot = [s for s in snapshots if s["step"] == 1][-1]

    # 从Step1重新开始（修改状态后重新执行）
    for snapshot in graph.get_state_history(config):
        if len(snapshot.values.get("logs", [])) == 1:
            # 回到这个快照，修改状态
            graph.update_state(
                snapshot.config,
                &#123;"query": "LangChain是什么（修改后）"&#125;,
            )
            # 从这里继续执行
            result2 = await graph.ainvoke(None, config=snapshot.config)
            print("\n时间旅行结果:", result2["step3_result"])
            break

asyncio.run(main())
```

---

## 三、快照管理器封装

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class SnapshotInfo:
    """快照信息。"""
    config: dict
    step: int
    state: dict
    next_nodes: list[str]
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

class SnapshotManager:
    """快照管理器——封装常用操作。"""

    def __init__(self, graph, checkpointer):
        self.graph = graph
        self.checkpointer = checkpointer

    def list_snapshots(self, thread_id: str) -> list[SnapshotInfo]:
        """列出所有快照。"""
        config = &#123;"configurable": &#123;"thread_id": thread_id&#125;&#125;
        snapshots = []
        for snapshot in self.graph.get_state_history(config):
            snapshots.append(SnapshotInfo(
                config=snapshot.config,
                step=len(snapshot.values.get("logs", [])),
                state=snapshot.values,
                next_nodes=list(snapshot.next) if snapshot.next else [],
            ))
        return snapshots

    def get_snapshot_at_step(self, thread_id: str, step: int) -> SnapshotInfo:
        """获取指定步骤的快照。"""
        snapshots = self.list_snapshots(thread_id)
        for s in snapshots:
            if s.step == step:
                return s
        return None

    def compare_snapshots(self, snap1: SnapshotInfo, snap2: SnapshotInfo) -> dict:
        """对比两个快照。"""
        diffs = &#123;&#125;
        all_keys = set(snap1.state.keys()) | set(snap2.state.keys())
        for key in all_keys:
            v1 = snap1.state.get(key)
            v2 = snap2.state.get(key)
            if v1 != v2:
                diffs[key] = &#123;"before": str(v1)[:100], "after": str(v2)[:100]&#125;
        return &#123;
            "step1": snap1.step,
            "step2": snap2.step,
            "diff_count": len(diffs),
            "diffs": diffs,
        &#125;

    async def replay_from(self, snapshot: SnapshotInfo, state_update: dict = None) -> dict:
        """从指定快照重新执行。"""
        if state_update:
            self.graph.update_state(snapshot.config, state_update)
        return await self.graph.ainvoke(None, config=snapshot.config)
```

---

## 四、时间旅行调试场景

| 场景 | 操作 | 价值 |
|------|------|------|
| 定位错误步骤 | 逐步快照对比 | 找到状态首次出错的位置 |
| 重跑修正 | 回到出错前+修改状态 | 不用从头跑 |
| A/B分支 | 同一快照+不同输入 | 对比不同路径结果 |
| 状态审查 | 查看任意步骤的完整状态 | 理解Agent决策过程 |
| 回归测试 | 固定快照+重跑 | 验证代码变更不影响 |

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 必须用checkpointer | MemorySaver或PostgresSaver | ★★★ |
| thread_id隔离 | 每次执行用独立thread_id | ★★★ |
| 关键步骤打快照 | 重要决策点保存 | ★★☆ |
| 快照对比定位 | 找到状态首次异常的步骤 | ★★★ |
| 生产用持久化 | MemorySaver重启丢失 | ★★★ |
| 不要无限保留 | 定期清理旧快照 | ★☆☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 有checkpointer | ☐ |
| 可列出所有快照 | ☐ |
| 可查看任意快照状态 | ☐ |
| 可从快照重新执行 | ☐ |
| 可修改状态后重跑 | ☐ |
| 有快照对比 | ☐ |
