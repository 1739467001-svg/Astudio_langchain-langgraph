# Agent 知识图谱推理与因果推断指南

> 传统 RAG 只做语义检索——"A 导致 B"的关系无法通过向量相似度回答。知识图谱推理 + 因果推断让 Agent 能进行"为什么"级别的深度推理。本指南讲解图谱推理、因果发现、反事实推理、以及在医疗/金融中的应用。

---

## 1. 图谱推理 vs 向量检索

```mermaid
graph TB
    Q["用户问题: A为什么导致C?"]

    Q --> VEC["向量检索<br/>找相似文档<br/>可能找到A和C的描述<br/>但找不到因果关系"]
    Q --> GRAPH["图谱推理<br/>沿边行走<br/>A→B→C<br/>发现中间因果关系"]

    style VEC fill:#FFCCBC,stroke:#D84315
    style GRAPH fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 因果推断

```python
@dataclass
class CausalInference:
    """因果推断引擎"""

    async def discover_causality(self, data: dict, domain: str = "general") -> dict:
        """从数据中发现因果关系"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        response = await llm.ainvoke(f"""从数据中发现因果关系。

领域: &#123;domain&#125;
数据: &#123;json.dumps(data, ensure_ascii=False)[:2000]&#125;

输出 JSON:
&#123;&#123;
    "causal_chains": [
        &#123;&#123;"cause": "变量A", "effect": "变量B", "mechanism": "因果机制", "confidence": 0.85&#125;&#125;
    ],
    "confounders": ["混淆变量"],
    "interventions": [&#123;&#123;"intervene": "改变A", "expected_effect": "B的变化"&#125;&#125;],
    "counterfactuals": ["如果A不发生，B会怎样？"]
&#125;&#125;""")

        return json.loads(response.content)

    async def counterfactual(self, scenario: dict, intervention: str) -> dict:
        """反事实推理：如果X不同，结果会怎样？"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""反事实推理。

场景: &#123;json.dumps(scenario, ensure_ascii=False)[:1000]&#125;
假设: 如果 &#123;intervention&#125;

推理:
1. 在因果图中切断相关边
2. 重新推演
3. 预测新结果

输出 JSON:
&#123;&#123;
    "original_outcome": "原始结果",
    "counterfactual_outcome": "反事实结果",
    "difference": "差异分析",
    "confidence": 0.8,
    "reasoning": "推理过程"
&#125;&#125;""")

        return json.loads(response.content)
```

---

## 3. 多跳因果推理

```python
@dataclass
class MultiHopCausalReasoning:
    """多跳因果推理"""

    async def reason(self, question: str, graph: dict) -> dict:
        """多跳推理"""
        # 1. 识别问题中的实体
        entities = await self._extract_entities(question)

        # 2. 在因果图中找路径
        paths = await self._find_causal_paths(graph, entities[0], entities[1])

        # 3. LLM 沿路径推理
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""沿因果路径推理。

问题: &#123;question&#125;
因果路径: &#123;json.dumps(paths, ensure_ascii=False)&#125;

逐步推理每条路径的因果关系，回答问题。""")

        return &#123;
            "answer": response.content,
            "reasoning_paths": paths,
            "hops": len(paths),
        &#125;

    async def _extract_entities(self, question: str) -> list:
        """提取实体"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        response = await llm.ainvoke(f"提取问题中的关键实体。只返回逗号分隔的实体列表。\n&#123;question&#125;")
        return [e.strip() for e in response.content.split(",")]

    async def _find_causal_paths(self, graph: dict, start: str, end: str) -> list:
        """在因果图中寻找路径"""
        # BFS
        from collections import deque
        queue = deque([(start, [start])])
        visited = &#123;start&#125;

        while queue:
            node, path = queue.popleft()
            if node == end:
                return path

            for edge in graph.get("edges", []):
                if edge["source"] == node and edge["target"] not in visited:
                    visited.add(edge["target"])
                    queue.append((edge["target"], path + [edge["target"]]))

        return []
```

---

## 4. 应用场景

| 场景 | 因果问题 | 推理方式 |
|------|---------|---------|
| 医疗 | 药物→副作用→并发症 | 多跳因果链 |
| 金融 | 降息→汇率→出口 | 反事实推理 |
| 交通 | 拥堵→绕行→新拥堵 | 因果反馈环 |
| 经济 | 政策→市场→消费 | 干预分析 |

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解图谱推理 vs 向量检索 | ☐ |
| 实现了因果发现 | ☐ |
| 实现了反事实推理 | ☐ |
| 实现了多跳因果推理 | ☐ |
| 知道因果推断应用场景 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 463 | GraphRAG | 图谱 |
| 444 | Agent 可解释性 | 解释 |
| 513 | 推理链优化 | 推理 |
| 523 | 医疗辅助 | 医疗 |
| 524 | 金融风控 | 金融 |
