# Agent 知识管理与组织记忆

> Agent 每次执行完就忘了——下次遇到类似问题从零开始。如果 Agent 能记住"上次怎么解决的"、"用户偏好什么"、"哪些方案失败了"，效率会大幅提升。这份指南覆盖组织记忆的构建和管理。

---

## 一、组织记忆的三个层次

```mermaid
graph TB
    subgraph 记忆 {"组织记忆三层"}
        L1["第1层: 操作记忆<br/>工具调用模式<br/>什么情况用什么工具"]
        L2["第2层: 决策记忆<br/>成功/失败的方案<br/>什么策略有效"]
        L3["第3层: 领域记忆<br/>领域知识积累<br/>什么概念有什么含义"]
    end

    style 记忆 fill:#E3F2FD
    style L1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、操作记忆：工具调用模式

```python
from dataclasses import dataclass, field
from collections import defaultdict, Counter
from datetime import datetime
import json

@dataclass
class ToolUsageRecord:
    """工具使用记录。"""
    task_type: str          # 任务类型
    tool_name: str          # 使用的工具
    success: bool           # 是否成功
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

class OperationalMemory:
    """操作记忆：记录工具调用模式。

    积累"什么类型的问题用什么工具解决最好"的经验。
    """

    def __init__(self):
        self.records: list[ToolUsageRecord] = []

    def record(self, task_type: str, tool_name: str, success: bool):
        """记录工具使用。"""
        self.records.append(ToolUsageRecord(
            task_type=task_type, tool_name=tool_name, success=success,
        ))

    def get_best_tool(self, task_type: str) -> str | None:
        """根据历史经验推荐最佳工具。"""
        type_records = [r for r in self.records if r.task_type == task_type]
        if not type_records:
            return None

        # 统计每种工具的成功率
        tool_stats = defaultdict(lambda: {"total": 0, "success": 0})
        for r in type_records:
            tool_stats[r.tool_name]["total"] += 1
            if r.success:
                tool_stats[r.tool_name]["success"] += 1

        # 按成功率排序
        best = max(
            tool_stats.items(),
            key=lambda x: x[1]["success"] / x[1]["total"] if x[1]["total"] > 0 else 0,
        )
        return best[0] if best[1]["success"] / max(best[1]["total"], 1) > 0.5 else None

    def get_tool_stats(self) -> dict:
        """获取工具使用统计。"""
        stats = defaultdict(lambda: {"total": 0, "success": 0})
        for r in self.records:
            stats[r.tool_name]["total"] += 1
            if r.success:
                stats[r.tool_name]["success"] += 1

        return {
            tool: {
                "total": s["total"],
                "success": s["success"],
                "success_rate": round(s["success"] / s["total"], 4) if s["total"] > 0 else 0,
            }
            for tool, s in stats.items()
        }
```

---

## 三、决策记忆：成功/失败方案

```python
@dataclass
class DecisionRecord:
    """决策记忆记录。"""
    task: str
    approach: str          # 采取的方案
    outcome: str           # "success" / "failure" / "partial"
    lesson: str = ""       # 经验教训
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

class DecisionMemory:
    """决策记忆：记录什么策略有效。

    当遇到类似任务时，可以回忆过去的成功方案。
    """

    def __init__(self):
        self.records: list[DecisionRecord] = []

    def record_success(self, task: str, approach: str, lesson: str = ""):
        """记录成功方案。"""
        self.records.append(DecisionRecord(
            task=task, approach=approach, outcome="success", lesson=lesson,
        ))

    def record_failure(self, task: str, approach: str, lesson: str = ""):
        """记录失败方案。"""
        self.records.append(DecisionRecord(
            task=task, approach=approach, outcome="failure", lesson=lesson,
        ))

    def recall_successes(self, task: str, limit: int = 3) -> list[DecisionRecord]:
        """回忆类似任务的成功方案。"""
        successes = [r for r in self.records if r.outcome == "success"]
        # 简化：关键词匹配
        matches = [r for r in successes if any(w in r.task for w in task.split())]
        return matches[:limit]

    def recall_failures(self, task: str, limit: int = 3) -> list[DecisionRecord]:
        """回忆类似任务的失败方案（避免重蹈覆辙）。"""
        failures = [r for r in self.records if r.outcome == "failure"]
        matches = [r for r in failures if any(w in r.task for w in task.split())]
        return matches[:limit]

    def get_lessons(self) -> list[str]:
        """获取所有经验教训。"""
        return [r.lesson for r in self.records if r.lesson]
