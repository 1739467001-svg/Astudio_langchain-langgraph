# Agent 计费与成本管理深度指南

> 运营一个 Agent 平台，每天 10 万次调用——你赚的够付 LLM API 费吗？Agent 计费不只是"记录花了多少 Token"，还包括按用户/租户/任务归因成本、设计计费方案、设置预算限制、实现成本自动优化。本指南系统讲解成本归因模型、计费方案设计、预算控制闭环，以及自动降本策略。

---

## 1. 成本归因模型

### 多维度成本追踪

```python
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict

@dataclass
class CostTracker:
    """成本追踪器"""

    # 成本记录：{(user_id, tenant_id, task_type): [records]}
    records: list = field(default_factory=list)

    async def record(self, user_id: str, tenant_id: str, task_type: str,
                     model: str, input_tokens: int, output_tokens: int,
                     reasoning_tokens: int = 0):
        """记录一次调用成本"""
        cost = self._calculate(model, input_tokens, output_tokens, reasoning_tokens)

        self.records.append({
            "user_id": user_id,
            "tenant_id": tenant_id,
            "task_type": task_type,    # qa / coding / analysis
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "reasoning_tokens": reasoning_tokens,
            "cost": cost,
            "timestamp": datetime.utcnow().isoformat(),
        })

        return cost

    def _calculate(self, model, input_t, output_t, reasoning_t=0):
        """计算成本"""
        pricing = {
            "gpt-4o": {"in": 2.50, "out": 10.00, "reason": 10.00},
            "gpt-4o-mini": {"in": 0.15, "out": 0.60, "reason": 0.60},
            "o3-mini": {"in": 1.10, "out": 4.40, "reason": 4.40},
            "claude-3.5-sonnet": {"in": 3.00, "out": 15.00, "reason": 15.00},
            "deepseek-v3": {"in": 0.27, "out": 1.10, "reason": 1.10},
        }
        p = pricing.get(model, {"in": 1.0, "out": 4.0, "reason": 4.0})

        in_cost = input_t / 1_000_000 * p["in"]
        out_cost = output_t / 1_000_000 * p["out"]
        reason_cost = reasoning_t / 1_000_000 * p["reason"]

        return round(in_cost + out_cost + reason_cost, 6)

    def report_by_user(self, user_id: str, days: int = 30) -> dict:
        """按用户报告"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        user_records = [
            r for r in self.records
            if r["user_id"] == user_id and
            datetime.fromisoformat(r["timestamp"]) > cutoff
        ]

        total_cost = sum(r["cost"] for r in user_records)
        by_model = defaultdict(lambda: {"count": 0, "cost": 0})
        by_task = defaultdict(lambda: {"count": 0, "cost": 0})

        for r in user_records:
            by_model[r["model"]]["count"] += 1
            by_model[r["model"]]["cost"] += r["cost"]
            by_task[r["task_type"]]["count"] += 1
            by_task[r["task_type"]]["cost"] += r["cost"]

        return {
            "user_id": user_id,
            "days": days,
            "total_cost": total_cost,
            "total_requests": len(user_records),
            "avg_cost_per_request": total_cost / len(user_records) if user_records else 0,
            "by_model": dict(by_model),
            "by_task": dict(by_task),
        }

    def report_by_tenant(self, tenant_id: str, days: int = 30) -> dict:
        """按租户报告"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        tenant_records = [
            r for r in self.records
            if r["tenant_id"] == tenant_id and
            datetime.fromisoformat(r["timestamp"]) > cutoff
        ]

        return {
            "tenant_id": tenant_id,
            "total_cost": sum(r["cost"] for r in tenant_records),
            "total_requests": len(tenant_records),
            "unique_users": len(set(r["user_id"] for r in tenant_records)),
        }
```

---

## 2. 计费方案设计

### 计费模式

