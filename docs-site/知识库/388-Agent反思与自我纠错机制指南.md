# Agent 反思与自我纠错机制指南

> Agent 第一次回答可能不对——但如果它能检查自己的答案并修正，质量会显著提升。这篇指南讲透反思循环、自我批判和迭代纠错，让 Agent 像人一样"想完再检查一遍"。

---

## 一、反思循环架构

```mermaid
graph TB
    QUESTION["用户问题"] --> ANSWER["初始回答"]
    ANSWER --> CRITIC&#123;"自我批判<br/>找问题"&#125;
    CRITIC -->|有问题| REFLECT["反思<br/>分析原因"]
    REFLECT --> REVISE["修正<br/>重新生成"]
    REVISE --> CRITIC
    CRITIC -->|无问题| CONFIRM["确认输出"]

    subgraph 循环 &#123;"反思循环（最多N次）"&#125;
        CRITIC
        REFLECT
        REVISE
    end

    style CRITIC fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REFLECT fill:#E3F2FD,stroke:#1565C0
    style CONFIRM fill:#C8E6C9
```

核心思想：生成→批判→修正→再批判，直到批判通过或达到最大循环次数。每轮反思让答案质量螺旋上升。

---

## 二、反思机制实现

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
import json

class CriticSeverity(str, Enum):
    NONE = "none"          # 无问题
    MINOR = "minor"        # 小问题
    MAJOR = "major"        # 大问题
    CRITICAL = "critical"  # 严重错误

@dataclass
class CriticResult:
    """批判结果。"""
    severity: CriticSeverity
    issues: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)
    confidence: float = 0.0  # 对答案的置信度

@dataclass
class ReflectionCycle:
    """一轮反思循环。"""
    round: int
    answer: str
    critic: CriticResult
    revised_answer: str = ""
    improved: bool = False

@dataclass
class ReflectionReport:
    """完整反思报告。"""
    question: str
    initial_answer: str
    final_answer: str
    rounds: list[ReflectionCycle] = field(default_factory=list)
    total_rounds: int = 0
    improved: bool = False
    final_confidence: float = 0.0

    @property
    def summary(self) -> dict:
        return &#123;
            "question": self.question[:100],
            "total_rounds": self.total_rounds,
            "improved": self.improved,
            "initial_confidence": self.rounds[0].critic.confidence if self.rounds else 0,
            "final_confidence": self.final_confidence,
            "issues_found": sum(len(r.critic.issues) for r in self.rounds),
            "issues_resolved": sum(1 for r in self.rounds if r.improved),
        &#125;


from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

CRITIC_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """你是答案质量审查员。审查以下回答的质量。

审查维度:
1. 准确性: 事实是否正确
2. 完整性: 是否遗漏重要信息
3. 逻辑性: 推理是否连贯
4. 针对性: 是否回答了问题

返回JSON:
&#123;&#123;"severity": "none/minor/major/critical", "issues": ["问题1"], "suggestions": ["建议1"], "confidence": 0.0-1.0&#125;&#125;"""),
    ("human", "问题: &#123;question&#125;\n回答: &#123;answer&#125;"),
])

REVISE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """根据审查反馈修正回答。

原始问题: &#123;question&#125;
原始回答: &#123;answer&#125;
审查反馈:
- 问题: &#123;issues&#125;
- 建议: &#123;suggestions&#125;

请修正所有问题，输出修正后的回答。"""),
    ("human", "请修正。"),
])


