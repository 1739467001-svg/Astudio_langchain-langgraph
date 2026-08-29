# LangGraph 状态快照与对比

> 在执行过程中随时"拍照"State，对比不同步骤的 State 变化，精确定位问题。

---

## 一、状态快照的价值

```mermaid
graph TB
    subgraph 无快照 &#123;"❌ 无快照"&#125;
        N1["图执行完"] --> N2["只看到最终State"]
        N2 --> N3["不知道中间哪步变了"]
    end

    subgraph 有快照 &#123;"✅ 有快照"&#125;
        S1["每步后拍照"] --> S2["对比Step3 vs Step4"]
        S2 --> S3["精确发现哪步改变了什么"]
    end

    style 无快照 fill:'#FFCDD2'
    style 有快照 fill:'#C8E6C9'
```

## 二、快照实现

```python
import copy
import json
from datetime import datetime
from typing import Any

class StateSnapshotManager:
    """状态快照管理器"""
    def __init__(self):
        self.snapshots: list[dict] = []

    def snapshot(self, state: dict, step: str = "", node_name: str = "") -> str:
        """拍照：保存当前State的副本"""
        snap_id = f"snap_&#123;len(self.snapshots) + 1&#125;"
        self.snapshots.append(&#123;
            "snap_id": snap_id,
            "step": step,
            "node": node_name,
            "timestamp": datetime.now().isoformat(),
            "state": copy.deepcopy(state),
        &#125;)
        return snap_id

    def compare(self, snap_id_1: str, snap_id_2: str) -> dict:
        """对比两个快照"""
        s1 = self._find(snap_id_1)
        s2 = self._find(snap_id_2)
        if not s1 or not s2:
            return &#123;"error": "快照不存在"&#125;

        state1 = s1["state"]
        state2 = s2["state"]

        diff = &#123;"added": &#123;&#125;, "removed": &#123;&#125;, "changed": &#123;&#125;&#125;

        all_keys = set(state1.keys()) | set(state2.keys())
        for key in all_keys:
            if key not in state1:
                diff["added"][key] = state2[key]
            elif key not in state2:
                diff["removed"][key] = state1[key]
            elif state1[key] != state2[key]:
                diff["changed"][key] = &#123;
                    "before": self._truncate(state1[key]),
                    "after": self._truncate(state2[key]),
                &#125;

        return diff

    def _find(self, snap_id: str) -> dict:
        for s in self.snapshots:
            if s["snap_id"] == snap_id:
                return s
        return None

    def _truncate(self, val: Any, max_len: int = 200) -> str:
        s = str(val)
        return s[:max_len] + "..." if len(s) > max_len else s

    def report(self) -> str:
        """生成快照报告"""
        report = "=== 状态快照报告 ===\n"
        for snap in self.snapshots:
            state_keys = list(snap["state"].keys())
            report += f"&#123;snap['snap_id']&#125; [&#123;snap['node']&#125;]: keys=&#123;state_keys&#125;\n"
        return report
```

## 三、在 LangGraph 中使用

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from operator import add

class TrackableState(TypedDict):
    messages: Annotated[list, add]
    question: str
    context: str
    answer: str

snap_mgr = StateSnapshotManager()

def tracked_retrieve(state: TrackableState) -> dict:
    """检索节点（带快照）"""
    snap_mgr.snapshot(state, step="before_retrieve", node="retrieve")
    result = &#123;"context": f"检索结果: &#123;state['question']&#125;"&#125;
    # 拍照：检索后的State
    new_state = &#123;**state, **result&#125;
    snap_mgr.snapshot(new_state, step="after_retrieve", node="retrieve")
    return result

def tracked_answer(state: TrackableState) -> dict:
    """回答节点（带快照）"""
    snap_mgr.snapshot(state, step="before_answer", node="answer")
    result = &#123;"answer": f"回答: &#123;state['context'][:50]&#125;"&#125;
    new_state = &#123;**state, **result&#125;
    snap_mgr.snapshot(new_state, step="after_answer", node="answer")
    return result

# 构建图
graph = StateGraph(TrackableState)
graph.add_node("retrieve", tracked_retrieve)
graph.add_node("answer", tracked_answer)
graph.add_edge(START, "retrieve")
graph.add_edge("retrieve", "answer")
graph.add_edge("answer", END)
app = graph.compile()

# 执行
result = app.invoke(&#123;
    "messages": [], "question": "测试", "context": "", "answer": ""
&#125;)

# 对比快照
diff = snap_mgr.compare("snap_1", "snap_4")
print("Step1→Step4变化:")
for key, change in diff["changed"].items():
    print(f"  &#123;key&#125;: &#123;change['before'][:50]&#125; → &#123;change['after'][:50]&#125;")
```

## 四、与 Checkpointer 的区别

```mermaid
graph TB
    subgraph 对比 &#123;"快照管理器 vs Checkpointer"&#125;
        S1["StateSnapshotManager<br/>手动快照<br/>用于: 调试/对比<br/>粒度: 每个节点前后"]
        S2["Checkpointer<br/>自动持久化<br/>用于: 持久化/恢复<br/>粒度: 每次执行"]
    end

    style S1 fill:'#C8E6C9'
    style S2 fill:'#E3F2FD'
```

## 五、检查清单

| 检查项 | 说明 | 状态 |
|--------|------|------|
| 关键节点前后快照 | 重要步骤前后拍照 | ☐ |
| 快照对比 | 能diff两个快照 | ☐ |
| 快照报告 | 能列出所有快照 | ☐ |
| 快照清理 | 定期清理旧快照 | ☐ |
