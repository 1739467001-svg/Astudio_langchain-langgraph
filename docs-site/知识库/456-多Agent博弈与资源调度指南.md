# 多 Agent 博弈与资源调度指南

> 多个 Agent 竞争有限资源时——谁先用 GPU？哪个 Agent 获得高优先级模型？当 Agent 之间利益不一致时——如何协调？如何防止"自私 Agent"消耗过多资源？本指南系统讲解多 Agent 博弈论基础、资源调度算法、负载均衡策略，以及 LangGraph 中的实现。

---

## 1. 多 Agent 资源竞争问题

### 典型场景

```
场景1：GPU 资源竞争
  3 个 Agent 同时需要 LLM 推理
  GPU 只能处理 2 个并发
  → 谁先？按什么规则？

场景2：模型选择博弈
  Agent A 想用 GPT-4o（贵但好）
  Agent B 想用 GPT-4o-mini（便宜但差）
  日预算有限 → 给谁用 GPT-4o？

场景3：工具调用竞争
  多个 Agent 同时调用搜索 API
  API 限流 10 QPS → 谁等待？

场景4：优先级冲突
  VIP 用户的 Agent 和普通用户的 Agent
  同时请求 → VIP 优先？
```

### 博弈论基础

| 博弈类型 | 描述 | Agent 场景 |
|---------|------|-----------|
| 合作博弈 | Agent 合作最大化总收益 | 多 Agent 协作完成任务 |
| 非合作博弈 | 各自最大化自身收益 | Agent 竞争资源 |
| 零和博弈 | 一方收益 = 另一方损失 | 固定预算分配 |
| 非零和博弈 | 可以双赢 | 资源分配后整体效率提升 |
| 纳什均衡 | 没有人能单方面改变策略获益 | 稳定的资源分配方案 |

---

## 2. 资源调度算法

### 优先级调度

```python
from dataclasses import dataclass, field
from enum import Enum
import heapq
from datetime import datetime

class Priority(Enum):
    CRITICAL = 0   # VIP/紧急
    HIGH = 1       # 付费用户
    NORMAL = 2     # 普通用户
    LOW = 3        # 批量/后台
    BATCH = 4      # 低优先级批处理

@dataclass(order=True)
class AgentRequest:
    """Agent 请求（可排序）"""
    priority: int                    # 优先级（越小越高）
    timestamp: float                 # 提交时间
    request_id: str = field(compare=False)
    agent_id: str = field(compare=False)
    user_id: str = field(compare=False)
    estimated_cost: float = field(compare=False, default=0.01)
    model_requested: str = field(compare=False, default="gpt-4o-mini")


class PriorityScheduler:
    """优先级调度器"""

    def __init__(self, max_concurrent: int = 10):
        self.max_concurrent = max_concurrent
        self.queue: list = []          # 优先级队列
        self.running: dict = &#123;&#125;        # 正在运行的请求
        self.running_count = 0

    async def submit(self, request: AgentRequest):
        """提交请求"""
        heapq.heappush(self.queue, request)
        await self._try_dispatch()

    async def _try_dispatch(self):
        """尝试调度队列中的请求"""
        while self.queue and self.running_count < self.max_concurrent:
            request = heapq.heappop(self.queue)
            self.running[request.request_id] = request
            self.running_count += 1
            # 异步执行
            asyncio.create_task(self._execute(request))

    async def _execute(self, request: AgentRequest):
        """执行请求"""
        try:
            result = await process_agent_request(request)
            return result
        finally:
            del self.running[request.request_id]
            self.running_count -= 1
            await self._try_dispatch()  # 尝试调度下一个

    def get_queue_status(self) -> dict:
        """获取队列状态"""
        return &#123;
            "queue_length": len(self.queue),
            "running_count": self.running_count,
            "max_concurrent": self.max_concurrent,
            "queue_by_priority": self._count_by_priority(),
        &#125;

    def _count_by_priority(self) -> dict:
        counts = &#123;&#125;
        for req in self.queue:
            p = Priority(req.priority).name
            counts[p] = counts.get(p, 0) + 1
        return counts
```

### 公平调度（Fair Scheduling）