class ReflectionAgent:
    """反思Agent。"""

    def __init__(self, llm, max_rounds: int = 3):
        self.llm = llm
        self.max_rounds = max_rounds
        self.critic_chain = CRITIC_PROMPT | llm | StrOutputParser()
        self.revise_chain = REVISE_PROMPT | llm | StrOutputParser()

    async def answer_with_reflection(self, question: str, initial_answer: str = None) -> ReflectionReport:
        """带反思的回答流程。"""
        # 初始回答
        if not initial_answer:
            response = await self.llm.ainvoke(question)
            initial_answer = response.content

        report = ReflectionReport(
            question=question,
            initial_answer=initial_answer,
            final_answer=initial_answer,
        )

        current_answer = initial_answer

        for round_num in range(1, self.max_rounds + 1):
            # 1. 批判
            critic_result = await self._critic(question, current_answer)

            cycle = ReflectionCycle(
                round=round_num,
                answer=current_answer,
                critic=critic_result,
            )

            # 2. 如果无问题或只有minor，结束
            if critic_result.severity in (CriticSeverity.NONE, CriticSeverity.MINOR):
                report.final_answer = current_answer
                report.final_confidence = critic_result.confidence
                report.rounds.append(cycle)
                report.total_rounds = round_num
                break

            # 3. 反思+修正
            revised = await self._revise(question, current_answer, critic_result)
            cycle.revised_answer = revised
            cycle.improved = revised != current_answer

            report.rounds.append(cycle)
            report.total_rounds = round_num
            report.improved = True
            current_answer = revised

        report.final_answer = current_answer
        if not report.rounds:
            report.final_confidence = 0.5
        else:
            report.final_confidence = report.rounds[-1].critic.confidence

        return report

    async def _critic(self, question: str, answer: str) -> CriticResult:
        """自我批判。"""
        result = await self.critic_chain.ainvoke(&#123;"question": question, "answer": answer[:2000]&#125;)
        try:
            parsed = json.loads(result)
            severity = CriticSeverity(parsed.get("severity", "none"))
            issues = parsed.get("issues", [])
            suggestions = parsed.get("suggestions", [])
            confidence = float(parsed.get("confidence", 0.5))
        except (json.JSONDecodeError, ValueError):
            severity = CriticSeverity.NONE
            issues = []
            suggestions = []
            confidence = 0.5

        return CriticResult(severity=severity, issues=issues, suggestions=suggestions, confidence=confidence)

    async def _revise(self, question: str, answer: str, critic: CriticResult) -> str:
        """修正回答。"""
        issues_text = "\n".join(f"- &#123;i&#125;" for i in critic.issues)
        suggestions_text = "\n".join(f"- &#123;s&#125;" for s in critic.suggestions)

        revised = await self.revise_chain.ainvoke(&#123;
            "question": question,
            "answer": answer[:2000],
            "issues": issues_text,
            "suggestions": suggestions_text,
        &#125;)
        return revised
```

### 与 LangGraph 集成

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class ReflectionState(TypedDict):
    question: str
    current_answer: str
    critic_severity: str
    round: int
    final_answer: str
    improved: bool

def generate_initial(state: ReflectionState) -> ReflectionState:
    """生成初始回答。"""
    if not state.get("current_answer"):
        response = llm.invoke(state["question"])
        state["current_answer"] = response.content
    state["round"] = state.get("round", 0) + 1
    return state

async def critic_node(state: ReflectionState) -> ReflectionState:
    """批判节点。"""
    import asyncio
    agent = ReflectionAgent(llm)
    critic = await agent._critic(state["question"], state["current_answer"])
    state["critic_severity"] = critic.severity.value
    return state

def route_after_critic(state: ReflectionState) -> str:
    """路由：需要修正则走修正，否则结束。"""
    if state["critic_severity"] in ("none", "minor") or state["round"] >= 3:
        return "end"
    return "revise"

async def revise_node(state: ReflectionState) -> ReflectionState:
    """修正节点。"""
    agent = ReflectionAgent(llm)
    critic = await agent._critic(state["question"], state["current_answer"])
    revised = await agent._revise(state["question"], state["current_answer"], critic)
    state["current_answer"] = revised
    state["improved"] = True
    return state

# 构建反思图
reflection_builder = StateGraph(ReflectionState)
reflection_builder.add_node("generate", generate_initial)
reflection_builder.add_node("critic", critic_node)
reflection_builder.add_node("revise", revise_node)
reflection_builder.add_edge(START, "generate")
reflection_builder.add_edge("generate", "critic")
reflection_builder.add_conditional_edges("critic", route_after_critic, &#123;
    "revise": "revise",
    "end": END,
&#125;)
reflection_builder.add_edge("revise", "critic")
reflection_graph = reflection_builder.compile()
```

### 使用示例

```python
import asyncio

async def main():
    agent = ReflectionAgent(llm, max_rounds=3)

    report = await agent.answer_with_reflection(
        "LangGraph和LangChain有什么区别？"
    )

    print(f"问题: &#123;report.question&#125;")
    print(f"总轮数: &#123;report.total_rounds&#125;")
    print(f"是否有改进: &#123;report.improved&#125;")
    print(f"最终置信度: &#123;report.final_confidence:.2f&#125;")
    print(f"发现问题数: &#123;report.summary['issues_found']&#125;")
    print(f"\n初始回答: &#123;report.initial_answer[:150]&#125;...")
    print(f"\n最终回答: &#123;report.final_answer[:150]&#125;...")

asyncio.run(main())
```

---

## 三、反思策略对比

| 策略 | 轮数 | 成本 | 质量提升 | 适用 |
|------|------|------|----------|------|
| 无反思 | 0 | 1× | 基线 | 简单问题 |
| 单轮反思 | 1 | 2× | +10-15% | 通用 |
| 多轮反思 | 3 | 4× | +20-30% | 复杂问题 |
| 自一致性 | N采样 | N× | +15-25% | 高可靠 |
| 外部验证 | 1 | 2× | +25-35% | 事实问答 |

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 限制最大轮数 | 3轮足够，过多收益递减 | ★★★ |
| minor直接通过 | 小问题不值得修正 | ★★★ |
| 记录每轮改进 | 可追踪质量提升 | ★★☆ |
| 置信度输出 | 告诉用户答案可信度 | ★★★ |
| 与LangGraph结合 | 用条件边实现循环 | ★★☆ |
| 复杂问题才反思 | 简单问题不需要 | ★★☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有自我批判 | ☐ |
| 有修正机制 | ☐ |
| 有最大轮数限制 | ☐ |
| 有置信度输出 | ☐ |
| 有反思报告 | ☐ |
| 支持LangGraph集成 | ☐ |
