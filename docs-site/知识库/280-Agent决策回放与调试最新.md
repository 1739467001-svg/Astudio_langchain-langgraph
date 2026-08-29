# Agent 决策回放与调试最新

> 知识库 88 有 234 行。这篇讲透——执行轨迹记录、回放和断点调试。

---

## 一、回放架构

```mermaid
graph TB
    subgraph 回放 &#123;"决策回放流程"&#125;
        TRACE["记录执行轨迹<br/>每步State快照"] --> SAVE["保存到检查点"]
        SAVE --> REPLAY["回放: 从任意步骤重放"]
        REPLAY --> MODIFY["修改State"]
        MODIFY --> RERUN["从修改点重新执行"]
    end

    style REPLAY fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style RERUN fill:#C8E6C9
```

---

## 二、实现

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

@dataclass
class TraceStep:
    """执行轨迹步骤。"""
    step: int
    node: str
    input_state: dict
    output_state: dict
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

class ExecutionTracer:
    """执行轨迹记录器。"""

    def __init__(self):
        self.steps: list[TraceStep] = []

    def record(self, node: str, input_state: dict, output_state: dict):
        self.steps.append(TraceStep(
            step=len(self.steps) + 1,
            node=node,
            input_state=&#123;k: str(v)[:100] for k, v in input_state.items()&#125;,
            output_state=&#123;k: str(v)[:100] for k, v in output_state.items()&#125;,
        ))

    def get_trace_text(self) -> str:
        """生成可读轨迹。"""
        lines = []
        for s in self.steps:
            lines.append(f"步骤&#123;s.step&#125; [&#123;s.node&#125;]: &#123;s.input_state&#125; → &#123;s.output_state&#125;")
        return "\n".join(lines)

    def replay_from(self, step: int) -> list[TraceStep]:
        """从指定步骤回放。"""
        return [s for s in self.steps if s.step >= step]


class DebugSession:
    """调试会话——断点+检查+修改。"""

    def __init__(self, tracer: ExecutionTracer):
        self.tracer = tracer
        self.breakpoints: set[int] = set()  # 步骤号断点

    def set_breakpoint(self, step: int):
        """设置断点。"""
        self.breakpoints.add(step)

    def inspect_state(self, step: int) -> dict:
        """检查某步状态。"""
        if 0 < step <= len(self.tracer.steps):
            return self.tracer.steps[step - 1].output_state
        return &#123;&#125;

    def modify_state(self, step: int, updates: dict) -> dict:
        """修改某步状态（用于调试）。"""
        if 0 < step <= len(self.tracer.steps):
            self.tracer.steps[step - 1].output_state.update(updates)
            return self.tracer.steps[step - 1].output_state
        return &#123;&#125;
```

---

## 三、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 每步记录State快照 | 可回放 | ★★★ |
| 支持断点调试 | 暂停检查 | ★★☆ |
| 支持状态修改 | 回到出错点修改 | ★★☆ |
| 轨迹文本可读 | 便于人工检查 | ★★☆ |

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有轨迹记录器 | ☐ |
| 有调试会话 | ☐ |