```python
@dataclass
class FairScheduler:
    """公平调度器：保证每个用户/Agent 获得公平份额"""

    def __init__(self, total_capacity: int = 10):
        self.total_capacity = total_capacity
        self.user_weights: dict = &#123;&#125;  # &#123;user_id: weight&#125;
        self.user_usage: dict = &#123;&#125;    # &#123;user_id: total_requests_served&#125;

    async def allocate(self, requests: list) -> dict:
        """公平分配资源"""
        # 按用户分组
        by_user = &#123;&#125;
        for req in requests:
            by_user.setdefault(req["user_id"], []).append(req)

        # 计算每个用户的权重（默认等权重）
        for user_id in by_user:
            if user_id not in self.user_weights:
                self.user_weights[user_id] = 1.0  # 默认等权重

        # 按权重分配
        total_weight = sum(self.user_weights[u] for u in by_user)
        allocation = &#123;&#125;
        remaining_capacity = self.total_capacity

        for user_id, reqs in by_user.items():
            weight = self.user_weights[user_id]
            share = int(remaining_capacity * weight / total_weight)
            share = min(share, len(reqs))  # 不超过实际请求数
            allocation[user_id] = reqs[:share]
            remaining_capacity -= share

        return allocation

    def set_weight(self, user_id: str, weight: float):
        """设置用户权重（VIP 用户可设更高）"""
        self.user_weights[user_id] = weight
```

### 轮转调度（Round Robin）

```python
class RoundRobinScheduler:
    """轮转调度：每个用户轮流获得执行权"""

    def __init__(self):
        self.user_queues: dict = &#123;&#125;  # &#123;user_id: [request, ...]&#125;
        self.user_order: list = []    # 用户轮转顺序
        self.current_index: int = 0

    async def submit(self, user_id: str, request: dict):
        """提交请求"""
        if user_id not in self.user_queues:
            self.user_queues[user_id] = []
            self.user_order.append(user_id)
        self.user_queues[user_id].append(request)

    async def next_request(self) -> dict:
        """获取下一个要处理的请求"""
        if not self.user_order:
            return None

        # 轮转寻找有请求的用户
        for _ in range(len(self.user_order)):
            user_id = self.user_order[self.current_index]
            self.current_index = (self.current_index + 1) % len(self.user_order)

            if self.user_queues[user_id]:
                return self.user_queues[user_id].pop(0)

        return None  # 所有队列为空
```

---

## 3. 负载均衡

### 多 GPU 负载均衡

```python
@dataclass
class GPULoadBalancer:
    """多 GPU 负载均衡器"""

    def __init__(self, gpu_list: list):
        # gpu_list = [&#123;"id": 0, "model": "A100", "capacity": 10, "current": 0&#125;, ...]
        self.gpus = gpu_list

    async def select_gpu(self, request: AgentRequest) -> dict:
        """选择最佳 GPU"""
        # 策略1：最少连接
        best = min(self.gpus, key=lambda g: g["current"])
        if best["current"] < best["capacity"]:
            best["current"] += 1
            return best

        # 策略2：所有 GPU 满了，排队
        return None

    async def release_gpu(self, gpu_id: int):
        """释放 GPU"""
        for g in self.gpus:
            if g["id"] == gpu_id:
                g["current"] -= 1
                break
```

### 模型路由负载均衡

```python
@dataclass
class ModelLoadBalancer:
    """模型路由负载均衡"""

    # 多个等效模型实例
    model_instances: dict = field(default_factory=lambda: &#123;
        "gpt-4o": [
            &#123;"endpoint": "https://api.openai.com", "load": 0, "limit": 500&#125;,
            &#123;"endpoint": "https://api2.openai.com", "load": 0, "limit": 500&#125;,
        ],
        "gpt-4o-mini": [
            &#123;"endpoint": "https://api.openai.com", "load": 0, "limit": 1000&#125;,
        ],
    &#125;)

    async def route(self, model: str) -> dict:
        """路由到负载最低的实例"""
        instances = self.model_instances.get(model, [])
        if not instances:
            return None

        # 选择负载最低的实例
        best = min(instances, key=lambda x: x["load"])
        if best["load"] < best["limit"]:
            best["load"] += 1
            return best

        # 所有实例超限 → 降级
        return await self._fallback(model)

    async def _fallback(self, model: str) -> dict:
        """降级到更便宜的模型"""
        fallback_map = &#123;
            "gpt-4o": "gpt-4o-mini",
            "gpt-4o-mini": "deepseek-v3",
        &#125;
        fallback_model = fallback_map.get(model)
        if fallback_model:
            return await self.route(fallback_model)
        return None
```

