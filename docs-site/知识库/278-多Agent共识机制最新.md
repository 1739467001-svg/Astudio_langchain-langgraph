# 多 Agent 共识机制最新

> 知识库 86 有 180 行。这篇讲透——投票、协商和一致性达成。

---

## 一、共识机制

```mermaid
graph TB
    subgraph 共识 &#123;"三种共识方式"&#125;
        M1["多数投票<br/>少数服从多数"]
        M2["协商一致<br/>讨论后达成"]
        M3["权威决策<br/>指定Agent裁决"]
    end

    style M1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、实现

```python
import asyncio
from dataclasses import dataclass, field
from collections import Counter
from typing import Any

@dataclass
class VoteResult:
    """投票结果。"""
    winner: Any
    confidence: float
    votes: dict
    total_voters: int

class ConsensusEngine:
    """共识引擎。"""

    @staticmethod
    async def majority_vote(agents: list, task: str) -> VoteResult:
        """多数投票——各Agent独立回答，取多数。"""
        tasks = [agent.answer(task) for agent in agents]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        valid = [r for r in results if not isinstance(r, Exception)]
        if not valid:
            return VoteResult(winner=None, confidence=0, votes=&#123;&#125;, total_voters=len(agents))

        vote_counts = Counter(valid)
        winner, count = vote_counts.most_common(1)[0]
        confidence = count / len(valid)

        return VoteResult(
            winner=winner,
            confidence=round(confidence, 2),
            votes=dict(vote_counts),
            total_voters=len(valid),
        )

    @staticmethod
    async def deliberation(agents: list, task: str, rounds: int = 2) -> str:
        """协商一致——多轮讨论后达成。"""
        discussion = []

        for round_num in range(rounds):
            round_responses = await asyncio.gather(
                *[agent.answer(f"第&#123;round_num+1&#125;轮讨论: &#123;task&#125;\n前轮观点: &#123;discussion[-1] if discussion else '无'&#125;")
                  for agent in agents],
                return_exceptions=True
            )
            discussion = [r for r in round_responses if not isinstance(r, Exception)]

        # 最后一轮取多数
        if discussion:
            return max(set(discussion), key=discussion.count)
        return "无法达成共识"

    @staticmethod
    async def authority_decision(authority_agent, task: str, other_opinions: list = None) -> str:
        """权威决策——指定Agent做最终裁决。"""
        context = f"其他Agent观点: &#123;other_opinions&#125;" if other_opinions else ""
        return await authority_agent.answer(f"&#123;task&#125;\n&#123;context&#125;")
```

---

## 三、最佳实践

| 方式 | 场景 | 速度 | 准确率 |
|------|------|------|--------|
| 多数投票 | 事实问答 | 快 | 中 |
| 协商 | 复杂推理 | 慢 | 高 |
| 权威决策 | 需要专业知识 | 快 | 取决于权威Agent |

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有投票机制 | ☐ |
| 有协商机制 | ☐ |