```python
from enum import Enum

class BillingModel(Enum):
    PAY_PER_USE = "pay_per_use"         # 按量计费
    SUBSCRIPTION = "subscription"       # 订阅制
    TIERED = "tiered"                    # 阶梯计费
    HYBRID = "hybrid"                     # 混合（订阅+超额按量）

@dataclass
class BillingEngine:
    """计费引擎"""

    plans = {
        "free": {
            "model": BillingModel.PAY_PER_USE,
            "monthly_credits": 1.0,        # 每月 $1 额度
            "rate_per_request": 0.01,      # 每次请求 $0.01
            "max_requests_per_day": 100,
            "available_models": ["gpt-4o-mini"],
        },
        "pro": {
            "model": BillingModel.SUBSCRIPTION,
            "monthly_fee": 29.0,           # 月费 $29
            "included_requests": 5000,
            "overage_rate": 0.005,         # 超额 $0.005/次
            "max_requests_per_day": 1000,
            "available_models": ["gpt-4o-mini", "gpt-4o"],
        },
        "enterprise": {
            "model": BillingModel.TIERED,
            "monthly_fee": 500.0,
            "included_requests": 50000,
            "tier_rates": [
                (0, 50000, 0.0),           # 前 5 万次免费
                (50000, 100000, 0.003),    # 5-10 万 $0.003/次
                (100000, float("inf"), 0.002),  # 10万+ $0.002/次
            ],
            "max_requests_per_day": 10000,
            "available_models": ["gpt-4o-mini", "gpt-4o", "o3-mini"],
        },
    }

    async def calculate_charge(self, plan: str, monthly_requests: int) -> dict:
        """计算费用"""
        plan_config = self.plans.get(plan, self.plans["free"])

        if plan_config["model"] == BillingModel.PAY_PER_USE:
            charge = min(
                monthly_requests * plan_config["rate_per_request"],
                plan_config["monthly_credits"],
            )
            return {"plan": plan, "requests": monthly_requests, "charge": charge}

        elif plan_config["model"] == BillingModel.SUBSCRIPTION:
            included = plan_config["included_requests"]
            overage = max(0, monthly_requests - included)
            charge = plan_config["monthly_fee"] + overage * plan_config["overage_rate"]
            return {"plan": plan, "requests": monthly_requests, "charge": charge}

        elif plan_config["model"] == BillingModel.TIERED:
            charge = plan_config["monthly_fee"]
            remaining = monthly_requests
            for start, end, rate in plan_config["tier_rates"]:
                tier_count = min(remaining, end - start)
                charge += tier_count * rate
                remaining -= tier_count
                if remaining <= 0:
                    break
            return {"plan": plan, "requests": monthly_requests, "charge": charge}

        return {"plan": plan, "requests": monthly_requests, "charge": 0}
```

---

## 3. 预算控制闭环

```python
@dataclass
class BudgetControlLoop:
    """预算控制闭环"""

    async def check_and_deduct(self, user_id: str, plan: str,
                                estimated_cost: float) -> dict:
        """检查预算并扣费"""
        # 1. 检查月预算
        monthly_budget = await self._get_monthly_budget(user_id, plan)
        monthly_spent = await self._get_monthly_spent(user_id)

        if monthly_spent + estimated_cost > monthly_budget:
            remaining = monthly_budget - monthly_spent
            return {
                "allowed": False,
                "reason": "月预算不足",
                "remaining_budget": remaining,
                "estimated_cost": estimated_cost,
            }

        # 2. 检查日限制
        daily_limit = self.plans[plan]["max_requests_per_day"]
        daily_used = await self._get_daily_requests(user_id)
        if daily_used >= daily_limit:
            return {
                "allowed": False,
                "reason": "达到日请求上限",
                "daily_limit": daily_limit,
            }

        # 3. 扣费
        await self._deduct(user_id, estimated_cost)

        return {
            "allowed": True,
            "charged": estimated_cost,
            "remaining_budget": monthly_budget - monthly_spent - estimated_cost,
        }

    async def auto_optimize(self, user_id: str, plan: str) -> dict:
        """自动成本优化"""
        analysis = await self._analyze_spending(user_id)

        optimizations = []

        # 策略1：如果简单任务用了贵模型
        expensive_simple = [
            r for r in analysis["recent_records"]
            if r["model"] == "gpt-4o" and r["task_type"] == "qa"
        ]
        if len(expensive_simple) > 10:
            optimizations.append({
                "action": "downgrade_model",
                "from": "gpt-4o",
                "to": "gpt-4o-mini",
                "task_type": "qa",
                "estimated_saving": len(expensive_simple) * 0.009,
            })

        # 策略2：如果上下文过大
        avg_tokens = analysis["avg_tokens"]
        if avg_tokens > 5000:
            optimizations.append({
                "action": "compress_context",
                "estimated_saving": analysis["total_cost"] * 0.2,
            })

        # 策略3：如果没启用缓存
        if not analysis.get("cache_hit_rate", 0) > 0.3:
            optimizations.append({
                "action": "enable_cache",
                "estimated_saving": analysis["total_cost"] * 0.15,
            })

        return {
            "analysis": analysis,
            "optimizations": optimizations,
            "total_potential_saving": sum(o.get("estimated_saving", 0) for o in optimizations),
        }
```

---

## 4. 成本仪表盘

