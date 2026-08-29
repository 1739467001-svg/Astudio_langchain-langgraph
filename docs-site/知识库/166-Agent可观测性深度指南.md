# Agent 可观测性深度指南

> 通用 LLM 可观测性（知识库 123）关注指标和追踪。Agent 可观测性更复杂——需要追踪推理链、工具决策、状态变化和循环行为。这份指南聚焦 Agent 特有的可观测性需求。

---

## 一、Agent 可观测性的独特需求

```mermaid
graph TB
    subgraph 通用LLM &#123;"通用LLM可观测性"&#125;
        L1["调用延迟"]
        L2["Token消耗"]
        L3["错误率"]
    end

    subgraph Agent特有 &#123;"Agent特有可观测性"&#125;
        A1["推理链追踪<br/>每步Thought→Action→Observation"]
        A2["工具决策审计<br/>为什么选这个工具"]
        A3["状态变化记录<br/>State在每步的变化"]
        A4["循环检测<br/>是否陷入死循环"]
        A5["多Agent通信<br/>Agent间消息传递"]
    end

    style 通用LLM fill:#E3F2FD
    style Agent特有 fill:#FFF3E0,stroke:#E65100,stroke-width:3px
```

---

## 二、推理链追踪

```mermaid
graph TB
    subgraph 追踪 &#123;"Agent推理链追踪"&#125;
        S1["步骤1<br/>Thought: 需要搜索<br/>Action: search('RAG')<br/>Observation: 结果..."]
        S2["步骤2<br/>Thought: 需要总结<br/>Action: summarize()<br/>Observation: 总结..."]
        S3["步骤3<br/>Thought: 可以回答<br/>Final: 答案..."]
        S1 --> S2 --> S3
    end

    style S1 fill:#E3F2FD
    style S2 fill:#FFF9C4
    style S3 fill:#C8E6C9
```

```python
from dataclasses import dataclass, field
from typing import Any
import time

@dataclass
class AgentTraceStep:
    """Agent单步追踪。"""
    step: int
    thought: str = ""              # LLM的推理
    action: str = ""               # 选择的工具
    action_input: dict = field(default_factory=dict)  # 工具参数
    observation: str = ""          # 工具返回
    duration_ms: float = 0
    timestamp: str = field(default_factory=lambda: str(time.time()))

@dataclass
class AgentTrace:
    """完整Agent执行追踪。"""
    task: str
    steps: list[AgentTraceStep] = field(default_factory=list)
    final_answer: str = ""
    total_duration_ms: float = 0
    total_tokens: int = 0
    loop_detected: bool = False

    def add_step(self, step: AgentTraceStep):
        self.steps.append(step)
        # 检测循环：连续3次相同action+input
        if len(self.steps) >= 3:
            recent = self.steps[-3:]
            if all(s.action == recent[0].action and s.action_input == recent[0].action_input for s in recent):
                self.loop_detected = True

    def summary(self) -> dict:
        return &#123;
            "task": self.task,
            "total_steps": len(self.steps),
            "total_tokens": self.total_tokens,
            "duration_ms": self.total_duration_ms,
            "loop_detected": self.loop_detected,
            "tools_used": list(set(s.action for s in self.steps)),
            "avg_step_duration": round(
                sum(s.duration_ms for s in self.steps) / max(len(self.steps), 1), 2
            ),
        &#125;
```

---

## 三、工具决策审计

```python
class ToolDecisionAuditor:
    """工具决策审计器。

    记录Agent每次选择工具的决策过程，
    便于事后分析为什么选了某个工具。
    """

    def __init__(self):
        self.decisions: list[dict] = []

    def record_decision(
        self,
        step: int,
        available_tools: list[str],
        selected_tool: str,
        llm_reasoning: str,
        confidence: float = 0,
    ):
        """记录一次工具选择决策。"""
        self.decisions.append(&#123;
            "step": step,
            "available": available_tools,
            "selected": selected_tool,
            "reasoning": llm_reasoning[:200],
            "confidence": confidence,
            "timestamp": time.time(),
        &#125;)

    def analyze_decisions(self) -> dict:
        """分析工具选择模式。"""
        from collections import Counter
        tool_counts = Counter(d["selected"] for d in self.decisions)
        low_confidence = [d for d in self.decisions if d["confidence"] < 0.5]

        return &#123;
            "total_decisions": len(self.decisions),
            "tool_distribution": dict(tool_counts),
            "most_used_tool": tool_counts.most_common(1)[0] if tool_counts else None,
            "low_confidence_count": len(low_confidence),
            "low_confidence_steps": [d["step"] for d in low_confidence],
        &#125;
```

---

## 四、状态变化追踪

