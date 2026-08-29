# Agent 协商与共识机制指南

> 多 Agent 协作不只是"你做A、我做B"——当多个 Agent 对同一问题有不同看法时，谁来拍板？投票？加权？还是再讨论一轮？Agent 协商机制让多个 Agent 像人类团队一样讨论、争论、达成共识。

---

## 1. 为什么需要协商机制

### 问题：多个 Agent 意见分歧

```
场景：用户问"这只股票该不该买？"
  技术分析 Agent → "买入"（K线形态看好）
  基本面 Agent   → "卖出"（财报利润下滑）
  情绪分析 Agent → "持有"（社交媒体中性）

分歧：3 个 Agent 意见不一致
方案 1：简单投票 → 1:1:1 平票
方案 2：加权投票 → 技术面权重 0.3 + 基本面 0.5 + 情绪 0.2 → "卖出"
方案 3：协商讨论 → 让 3 个 Agent 交流后达成共识
```

### 协商 vs 投票 vs 仲裁

| 方式 | 机制 | 优点 | 缺点 |
|------|------|------|------|
| 投票 | 多数决 | 快速简单 | 少数意见被忽略 |
| 加权投票 | 按权重决 | 考虑专业度 | 权重需预设 |
| 协商讨论 | 多轮交流 | 考虑全面 | 慢、成本高 |
| 仲裁者 | 上级裁决 | 果断 | 依赖仲裁者质量 |
| 置信度融合 | 按置信度加权 | 自适应 | 需要标定置信度 |

---

## 2. 协商状态模型

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Any
import time
import uuid

class NegotiationStatus(Enum):
    INITIATED = "initiated"        # 发起
    PROPOSING = "proposing"        # 提案中
    DISCUSSING = "discussing"      # 讨论中
    VOTING = "voting"              # 投票中
    RESOLVED = "resolved"          # 已解决
    DEADLOCKED = "deadlocked"      # 僵局
    TIMEOUT = "timeout"            # 超时


class Opinion(Enum):
    AGREE = "agree"
    DISAGREE = "disagree"
    ABSTAIN = "abstain"
    COMPROMISE = "compromise"      # 妥协


@dataclass
class AgentOpinion:
    """Agent 意见"""
    agent_id: str
    agent_role: str                # "技术分析师" / "基本面分析师"
    opinion: str                   # "买入" / "卖出" / "持有"
    confidence: float              # 0-1
    reasoning: str                 # 理由
    evidence: list[str] = field(default_factory=list)  # 证据
    timestamp: float = field(default_factory=time.time)


@dataclass
class Negotiation:
    """协商会话"""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    topic: str = ""                # 协商主题
    question: str = ""             # 原始问题
    participants: list[str] = field(default_factory=list)  # 参与 Agent ID
    # 意见
    opinions: list[AgentOpinion] = field(default_factory=list)
    rounds: list[dict] = field(default_factory=list)  # 协商轮次记录
    # 状态
    status: NegotiationStatus = NegotiationStatus.INITIATED
    max_rounds: int = 3            # 最大协商轮次
    current_round: int = 0
    # 结果
    consensus: str = ""            # 最终共识
    confidence: float = 0.0        # 共识置信度
    method: str = ""                # 达成方式
    created_at: float = field(default_factory=time.time)
    resolved_at: float | None = None
