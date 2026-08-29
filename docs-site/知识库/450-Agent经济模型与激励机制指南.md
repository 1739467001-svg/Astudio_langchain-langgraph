# Agent 经济模型与激励机制指南

> 当多个 Agent 协作时，谁做什么、收益怎么分？当 Agent 代表用户购买 API 服务时，怎么控制预算？当 Agent 在市场上自主交易时，怎么定价？Agent 不只是技术系统，它还涉及"经济系统"——成本控制、资源分配、激励对齐、博弈策略。本指南系统讲解 Agent 的 Token 经济学、多 Agent 激励机制、预算控制，以及自主交易架构。

---

## 1. Agent 经济问题

### 为什么需要经济模型

```
场景1：多 Agent 协作
  Agent A 做检索、Agent B 做分析、Agent C 做报告
  谁的贡献大？Token 消耗怎么算？成本怎么分摊？

场景2：Agent 自主采购
  Agent 需要调用付费 API（搜索/翻译/图片生成）
  每次调用都花钱，怎么控制总预算？

场景3：Agent 市场
  多个 Agent 提供不同服务，用户选择哪个？
  价格怎么定？质量怎么保证？

场景4：资源竞争
  多个用户同时使用 Agent，GPU/API 配额有限
  怎么公平分配？优先级怎么排？
```

### Agent 经济学的核心问题

| 问题 | 说明 |
|------|------|
| 成本归因 | 每个 Agent/步骤消耗多少成本 |
| 预算控制 | 单次/日/月预算限制 |
| 激励对齐 | 让 Agent 选择成本效益最优的方案 |
| 资源分配 | 有限资源在多用户/Agent 间分配 |
| 定价策略 | Agent 服务的定价模型 |
| 质量激励 | 鼓励高质量输出的机制 |

---

## 2. Token 经济学