---

## 4. 速率限制

### 多层限流

```python
import time
from collections import defaultdict, deque

@dataclass
class MultiLayerRateLimiter:
    """多层速率限制"""

    # 用户级限流
    user_limits: dict = field(default_factory=lambda: &#123;
        "free": &#123;"rpm": 10, "tpm": 10000&#125;,
        "premium": &#123;"rpm": 100, "tpm": 100000&#125;,
        "enterprise": &#123;"rpm": 1000, "tpm": 1000000&#125;,
    &#125;)

    # 全局限流
    global_limit_rpm: int = 5000
    global_limit_tpm: int = 5000000

    # 状态
    user_requests: dict = field(default_factory=lambda: defaultdict(deque))
    global_requests: deque = field(default_factory=deque)

    async def check(self, user_id: str, tier: str = "free",
                    tokens: int = 100) -> tuple[bool, str]:
        """检查速率限制"""
        now = time.time()

        # 1. 用户级检查
        limits = self.user_limits.get(tier, self.user_limits["free"])
        user_reqs = self.user_requests[user_id]

        # 清理过期记录（1分钟窗口）
        while user_reqs and user_reqs[0][0] < now - 60:
            user_reqs.popleft()

        # 检查 RPM
        if len(user_reqs) >= limits["rpm"]:
            return False, f"用户 RPM 超限: &#123;len(user_reqs)&#125;/&#123;limits['rpm']&#125;"

        # 检查 TPM
        user_tpm = sum(r[1] for r in user_reqs)
        if user_tpm + tokens > limits["tpm"]:
            return False, f"用户 TPM 超限: &#123;user_tpm + tokens&#125;/&#123;limits['tpm']&#125;"

        # 2. 全局检查
        while self.global_requests and self.global_requests[0][0] < now - 60:
            self.global_requests.popleft()

        if len(self.global_requests) >= self.global_limit_rpm:
            return False, "全局 RPM 超限"

        global_tpm = sum(r[1] for r in self.global_requests)
        if global_tpm + tokens > self.global_limit_tpm:
            return False, "全局 TPM 超限"

        # 3. 通过 → 记录
        user_reqs.append((now, tokens))
        self.global_requests.append((now, tokens))

        return True, ""
```

---

## 5. 博弈论在 Agent 中的应用

### 机制设计

```python
@dataclass
class ResourceAuction:
    """资源拍卖：让 Agent 竞价获取资源"""

    async def auction(self, bids: dict, resource: dict) -> dict:
        """
        二价拍卖（Vickrey Auction）：
        最高出价者获得资源，但只付第二高的价格

        bids = &#123;"agent_A": 0.05, "agent_B": 0.03, "agent_C": 0.08&#125;
        """
        # 排序出价
        sorted_bids = sorted(bids.items(), key=lambda x: -x[1])

        if not sorted_bids:
            return &#123;"winner": None&#125;

        winner = sorted_bids[0][0]
        # 二价：付第二高的价格
        if len(sorted_bids) > 1:
            price = sorted_bids[1][1]
        else:
            price = sorted_bids[0][1]

        return &#123;
            "winner": winner,
            "price": price,
            "all_bids": dict(sorted_bids),
            "resource": resource,
        &#125;
```

### 预算分配博弈

