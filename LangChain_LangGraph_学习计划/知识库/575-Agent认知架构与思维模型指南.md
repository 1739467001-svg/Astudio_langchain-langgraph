# Agent 认知架构与思维模型指南

> Agent 如何"思考"？人类有系统1（快思考）和系统2（慢思考）——Agent 也需要类似的双系统认知架构。本指南深度讲解认知架构设计、思维链工程化、元认知、以及认知偏差缓解。

---

## 1. 双系统认知架构

```mermaid
graph TB
    INPUT["输入"] --> S1["系统1: 快思考<br/>直觉/模式匹配<br/>快速响应"]
    INPUT --> S2["系统2: 慢思考<br/>深度推理/规划<br/>复杂决策"]

    S1 --> CONFIDENT{"置信度高?"}
    CONFIDENT -->|"是"| OUTPUT["直接输出"]
    CONFIDENT -->|"否"| S2
    S2 --> OUTPUT

    style S1 fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style S2 fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
```

---

## 2. 认知架构实现

```python
@dataclass
class CognitiveAgent:
    """双系统认知 Agent"""

    async def think(self, query: str) -> dict:
        """双系统思考"""
        # 系统1: 快速直觉
        fast_response = await self._system1(query)
        confidence = fast_response.get("confidence", 0)

        if confidence >= 0.85:
            return {
                "system": "system1_fast",
                "answer": fast_response["answer"],
                "confidence": confidence,
                "latency_ms": fast_response.get("latency_ms", 100),
            }

        # 系统2: 深度推理
        slow_response = await self._system2(query, fast_response)

        return {
            "system": "system2_slow",
            "answer": slow_response["answer"],
            "reasoning": slow_response.get("reasoning", ""),
            "confidence": slow_response.get("confidence", 0),
            "latency_ms": slow_response.get("latency_ms", 3000),
        }

    async def _system1(self, query: str) -> dict:
        """系统1: 快速模式匹配"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        start = time.time()

        response = await llm.ainvoke(
            f"快速回答（50字内）。如果不确定，回答'需要深入分析'。\n{query}"
        )

        confident = "需要深入分析" not in response.content
        return {
            "answer": response.content,
            "confidence": 0.9 if confident else 0.4,
            "latency_ms": (time.time() - start) * 1000,
        }

    async def _system2(self, query: str, fast_attempt: dict) -> dict:
        """系统2: 深度推理"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)
        start = time.time()

        response = await llm.ainvoke(f"""深度推理回答。

问题: {query}
初步判断: {fast_attempt.get('answer', '')}

请:
1. 分析问题的多个维度
2. 考虑边界情况
3. 给出有依据的结论
4. 评估置信度

回答:""")

        return {
            "answer": response.content,
            "reasoning": "多维度分析+边界考虑",
            "confidence": 0.85,
            "latency_ms": (time.time() - start) * 1000,
        }

    async def metacognition(self, answer: str, query: str) -> dict:
        """元认知: 思考自己的思考"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        response = await llm.ainvoke(f"""评估自己的回答质量。

问题: {query}
我的回答: {answer[:500]}

反思:
1. 回答是否准确?
2. 是否遗漏了重要方面?
3. 有没有认知偏差?
4. 置信度评估

输出 JSON:
{{
    "self_assessment": "自我评估",
    "accuracy": 0.85,
    "completeness": 0.80,
    "potential_bias": "可能的偏差",
    "improvement": "改进建议"
}}""")

        return json.loads(response.content)
```

---

## 3. 认知偏差缓解

| 偏差 | 表现 | 缓解策略 |
|------|------|---------|
| 确认偏差 | 只找支持自己的证据 | 主动考虑反面 |
| 锚定效应 | 被第一个信息锚定 | 多角度分析 |
| 可得性偏差 | 容易回忆的认为常见 | 数据驱动 |
| 过度自信 | 高估自己的准确性 | 元认知反思 |
| 框架效应 | 受表述方式影响 | 换角度表述 |

---

## 4. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解双系统认知架构 | ☐ |
| 实现了系统1+系统2 | ☐ |
| 实现了元认知 | ☐ |
| 知道5种认知偏差 | ☐ |
| 有偏差缓解策略 | ☐ |

---

## 5. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 513 | 推理链优化与思维链 | 推理 |
| 560 | 自进化与持续学习 | 进化 |
| 447 | AI 伦理与偏见检测 | 偏见 |
| 571 | 自然语言交互设计 | 交互 |