### 成本追踪模型

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class TokenEconomy:
    """Token 经济模型"""

    # 模型定价（美元/百万Token）
    pricing: dict = field(default_factory=lambda: &#123;
        "gpt-4o": &#123;"input": 2.50, "output": 10.00&#125;,
        "gpt-4o-mini": &#123;"input": 0.15, "output": 0.60&#125;,
        "o3-mini": &#123;"input": 1.10, "output": 4.40, "reasoning": 4.40&#125;,
        "claude-3.5-sonnet": &#123;"input": 3.00, "output": 15.00&#125;,
        "deepseek-v3": &#123;"input": 0.27, "output": 1.10&#125;,
    &#125;)

    async def track_cost(self, model: str, input_tokens: int,
                         output_tokens: int, reasoning_tokens: int = 0) -> float:
        """计算单次调用成本"""
        p = self.pricing.get(model, &#123;"input": 1.0, "output": 4.0&#125;)
        input_cost = input_tokens / 1_000_000 * p["input"]
        output_cost = output_tokens / 1_000_000 * p["output"]
        reasoning_cost = reasoning_tokens / 1_000_000 * p.get("reasoning", p["output"])
        total = input_cost + output_cost + reasoning_cost

        return &#123;
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "reasoning_tokens": reasoning_tokens,
            "input_cost": input_cost,
            "output_cost": output_cost,
            "reasoning_cost": reasoning_cost,
            "total_cost": total,
            "timestamp": datetime.utcnow().isoformat(),
        &#125;

    def recommend_model(self, task_complexity: str, budget: float) -> str:
        """根据任务复杂度和预算推荐模型"""
        recommendations = &#123;
            "simple": [
                ("gpt-4o-mini", 0.001),    # 成本/次
                ("deepseek-v3", 0.002),
            ],
            "moderate": [
                ("gpt-4o", 0.01),
                ("claude-3.5-sonnet", 0.02),
            ],
            "complex": [
                ("o3-mini", 0.03),
                ("claude-3.5-sonnet", 0.05),
            ],
        &#125;

        for model, cost in recommendations.get(task_complexity, []):
            if cost <= budget:
                return model
        return "gpt-4o-mini"  # 兜底
```

### 预算控制器

```python
@dataclass
class BudgetController:
    """Agent 预算控制器"""

    daily_budget: float = 10.0      # 日预算（美元）
    per_request_budget: float = 0.50  # 单次请求预算
    current_spent: float = 0.0
    request_history: list = field(default_factory=list)

    async def check_budget(self, estimated_cost: float) -> tuple[bool, str]:
        """检查预算"""
        # 检查单次预算
        if estimated_cost > self.per_request_budget:
            return False, f"预估成本 $&#123;estimated_cost:.4f&#125; 超过单次预算 $&#123;self.per_request_budget&#125;"

        # 检查日预算
        if self.current_spent + estimated_cost > self.daily_budget:
            remaining = self.daily_budget - self.current_spent
            return False, f"日预算不足，剩余 $&#123;remaining:.4f&#125;，需要 $&#123;estimated_cost:.4f&#125;"

        return True, ""

    async def record_spending(self, cost: float, model: str, task: str):
        """记录消费"""
        self.current_spent += cost
        self.request_history.append(&#123;
            "cost": cost,
            "model": model,
            "task": task,
            "timestamp": datetime.utcnow().isoformat(),
        &#125;)

    def get_daily_report(self) -> dict:
        """日消费报告"""
        return &#123;
            "daily_budget": self.daily_budget,
            "spent": self.current_spent,
            "remaining": self.daily_budget - self.current_spent,
            "usage_rate": self.current_spent / self.daily_budget,
            "request_count": len(self.request_history),
            "avg_cost_per_request": self.current_spent / max(len(self.request_history), 1),
            "by_model": self._breakdown_by_model(),
        &#125;

    def _breakdown_by_model(self) -> dict:
        """按模型分组"""
        by_model = &#123;&#125;
        for r in self.request_history:
            model = r["model"]
            if model not in by_model:
                by_model[model] = &#123;"count": 0, "cost": 0&#125;
            by_model[model]["count"] += 1
            by_model[model]["cost"] += r["cost"]
        return by_model
```

---

## 3. 成本效益路由

### 智能 Model Router

```python
@dataclass
class CostAwareRouter:
    """成本感知模型路由器"""

    budget: BudgetController = field(default_factory=BudgetController)

    async def route(self, query: str, conversation_history: list) -> dict:
        """根据查询特征和预算路由到最优模型"""

        # 1. 快速分类（用最便宜的模型）
        classification = await self._classify_query(query)
        complexity = classification["complexity"]
        task_type = classification["task_type"]

        # 2. 估算各模型成本
        estimated_input_tokens = len(query) // 3 + len(conversation_history) * 200
        estimates = &#123;
            "gpt-4o-mini": &#123;"cost": estimated_input_tokens / 1e6 * 0.15, "quality": 0.7&#125;,
            "gpt-4o": &#123;"cost": estimated_input_tokens / 1e6 * 2.50, "quality": 0.9&#125;,
            "o3-mini": &#123;"cost": estimated_input_tokens / 1e6 * 1.10, "quality": 0.95&#125;,
        &#125;

        # 3. 选择成本效益最优的模型
        budget_ok = False
        for model, est in sorted(estimates.items(), key=lambda x: x[1]["cost"]):
            ok, reason = await self.budget.check_budget(est["cost"])
            if ok:
                if complexity == "simple" and est["quality"] >= 0.7:
                    return &#123;"model": model, "cost": est["cost"]&#125;
                elif complexity == "moderate" and est["quality"] >= 0.9:
                    return &#123;"model": model, "cost": est["cost"]&#125;
                elif complexity == "complex" and est["quality"] >= 0.95:
                    return &#123;"model": model, "cost": est["cost"]&#125;
                budget_ok = True

        # 4. 预算允许但没有完美匹配，选最便宜的
        if budget_ok:
            cheapest = min(estimates.items(), key=lambda x: x[1]["cost"])
            return &#123;"model": cheapest[0], "cost": cheapest[1]["cost"]&#125;

        return &#123;"model": None, "reason": "预算不足"&#125;

    async def _classify_query(self, query: str) -> dict:
        """用便宜模型快速分类"""
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        response = await llm.ainvoke(
            f"分类问题复杂度（simple/moderate/complex）和类型（chat/code/analysis/reasoning）。只回答 JSON。\n&#123;query[:200]&#125;"
        )

        try:
            return json.loads(response.content)
        except:
            return &#123;"complexity": "moderate", "task_type": "chat"&#125;
```

---

## 4. 多 Agent 激励机制

### 贡度评估

```python
@dataclass
class AgentIncentiveSystem:
    """多 Agent 激励系统"""

    async def evaluate_contributions(self, agents: list, task_result: dict) -> dict:
        """评估各 Agent 的贡献度"""
        contributions = &#123;&#125;

        for agent in agents:
            # 贡献度评估维度
            score = 0

            # 1. 工具调用贡献（做了多少工作）
            tool_calls = agent.get("tool_calls", 0)
            score += min(tool_calls * 10, 30)  # 最多30分

            # 2. 输出质量（用 LLM 评判）
            quality = await self._evaluate_quality(agent.get("output", ""), task_result)
            score += quality * 40  # 最多40分

            # 3. 成本效率（做相同工作花的少）
            cost = agent.get("cost", 0)
            if cost > 0:
                efficiency = min(1.0, 0.01 / cost)  # 花费越少效率越高
                score += efficiency * 15  # 最多15分

            # 4. 任务关键性（是否做了核心步骤）
            is_critical = agent.get("is_critical_step", False)
            score += 15 if is_critical else 0  # 最多15分

            contributions[agent["id"]] = &#123;
                "total_score": min(score, 100),
                "tool_calls": tool_calls,
                "quality": quality,
                "cost": cost,
                "is_critical": is_critical,
            &#125;

        return contributions

    async def allocate_budget(self, contributions: dict, total_budget: float) -> dict:
        """根据贡献度分配预算"""
        total_score = sum(c["total_score"] for c in contributions.values())

        allocation = &#123;&#125;
        for agent_id, contrib in contributions.items():
            share = contrib["total_score"] / total_score if total_score > 0 else 0
            allocation[agent_id] = &#123;
                "budget_share": total_budget * share,
                "percentage": share,
            &#125;

        return allocation
```

### 质量激励

```python
@dataclass
class QualityIncentive:
    """质量激励机制"""

    async def reward_quality(self, agent_output: str, user_feedback: str) -> dict:
        """根据质量给予奖励"""
        # 用户反馈：positive / neutral / negative
        if "好" in user_feedback or "满意" in user_feedback:
            reward = 1.0
        elif "差" in user_feedback or "不满意" in user_feedback:
            reward = -0.5
        else:
            reward = 0.0

        # 质量评分
        quality_score = await self._evaluate_quality(agent_output)

        return &#123;
            "user_reward": reward,
            "quality_score": quality_score,
            "total_reward": reward + quality_score * 0.5,
            "recommendation": "增加预算" if reward > 0.5 else "减少预算" if reward < 0 else "维持",
        &#125;
```

---

## 5. Agent 自主交易

### 微支付架构

```python
@dataclass
class AgentMarketplace:
    """Agent 服务市场"""

    services: dict = field(default_factory=lambda: &#123;
        "search": &#123;"price_per_call": 0.01, "provider": "search_agent"&#125;,
        "translate": &#123;"price_per_call": 0.005, "provider": "translate_agent"&#125;,
        "analyze": &#123;"price_per_call": 0.05, "provider": "analyze_agent"&#125;,
        "report": &#123;"price_per_call": 0.03, "provider": "report_agent"&#125;,
    &#125;)

    async def purchase_service(self, service: str, user_budget: float,
                                params: dict) -> dict:
        """Agent 自主购买服务"""
        pricing = self.services.get(service)
        if not pricing:
            return &#123;"error": "服务不存在"&#125;

        price = pricing["price_per_call"]
        if price > user_budget:
            return &#123;"error": "预算不足", "needed": price, "available": user_budget&#125;

        # 执行服务
        result = await self._execute_service(service, params)

        return &#123;
            "service": service,
            "price": price,
            "result": result,
            "remaining_budget": user_budget - price,
        &#125;

    async def compare_providers(self, service: str) -> list:
        """比较多个提供者的价格和质量"""
        # 在实际市场中，多个 Agent 提供相同服务
        providers = [
            &#123;"name": "provider_A", "price": 0.01, "quality": 0.9, "latency": 1.0&#125;,
            &#123;"name": "provider_B", "price": 0.005, "quality": 0.7, "latency": 2.0&#125;,
            &#123;"name": "provider_C", "price": 0.02, "quality": 0.95, "latency": 0.5&#125;,
        ]

        # 按性价比排序
        for p in providers:
            p["value_score"] = p["quality"] / p["price"]

        return sorted(providers, key=lambda x: -x["value_score"])
```

---

## 6. 资源分配

### 公平调度

```python
@dataclass
class ResourceScheduler:
    """多用户资源公平调度"""

    async def schedule(self, requests: list, available_gpu: int) -> list:
        """公平调度请求到 GPU"""
        # 按用户分组
        by_user = &#123;&#125;
        for req in requests:
            by_user.setdefault(req["user_id"], []).append(req)

        # 轮转调度（Round Robin + 权重）
        scheduled = []
        max_rounds = max(len(reqs) for reqs in by_user.values())

        for round_num in range(max_rounds):
            for user_id, reqs in by_user.items():
                if round_num < len(reqs) and len(scheduled) < available_gpu:
                    reqs[round_num]["scheduled_round"] = round_num
                    scheduled.append(reqs[round_num])

        return scheduled

    async def priority_schedule(self, requests: list) -> list:
        """优先级调度"""
        # 优先级：付费用户 > 免费用户 > 低优先级
        priority_order = &#123;"premium": 0, "free": 1, "batch": 2&#125;

        return sorted(requests, key=lambda r: priority_order.get(r.get("tier", "free"), 1))
```

---

## 7. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解 Agent 经济学的核心问题 | ☐ |
| 实现了 Token 成本追踪 | ☐ |
| 实现了预算控制器 | ☐ |
| 实现了成本感知模型路由 | ☐ |
| 实现了多 Agent 贡献度评估 | ☐ |
| 实现了质量激励机制 | ☐ |
| 理解 Agent 自主交易架构 | ☐ |
| 实现了资源公平调度 | ☐ |

---

## 8. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 09 | Token 与成本可视化 | 成本可视化 |
| 52 | 成本分析 | 成本分析 |
| 73 | LLM 应用成本分析与 ROI | ROI |
| 75 | Agent 工具调用成本归因 | 成本归因 |
| 105 | Agent 工具调用成本归因 | 成本归因 |
| 133 | LLM 应用成本优化策略 | 成本优化 |
| 233 | 成本分析 | 成本分析 |
| 265 | 成本归因 | 成本归因 |
| 346 | 成本预算 | 预算 |
| 370 | Agent 推理预算与 Token 配额 | Token 配额 |
| 376 | LLM 应用成本预算与超支告警 | 预算告警 |
| 386 | Tool 缓存与工具结果复用 | 成本优化 |
| 400 | Agent 推理预算与 Token 配额管理 | 预算管理 |
