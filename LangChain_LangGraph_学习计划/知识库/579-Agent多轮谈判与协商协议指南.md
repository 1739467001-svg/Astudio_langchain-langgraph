# Agent 多轮谈判与协商协议指南

> 买卖双方 Agent 如何谈判价格？多方如何达成共识？本指南讲解谈判策略、让步模型、多轮协商协议、以及僵局处理。

---

## 1. 谈判模型

```mermaid
graph TB
    INIT["发起谈判"] --> OFFER["甲方出价"]
    OFFER --> EVAL["乙方评估"]
    EVAL --> ACCEPT{"接受?"}
    ACCEPT -->|"是"| DEAL["达成协议"]
    ACCEPT -->|"否"| COUNTER["乙方还价"]
    COUNTER --> OFFER2["甲方再评估"]
    OFFER2 --> ROUND{"达到轮次上限?"}
    ROUND -->|"否"| OFFER
    ROUND -->|"是"| DEADLOCK["僵局/仲裁"]

    style OFFER fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style DEAL fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style DEADLOCK fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

---

## 2. 谈判实现

```python
@dataclass
class NegotiationAgent:
    """谈判 Agent"""

    async def negotiate(self, my_goal: dict, opponent_profile: dict,
                        max_rounds: int = 5) -> dict:
        """多轮谈判"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.5)

        current_offer = my_goal.get("initial_offer", {})
        rounds = []

        for round_num in range(max_rounds):
            # 1. 生成报价
            response = await llm.ainvoke(f"""你是谈判 Agent。

我的目标: {json.dumps(my_goal, ensure_ascii=False)}
对手画像: {json.dumps(opponent_profile, ensure_ascii=False)}
当前报价: {json.dumps(current_offer, ensure_ascii=False)}
轮次: {round_num + 1}/{max_rounds}

策略:
- 前2轮强硬，后3轮逐步让步
- 每次让步不超过 10%
- 维护底线: {my_goal.get('reservation', {})}

输出 JSON:
{{
    "offer": {{"price": 0, "terms": "..."}},
    "concession_made": "让步内容",
    "strategy": "策略说明",
    "walk_away": false
}}""")

            offer = json.loads(response.content)
            rounds.append({"round": round_num + 1, "offer": offer})

            # 模拟对手评估
            accepted = await self._opponent_evaluate(offer["offer"], opponent_profile)
            if accepted:
                return {"agreed": True, "final_offer": offer["offer"], "rounds": rounds}

            if offer.get("walk_away"):
                return {"agreed": False, "reason": "我方退出", "rounds": rounds}

            current_offer = offer["offer"]

        return {"agreed": False, "reason": "达到最大轮次", "rounds": rounds}

    async def _opponent_evaluate(self, offer: dict, profile: dict) -> bool:
        """对手评估"""
        reservation = profile.get("reservation_price", 0)
        return offer.get("price", 0) >= reservation
```

---

## 3. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解谈判流程 | ☐ |
| 实现了多轮谈判 | ☐ |
| 有让步策略 | ☐ |
| 有僵局处理 | ☐ |

---

## 4. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 392 | Agent 协商与共识 | 协商 |
| 422 | Agent 协商与共识 | 协商 |
| 456 | 多 Agent 博弈 | 博弈 |
| 574 | 博弈论 | 博弈 |
