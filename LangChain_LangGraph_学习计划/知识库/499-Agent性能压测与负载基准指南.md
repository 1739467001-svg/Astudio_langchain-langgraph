# Agent 性能压测与负载基准指南

> 上线前不做压测，上线后被流量打爆。压测不是"发几个请求看看响应"——要模拟真实用户行为、阶梯加压、找出极限吞吐量、定位瓶颈。本指南系统讲解 Agent 压测方法论、负载模型、瓶颈分析、基准建立。

---

## 1. 压测方法论

### 压测类型

| 类型 | 目的 | 方法 | 指标 |
|------|------|------|------|
| 基准测试 | 建立性能基线 | 固定 QPS 测试 | 吞吐量/延迟 |
| 阶梯加压 | 找极限 | 逐步增加 QPS | 极限吞吐/拐点 |
| 持久测试 | 稳定性 | 长时间高负载 | 内存泄漏/降级 |
| 突发测试 | 弹性 | 瞬时高并发 | 恢复时间 |
| 混合场景 | 真实模拟 | 多种任务混合 | 综合性能 |

---

## 2. 压测工具

### Locust 集成

```python
from locust import HttpUser, task, between, constant
import random
import json

class AgentUser(HttpUser):
    """模拟 Agent 用户"""
    wait_time = between(1, 5)  # 用户间隔 1-5 秒

    def on_start(self):
        """用户启动时创建会话"""
        response = self.client.post("/v1/sessions", json={"user_id": f"user_{random.randint(1000, 9999)}"})
        self.session_id = response.json().get("session_id", "")

    @task(60)
    def chat_simple(self):
        """简单对话（60% 流量）"""
        queries = [
            "你好",
            "什么是 RAG？",
            "LangChain 是什么？",
            "解释 LCEL",
            "如何部署 Agent？",
        ]
        self.client.post("/v1/chat", json={
            "message": random.choice(queries),
            "session_id": self.session_id,
            "user_id": "test_user",
        })

    @task(25)
    def chat_with_tools(self):
        """带工具调用（25% 流量）"""
        queries = [
            "搜索 LangGraph 最新文档",
            "计算 123 * 456",
            "查一下北京天气",
        ]
        self.client.post("/v1/chat", json={
            "message": random.choice(queries),
            "session_id": self.session_id,
            "user_id": "test_user",
        })

    @task(10)
    def chat_long_context(self):
        """长上下文（10% 流量）"""
        long_query = "请分析以下文档：" + "这是一段测试文档。" * 100
        self.client.post("/v1/chat", json={
            "message": long_query,
            "session_id": self.session_id,
            "user_id": "test_user",
        })

    @task(5)
    def stream_chat(self):
        """流式对话（5% 流量）"""
        with self.client.post("/v1/chat/stream", json={
            "message": "写一首关于AI的诗",
            "session_id": self.session_id,
            "user_id": "test_user",
        }, stream=True, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"状态码 {response.status_code}")
```

### 运行压测

```bash
# 基准测试：10 用户，持续 5 分钟
locust -f locustfile.py --headless -u 10 -r 2 -t 300s --host http://localhost:8000

# 阶梯加压：从 10 到 200 用户
locust -f locustfile.py --headless -u 200 -r 5 -t 600s --host http://localhost:8000

# 突发测试：瞬时 100 用户
locust -f locustfile.py --headless -u 100 -r 100 -t 60s --host http://localhost:8000

# Web UI 模式
locust -f locustfile.py --host http://localhost:8000
# 访问 http://localhost:8089
```

---

## 3. 性能基准建立

```python
@dataclass
class PerformanceBaseline:
    """性能基线"""

    baselines = {
        "simple_qa": {
            "target_p50_ms": 2000,
            "target_p95_ms": 5000,
            "target_p99_ms": 10000,
            "target_qps": 50,
            "target_error_rate": 0.01,
        },
        "tool_use": {
            "target_p50_ms": 5000,
            "target_p95_ms": 15000,
            "target_p99_ms": 30000,
            "target_qps": 20,
            "target_error_rate": 0.02,
        },
        "long_context": {
            "target_p50_ms": 10000,
            "target_p95_ms": 30000,
            "target_p99_ms": 60000,
            "target_qps": 5,
            "target_error_rate": 0.03,
        },
    }

    def check_against_baseline(self, results: dict, scenario: str) -> dict:
        """对比基线"""
        baseline = self.baselines.get(scenario, {})
        checks = {}

        for metric, target in baseline.items():
            actual = results.get(metric.replace("target_", ""), 0)

            if "ms" in metric:
                passed = actual <= target
            elif "qps" in metric:
                passed = actual >= target
            elif "error_rate" in metric:
                passed = actual <= target
            else:
                passed = True

            checks[metric] = {
                "target": target,
                "actual": actual,
                "passed": passed,
            }

        all_passed = all(c["passed"] for c in checks.values())
        return {"scenario": scenario, "all_passed": all_passed, "checks": checks}
```

---

## 4. 瓶颈分析

