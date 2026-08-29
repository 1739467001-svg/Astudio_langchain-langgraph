# Agent 可恢复性与容错编排指南

> Agent 运行到第 8 步突然 LLM API 超时——是放弃重来还是从第 8 步继续？生产环境的 Agent 必须能"断点续跑"：进程崩溃后恢复、网络中断后重试、工具失败后降级。本指南系统讲解 LangGraph 中 Agent 的可恢复性设计、容错模式和生产级容错编排。

---

## 1. 为什么 Agent 需要可恢复性

### 不可恢复 Agent 的痛点

```
场景：一个 10 步的研究 Agent
  步骤 1-7：检索 + 分析（耗时 3 分钟，花费 $0.50）
  步骤 8：调用 LLM 总结 → API 超时
  步骤 9-10：未执行

不可恢复：从头重来 = 浪费 3 分钟 + $0.50
可恢复：从步骤 8 重试 = 只花几秒 + $0.05
```

### Agent 失败的常见原因

| 失败类型 | 频率 | 影响 | 恢复策略 |
|----------|------|------|----------|
| LLM API 超时/限流 | 高 | 当前步骤中断 | 重试 + 指数退避 |
| 工具调用失败 | 中 | 步骤结果丢失 | 降级/跳过/替代工具 |
| 进程崩溃（OOM） | 低 | 全部状态丢失 | 检查点恢复 |
| 网络中断 | 中 | 请求丢失 | 自动重连 + 重试 |
| 状态不一致 | 低 | 数据损坏 | 状态校验 + 回滚 |
| 上下文超长 | 中 | 请求被拒 | 上下文压缩 + 裁剪 |
| 超预算 | 低 | 强制停止 | 降级到便宜模型 |

---

## 2. LangGraph 检查点机制

### 检查点原理

```
Agent 执行流程（带检查点）：

  节点A → [检查点1] → 节点B → [检查点2] → 节点C → [检查点3] → END
                                    ↓
                            如果节点C崩溃
                                    ↓
                          从检查点2恢复 → 重新执行节点C
```

### 配置 Checkpointer

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import StateGraph
from typing import TypedDict

class ResearchState(TypedDict):
    messages: list
    search_results: list
    analysis: str
    report: str
    step: int

# === 内存检查点（开发测试） ===
memory_saver = MemorySaver()

# === SQLite 检查点（单机生产） ===
# import asyncio
# async with AsyncSqliteSaver.from_conn_string("checkpoints.db") as saver:
#     app = graph.compile(checkpointer=saver)

# === Postgres 检查点（分布式生产） ===
# async with AsyncPostgresSaver.from_conn_string(
#     "postgresql://user:pass@localhost/db"
# ) as saver:
#     await saver.setup()  # 创建表
#     app = graph.compile(checkpointer=saver)

# 构建 Agent
graph = StateGraph(ResearchState)

async def search_node(state: ResearchState):
    """步骤1：检索"""
    results = await search(state["messages"][-1].content)
    return &#123;"search_results": results, "step": 1&#125;

async def analyze_node(state: ResearchState):
    """步骤2：分析"""
    analysis = await llm_analyze(state["search_results"])
    return &#123;"analysis": analysis, "step": 2&#125;

async def report_node(state: ResearchState):
    """步骤3：生成报告"""
    report = await llm_generate_report(state["analysis"])
    return &#123;"report": report, "step": 3&#125;

graph.add_node("search", search_node)
graph.add_node("analyze", analyze_node)
graph.add_node("report", report_node)
graph.add_edge("search", "analyze")
graph.add_edge("analyze", "report")

# 编译时指定 checkpointer
app = graph.compile(checkpointer=memory_saver)

# 每次调用指定 thread_id（用于恢复）
config = &#123;"configurable": &#123;"thread_id": "research-session-001"&#125;&#125;
```

### 恢复中断的执行

```python
import asyncio

