# Agent 用户反馈闭环与持续改进指南

> Agent 上线后，用户说"这个回答不好"——然后呢？没有闭环的话，这个反馈就消失了。这篇指南讲透用户反馈收集、分类、分析和自动转化为改进措施的完整闭环。

---

## 一、反馈闭环架构

```mermaid
graph TB
    USER["用户使用Agent"] --> RESPONSE["Agent回答"]
    RESPONSE --> FEEDBACK&#123;"用户反馈"&#125;
    FEEDBACK -->|👍正反馈| POSITIVE["正反馈库"]
    FEEDBACK -->|👎负反馈| NEGATIVE["负反馈库"]
    FEEDBACK -->|不反馈| SILENT["无反馈<br/>推断满意度"]

    POSITIVE --> ANALYZE["反馈分析<br/>分类+聚类"]
    NEGATIVE --> ANALYZE
    ANALYZE --> ACTIONS&#123;"改进决策"&#125;
    ACTIONS -->|Prompt优化| PROMPT["更新Prompt"]
    ACTIONS -->|工具修复| TOOL["修复工具逻辑"]
    ACTIONS -->|知识补充| KB["补充知识库"]
    ACTIONS -->|模型升级| MODEL["换更强模型"]
    PROMPT & TOOL & KB & MODEL --> REDEPLOY["重新部署"]
    REDEPLOY --> USER

    style FEEDBACK fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style ANALYZE fill:#E3F2FD,stroke:#1565C0
    style REDEPLOY fill:#C8E6C9
```

闭环的核心：反馈不只是一条数据，它要触发一个改进动作，改进后重新上线，再收集新反馈——循环往复。

---

## 二、反馈闭环实现

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from collections import defaultdict
import json

class FeedbackType(str, Enum):
    THUMBS_UP = "thumbs_up"
    THUMBS_DOWN = "thumbs_down"
    RATING = "rating"
    TEXT = "text"
    CORRECTION = "correction"

class FeedbackCategory(str, Enum):
    ACCURACY = "accuracy"          # 回答不准确
    COMPLETENESS = "completeness"  # 回答不完整
    FORMATTING = "formatting"      # 格式问题
    LATENCY = "latency"            # 太慢
    SAFETY = "safety"              # 安全问题
    HELPFUL = "helpful"            # 有帮助
    CORRECT = "correct"            # 正确

class ActionType(str, Enum):
    PROMPT_UPDATE = "prompt_update"
    TOOL_FIX = "tool_fix"
    KB_SUPPLEMENT = "kb_supplement"
    MODEL_UPGRADE = "model_upgrade"
    NO_ACTION = "no_action"

@dataclass
class Feedback:
    """用户反馈。"""
    feedback_id: str
    user_id: str
    session_id: str
    query: str
    response: str
    feedback_type: FeedbackType
    category: FeedbackCategory = FeedbackCategory.HELPFUL
    rating: Optional[int] = None  # 1-5
    comment: str = ""
    correction: str = ""          # 用户提供的正确答案
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def is_negative(self) -> bool:
        if self.feedback_type == FeedbackType.THUMBS_DOWN:
            return True
        if self.feedback_type == FeedbackType.RATING and (self.rating or 0) <= 2:
            return True
        if self.feedback_type == FeedbackType.CORRECTION:
            return True
        return False

@dataclass
class ImprovementAction:
    """改进动作。"""
    action_id: str
    action_type: ActionType
    description: str
    triggered_by: list[str] = field(default_factory=list)  # feedback_ids
    status: str = "pending"  # pending / in_progress / done
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    impact_estimate: str = "medium"


class FeedbackCollector:
    """反馈收集器。"""

    def __init__(self):
        self._feedbacks: list[Feedback] = []
        self._by_session: dict[str, list[str]] = defaultdict(list)

    def collect(self, feedback: Feedback):
        self._feedbacks.append(feedback)
        self._by_session[feedback.session_id].append(feedback.feedback_id)

    def get_negative(self, limit: int = 50) -> list[Feedback]:
        return [f for f in self._feedbacks if f.is_negative][-limit:]

    def get_positive(self, limit: int = 50) -> list[Feedback]:
        return [f for f in self._feedbacks if not f.is_negative][-limit:]

    def get_stats(self) -> dict:
        total = len(self._feedbacks)
        if total == 0:
            return &#123;"total": 0&#125;
        negative = sum(1 for f in self._feedbacks if f.is_negative)
        positive = total - negative
        avg_rating = sum(f.rating or 0 for f in self._feedbacks if f.rating) / max(sum(1 for f in self._feedbacks if f.rating), 1)
        category_dist = defaultdict(int)
        for f in self._feedbacks:
            category_dist[f.category.value] += 1
        return &#123;
            "total": total,
            "positive": positive,
            "negative": negative,
            "satisfaction_rate": round(positive / total * 100, 1),
            "avg_rating": round(avg_rating, 2),
            "category_distribution": dict(category_dist),
        &#125;


from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

ANALYZE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """分析用户反馈，确定改进方向。

反馈列表:
&#123;feedbacks&#125;

对每条负反馈，判断需要哪种改进动作:
- prompt_update: 优化提示词可以解决
- tool_fix: 工具逻辑需要修复
- kb_supplement: 知识库缺少信息
- model_upgrade: 需要更强的模型
- no_action: 无需改进

返回JSON数组:
[&#123;&#123;"feedback_id": "...", "action_type": "...", "description": "改进建议", "impact": "high/medium/low"&#125;&#125;]"""),
    ("human", "请分析。"),
])


