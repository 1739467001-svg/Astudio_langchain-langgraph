# Agent 编排引擎设计

> 之前完全空白（0 mentions）。这篇讲透——如何设计一个通用的 Agent 编排引擎，支持动态任务分配、条件路由和并行执行。

---

## 一、编排引擎架构

```mermaid
graph TB
    subgraph 引擎 &#123;"编排引擎"&#125;
        INPUT["任务输入"] --> DECOMPOSE["任务分解"]
        DECOMPOSE --> SCHEDULE["调度器<br/>依赖排序+优先级"]
        SCHEDULE --> EXEC["执行器<br/>串行/并行/条件"]
        EXEC --> MONITOR["监控器<br/>进度+异常"]
        MONITOR --> OUTPUT["结果聚合"]
    end

    style SCHEDULE fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style OUTPUT fill:#C8E6C9
```

---

## 二、实现

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Any
import asyncio

class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"

@dataclass
class Task:
    """编排任务。"""
    id: str
    name: str
    handler: Callable
    depends_on: list[str] = field(default_factory=list)
    priority: int = 1  # 0=高 1=中 2=低
    status: TaskStatus = TaskStatus.PENDING
    result: Any = None
    error: str = ""

@dataclass
class OrchestrationConfig:
    """编排配置。"""
    max_parallel: int = 5
    timeout_per_task: int = 30
    max_retries: int = 2

class OrchestrationEngine:
    """Agent编排引擎。

    核心能力：
    1. 任务分解——一个大任务拆为多个子任务
    2. 依赖排序——按依赖关系确定执行顺序
    3. 并行执行——无依赖任务并行
    4. 异常处理——失败重试+降级
    5. 结果聚合——合并所有子任务结果
    """

    def __init__(self, config: OrchestrationConfig = OrchestrationConfig()):
        self.config = config
        self.tasks: dict[str, Task] = &#123;&#125;
        self.results: dict[str, Any] = &#123;&#125;

    def add_task(self, task: Task):
        """添加任务。"""
        self.tasks[task.id] = task

    async def execute(self) -> dict:
        """执行编排。"""
        # 1. 拓扑排序——按依赖关系分层
        layers = self._topological_sort()

        # 2. 按层执行（同层并行）
        for layer in layers:
            await self._execute_layer(layer)

        return &#123;
            "total": len(self.tasks),
            "succeeded": sum(1 for t in self.tasks.values() if t.status == TaskStatus.DONE),
            "failed": sum(1 for t in self.tasks.values() if t.status == TaskStatus.FAILED),
            "results": self.results,
        &#125;

    def _topological_sort(self) -> list[list[str]]:
        """拓扑排序——返回分层列表，同层可并行。"""
        layers = []
        remaining = dict(self.tasks)
        completed = set()

        while remaining:
            # 找出无依赖（或依赖已完成）的任务
            layer = [
                tid for tid, t in remaining.items()
                if all(d in completed for d in t.depends_on)
            ]
            if not layer:
                # 循环依赖
                break

            # 按优先级排序
            layer.sort(key=lambda tid: self.tasks[tid].priority)
            layers.append(layer)

            for tid in layer:
                completed.add(tid)
                del remaining[tid]

        return layers

    async def _execute_layer(self, layer: list[str]):
        """执行一层任务（并行）。"""
        semaphore = asyncio.Semaphore(self.config.max_parallel)

        async def run_one(task_id: str):
            async with semaphore:
                task = self.tasks[task_id]

                for attempt in range(self.config.max_retries + 1):
                    try:
                        result = await asyncio.wait_for(
                            task.handler(self.results),
                            timeout=self.config.timeout_per_task,
                        )
                        task.result = result
                        task.status = TaskStatus.DONE
                        self.results[task_id] = result
                        return
                    except Exception as e:
                        task.error = str(e)[:200]

                task.status = TaskStatus.FAILED

        await asyncio.gather(*[run_one(tid) for tid in layer])

    def status(self) -> dict:
        """编排状态。"""
        return &#123;
            "total": len(self.tasks),
            "done": sum(1 for t in self.tasks.values() if t.status == TaskStatus.DONE),
            "running": sum(1 for t in self.tasks.values() if t.status == TaskStatus.RUNNING),
            "failed": sum(1 for t in self.tasks.values() if t.status == TaskStatus.FAILED),
        &#125;
```

---

## 三、使用示例

```python
# 创建编排引擎
engine = OrchestrationEngine()

# 添加任务（含依赖关系）
engine.add_task(Task(
    id="collect", name="数据收集",
    handler=lambda ctx: &#123;"data": "收集完成"&#125;,
    priority=0,  # 最高优先级
))
engine.add_task(Task(
    id="analyze", name="数据分析",
    handler=lambda ctx: &#123;"analysis": f"分析&#123;ctx.get('collect', &#123;&#125;).get('data', '')&#125;"&#125;,
    depends_on=["collect"],  # 依赖collect完成
))
engine.add_task(Task(
    id="translate", name="翻译",
    handler=lambda ctx: &#123;"translation": "翻译完成"&#125;,
    depends_on=["analyze"],
))
engine.add_task(Task(
    id="report", name="生成报告",
    handler=lambda ctx: &#123;"report": f"报告: &#123;ctx.get('analyze', &#123;&#125;).get('analysis', '')&#125;"&#125;,
    depends_on=["translate"],
))

# 执行
result = await engine.execute()
```

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 拓扑排序分层 | 无依赖并行 | ★★★ |
| 限制并行数 | 防资源耗尽 | ★★★ |
| 有重试机制 | 单个失败不阻断 | ★★★ |
| 优先级排序 | 高优先先执行 | ★★☆ |
| 结果传递 | 前任务结果可被后任务使用 | ★★★ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有编排引擎 | ☐ |
| 有拓扑排序 | ☐ |
| 有并行执行 | ☐ |
