# Agent 自进化与持续学习闭环指南

> Agent 上线后如何越来越聪明？不是靠人工调 Prompt，而是建立自动反馈→分析→优化→验证的闭环。本指南深度讲解自进化架构、在线学习、经验回放、以及防止灾难性遗忘。

---

## 1. 自进化闭环

```mermaid
graph LR
    RUN["Agent 运行"] --> COLLECT["收集反馈<br/>评分/投诉/成功案例"]
    COLLECT --> ANALYZE["自动分析<br/>失败模式+成功模式"]
    ANALYZE --> OPTIMIZE["自动优化<br/>Few-shot/Prompt/工具"]
    OPTIMIZE --> VALIDATE["离线验证<br/>评估集对比"]
    VALIDATE --> DEPLOY["灰度上线<br/>渐进部署"]
    DEPLOY --> RUN

    style COLLECT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style OPTIMIZE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style VALIDATE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

---

## 2. 在线学习

```python
@dataclass
class OnlineLearner:
    """在线学习：从每次交互中学习"""

    experience_buffer: list = field(default_factory=list)
    max_buffer: int = 1000

    async def learn_from_interaction(self, interaction: dict):
        """从单次交互中学习"""
        # 1. 评估交互质量
        quality = await self._evaluate(interaction)

        # 2. 存入经验缓冲
        self.experience_buffer.append(&#123;
            "query": interaction["query"],
            "response": interaction["response"],
            "quality": quality,
            "timestamp": datetime.utcnow().isoformat(),
        &#125;)

        # 3. 缓冲溢出时淘汰低质量
        if len(self.experience_buffer) > self.max_buffer:
            self.experience_buffer.sort(key=lambda x: x["quality"])
            self.experience_buffer = self.experience_buffer[-self.max_buffer:]

    async def select_few_shot(self, query: str, n: int = 3) -> list:
        """从经验中选出最佳 Few-shot"""
        # 找最相似的高质量案例
        scored = []
        for exp in self.experience_buffer:
            if exp["quality"] > 0.7:
                similarity = self._similarity(query, exp["query"])
                scored.append((exp, similarity))

        scored.sort(key=lambda x: -x[1])
        return [s[0] for s in scored[:n]]

    async def _evaluate(self, interaction: dict) -> float:
        """评估交互质量"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        response = await llm.ainvoke(
            f"评估回答质量（0-1）。只回答数字。\n问题: &#123;interaction['query'][:200]&#125;\n回答: &#123;interaction['response'][:200]&#125;"
        )
        try:
            return float(response.content.strip())
        except:
            return 0.5

    def _similarity(self, q1: str, q2: str) -> float:
        words1 = set(q1.split())
        words2 = set(q2.split())
        if not words1 or not words2:
            return 0
        return len(words1 & words2) / len(words1 | words2)
```

---

## 3. 防止灾难性遗忘

```python
@dataclass
class AntiForgetting:
    """防止灾难性遗忘"""

    async def replay_buffer(self, new_data: list, old_data: list,
                           ratio: float = 0.3) -> list:
        """经验回放：混合新数据和旧数据"""
        # 从旧数据中采样
        import random
        replay_size = int(len(new_data) * ratio)
        replay_samples = random.sample(old_data, min(replay_size, len(old_data)))

        # 混合
        mixed = new_data + replay_samples
        random.shuffle(mixed)
        return mixed

    async def elastic_weight_consolidation(self, old_weights: dict,
                                           new_weights: dict,
                                           fisher_matrix: dict,
                                           lambda_ewc: float = 0.1) -> dict:
        """EWC：对重要参数施加正则化"""
        consolidated = &#123;&#125;
        for key in new_weights:
            if key in fisher_matrix:
                # EWC 正则项
                penalty = lambda_ewc * fisher_matrix[key] * (new_weights[key] - old_weights[key]) ** 2
                consolidated[key] = new_weights[key] - 0.01 * penalty
            else:
                consolidated[key] = new_weights[key]
        return consolidated
```

---

## 4. 自动 Prompt 优化

```python
@dataclass
class AutoPromptOptimizer:
    """自动 Prompt 优化器"""

    async def optimize(self, current_prompt: str, feedback_data: list) -> dict:
        """基于反馈自动优化 Prompt"""
        # 1. 分析失败案例
        failures = [f for f in feedback_data if f.get("rating", 3) <= 2]
        successes = [f for f in feedback_data if f.get("rating", 3) >= 4]

        if not failures:
            return &#123;"optimized": False, "reason": "无失败案例"&#125;

        llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

        response = await llm.ainvoke(f"""你是 Prompt 优化专家。

当前 Prompt:
&#123;current_prompt&#125;

失败案例（用户不满意）:
&#123;json.dumps([&#123;"q": f["query"][:100], "a": f["response"][:100]&#125; for f in failures[:5]], ensure_ascii=False)&#125;

成功案例（用户满意）:
&#123;json.dumps([&#123;"q": f["query"][:100], "a": f["response"][:100]&#125; for f in successes[:5]], ensure_ascii=False)&#125;

分析失败原因，输出优化后的 Prompt。只输出 Prompt 本身。""")

        return &#123;
            "optimized": True,
            "old_prompt": current_prompt,
            "new_prompt": response.content,
            "analysis": f"分析了 &#123;len(failures)&#125; 个失败案例",
        &#125;
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解自进化闭环 | ☐ |
| 实现在线学习 | ☐ |
| 实现经验回放 | ☐ |
| 理解 EWC 防遗忘 | ☐ |
| 实现自动 Prompt 优化 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 414 | 数据飞轮与持续学习 | 飞轮 |
| 468 | 自动 Prompt 优化 | DSPy |
| 496 | Agent 经验沉淀 | 经验 |
| 423 | 反馈循环与自动调优 | 反馈 |
| 515 | Agent 记忆架构 | 记忆 |