```

---

## 3. 协商引擎

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import json

class NegotiationEngine:
    """Agent 协商引擎"""

    def __init__(self, llm: ChatOpenAI | None = None):
        self.llm = llm or ChatOpenAI(temperature=0, model="gpt-4o-mini")

    def initiate(
        self,
        topic: str,
        question: str,
        participants: list[str],
    ) -> Negotiation:
        """发起协商"""
        return Negotiation(
            topic=topic,
            question=question,
            participants=participants,
            status=NegotiationStatus.PROPOSING,
        )

    def collect_opinions(
        self,
        negotiation: Negotiation,
        agent_opinions: list[AgentOpinion],
    ) -> Negotiation:
        """收集各 Agent 的初始意见"""
        negotiation.opinions = agent_opinions
        negotiation.current_round = 1
        negotiation.rounds.append({
            "round": 1,
            "type": "initial_proposals",
            "opinions": [
                {
                    "agent": o.agent_role,
                    "opinion": o.opinion,
                    "confidence": o.confidence,
                }
                for o in agent_opinions
            ],
        })

        # 检查是否已一致
        unique_opinions = set(o.opinion for o in agent_opinions)
        if len(unique_opinions) == 1:
            negotiation.status = NegotiationStatus.RESOLVED
            negotiation.consensus = agent_opinions[0].opinion
            negotiation.confidence = sum(o.confidence for o in agent_opinions) / len(agent_opinions)
            negotiation.method = "unanimous"
            negotiation.resolved_at = time.time()
        else:
            negotiation.status = NegotiationStatus.DISCUSSING

        return negotiation

    def discuss_round(
        self,
        negotiation: Negotiation,
    ) -> Negotiation:
        """执行一轮协商讨论"""
        if negotiation.current_round >= negotiation.max_rounds:
            negotiation.status = NegotiationStatus.DEADLOCKED
            return negotiation

        negotiation.current_round += 1

        # 让每个 Agent 看到其他人的意见后重新评估
        prompt = ChatPromptTemplate.from_messages([
            ("system", """你是 {role}。其他专家给出了以下意见：

{other_opinions}

请重新评估你的观点。你可以：
1. 坚持原意见（附理由）
2. 修改意见（附理由）
3. 妥协（附理由）

输出 JSON：{{"final_opinion": "...", "confidence": 0.0-1.0, "reasoning": "...", "changed": true/false}}"""),
            ("human", "原始问题：{question}\n你之前的意见：{my_opinion}"),
        ])

        chain = prompt | self.llm
        updated_opinions = []

        for original in negotiation.opinions:
            other_opinions = "\n".join([
                f"- {o.agent_role}：{o.opinion}（置信度{o.confidence:.0%}，理由：{o.reasoning[:100]}）"
                for o in negotiation.opinions
                if o.agent_id != original.agent_id
            ])

            result = chain.invoke({
                "role": original.agent_role,
                "other_opinions": other_opinions,
                "question": negotiation.question,
                "my_opinion": f"{original.opinion}（{original.reasoning[:100]}）",
            })

            try:
                data = json.loads(result.content)
                updated = AgentOpinion(
                    agent_id=original.agent_id,
                    agent_role=original.agent_role,
                    opinion=data.get("final_opinion", original.opinion),
                    confidence=data.get("confidence", original.confidence),
                    reasoning=data.get("reasoning", original.reasoning),
                    evidence=original.evidence,
                )
                updated_opinions.append(updated)
            except json.JSONDecodeError:
                updated_opinions.append(original)

        negotiation.opinions = updated_opinions
        negotiation.rounds.append({
            "round": negotiation.current_round,
            "type": "discussion",
            "opinions": [
                {"agent": o.agent_role, "opinion": o.opinion, "confidence": o.confidence}
                for o in updated_opinions
            ],
        })

        # 检查是否达成一致
        unique = set(o.opinion for o in updated_opinions)
        if len(unique) == 1:
            negotiation.status = NegotiationStatus.RESOLVED
            negotiation.consensus = updated_opinions[0].opinion
            negotiation.confidence = sum(o.confidence for o in updated_opinions) / len(updated_opinions)
            negotiation.method = f"consensus_round_{negotiation.current_round}"
            negotiation.resolved_at = time.time()
        elif negotiation.current_round >= negotiation.max_rounds:
            # 超过最大轮次，用加权投票
            negotiation = self._weighted_vote(negotiation)

        return negotiation

    def _weighted_vote(self, negotiation: Negotiation) -> Negotiation:
        """加权投票：按置信度加权"""
        from collections import defaultdict
        votes = defaultdict(float)

        for o in negotiation.opinions:
            votes[o.opinion] += o.confidence

        winner = max(votes, key=votes.get)
        total = sum(votes.values())

        negotiation.status = NegotiationStatus.RESOLVED
        negotiation.consensus = winner
        negotiation.confidence = votes[winner] / total
        negotiation.method = "weighted_vote"
        negotiation.resolved_at = time.time()

        return negotiation

    def resolve(self, negotiation: Negotiation) -> dict:
        """完整协商流程"""
        # 如果还在讨论中，继续协商
        while negotiation.status == NegotiationStatus.DISCUSSING:
            negotiation = self.discuss_round(negotiation)

        return {
            "topic": negotiation.topic,
            "consensus": negotiation.consensus,
            "confidence": f"{negotiation.confidence:.0%}",
            "method": negotiation.method,
            "rounds": negotiation.current_round,
            "status": negotiation.status.value,
            "participants": [
                {"role": o.agent_role, "opinion": o.opinion, "confidence": f"{o.confidence:.0%}"}
                for o in negotiation.opinions
            ],
        }
```

---

## 4. 仲裁者模式