class FeedbackAnalyzer:
    """反馈分析器。"""

    def __init__(self, llm):
        self.llm = llm
        self.chain = ANALYZE_PROMPT | llm | StrOutputParser()

    async def analyze(self, feedbacks: list[Feedback]) -> list[ImprovementAction]:
        """分析反馈，生成改进动作。"""
        if not feedbacks:
            return []

        feedback_text = "\n".join(
            f"ID: &#123;f.feedback_id&#125;\n问题: &#123;f.query[:100]&#125;\n回答: &#123;f.response[:100]&#125;\n反馈: &#123;f.comment or f.category.value&#125;\n修正: &#123;f.correction[:100]&#125;"
            for f in feedbacks if f.is_negative
        )

        result = await self.chain.ainvoke(&#123;"feedbacks": feedback_text&#125;)

        actions = []
        try:
            parsed = json.loads(result)
            for item in parsed:
                actions.append(ImprovementAction(
                    action_id=f"act-&#123;datetime.now().strftime('%Y%m%d%H%M%S')&#125;-&#123;len(actions)&#125;",
                    action_type=ActionType(item.get("action_type", "no_action")),
                    description=item.get("description", ""),
                    triggered_by=[item.get("feedback_id", "")],
                    impact_estimate=item.get("impact", "medium"),
                ))
        except (json.JSONDecodeError, ValueError):
            actions.append(ImprovementAction(
                action_id=f"act-&#123;datetime.now().strftime('%Y%m%d%H%M%S')&#125;",
                action_type=ActionType.NO_ACTION,
                description="分析失败，需人工审查",
            ))

        return actions


class ContinuousImprovementLoop:
    """持续改进闭环。"""

    def __init__(self, collector: FeedbackCollector, analyzer: FeedbackAnalyzer):
        self.collector = collector
        self.analyzer = analyzer
        self._actions: list[ImprovementAction] = []

    async def run_cycle(self) -> dict:
        """执行一轮改进循环。"""
        # 1. 收集负反馈
        negatives = self.collector.get_negative(limit=20)

        # 2. 分析并生成改进动作
        actions = await self.analyzer.analyze(negatives)
        self._actions.extend(actions)

        # 3. 统计
        stats = self.collector.get_stats()
        action_dist = defaultdict(int)
        for a in actions:
            action_dist[a.action_type.value] += 1

        return &#123;
            "feedback_stats": stats,
            "new_actions": len(actions),
            "action_distribution": dict(action_dist),
            "total_actions": len(self._actions),
            "pending_actions": sum(1 for a in self._actions if a.status == "pending"),
        &#125;

    def get_pending_actions(self) -> list[ImprovementAction]:
        return [a for a in self._actions if a.status == "pending"]

    def mark_done(self, action_id: str):
        for a in self._actions:
            if a.action_id == action_id:
                a.status = "done"
                break
```

### 使用示例

```python
import asyncio

async def main():
    collector = FeedbackCollector()
    analyzer = FeedbackAnalyzer(llm)
    loop = ContinuousImprovementLoop(collector, analyzer)

    # 模拟用户反馈
    collector.collect(Feedback(
        feedback_id="f1", user_id="u1", session_id="s1",
        query="什么是RAG?", response="RAG是一种技术。",
        feedback_type=FeedbackType.THUMBS_DOWN,
        category=FeedbackCategory.COMPLETENESS,
        comment="回答太简略，缺少细节",
    ))
    collector.collect(Feedback(
        feedback_id="f2", user_id="u2", session_id="s2",
        query="LangGraph的State是什么?", response="State是状态管理机制...",
        feedback_type=FeedbackType.THUMBS_UP,
        category=FeedbackCategory.HELPFUL,
    ))
    collector.collect(Feedback(
        feedback_id="f3", user_id="u3", session_id="s3",
        query="如何部署Agent?", response="请参考文档。",
        feedback_type=FeedbackType.CORRECTION,
        category=FeedbackCategory.ACCURACY,
        correction="应该给出具体部署步骤，而不是简单说'参考文档'",
    ))

    # 执行改进循环
    result = await loop.run_cycle()
    print(f"反馈统计: &#123;result['feedback_stats']&#125;")
    print(f"新增改进动作: &#123;result['new_actions']&#125;")
    print(f"动作分布: &#123;result['action_distribution']&#125;")

    for action in loop.get_pending_actions():
        print(f"\n待办: [&#123;action.action_type.value&#125;] &#123;action.description&#125;")

asyncio.run(main())
```

---

## 三、反馈收集方式对比

| 方式 | 收集率 | 数据质量 | 实现成本 | 适用 |
|------|--------|----------|----------|------|
| 👍/👎按钮 | 高 | 低 | 低 | 通用 |
| 1-5星评分 | 中 | 中 | 低 | 通用 |
| 文字反馈 | 低 | 高 | 中 | 深度改进 |
| 用户修正 | 低 | 极高 | 中 | 准确性改进 |
| 隐式信号 | 极高 | 中 | 高 | 大规模 |

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 负反馈优先处理 | 负反馈价值远高于正反馈 | ★★★ |
| 反馈分类自动化 | LLM自动分类 | ★★★ |
| 闭环有截止时间 | 不让反馈无限堆积 | ★★★ |
| 改进动作可追踪 | 每个动作有状态 | ★★☆ |
| 隐式信号+显式反馈 | 点击/复制/停留时间 | ★★☆ |
| 定期回顾改进效果 | 验证改进是否有效 | ★★☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有反馈收集器 | ☐ |
| 支持多种反馈类型 | ☐ |
| 有反馈分析器 | ☐ |
| 有改进动作生成 | ☐ |
| 有闭环循环 | ☐ |
| 有改进效果验证 | ☐ |
