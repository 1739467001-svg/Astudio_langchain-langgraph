# Agent 任务分解与分布式执行指南

> 复杂任务需要拆分——"写一份市场分析报告"→收集数据+分析+写结论。拆分后可并行执行。本指南讲解任务分解策略、依赖图构建、并行执行、结果聚合。

---

## 1. 任务分解架构

```mermaid
graph TB
    TASK["复杂任务"] --> DECOMP["分解"]
    DECOMP --> S1["子任务1<br/>收集数据"]
    DECOMP --> S2["子任务2<br/>市场分析"]
    DECOMP --> S3["子任务3<br/>竞争分析"]
    S1 --> S2
    S1 --> S3
    S2 --> MERGE["聚合"]
    S3 --> MERGE
    MERGE --> FINAL["最终报告"]

    style DECOMP fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style MERGE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 分解与执行

```python
@dataclass
class TaskDecomposer:
    """任务分解器"""

    async def decompose(self, task: str, complexity: str = "medium") -> dict:
        """分解任务"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""分解复杂任务。

任务: &#123;task&#125;
复杂度: &#123;complexity&#125;

输出 JSON:
&#123;&#123;
    "subtasks": [
        &#123;&#123;"id": "s1", "name": "...", "description": "...", "depends_on": [], "estimated_minutes": 5, "can_parallel": true&#125;&#125;
    ],
    "dependency_graph": &#123;&#123;"s1": [], "s2": ["s1"]&#125;&#125;,
    "parallel_groups": [["s1"], ["s2", "s3"]],
    "total_estimated_minutes": 30
&#125;&#125;""")

        return json.loads(response.content)

    async def execute_distributed(self, plan: dict, executor_agents: list) -> dict:
        """分布式执行"""
        results = &#123;&#125;
        parallel_groups = plan.get("parallel_groups", [])

        for group in parallel_groups:
            # 并行执行同组任务
            tasks = []
            for task_id in group:
                task_def = next(t for t in plan["subtasks"] if t["id"] == task_id)
                agent = executor_agents[len(results) % len(executor_agents)]
                tasks.append(self._execute_task(task_def, agent, results))

            group_results = await asyncio.gather(*tasks)
            for task_id, result in zip(group, group_results):
                results[task_id] = result

        return &#123;"results": results, "completed": len(results)&#125;

    async def aggregate(self, results: dict, original_task: str) -> str:
        """聚合结果"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.5)
        response = await llm.ainvoke(f"综合以下子任务结果，完成原始任务：&#123;original_task&#125;\n\n结果：&#123;json.dumps(results, ensure_ascii=False)[:2000]&#125;")
        return response.content

    async def _execute_task(self, task_def: dict, agent, prior_results: dict) -> str:
        """执行单个子任务"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
        context = json.dumps(&#123;k: v[:200] for k, v in prior_results.items()&#125;) if prior_results else "无"
        response = await llm.ainvoke(f"执行任务: &#123;task_def['name']&#125;\n描述: &#123;task_def['description']&#125;\n前序结果: &#123;context&#125;")
        return response.content
```

---

## 3. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了任务分解 | ☐ |
| 构建了依赖图 | ☐ |
| 实现了并行执行 | ☐ |
| 实现了结果聚合 | ☐ |

---

## 4. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 170 | Agent 任务分解策略 | 分解 |
| 357 | Agent 目标分解 | 分解 |
| 387 | Agent 目标分解与任务规划 | 规划 |
| 466 | DAG 编排引擎 | DAG |