```mermaid
graph TB
    subgraph 状态追踪 &#123;"State在每步的变化"&#125;
        S0["初始State<br/>&#123;messages: [user], results: []&#125;"]
        S1["步骤1后<br/>&#123;messages: [user, ai], results: [搜索结果]&#125;"]
        S2["步骤2后<br/>&#123;messages: [...], results: [搜索, 分析]&#125;"]
        S3["最终State<br/>&#123;messages: [..., answer], results: [...]&#125;"]

        S0 --> S1 --> S2 --> S3
    end

    style S0 fill:#E3F2FD
    style S3 fill:#C8E6C9
```

```python
class StateChangeTracker:
    """State变化追踪器。"""

    def __init__(self):
        self.snapshots: list[dict] = []

    def capture(self, step: int, state: dict, changed_keys: list[str] = None):
        """捕获State快照。"""
        # 只记录变化的字段（减少存储）
        snapshot = &#123;
            "step": step,
            "timestamp": time.time(),
            "changed_keys": changed_keys or [],
            "state_size": len(str(state)),
        &#125;
        self.snapshots.append(snapshot)

    def get_changes_timeline(self) -> list[dict]:
        """获取State变化时间线。"""
        return [
            &#123;"step": s["step"], "changed": s["changed_keys"]&#125;
            for s in self.snapshots
        ]
```

---

## 五、循环检测

```python
class LoopDetector:
    """Agent循环检测器。

    Agent可能陷入循环：
    - 重复调用相同工具相同参数
    - 在两个状态间来回切换
    - 不断生成相同输出
    """

    @staticmethod
    def detect_repeated_actions(trace: AgentTrace) -> dict:
        """检测重复行动。"""
        if len(trace.steps) < 3:
            return &#123;"detected": False&#125;

        # 检查最近3步是否相同
        recent = trace.steps[-3:]
        same_action = all(s.action == recent[0].action for s in recent)
        same_input = all(s.action_input == recent[0].action_input for s in recent)

        if same_action and same_input:
            return &#123;
                "detected": True,
                "type": "repeated_action",
                "action": recent[0].action,
                "count": 3,
                "suggestion": "增加max_iterations或检查工具返回值",
            &#125;

        return &#123;"detected": False&#125;

    @staticmethod
    def detect_oscillation(trace: AgentTrace) -> dict:
        """检测震荡（A→B→A→B模式）。"""
        if len(trace.steps) < 4:
            return &#123;"detected": False&#125;

        recent = trace.steps[-4:]
        # A→B→A→B模式
        if (recent[0].action == recent[2].action and
            recent[1].action == recent[3].action and
            recent[0].action != recent[1].action):
            return &#123;
                "detected": True,
                "type": "oscillation",
                "actions": [recent[0].action, recent[1].action],
                "suggestion": "Agent在两个工具间震荡，检查决策逻辑",
            &#125;

        return &#123;"detected": False&#125;
```

---

## 六、与 LangSmith 深度集成

```python
class LangSmithAgentTracer:
    """LangSmith Agent深度追踪。"""

    @staticmethod
    def trace_agent_execution():
        """配置LangSmith自动追踪Agent。"""
        import os
        os.environ["LANGSMITH_TRACING"] = "true"
        os.environ["LANGSMITH_PROJECT"] = "agent-production"

        # LangSmith自动捕获：
        # 1. 每次LLM调用的输入输出
        # 2. 每次工具调用的参数和结果
        # 3. 完整的执行链路
        # 4. Token使用和延迟

    @staticmethod
    async def export_trace(trace: AgentTrace) -> dict:
        """导出追踪到LangSmith格式。"""
        return &#123;
            "name": "agent_execution",
            "input": &#123;"task": trace.task&#125;,
            "output": &#123;"answer": trace.final_answer&#125;,
            "metadata": trace.summary(),
            "steps": [
                &#123;
                    "name": f"step_&#123;s.step&#125;",
                    "input": &#123;"thought": s.thought, "action": s.action&#125;,
                    "output": &#123;"observation": s.observation&#125;,
                    "duration_ms": s.duration_ms,
                &#125;
                for s in trace.steps
            ],
        &#125;
```

---

## 七、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 记录推理链每步 | Thought→Action→Observation | ★★★ |
| 有循环检测 | 防止Agent死循环 | ★★★ |
| 工具决策审计 | 知道为什么选某工具 | ★★☆ |
| 状态变化追踪 | 可回放执行过程 | ★★☆ |
| LangSmith深度集成 | 自动捕获执行链 | ★★☆ |
| 低置信度决策标记 | 帮助识别问题步骤 | ★☆☆ |

---

## 八、检查清单

| 检查项 | 状态 |
|--------|------|
| 有推理链追踪 | ☐ |
| 有工具决策审计 | ☐ |
| 有循环检测 | ☐ |
| 有状态变化追踪 | ☐ |
| 有LangSmith集成 | ☐ |
