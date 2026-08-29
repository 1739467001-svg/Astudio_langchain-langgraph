# Agent 工具调用成本归因最新

> 知识库 105 仅 170 行。这篇讲透——每次工具调用的成本追踪、按用户/工具/任务归因和成本报告。

---

## 一、成本归因架构

```mermaid
graph TB
    subgraph 归因 {"成本归因"}
        T["工具调用"] --> TRACK["成本追踪<br/>Token+费用"]
        TRACK --> ATTR["归因<br/>按用户/工具/任务"]
        ATTR --> REPORT["成本报告"]
    end

    style TRACK fill:#FFF9C4
    style REPORT fill:#C8E6C9
```

---

## 二、实现

```python
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict

@dataclass
class CostRecord:
    """成本记录。"""
    timestamp: str
    user_id: str
    tool_name: str
    task_id: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float

PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
}

class CostAttributionTracker:
    """成本归因追踪器。"""

    def __init__(self):
        self.records: list[CostRecord] = []

    def record(self, user_id: str, tool_name: str, task_id: str,
               model: str, input_tokens: int, output_tokens: int):
        """记录一次工具调用的成本。"""
        pricing = PRICING.get(model, PRICING["gpt-4o-mini"])
        cost = (input_tokens / 1e6 * pricing["input"]) + (output_tokens / 1e6 * pricing["output"])

        self.records.append(CostRecord(
            timestamp=datetime.now().isoformat(),
            user_id=user_id, tool_name=tool_name, task_id=task_id,
            model=model, input_tokens=input_tokens, output_tokens=output_tokens,
            cost_usd=round(cost, 6),
        ))

    def by_user(self, user_id: str) -> dict:
        """按用户归因。"""
        user_records = [r for r in self.records if r.user_id == user_id]
        total_cost = sum(r.cost_usd for r in user_records)
        return {
            "user_id": user_id,
            "total_cost": round(total_cost, 4),
            "total_calls": len(user_records),
            "cost_per_call": round(total_cost / max(len(user_records), 1), 6),
        }

    def by_tool(self) -> dict:
        """按工具归因。"""
        tool_costs = defaultdict(lambda: {"cost": 0, "calls": 0, "tokens": 0})
        for r in self.records:
            tool_costs[r.tool_name]["cost"] += r.cost_usd
            tool_costs[r.tool_name]["calls"] += 1
            tool_costs[r.tool_name]["tokens"] += r.input_tokens + r.output_tokens
        return {k: {**v, "cost": round(v["cost"], 4)} for k, v in tool_costs.items()}

    def summary(self) -> dict:
        """成本摘要。"""
        total = sum(r.cost_usd for r in self.records)
        return {
            "total_records": len(self.records),
            "total_cost_usd": round(total, 4),
            "avg_cost_per_call": round(total / max(len(self.records), 1), 6),
            "by_tool": self.by_tool(),
        }
```

---

## 三、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 每次工具调用记录成本 | 可追溯 | ★★★ |
| 按用户/工具/任务归因 | 知道钱花在哪 | ★★★ |
| 有成本报告 | 定期审查 | ★★☆ |

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有成本追踪器 | ☐ |
| 有归因分析 | ☐ |