```python
@dataclass
class CostDashboard:
    """成本仪表盘"""

    async def generate_report(self, period_days: int = 30) -> dict:
        """生成成本报告"""
        tracker = CostTracker()

        # 总成本
        total_cost = sum(r["cost"] for r in tracker.records)
        total_requests = len(tracker.records)

        # 按模型分布
        by_model = defaultdict(lambda: {"cost": 0, "count": 0, "tokens": 0})
        for r in tracker.records:
            by_model[r["model"]]["cost"] += r["cost"]
            by_model[r["model"]]["count"] += 1
            by_model[r["model"]]["tokens"] += r["input_tokens"] + r["output_tokens"]

        # 按任务类型分布
        by_task = defaultdict(lambda: {"cost": 0, "count": 0})
        for r in tracker.records:
            by_task[r["task_type"]]["cost"] += r["cost"]
            by_task[r["task_type"]]["count"] += 1

        # 趋势（按天）
        daily_trend = defaultdict(float)
        for r in tracker.records:
            date = r["timestamp"][:10]
            daily_trend[date] += r["cost"]

        return {
            "period_days": period_days,
            "total_cost": total_cost,
            "total_requests": total_requests,
            "avg_cost_per_request": total_cost / total_requests if total_requests else 0,
            "by_model": dict(by_model),
            "by_task": dict(by_task),
            "daily_trend": dict(sorted(daily_trend.items())),
            "top_cost_users": self._top_users(tracker.records, 10),
        }

    def _top_users(self, records, limit):
        by_user = defaultdict(float)
        for r in records:
            by_user[r["user_id"]] += r["cost"]
        return sorted(by_user.items(), key=lambda x: -x[1])[:limit]
```

---

## 5. 自动降本策略

```python
@dataclass
class CostOptimizer:
    """自动降本"""

    async def optimize_model_selection(self, query: str, budget: float) -> str:
        """智能模型选择"""
        # 简单查询用便宜模型
        if len(query) < 50 and not any(kw in query for kw in ["分析", "对比", "设计", "证明"]):
            return "gpt-4o-mini"

        # 复杂查询用强模型
        if budget > 0.02:
            return "gpt-4o"

        # 预算紧张用最便宜的
        return "deepseek-v3"

    async def enable_cache_first(self, query: str) -> dict:
        """缓存优先策略"""
        # 1. 精确缓存
        exact = await self._get_exact_cache(query)
        if exact:
            return {"source": "exact_cache", "result": exact, "cost": 0}

        # 2. 语义缓存
        semantic = await self._get_semantic_cache(query)
        if semantic:
            return {"source": "semantic_cache", "result": semantic, "cost": 0.001}

        # 3. 实时计算
        result = await self._compute(query)
        # 存入缓存
        await self._set_cache(query, result)
        return {"source": "compute", "result": result, "cost": 0.01}

    async def batch_optimization(self, requests: list) -> dict:
        """批量优化"""
        # 合并相似请求（只算一次）
        unique = {}
        duplicates = 0
        for req in requests:
            key = req["query"].lower().strip()
            if key in unique:
                duplicates += 1
            else:
                unique[key] = req

        return {
            "total_requests": len(requests),
            "unique_requests": len(unique),
            "duplicates_removed": duplicates,
            "estimated_saving": duplicates * 0.01,
        }
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了多维度成本追踪 | ☐ |
| 能按用户/租户/任务归因 | ☐ |
| 设计了计费方案（按量/订阅/阶梯） | ☐ |
| 实现了预算控制闭环 | ☐ |
| 实现了自动成本优化 | ☐ |
| 有成本仪表盘 | ☐ |
| 能诊断高成本原因 | ☐ |
| 实现了缓存优先策略 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 09 | Token 与成本可视化 | 成本可视化 |
| 52 | 成本分析 | 成本分析 |
| 73 | LLM 应用成本分析与 ROI | ROI |
| 75 | Agent 工具调用成本归因 | 归因 |
| 101 | 成本优化策略 | 优化 |
| 105 | Agent 工具调用成本归因 | 归因 |
| 133 | LLM 应用成本优化策略 | 优化 |
| 233 | 成本分析图解 | 分析 |
| 265 | 成本归因 | 归因 |
| 314 | 成本归因 | 归因 |
| 346 | 成本预算 | 预算 |
| 370 | Agent 推理预算 | 预算 |
| 376 | LLM 应用成本预算 | 预算 |
| 386 | Tool 缓存与结果复用 | 缓存优化 |
| 400 | Agent 推理预算 | 预算 |
| 450 | Agent 经济模型与激励机制 | 经济模型 |
| 459 | 多租户隔离 | 租户 |
