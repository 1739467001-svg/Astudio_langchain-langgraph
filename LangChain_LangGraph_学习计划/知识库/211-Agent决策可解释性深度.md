# Agent 决策可解释性深度

> 用户问 Agent "为什么这样做"时，Agent 需要能解释。可解释性不只是"记录日志"——它要求 Agent 的每一步决策都有据可查。

---

## 一、可解释性三层

```mermaid
graph TB
    subgraph 三层 {"可解释性三层"}
        L1["决策追踪<br/>记录每步为什么这样做"]
        L2["推理展示<br/>用户可看到推理过程"]
        L3["结果验证<br/>回答能追溯到来源"]
    end

    style 三层 fill:#E3F2FD
    style L2 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、决策追踪

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import json

@dataclass
class DecisionRecord:
    """决策记录。"""
    step: int
    decision: str            # 做了什么决策
    reasoning: str           # 为什么这样做
    alternatives: list[str] = field(default_factory=list)  # 还有什么备选
    selected_reason: str = ""  # 为什么选这个
    confidence: float = 0.8
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

class DecisionTracker:
    """决策追踪器。"""

    def __init__(self):
        self.decisions: list[DecisionRecord] = []

    def record(self, decision: str, reasoning: str, alternatives: list[str] = None,
               selected_reason: str = "", confidence: float = 0.8):
        """记录一个决策。"""
        self.decisions.append(DecisionRecord(
            step=len(self.decisions) + 1,
            decision=decision,
            reasoning=reasoning,
            alternatives=alternatives or [],
            selected_reason=selected_reason,
            confidence=confidence,
        ))

    def generate_explanation(self) -> str:
        """生成决策解释文本。"""
        if not self.decisions:
            return "无决策记录"

        lines = ["## 决策过程"]
        for d in self.decisions:
            lines.append(f"\n### 步骤 {d.step}: {d.decision}")
            lines.append(f"**推理**: {d.reasoning}")
            if d.alternatives:
                lines.append(f"**备选方案**: {', '.join(d.alternatives)}")
            if d.selected_reason:
                lines.append(f"**选择原因**: {d.selected_reason}")
            lines.append(f"**置信度**: {d.confidence:.0%}")

        return "\n".join(lines)

    def get_decision_tree(self) -> dict:
        """获取决策树结构。"""
        return {
            "total_steps": len(self.decisions),
            "steps": [
                {
                    "step": d.step,
                    "decision": d.decision,
                    "reasoning": d.reasoning,
                    "alternatives": d.alternatives,
                    "confidence": d.confidence,
                }
                for d in self.decisions
            ],
        }
```

---

## 三、推理展示

```python
class ReasoningExplainer:
    """推理展示器——让用户看到Agent怎么想的。"""

    @staticmethod
    def format_for_user(decision_tracker: DecisionTracker) -> str:
        """格式化推理过程供用户查看。"""
        explanation = decision_tracker.generate_explanation()

        # 添加总结
        total_steps = len(decision_tracker.decisions)
        avg_confidence = sum(d.confidence for d in decision_tracker.decisions) / max(total_steps, 1)

        summary = f"\n\n---\n**总结**: 共{total_steps}步推理，平均置信度{avg_confidence:.0%}"
        if avg_confidence < 0.6:
            summary += "\n⚠️ 置信度较低，建议人工验证"

        return explanation + summary

    @staticmethod
    def format_collapsible(decision_tracker: DecisionTracker) -> str:
        """格式化为可折叠的推理过程（Markdown格式）。"""
        lines = ["<details>\n<summary>📊 查看推理过程</summary>\n"]
        for d in decision_tracker.decisions:
            lines.append(f"**步骤{d.step}**: {d.decision}")
            lines.append(f"- 推理: {d.reasoning}")
            if d.selected_reason:
                lines.append(f"- 选择原因: {d.selected_reason}")
            lines.append("")
        lines.append("</details>")
        return "\n".join(lines)
```

---

## 四、来源追溯

```python
class SourceTracer:
    """来源追溯器。"""

    @staticmethod
    def trace_answer(answer: str, sources: list[dict]) -> dict:
        """追溯答案中的信息来源。"""
        import re

        # 找出答案中的关键陈述句
        sentences = re.split(r'[。.！!？?]', answer)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 10]

        # 每个句子追溯来源
        traced = []
        for sent in sentences:
            # 检查哪个来源支持这个句子
            supporting_sources = []
            for source in sources:
                source_content = source.get("content", "")
                # 简化：关键词重叠
                common_words = set(sent.split()) & set(source_content.split())
                if len(common_words) > 3:
                    supporting_sources.append(source.get("source", "未知"))

            traced.append({
                "statement": sent[:100],
                "sources": supporting_sources[:3],
                "has_source": len(supporting_sources) > 0,
            })

        supported = sum(1 for t in traced if t["has_source"])
        return {
            "total_statements": len(traced),
            "supported": supported,
            "unsupported": len(traced) - supported,
            "support_rate": round(supported / max(len(traced), 1), 4),
            "trace": traced,
        }
```

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 每步决策记录理由 | 不只记做了什么 | ★★★ |
| 展示备选方案 | 说明为什么不选其他 | ★★☆ |
| 推理过程可折叠 | 不打扰用户 | ★★☆ |
| 低置信度标记 | 提醒验证 | ★★★ |
| 答案追溯来源 | 防幻觉 | ★★★ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 有决策追踪器 | ☐ |
| 有推理展示 | ☐ |
| 有来源追溯 | ☐ |