```python
@dataclass
class BottleneckAnalyzer:
    """瓶颈分析器"""

    async def analyze(self, load_test_results: dict) -> dict:
        """分析瓶颈"""
        bottlenecks = []

        # 1. 延迟分析
        p50 = load_test_results.get("p50_ms", 0)
        p95 = load_test_results.get("p95_ms", 0)
        p99 = load_test_results.get("p99_ms", 0)

        if p99 > p50 * 5:
            bottlenecks.append({
                "type": "tail_latency",
                "severity": "high",
                "description": f"P99 ({p99}ms) 是 P50 ({p50}ms) 的 5 倍以上",
                "cause": "可能有慢请求或 GC 停顿",
            })

        if p95 > p50 * 3:
            bottlenecks.append({
                "type": "high_variance",
                "severity": "medium",
                "description": f"P95 ({p95}ms) 是 P50 ({p50}ms) 的 3 倍以上",
                "cause": "请求处理时间差异大",
            })

        # 2. 错误率分析
        error_rate = load_test_results.get("error_rate", 0)
        if error_rate > 0.05:
            bottlenecks.append({
                "type": "high_error_rate",
                "severity": "critical",
                "description": f"错误率 {error_rate:.1%} 超过 5%",
                "cause": "可能是超时、OOM 或 API 限流",
            })

        # 3. 吞吐量分析
        qps = load_test_results.get("qps", 0)
        target_qps = load_test_results.get("target_qps", 0)
        if qps < target_qps * 0.8:
            bottlenecks.append({
                "type": "low_throughput",
                "severity": "high",
                "description": f"实际 QPS {qps} 低于目标 {target_qps} 的 80%",
                "cause": "可能是 GPU/CPU 瓶颈或网络限制",
            })

        # 4. 资源分析
        cpu_util = load_test_results.get("cpu_utilization", 0)
        gpu_util = load_test_results.get("gpu_utilization", 0)
        memory_util = load_test_results.get("memory_utilization", 0)

        if cpu_util > 0.9:
            bottlenecks.append({"type": "cpu_bottleneck", "severity": "high", "description": f"CPU {cpu_util:.0%}"})
        if gpu_util > 0.95:
            bottlenecks.append({"type": "gpu_bottleneck", "severity": "high", "description": f"GPU {gpu_util:.0%}"})
        if memory_util > 0.9:
            bottlenecks.append({"type": "memory_bottleneck", "severity": "critical", "description": f"内存 {memory_util:.0%}"})

        return {
            "bottlenecks": bottlenecks,
            "primary_bottleneck": bottlenecks[0] if bottlenecks else None,
            "recommendations": self._generate_recommendations(bottlenecks),
        }

    def _generate_recommendations(self, bottlenecks: list) -> list:
        recs = []
        for b in bottlenecks:
            if b["type"] == "gpu_bottleneck":
                recs.append("增加 GPU 实例或使用量化模型减少显存")
            elif b["type"] == "cpu_bottleneck":
                recs.append("增加 CPU 核心数或优化计算逻辑")
            elif b["type"] == "memory_bottleneck":
                recs.append("增加内存或检查内存泄漏")
            elif b["type"] == "tail_latency":
                recs.append("检查慢请求日志，优化超时和重试")
            elif b["type"] == "high_error_rate":
                recs.append("检查错误日志，可能需要扩容或降级")
        return recs
```

---

## 5. 持续压测

```python
@dataclass
class ContinuousLoadTest:
    """持续压测：CI/CD 集成"""

    async def run_regression_test(self) -> dict:
        """回归测试：每次发布后运行"""
        # 运行基准场景
        results = await self._run_scenario("simple_qa", users=10, duration=120)

        # 对比基线
        baseline = PerformanceBaseline()
        check = baseline.check_against_baseline(results, "simple_qa")

        if not check["all_passed"]:
            return {
                "passed": False,
                "action": "阻止发布",
                "regressions": [c for c in check["checks"].values() if not c["passed"]],
            }

        return {"passed": True, "action": "可发布"}
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了 Locust 压测脚本 | ☐ |
| 模拟了混合场景（简单/工具/长上下文/流式） | ☐ |
| 建立了性能基线 | ☐ |
| 实现了瓶颈分析器 | ☐ |
| 能定位 GPU/CPU/内存瓶颈 | ☐ |
| 集成了 CI/CD 回归测试 | ☐ |
| 有阶梯加压测试 | ☐ |
| 有持久稳定性测试 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 22 | CI/CD 流水线 | CI/CD |
| 29 | 性能基准测试 | 基准 |
| 42 | 性能剖析 | 剖析 |
| 59 | LLM 应用性能剖析 | 剖析 |
| 85 | 混沌工程实验 | 混沌 |
| 128 | 性能调优系统 | 调优 |
| 160 | 性能调优系统指南 | 调优 |
| 182 | 故障注入测试 | 故障注入 |
| 228 | 性能基准测试 | 基准 |
| 376 | 全链路压测与性能基准 | 压测 |
| 475 | Agent 性能调优与延迟优化 | 性能优化 |
| 487 | Agent 最佳实践 | 最佳实践 |