async def run_with_recovery(app, initial_state, thread_id: str):
    """带恢复能力的执行"""
    config = &#123;"configurable": &#123;"thread_id": thread_id&#125;&#125;

    # 检查是否有已保存的检查点
    saved_state = await app.aget_state(config)

    if saved_state and saved_state.next:
        # 有未完成的节点 → 从断点恢复
        print(f"发现检查点，当前步骤: &#123;saved_state.values.get('step', 0)&#125;")
        print(f"待执行节点: &#123;saved_state.next&#125;")

        # 继续执行（None 表示从当前状态继续）
        result = await app.ainvoke(None, config=config)
    else:
        # 全新执行
        print("无检查点，从头开始")
        result = await app.ainvoke(initial_state, config=config)

    return result

# 使用
result = await run_with_recovery(
    app,
    initial_state=&#123;"messages": [&#123;"role": "user", "content": "研究量子计算最新进展"&#125;]&#125;,
    thread_id="research-001"
)
```

---

## 3. 节点级容错

### 重试 + 指数退避

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import asyncio

class LLMTimeoutError(Exception):
    pass

class ToolExecutionError(Exception):
    pass

# === LLM 调用重试 ===
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(min=2, max=30, multiplier=1.5),
    retry=retry_if_exception_type((LLMTimeoutError, asyncio.TimeoutError)),
    before_sleep=lambda rs: print(f"LLM 调用重试 &#123;rs.attempt_number&#125;/3...")
)
async def safe_llm_call(model, messages, timeout: float = 60.0):
    """带重试的 LLM 调用"""
    try:
        response = await asyncio.wait_for(
            model.ainvoke(messages),
            timeout=timeout
        )
        return response
    except asyncio.TimeoutError:
        raise LLMTimeoutError(f"LLM 调用超时 (&#123;timeout&#125;s)")

# === 工具调用重试 ===
@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(min=1, max=10),
    retry=retry_if_exception_type(ToolExecutionError),
)
async def safe_tool_call(tool, input_data):
    """带重试的工具调用"""
    try:
        result = await tool.ainvoke(input_data)
        return result
    except ConnectionError as e:
        raise ToolExecutionError(f"工具连接失败: &#123;e&#125;")
```

### 节点降级策略

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict
from dataclasses import dataclass

@dataclass
class FaultTolerantState(TypedDict):
    messages: list
    results: dict
    errors: list
    degraded: bool

# 节点 A：主要分析（可能失败）
async def primary_analysis(state):
    try:
        result = await safe_llm_call(
            expensive_model,
            state["messages"],
            timeout=60
        )
        return &#123;"results": &#123;"analysis": result.content&#125;, "degraded": False&#125;
    except Exception as e:
        return &#123;
            "errors": [f"主分析失败: &#123;e&#125;"],
            "degraded": True,
            # 不中断，标记降级
        &#125;

# 节点 B：降级分析（便宜模型，兜底）
async def fallback_analysis(state):
    if not state.get("degraded"):
        return &#123;&#125;  # 主分析成功，跳过

    try:
        result = await safe_llm_call(
            cheap_model,  # GPT-4o-mini
            state["messages"],
            timeout=15
        )
        return &#123;"results": &#123;"analysis": result.content, "source": "fallback"&#125;&#125;
    except Exception as e:
        return &#123;
            "errors": [f"降级分析也失败: &#123;e&#125;"],
            "results": &#123;"analysis": "分析暂时不可用"&#125;
        &#125;