```python
class Arbitrator:
    """仲裁者：当协商失败时做最终裁决"""

    def __init__(self, llm: ChatOpenAI | None = None):
        self.llm = llm or ChatOpenAI(temperature=0, model="gpt-4o")

    def arbitrate(
        self,
        question: str,
        opinions: list[AgentOpinion],
        negotiation_history: list[dict],
    ) -> dict:
        """仲裁：综合所有意见做最终判断"""
        opinions_text = "\n".join([
            f"### {o.agent_role}（置信度 {o.confidence:.0%}）\n"
            f"观点：{o.opinion}\n理由：{o.reasoning}\n证据：{o.evidence}"
            for o in opinions
        ])

        prompt = ChatPromptTemplate.from_messages([
            ("system", """你是最终仲裁者。多个专家对同一问题给出了不同意见。
请综合所有意见，给出最终裁决。

要求：
1. 认真考虑每个专家的观点和理由
2. 根据证据质量和置信度做判断
3. 如果多方都有道理，可以给出折中方案
4. 说明裁决理由

输出 JSON：
{
  "verdict": "最终结论",
  "confidence": 0.0-1.0,
  "reasoning": "裁决理由",
  "acknowledged_views": ["采纳的观点1", "采纳的观点2"]
}"""),
            ("human", "问题：{question}\n\n专家意见：\n{opinions}"),
        ])

        chain = prompt | self.llm
        result = chain.invoke({
            "question": question,
            "opinions": opinions_text,
        })

        try:
            return json.loads(result.content)
        except json.JSONDecodeError:
            return {
                "verdict": result.content[:200],
                "confidence": 0.5,
                "reasoning": "仲裁者原始回复",
            }
```

---

## 5. 完整协商流程示例

```python
# 创建协商引擎
engine = NegotiationEngine()
arbitrator = Arbitrator()

# 1. 发起协商
negotiation = engine.initiate(
    topic="股票投资决策",
    question="某科技公司股票当前是否值得买入？",
    participants=["tech_agent", "fundamental_agent", "sentiment_agent"],
)

# 2. 收集初始意见
opinions = [
    AgentOpinion(
        agent_id="tech_agent",
        agent_role="技术分析师",
        opinion="买入",
        confidence=0.75,
        reasoning="K线突破关键阻力位，MACD金叉，成交量放大",
        evidence=["阻力位突破", "MACD金叉", "量能放大"],
    ),
    AgentOpinion(
        agent_id="fundamental_agent",
        agent_role="基本面分析师",
        opinion="卖出",
        confidence=0.80,
        reasoning="营收增长放缓，利润率下降，估值偏高",
        evidence=["营收增速-15%", "毛利率-3pp", "PE>30"],
    ),
    AgentOpinion(
        agent_id="sentiment_agent",
        agent_role="情绪分析师",
        opinion="持有",
        confidence=0.60,
        reasoning="社交媒体讨论热度中性，无极端情绪",
        evidence=["社交情绪指数0.52", "新闻报道中性"],
    ),
]

negotiation = engine.collect_opinions(negotiation, opinions)

# 3. 协商解决
result = engine.resolve(negotiation)
print(f"共识：{result['consensus']}")
print(f"置信度：{result['confidence']}")
print(f"方式：{result['method']}")
print(f"轮次：{result['rounds']}")

# 4. 如果僵局，用仲裁者
if negotiation.status == NegotiationStatus.DEADLOCKED:
    arbitration = arbitrator.arbitrate(
        question=negotiation.question,
        opinions=negotiation.opinions,
        negotiation_history=negotiation.rounds,
    )
    print(f"仲裁结果：{arbitration['verdict']}")
```

---

## 6. 协商策略对比

| 策略 | 适用场景 | 速度 | 质量 | 成本 |
|------|---------|------|------|------|
| 一致同意 | 所有 Agent 同意 | 快 | 高 | 低 |
| 加权投票 | 有专业度差异 | 快 | 中 | 低 |
| 多轮协商 | 复杂分歧 | 慢 | 高 | 高 |
| 仲裁者 | 协商失败 | 中 | 取决于仲裁者 | 中 |
| 混合模式 | 生产推荐 | 中 | 高 | 中 |

### 混合模式流程

```
1. 收集初始意见
2. 一致？→ 是 → 完成
3. 一致？→ 否 → 第1轮协商
4. 一致？→ 是 → 完成
5. 一致？→ 否 → 第2轮协商
6. 一致？→ 是 → 完成
7. 一致？→ 否 → 加权投票
8. 加权投票有明确赢家？→ 是 → 完成
9. 仍然僵局？→ 是 → 仲裁者裁决
```

---

## 7. 配置参考

| 配置 | 推荐值 | 说明 |
|------|--------|------|
| 最大协商轮次 | 3 | 太多浪费 Token |
| 置信度阈值 | 0.6 | 低于此值标记低置信 |
| 仲裁者模型 | gpt-4o | 仲裁需要更强能力 |
| 协商超时 | 30s | 防止无限讨论 |
| 最少参与者 | 2 | 至少 2 个 Agent |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有协商状态模型 | ☐ |
| 有多轮讨论机制 | ☐ |
| 有加权投票 | ☐ |
| 有仲裁者模式 | ☐ |
| 有僵局检测 | ☐ |
| 有超时处理 | ☐ |
| 有协商历史记录 | ☐ |
| 有置信度追踪 | ☐ |
