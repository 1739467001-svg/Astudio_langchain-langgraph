# 多 Agent 仿真与群体智能指南

> 一个 Agent 聪明，一百个 Agent 会怎样？群体智能研究的是：简单的个体规则如何产生复杂的集体行为——鸟群同步飞行、蚂蚁找到最短路径、蜜蜂集体决策。当多个 LLM Agent 交互时，会涌现出什么行为？本指南系统讲解群体智能原理、多 Agent 仿真框架、涌现行为检测，以及实际应用场景。

---

## 1. 群体智能原理

### 核心思想

```
群体智能（Swarm Intelligence）：
  个体简单 + 大量交互 = 复杂集体行为

经典案例：
  蚁群觅食：单只蚂蚁只遵循信息素规则
    → 但蚁群整体能找到最短路径

  鸟群飞行：每只鸟只关注邻居的 3 条规则
    → 但鸟群整体呈现优美的同步运动

  蜂群决策：每只蜜蜂只做简单比较
    → 但蜂群整体能选出最佳筑巢地点

LLM Agent 群体：
  每个 Agent 有简单规则（角色 + Prompt）
    → 群体交互可能涌现：共识/分歧/分工/协作/竞争
```

### Boid 模型（鸟群三规则）

```python
@dataclass
class BoidRules:
    """鸟群行为三规则（可映射到 Agent 群体）"""

    # 规则1：分离（避免拥挤）
    def separation(self, agent: dict, neighbors: list) -> dict:
        """Agent 之间保持距离"""
        if not neighbors:
            return &#123;"dx": 0, "dy": 0&#125;
        dx = sum(agent["x"] - n["x"] for n in neighbors) / len(neighbors)
        dy = sum(agent["y"] - n["y"] for n in neighbors) / len(neighbors)
        return &#123;"dx": dx * 0.5, "dy": dy * 0.5&#125;

    # 规则2：对齐（与邻居方向一致）
    def alignment(self, agent: dict, neighbors: list) -> dict:
        """与周围 Agent 方向一致"""
        if not neighbors:
            return &#123;"dx": 0, "dy": 0&#125;
        dx = sum(n["dx"] for n in neighbors) / len(neighbors)
        dy = sum(n["dy"] for n in neighbors) / len(neighbors)
        return &#123;"dx": (dx - agent["dx"]) * 0.1, "dy": (dy - agent["dy"]) * 0.1&#125;

    # 规则3：聚合（向群体中心靠近）
    def cohesion(self, agent: dict, neighbors: list) -> dict:
        """向群体中心移动"""
        if not neighbors:
            return &#123;"dx": 0, "dy": 0&#125;
        cx = sum(n["x"] for n in neighbors) / len(neighbors)
        cy = sum(n["y"] for n in neighbors) / len(neighbors)
        return &#123;"dx": (cx - agent["x"]) * 0.01, "cy": (cy - agent["y"]) * 0.01&#125;
```

---

## 2. 多 Agent 仿真框架

### Agent 仿真器

