# Agent 自适应推理与动态策略选择指南

> 不同问题需要不同策略——简单问题快速回答、复杂问题深度推理。Agent 需要动态选择最优策略。本指南讲解策略选择、自适应路由、推理深度控制。

---

## 1. 动态策略选择

```mermaid
graph TB
    Q["用户问题"] --> CLASSIFY["问题分类"]
    CLASSIFY --> SIMPLE["简单<br/>直接回答"]
    CLASSIFY --> MODERATE["中等<br/>CoT推理"]
    CLASSIFY --> COMPLEX["复杂<br/>多步推理+工具"]
    CLASSIFY --> CREATIVE["创意<br/>高温度生成"]

    style CLASSIFY fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style COMPLEX fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
```

---

## 2. 自适应路由

```python
@dataclass
class AdaptiveReasoningRouter:
    """自适应推理路由器"""

    async def route(self, query: str, context: dict = None) -> dict:
        """根据问题特征选择最优策略"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        response = await llm.ainvoke(f"""分析问题并选择处理策略。

问题: {query}
上下文: {json.dumps(context or {}, ensure_ascii=False)[:200]}

输出 JSON:
{{
    "complexity": "simple/moderate/complex/creative",
    "strategy": "direct/cot/multi_step/creative",
    "model": "gpt-4o-mini/gpt-4o/o3-mini",
    "temperature": 0.0,
    "max_tokens": 1024,
    "needs_tools": false,
    "needs_retrieval": false,
    "estimated_latency_ms": 2000,
    "estimated_cost": 0.005,
    "reasoning": "选择理由"
}}""")

        config = json.loads(response.content)

        # 按策略执行
        if config["strategy"] == "direct":
            result = await self._direct(query, config)
        elif config["strategy"] == "cot":
            result = await self._chain_of_thought(query, config)
        elif config["strategy"] == "multi_step":
            result = await self._multi_step(query, config)
        else:
            result = await self._creative(query, config)

        return {**config, "result": result}

    async def _direct(self, query, config):
        llm = ChatOpenAI(model=config["model"], temperature=config["temperature"])
        return (await llm.ainvoke(query)).content

    async def _chain_of_thought(self, query, config):
        llm = ChatOpenAI(model=config["model"], temperature=config["temperature"])
        return (await llm.ainvoke(f"{query}\n\n让我们一步一步思考。")).content

    async def _multi_step(self, query, config):
        llm = ChatOpenAI(model=config["model"], temperature=config["temperature"])
        response = await llm.ainvoke(f"分步骤解决: {query}")
        return response.content

    async def _creative(self, query, config):
        llm = ChatOpenAI(model=config["model"], temperature=config["temperature"])
        return (await llm.ainvoke(query)).content
```

---

## 3. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解动态策略选择 | ☐ |
| 实现了自适应路由 | ☐ |
| 有推理深度控制 | ☐ |
| 有成本优化 | ☐ |

---

## 4. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 513 | 推理链优化 | 推理 |
| 575 | 认知架构 | 认知 |
| 428 | 推理模型集成 | 推理模型 |
| 570 | 实时决策 | 实时 |