```

---

## 四、领域记忆：知识积累

```python
class DomainMemory:
    """领域记忆：积累领域知识。

    Agent在执行过程中学到的领域知识，
    如"用户行业术语映射""常见问题答案"等。
    """

    def __init__(self):
        self.facts: dict[str, str] = {}       # 事实知识
        self.faqs: dict[str, str] = {}        # 常见问答
        self.terminology: dict[str, str] = {}  # 术语映射

    def add_fact(self, key: str, value: str):
        """添加事实知识。"""
        self.facts[key] = value

    def add_faq(self, question: str, answer: str):
        """添加常见问答。"""
        self.faqs[question] = answer

    def add_term(self, term: str, definition: str):
        """添加术语。"""
        self.terminology[term] = definition

    def get_context_for_prompt(self, query: str = "") -> str:
        """为Prompt提供领域知识上下文。"""
        lines = []

        # 相关FAQ
        relevant_faqs = [
            (q, a) for q, a in self.faqs.items()
            if any(w in q for w in query.split())
        ]
        if relevant_faqs:
            lines.append("## 相关FAQ")
            for q, a in relevant_faqs[:3]:
                lines.append(f"Q: {q}\nA: {a}")

        # 相关术语
        relevant_terms = [
            (t, d) for t, d in self.terminology.items()
            if t in query
        ]
        if relevant_terms:
            lines.append("## 术语参考")
            for t, d in relevant_terms:
                lines.append(f"- {t}: {d}")

        return "\n\n".join(lines)
```

---

## 五、组织记忆整合

```mermaid
graph TB
    subgraph 整合 {"组织记忆系统"}
        TASK["新任务"] --> CHECK_OP["查操作记忆<br/>推荐工具"]
        TASK --> CHECK_DEC["查决策记忆<br/>参考成功方案"]
        TASK --> CHECK_DOM["查领域记忆<br/>提供知识上下文"]
        CHECK_OP & CHECK_DEC & CHECK_DOM --> EXECUTE["执行任务"]
        EXECUTE --> LEARN["学习<br/>记录结果"]
        LEARN --> CHECK_OP
    end

    style 整合 fill:#E3F2FD
    style LEARN fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

```python
class OrganizationalMemory:
    """组织记忆系统：整合三层记忆。"""

    def __init__(self):
        self.operational = OperationalMemory()
        self.decision = DecisionMemory()
        self.domain = DomainMemory()

    def get_context_for_task(self, task: str) -> dict:
        """为新任务提供记忆上下文。"""
        # 推荐工具
        best_tool = self.operational.get_best_tool(task)

        # 回忆成功方案
        successes = self.decision.recall_successes(task)

        # 回忆失败方案
        failures = self.decision.recall_failures(task)

        # 领域知识
        domain_context = self.domain.get_context_for_prompt(task)

        return {
            "recommended_tool": best_tool,
            "past_successes": [
                {"approach": s.approach, "lesson": s.lesson}
                for s in successes
            ],
            "past_failures": [
                {"approach": f.approach, "lesson": f.lesson}
                for f in failures
            ],
            "domain_context": domain_context,
        }

    def learn_from_execution(
        self,
        task: str,
        tool_used: str,
        approach: str,
        success: bool,
        lesson: str = "",
    ):
        """从执行中学习。"""
        # 记录工具使用
        self.operational.record(task, tool_used, success)

        # 记录决策
        if success:
            self.decision.record_success(task, approach, lesson)
        else:
            self.decision.record_failure(task, approach, lesson)

    def stats(self) -> dict:
        """记忆统计。"""
        return {
            "tool_usage": self.operational.get_tool_stats(),
            "total_decisions": len(self.decision.records),
            "total_facts": len(self.domain.facts),
            "total_faqs": len(self.domain.faqs),
            "total_terms": len(self.domain.terminology),
        }
```

---

## 六、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 每次执行后学习 | 积累经验 | ★★★ |
| 成功和失败都记录 | 失败教训同样重要 | ★★★ |
| 领域知识注入Prompt | 提升回答质量 | ★★☆ |
| 定期清理过时记忆 | 防止误导 | ★★☆ |
| 记忆要有版本管理 | 可追溯 | ★☆☆ |

---

## 七、检查清单

| 检查项 | 状态 |
|--------|------|
| 有操作记忆 | ☐ |
| 有决策记忆 | ☐ |
| 有领域记忆 | ☐ |
| 有整合系统 | ☐ |
| 有学习机制 | ☐ |