```python
from dataclasses import dataclass, field
from langchain_openai import ChatOpenAI
import asyncio

@dataclass
class SwarmAgent:
    """群体智能中的单个 Agent"""
    agent_id: str
    role: str               # 角色
    position: dict          # 在观点空间中的位置
    velocity: dict          # 观点变化方向
    knowledge: str = ""     # 知识/立场
    neighbors: list = field(default_factory=list)
    llm: ChatOpenAI = None

    async def update(self, all_agents: list):
        """更新 Agent 状态"""
        # 找到邻居（观点相近的 Agent）
        self.neighbors = self._find_neighbors(all_agents)

        # 用 LLM 决策
        neighbor_views = [a.knowledge for a in self.neighbors[:5]]
        prompt = f"""你是 &#123;self.role&#125;。
你的当前观点: &#123;self.knowledge&#125;
其他人的观点: &#123;neighbor_views&#125;

请更新你的观点。可以：
1. 坚持原观点
2. 部分调整
3. 改变立场

只输出你的新观点（100字以内）。"""

        response = await self.llm.ainvoke(prompt)
        self.knowledge = response.content

    def _find_neighbors(self, all_agents: list) -> list:
        """找到观点相近的邻居"""
        # 用文本相似度
        scores = []
        for a in all_agents:
            if a.agent_id == self.agent_id:
                continue
            similarity = self._text_similarity(self.knowledge, a.knowledge)
            scores.append((a, similarity))

        scores.sort(key=lambda x: -x[1])
        return [a for a, _ in scores[:10]]

    @staticmethod
    def _text_similarity(t1: str, t2: str) -> float:
        words1 = set(t1.split())
        words2 = set(t2.split())
        if not words1 or not words2:
            return 0
        return len(words1 & words2) / len(words1 | words2)


@dataclass
class SwarmSimulator:
    """群体智能仿真器"""

    async def simulate(self, agents: list, rounds: int = 10, topic: str = "") -> dict:
        """运行群体仿真"""
        history = []

        for round_num in range(rounds):
            # 并行更新所有 Agent
            tasks = [agent.update(agents) for agent in agents]
            await asyncio.gather(*tasks)

            # 记录状态
            snapshot = &#123;
                "round": round_num + 1,
                "agents": [&#123;"id": a.agent_id, "role": a.role, "knowledge": a.knowledge&#125; for a in agents],
                "consensus": self._measure_consensus(agents),
                "diversity": self._measure_diversity(agents),
            &#125;
            history.append(snapshot)

            print(f"Round &#123;round_num+1&#125;: 共识度=&#123;snapshot['consensus']:.2f&#125;, 多样性=&#123;snapshot['diversity']:.2f&#125;")

        return &#123;
            "rounds": rounds,
            "topic": topic,
            "history": history,
            "final_consensus": self._measure_consensus(agents),
            "final_diversity": self._measure_diversity(agents),
            "emergent_behavior": self._detect_emergence(history),
        &#125;

    def _measure_consensus(self, agents: list) -> float:
        """测量共识度（0=完全分歧, 1=完全一致）"""
        if not agents:
            return 0
        all_words = [set(a.knowledge.split()) for a in agents]
        if not all_words or not all_words[0]:
            return 0

        # 计算两两相似度平均
        similarities = []
        for i in range(len(all_words)):
            for j in range(i+1, len(all_words)):
                if all_words[i] and all_words[j]:
                    sim = len(all_words[i] & all_words[j]) / len(all_words[i] | all_words[j])
                    similarities.append(sim)

        return sum(similarities) / len(similarities) if similarities else 0

    def _measure_diversity(self, agents: list) -> float:
        """测量多样性（0=完全相同, 1=完全不同）"""
        return 1 - self._measure_consensus(agents)

    def _detect_emergence(self, history: list) -> list:
        """检测涌现行为"""
        emergent = []

        # 检测共识形成
        if len(history) >= 3:
            early_consensus = history[0]["consensus"]
            late_consensus = history[-1]["consensus"]
            if late_consensus > early_consensus + 0.2:
                emergent.append(&#123;
                    "type": "consensus_formation",
                    "description": f"共识度从 &#123;early_consensus:.2f&#125; 上升到 &#123;late_consensus:.2f&#125;",
                &#125;)

        # 检测角色分化
        if len(history) >= 5:
            emergent.append(&#123;
                "type": "role_differentiation",
                "description": "Agent 可能形成了不同的角色分工",
            &#125;)

        # 检测观点聚类
        if len(history) >= 5:
            emergent.append(&#123;
                "type": "opinion_clustering",
                "description": "可能形成了不同的观点阵营",
            &#125;)

        return emergent
```

---

## 3. 应用场景

### 场景1：市场仿真

```python
async def market_simulation():
    """多 Agent 市场仿真：模拟买卖双方行为"""
    buyers = [SwarmAgent(
        agent_id=f"buyer_&#123;i&#125;",
        role="消费者",
        knowledge="我想买便宜的好产品",
        llm=ChatOpenAI(model="gpt-4o-mini", temperature=0.7),
    ) for i in range(5)]

    sellers = [SwarmAgent(
        agent_id=f"seller_&#123;i&#125;",
        role="商家",
        knowledge="我想卖高价但要有竞争力",
        llm=ChatOpenAI(model="gpt-4o-mini", temperature=0.7),
    ) for i in range(3)]

    all_agents = buyers + sellers
    simulator = SwarmSimulator()
    result = await simulator.simulate(all_agents, rounds=10, topic="市场定价")
    return result
```

