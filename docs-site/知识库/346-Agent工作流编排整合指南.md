# Agent 工作流编排整合指南

> 6 篇提及。这篇整合为完整指南——从任务分解到执行编排到异常处理的统一方案。

---

## 一、编排整合架构

```mermaid
graph TB
    subgraph 编排 &#123;"工作流编排"&#125;
        GOAL["目标"] --> DECOMP["任务分解<br/>LLM拆分"]
        DECOMP --> PLAN["执行计划<br/>依赖排序"]
        PLAN --> EXEC["执行<br/>串行/并行/条件"]
        EXEC --> HANDLE["异常处理<br/>重试/降级/升级"]
        HANDLE --> RESULT["结果聚合"]
    end

    style DECOMP fill:#FFF9C4
    style RESULT fill:#C8E6C9
```

---

## 二、实现

```python
import asyncio
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Any

class ExecutionMode(str, Enum):
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    CONDITIONAL = "conditional"

@dataclass
class WorkflowStep:
    """工作流步骤。"""
    id: str
    name: str
    handler: Callable
    mode: ExecutionMode = ExecutionMode.SEQUENTIAL
    depends_on: list[str] = field(default_factory=list)
    condition: Callable = None
    timeout: int = 30
    max_retries: int = 2
    result: Any = None
    status: str = "pending"

class WorkflowOrchestrator:
    """工作流编排器——整合任务分解+执行+异常处理。"""

    def __init__(self):
        self.steps: dict[str, WorkflowStep] = &#123;&#125;
        self.results: dict[str, Any] = &#123;&#125;
        self.execution_log: list[dict] = []

    def add_step(self, step: WorkflowStep):
        self.steps[step.id] = step

    async def execute(self) -> dict:
        """执行工作流。"""
        # 1. 拓扑排序
        ordered = self._topological_sort()

        # 2. 按层执行
        for layer in ordered:
            await self._execute_layer(layer)

        return &#123;
            "total": len(self.steps),
            "succeeded": sum(1 for s in self.steps.values() if s.status == "done"),
            "failed": sum(1 for s in self.steps.values() if s.status == "failed"),
            "results": self.results,
        &#125;

    def _topological_sort(self) -> list[list[str]]:
        """拓扑排序。"""
        layers = []
        remaining = dict(self.steps)
        completed = set()

        while remaining:
            layer = [
                sid for sid, s in remaining.items()
                if all(d in completed for d in s.depends_on)
            ]
            if not layer:
                break
            layers.append(layer)
            for sid in layer:
                completed.add(sid)
                del remaining[sid]
        return layers

    async def _execute_layer(self, layer: list[str]):
        """执行一层（并行）。"""
        async def run_one(step_id: str):
            step = self.steps[step_id]

            # 条件检查
            if step.mode == ExecutionMode.CONDITIONAL and step.condition:
                if not step.condition(self.results):
                    step.status = "skipped"
                    return

            # 执行+重试
            for attempt in range(step.max_retries + 1):
                try:
                    result = await asyncio.wait_for(
                        step.handler(self.results),
                        timeout=step.timeout,
                    )
                    step.result = result
                    step.status = "done"
                    self.results[step_id] = result
                    self.execution_log.append(&#123;"step": step_id, "status": "done"&#125;)
                    return
                except Exception as e:
                    self.execution_log.append(&#123;"step": step_id, "status": "retry", "attempt": attempt + 1, "error": str(e)[:100]&#125;)

            step.status = "failed"
            self.execution_log.append(&#123;"step": step_id, "status": "failed"&#125;)

        await asyncio.gather(*[run_one(sid) for sid in layer])

    def summary(self) -> dict:
        return &#123;
            "steps": len(self.steps),
            "done": sum(1 for s in self.steps.values() if s.status == "done"),
            "failed": sum(1 for s in self.steps.values() if s.status == "failed"),
            "skipped": sum(1 for s in self.steps.values() if s.status == "skipped"),
            "log_size": len(self.execution_log),
        &#125;
```

---

## 三、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 拓扑排序分层 | 无依赖并行 | ★★★ |
| 条件执行 | 按条件跳过 | ★★☆ |
| 重试机制 | 单步失败可重试 | ★★★ |
| 执行日志 | 可追溯 | ★★☆ |

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有编排器 | ☐ |
| 有拓扑排序 | ☐ |
| 有异常处理 | ☐ |