# 节点 C：缓存兜底
async def cache_fallback(state):
    if state.get("results", &#123;&#125;).get("analysis"):
        return &#123;&#125;  # 已有结果

    # 尝试从缓存获取
    cached = await cache_get(state["messages"][-1].content)
    if cached:
        return &#123;"results": &#123;"analysis": cached, "source": "cache"&#125;&#125;
    return &#123;"results": &#123;"analysis": "服务暂时不可用，请稍后重试"&#125;&#125;

def should_fallback(state):
    if state.get("degraded"):
        return "fallback"
    return "next"

# 构建容错图
graph = StateGraph(FaultTolerantState)
graph.add_node("primary", primary_analysis)
graph.add_node("fallback", fallback_analysis)
graph.add_node("cache", cache_fallback)
graph.add_node("finalize", finalize_node)

graph.add_edge(START, "primary")
graph.add_conditional_edges("primary", should_fallback, &#123;
    "fallback": "fallback",
    "next": "finalize",
&#125;)
graph.add_edge("fallback", "cache")
graph.add_edge("cache", "finalize")
graph.add_edge("finalize", END)

ft_app = graph.compile(checkpointer=MemorySaver())
```

---

## 4. 超时编排

### 节点级超时

```python
import asyncio
from langgraph.graph import StateGraph, START, END

# 为每个节点设置不同的超时
NODE_TIMEOUTS = &#123;
    "search": 10.0,      # 检索节点 10 秒
    "analyze": 60.0,     # 分析节点 60 秒
    "generate": 120.0,   # 生成节点 120 秒
    "review": 30.0,      # 审查节点 30 秒
&#125;

async def with_timeout(node_func, node_name: str, state):
    """为节点添加超时控制"""
    timeout = NODE_TIMEOUTS.get(node_name, 30.0)
    try:
        result = await asyncio.wait_for(node_func(state), timeout=timeout)
        return result
    except asyncio.TimeoutError:
        # 记录超时，返回降级结果
        return &#123;
            "errors": state.get("errors", []) + [f"节点 &#123;node_name&#125; 超时 (&#123;timeout&#125;s)"],
            "degraded": True,
        &#125;

# 包装节点
async def search_node_wrapper(state):
    return await with_timeout(_search_impl, "search", state)

async def _search_impl(state):
    # 实际检索逻辑
    results = await search_api(state["query"])
    return &#123;"search_results": results&#125;

async def analyze_node_wrapper(state):
    return await with_timeout(_analyze_impl, "analyze", state)

async def _analyze_impl(state):
    response = await llm.ainvoke(state["search_results"])
    return &#123;"analysis": response.content&#125;
```

### 全局超时

```python
async def run_agent_with_global_timeout(app, input_state, thread_id, max_time=300):
    """Agent 全局超时控制"""
    config = &#123;"configurable": &#123;"thread_id": thread_id&#125;&#125;

    try:
        result = await asyncio.wait_for(
            app.ainvoke(input_state, config=config),
            timeout=max_time
        )
        return result
    except asyncio.TimeoutError:
        # 获取已保存的状态
        saved = await app.aget_state(config)
        print(f"Agent 超时，已完成步骤: &#123;saved.values.get('step', 0)&#125;")
        return saved.values
```

---

## 5. 状态校验与修复

### 状态 Schema 校验

```python
from pydantic import BaseModel, ValidationError
from typing import Optional

class ValidatedState(BaseModel):
    messages: list
    search_results: Optional[list] = None
    analysis: Optional[str] = None
    report: Optional[str] = None
    step: int = 0
    errors: list = []

def validate_state(state: dict) -> dict:
    """校验并修复状态"""
    try:
        validated = ValidatedState(**state)
        return validated.model_dump()
    except ValidationError as e:
        print(f"状态校验失败: &#123;e&#125;")
        # 修复：保留有效字段，填充默认值
        fixed = state.copy()
        for error in e.errors():
            field = error["loc"][0]
            if field not in fixed or fixed[field] is None:
                fixed[field] = [] if field in ["errors", "search_results"] else ""
        return fixed

async def validated_node(state, node_func):
    """带状态校验的节点包装"""
    # 进入前校验
    state = validate_state(state)

    # 执行节点
    result = await node_func(state)

    # 退出前校验
    result = validate_state(&#123;**state, **result&#125;)

    return result
```

### 状态自修复

```python
async def self_heal_node(state):
    """状态自修复节点"""
    issues = []

    # 检查消息完整性
    messages = state.get("messages", [])
    if not messages:
        issues.append("消息为空")
        state["messages"] = [&#123;"role": "user", "content": "请继续"&#125;]

    # 检查搜索结果格式
    results = state.get("search_results", [])
    if results:
        for i, r in enumerate(results):
            if not isinstance(r, dict) or "content" not in r:
                results[i] = &#123;"content": str(r), "score": 0.0&#125;
        state["search_results"] = results

    # 检查分析结果
    analysis = state.get("analysis", "")
    if analysis and len(analysis) < 10:
        issues.append("分析结果过短，可能不完整")
        state["analysis"] = analysis + "\n\n[注意：分析可能不完整]"

    if issues:
        state["errors"] = state.get("errors", []) + issues
        print(f"状态修复: &#123;issues&#125;")

    return state
```

---

## 6. 工具级容错模式

```python
from langchain_core.tools import ToolException

# === 模式1：重试 + 降级 ===
@retry(stop=stop_after_attempt(2), wait=wait_exponential(min=1, max=5))
async def robust_web_search(query: str):
    """带重试和降级的搜索工具"""
    try:
        # 主搜索
        return await primary_search_api(query)
    except Exception:
        try:
            # 降级搜索
            return await fallback_search_api(query)
        except Exception:
            # 最终兜底
            return [&#123;"content": f"搜索失败，请稍后重试", "source": "error"&#125;]

# === 模式2：超时 + 默认值 ===
async def safe_database_query(sql: str, timeout: float = 5.0):
    """带超时的数据库查询"""
    try:
        result = await asyncio.wait_for(
            db.execute(sql),
            timeout=timeout
        )
        return result
    except asyncio.TimeoutError:
        return &#123;"error": "查询超时", "data": []&#125;

# === 模式3：熔断保护 ===
from dataclasses import dataclass
from datetime import datetime, timedelta

@dataclass
class CircuitBreaker:
    """工具熔断器"""
    failure_count: int = 0
    failure_threshold: int = 5
    reset_timeout: float = 60.0  # 60秒后尝试恢复
    last_failure_time: datetime = None
    state: str = "closed"  # closed | open | half_open

    async def call(self, func, *args, **kwargs):
        if self.state == "open":
            if (datetime.now() - self.last_failure_time).total_seconds() > self.reset_timeout:
                self.state = "half_open"
            else:
                raise ToolException("工具熔断中，请稍后重试")

        try:
            result = await func(*args, **kwargs)
            self.failure_count = 0
            self.state = "closed"
            return result
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = datetime.now()
            if self.failure_count >= self.failure_threshold:
                self.state = "open"
                print(f"工具熔断: &#123;self.failure_count&#125; 次失败")
            raise

# 使用熔断器
search_breaker = CircuitBreaker(failure_threshold=5, reset_timeout=60)

async def protected_search(query: str):
    return await search_breaker.call(web_search, query)
```

---

## 7. 生产级容错编排模式

### 编排模式总览

```
模式1：线性 + 检查点
  A → [CP] → B → [CP] → C → [CP] → D

模式2：线性 + 降级分支
  A → B(失败) → B_fallback → C

模式3：并行 + 结果聚合
  A → [B1, B2, B3] (并行) → 聚合(容忍部分失败) → C

模式4：循环 + 最大轮次
  A → B → 条件(未完成 & 轮次<10) → B → ... → C

模式5：Saga 补偿
  A → B → C(失败) → B_compensate → A_compensate → END
```

### Saga 补偿模式实现

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class SagaState(TypedDict):
    messages: list
    completed_steps: list   # 已完成步骤（用于补偿）
    compensation: list      # 补偿动作队列
    result: dict
    failed: bool

async def book_flight(state):
    """步骤1：订机票"""
    try:
        booking = await flight_api.book(state["flight_info"])
        return &#123;
            "completed_steps": state.get("completed_steps", []) + ["flight"],
            "result": &#123;"flight_booking": booking&#125;
        &#125;
    except Exception as e:
        return &#123;"failed": True, "compensation": ["cancel_flight"]&#125;

async def book_hotel(state):
    """步骤2：订酒店"""
    try:
        booking = await hotel_api.book(state["hotel_info"])
        return &#123;
            "completed_steps": state.get("completed_steps", []) + ["hotel"],
            "result": &#123;**state.get("result", &#123;&#125;), "hotel_booking": booking&#125;
        &#125;
    except Exception as e:
        # 需要补偿已完成的步骤
        return &#123;
            "failed": True,
            "compensation": ["cancel_hotel", "cancel_flight"]
        &#125;

async def compensate(state):
    """补偿节点：逆向撤销已完成步骤"""
    steps = state.get("completed_steps", [])
    for step in reversed(steps):
        if step == "flight":
            await flight_api.cancel(state["result"]["flight_booking"]["id"])
        elif step == "hotel":
            await hotel_api.cancel(state["result"]["hotel_booking"]["id"])
    return &#123;"result": &#123;"status": "cancelled", "message": "预订已回滚"&#125;&#125;

def check_failure(state):
    if state.get("failed"):
        return "compensate"
    return "next"

graph = StateGraph(SagaState)
graph.add_node("book_flight", book_flight)
graph.add_node("book_hotel", book_hotel)
graph.add_node("compensate", compensate)
graph.add_node("finalize", lambda s: &#123;"result": s.get("result", &#123;&#125;)&#125;)

graph.add_edge(START, "book_flight")
graph.add_conditional_edges("book_flight", check_failure, &#123;
    "compensate": "compensate",
    "next": "book_hotel",
&#125;)
graph.add_conditional_edges("book_hotel", check_failure, &#123;
    "compensate": "compensate",
    "next": "finalize",
&#125;)
graph.add_edge("compensate", END)
graph.add_edge("finalize", END)

saga_app = graph.compile(checkpointer=MemorySaver())
```

---

## 8. 监控与告警

### 关键指标

```python
@dataclass
class ResilienceMetrics:
    """可恢复性指标"""
    total_runs: int = 0
    successful_runs: int = 0
    recovered_runs: int = 0          # 通过恢复完成的运行
    failed_runs: int = 0
    avg_recovery_time_ms: float = 0   # 平均恢复时间
    checkpoint_saves: int = 0
    checkpoint_restores: int = 0
    node_retries: int = 0
    fallback_count: int = 0
    circuit_breaker_trips: int = 0

    @property
    def recovery_rate(self) -> float:
        """恢复成功率"""
        if self.total_runs == 0:
            return 0
        return (self.successful_runs + self.recovered_runs) / self.total_runs

    @property
    def failure_rate(self) -> float:
        """失败率"""
        if self.total_runs == 0:
            return 0
        return self.failed_runs / self.total_runs
```

### 告警规则

| 指标 | 阈值 | 告警级别 |
|------|------|----------|
| 失败率 | > 10% | P2 |
| 失败率 | > 25% | P1 |
| 平均恢复时间 | > 5秒 | P3 |
| 熔断触发次数 | > 3次/小时 | P2 |
| 检查点恢复次数 | > 20% 运行 | P3 |
| 节点重试次数 | > 50次/小时 | P3 |

---

## 9. 检查清单

| 检查项 | 状态 |
|--------|------|
| 配置了 Checkpointer（SQLite/Postgres） | ☐ |
| 每次调用指定了 thread_id | ☐ |
| 实现了断点恢复逻辑 | ☐ |
| LLM 调用有重试 + 指数退避 | ☐ |
| 工具调用有降级/兜底策略 | ☐ |
| 节点有超时控制 | ☐ |
| 实现了 Saga 补偿模式（多步骤事务） | ☐ |
| 状态有 Schema 校验 | ☐ |
| 配置了熔断器保护关键工具 | ☐ |
| 监控了恢复成功率和恢复时间 | ☐ |

---

## 10. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 11 | LangGraph 检查点与时间旅行 | 检查点基础 |
| 74 | 状态快照 | 快照机制 |
| 126 | LangGraph 持久化 | 持久化后端 |
| 139 | Agent 错误恢复 | 错误恢复模式 |
| 145 | 灾难恢复 | 灾难级恢复 |
| 172 | Agent 自愈 | 自修复机制 |
| 188 | 容灾高可用 | 高可用架构 |
| 264 | 状态快照 | 快照恢复 |
| 340 | 状态快照时间旅行 | 时间旅行恢复 |
| 384 | 批量推理管线 | 批处理断点续跑 |
| 404 | LangGraph 持久化检查点与状态恢复 | 持久化深度 |