### 场景2：社会舆论仿真

```python
async def opinion_simulation(topic: str, num_agents: int = 20):
    """舆论传播仿真"""
    # 创建初始观点不同的 Agent
    initial_views = ["支持", "反对", "中立", "不确定"]
    agents = []
    for i in range(num_agents):
        view = initial_views[i % len(initial_views)]
        agents.append(SwarmAgent(
            agent_id=f"agent_&#123;i&#125;",
            role=f"公民&#123;i&#125;",
            knowledge=f"我对'&#123;topic&#125;'的观点是&#123;view&#125;",
            llm=ChatOpenAI(model="gpt-4o-mini", temperature=0.7),
        ))

    simulator = SwarmSimulator()
    return await simulator.simulate(agents, rounds=15, topic=topic)
```

### 场景3：集体决策

```python
async def collective_decision(problem: str, num_agents: int = 10):
    """集体决策仿真"""
    agents = [SwarmAgent(
        agent_id=f"expert_&#123;i&#125;",
        role=f"专家&#123;i&#125;",
        knowledge=f"关于'&#123;problem&#125;'，我的初步看法是...",
        llm=ChatOpenAI(model="gpt-4o", temperature=0.5),
    ) for i in range(num_agents)]

    simulator = SwarmSimulator()
    result = await simulator.simulate(agents, rounds=8, topic=problem)

    # 最终综合所有专家意见
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    all_views = "\n".join([f"&#123;a.role&#125;: &#123;a.knowledge&#125;" for a in agents])
    final = await llm.ainvoke(
        f"综合以下专家意见给出最终决策建议：\n\n问题: &#123;problem&#125;\n专家观点:\n&#123;all_views&#125;"
    )

    return &#123;**result, "final_decision": final.content&#125;
```

---

## 4. 涌现行为分析

```python
@dataclass
class EmergenceAnalyzer:
    """涌现行为分析器"""

    def analyze(self, simulation_history: list) -> dict:
        """分析仿真中的涌现行为"""
        return &#123;
            "consensus_trend": self._trend([h["consensus"] for h in simulation_history]),
            "diversity_trend": self._trend([h["diversity"] for h in simulation_history]),
            "phases": self._identify_phases(simulation_history),
            "convergence_round": self._find_convergence(simulation_history),
        &#125;

    def _trend(self, values: list) -> str:
        """趋势分析"""
        if len(values) < 2:
            return "insufficient_data"
        diff = values[-1] - values[0]
        if diff > 0.1:
            return "increasing"
        elif diff < -0.1:
            return "decreasing"
        return "stable"

    def _identify_phases(self, history: list) -> list:
        """识别阶段"""
        phases = []
        for i, h in enumerate(history):
            if i == 0:
                phases.append(&#123;"round": 1, "phase": "initial"&#125;)
            elif h["consensus"] > 0.7:
                phases.append(&#123;"round": i+1, "phase": "converged"&#125;)
            elif h["diversity"] > 0.7:
                phases.append(&#123;"round": i+1, "phase": "diverse"&#125;)
            else:
                phases.append(&#123;"round": i+1, "phase": "negotiating"&#125;)
        return phases

    def _find_convergence(self, history: list) -> int:
        """找到收敛轮次"""
        for i, h in enumerate(history):
            if h["consensus"] > 0.7:
                return i + 1
        return -1  # 未收敛
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解群体智能原理 | ☐ |
| 理解 Boid 三规则 | ☐ |
| 实现了多 Agent 仿真器 | ☐ |
| 能测量共识度和多样性 | ☐ |
| 实现了涌现行为检测 | ☐ |
| 能运行市场/舆论/决策仿真 | ☐ |
| 理解涌现行为分析 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 07 | 多 Agent 架构图解 | 多 Agent 基础 |
| 61 | 共识机制 | 共识 |
| 07 | 多 Agent 架构 | 架构 |
| 156 | 多 Agent 协调模式 | 协调 |
| 392 | Agent 协商与共识机制 | 协商 |
| 422 | Agent 协商与共识机制 | 协商 |
| 456 | 多 Agent 博弈与资源调度 | 博弈 |
| 462 | Agent 设计模式 | 设计模式 |