```python
@dataclass
class BudgetAllocation:
    """预算分配博弈：多个 Agent 分配有限预算"""

    async def allocate(self, agents: list, total_budget: float) -> dict:
        """
        按贡献度+需求分配预算
        """
        # 收集每个 Agent 的需求和预期收益
        agent_demands = []
        for agent in agents:
            agent_demands.append(&#123;
                "agent_id": agent["id"],
                "requested_budget": agent["requested_budget"],
                "expected_quality": agent.get("expected_quality", 0.8),
                "task_priority": agent.get("priority", 1),
            &#125;)

        # Shapley 值近似分配（简化版）
        total_requested = sum(a["requested_budget"] for a in agent_demands)

        if total_requested <= total_budget:
            # 需求总和 ≤ 预算 → 按需分配
            allocation = &#123;a["agent_id"]: a["requested_budget"] for a in agent_demands&#125;
        else:
            # 需求 > 预算 → 按优先级+质量加权
            total_weight = sum(
                a["task_priority"] * a["expected_quality"]
                for a in agent_demands
            )
            allocation = &#123;&#125;
            for a in agent_demands:
                weight = a["task_priority"] * a["expected_quality"]
                share = total_budget * weight / total_weight
                # 不超过请求量
                allocation[a["agent_id"]] = min(share, a["requested_budget"])

        return &#123;
            "allocation": allocation,
            "total_budget": total_budget,
            "total_allocated": sum(allocation.values()),
            "remaining": total_budget - sum(allocation.values()),
        &#125;
```

---

## 6. LangGraph 中的资源管理

### 在图中集成调度

```python
from langgraph.graph import StateGraph, START, END

class ScheduledAgentState(TypedDict):
    messages: list
    user_id: str
    tier: str            # user tier
    model_used: str
    queued: bool
    queue_time_ms: float

# 全局调度器
scheduler = PriorityScheduler(max_concurrent=50)
rate_limiter = MultiLayerRateLimiter()

async def schedule_node(state: ScheduledAgentState):
    """调度节点：检查限流和排队"""
    user_id = state["user_id"]
    tier = state.get("tier", "free")

    # 1. 速率限制检查
    ok, reason = await rate_limiter.check(user_id, tier, tokens=500)
    if not ok:
        return &#123;"messages": [&#123;"role": "assistant", "content": f"请求被限流: &#123;reason&#125;"&#125;]&#125;

    # 2. 提交到调度器
    import time
    request = AgentRequest(
        priority=Priority[tier.upper()].value,
        timestamp=time.time(),
        request_id=str(uuid.uuid4()),
        agent_id=f"agent_&#123;user_id&#125;",
        user_id=user_id,
    )
    await scheduler.submit(request)

    # 3. 检查队列状态
    status = scheduler.get_queue_status()
    if status["queue_length"] > 0:
        return &#123;"queued": True, "queue_position": status["queue_length"]&#125;

    return &#123;"queued": False&#125;

# 构建带调度的 Agent
graph = StateGraph(ScheduledAgentState)
graph.add_node("schedule", schedule_node)
graph.add_node("process", process_node)
graph.add_edge(START, "schedule")
graph.add_edge("schedule", "process")
graph.add_edge("process", END)

scheduled_agent = graph.compile()
```

---

## 7. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解多 Agent 资源竞争场景 | ☐ |
| 理解博弈论基础概念 | ☐ |
| 实现了优先级调度 | ☐ |
| 实现了公平调度 | ☐ |
| 实现了负载均衡 | ☐ |
| 实现了多层速率限制 | ☐ |
| 理解拍卖机制设计 | ☐ |
| 实现了预算分配博弈 | ☐ |
| 在 LangGraph 中集成了资源管理 | ☐ |

---

## 8. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 07 | 多 Agent 架构图解 | 多 Agent 基础 |
| 61 | 共识机制 | 共识机制 |
| 86 | 多 Agent 共识机制 | 共识 |
| 90 | 多 Agent 任务分配策略 | 任务分配 |
| 124 | 多 Agent 协调模式与拓扑 | 协调模式 |
| 156 | 多 Agent 协调模式 | 协调 |
| 198 | API 限流与流量管理 | 限流 |
| 250 | 任务分配 | 任务分配 |
| 329 | 多租户限流 | 多租户限流 |
| 381 | 优雅扩缩容 | 扩缩容 |
| 392 | Agent 协商与共识机制 | 协商 |
| 422 | Agent 协商与共识机制 | 协商共识 |
| 442 | Agent 身份认证与授权 | 认证 |
| 450 | Agent 经济模型与激励机制 | 经济模型 |
