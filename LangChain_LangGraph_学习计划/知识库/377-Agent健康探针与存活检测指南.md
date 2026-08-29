# Agent 健康探针与存活检测指南

> 生产环境的 Agent 需要回答两个问题："你还活着吗？"和"你还能干活吗？"存活探针和就绪探针分别回答这两个问题。这篇指南讲透探针设计、健康检查实现和自动恢复策略。

---

## 一、双探针架构

```mermaid
graph TB
    LB["负载均衡器"] --> LIVENESS{"存活探针<br/>Liveness<br/>进程活着?"}
    LIVENESS -->|是| READINESS{"就绪探针<br/>Readiness<br/>能干活?"}
    LIVENESS -->|否| RESTART["重启容器/进程"]
    READINESS -->|是| ROUTE["分发流量"]
    READINESS -->|否| DRAIN["摘除流量<br/>等待恢复"]

    subgraph 检查项 {"就绪探针检查项"}
        LLM_OK["LLM可达"]
        VEC_OK["向量库可达"]
        TOOL_OK["工具服务可达"]
        MEM_OK["内存充足"]
    end

    style LIVENESS fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style READINESS fill:#E3F2FD,stroke:#1565C0
    style RESTART fill:#FFCDD2,stroke:#C62828
    style ROUTE fill:#C8E6C9
```

存活探针（Liveness）：检查进程是否存活，失败则重启。就绪探针（Readiness）：检查依赖是否可用，失败则摘除流量但不重启。

---

## 二、探针实现

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Callable, Awaitable
import asyncio
import time
import psutil

class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"   # 部分依赖不可用
    UNHEALTHY = "unhealthy"
    STARTING = "starting"

@dataclass
class CheckResult:
    """单项检查结果。"""
    name: str
    status: HealthStatus
    latency_ms: float
    detail: str = ""
    checked_at: str = field(default_factory=lambda: datetime.now().isoformat())

@dataclass
class HealthReport:
    """完整健康报告。"""
    overall: HealthStatus = HealthStatus.HEALTHY
    checks: list[CheckResult] = field(default_factory=list)
    uptime_seconds: float = 0.0
    version: str = "1.0.0"

    @property
    def is_live(self) -> bool:
        """存活探针：进程活着即可。"""
        return self.overall != HealthStatus.UNHEALTHY

    @property
    def is_ready(self) -> bool:
        """就绪探针：所有关键依赖可用。"""
        return self.overall == HealthStatus.HEALTHY


class HealthChecker:
    """健康检查器。"""

    def __init__(self):
        self._checks: dict[str, Callable] = {}
        self._start_time = time.monotonic()
        self._last_report: Optional[HealthReport] = None

    def register(self, name: str, check_fn: Callable[[], Awaitable[CheckResult]]):
        """注册检查项。"""
        self._checks[name] = check_fn

    async def run_checks(self) -> HealthReport:
        """运行所有检查。"""
        report = HealthReport(uptime_seconds=round(time.monotonic() - self._start_time, 1))

        results = []
        for name, check_fn in self._checks.items():
            try:
                result = await asyncio.wait_for(check_fn(), timeout=5.0)
            except asyncio.TimeoutError:
                result = CheckResult(name=name, status=HealthStatus.UNHEALTHY, latency_ms=5000, detail="超时")
            except Exception as e:
                result = CheckResult(name=name, status=HealthStatus.UNHEALTHY, latency_ms=0, detail=str(e)[:100])
            results.append(result)

        report.checks = results

        # 综合状态：全部healthy=healthy，有unhealthy=unhealthy，其余=degraded
        statuses = [r.status for r in results]
        if all(s == HealthStatus.HEALTHY for s in statuses):
            report.overall = HealthStatus.HEALTHY
        elif any(s == HealthStatus.UNHEALTHY for s in statuses):
            report.overall = HealthStatus.UNHEALTHY
        else:
            report.overall = HealthStatus.DEGRADED

        self._last_report = report
        return report

    def get_last_report(self) -> Optional[HealthReport]:
        return self._last_report


# ===== 标准检查项 =====

async def check_llm_reachable() -> CheckResult:
    """检查LLM服务是否可达。"""
    start = time.monotonic()
    try:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        await asyncio.wait_for(llm.ainvoke("ping"), timeout=10)
        latency = (time.monotonic() - start) * 1000
        return CheckResult("llm", HealthStatus.HEALTHY, round(latency, 1), "LLM可达")
    except asyncio.TimeoutError:
        return CheckResult("llm", HealthStatus.UNHEALTHY, 10000, "LLM超时")
    except Exception as e:
        return CheckResult("llm", HealthStatus.UNHEALTHY, 0, str(e)[:100])

async def check_vector_db() -> CheckResult:
    """检查向量库是否可达。"""
    start = time.monotonic()
    try:
        # 模拟向量库ping
        await asyncio.sleep(0.05)
        latency = (time.monotonic() - start) * 1000
        return CheckResult("vector_db", HealthStatus.HEALTHY, round(latency, 1), "向量库可达")
    except Exception as e:
        return CheckResult("vector_db", HealthStatus.UNHEALTHY, 0, str(e)[:100])

async def check_memory() -> CheckResult:
    """检查内存使用率。"""
    try:
        mem = psutil.virtual_memory()
        latency = 0.1
        if mem.percent > 90:
            return CheckResult("memory", HealthStatus.UNHEALTHY, latency, f"内存使用率{mem.percent}%")
        elif mem.percent > 75:
            return CheckResult("memory", HealthStatus.DEGRADED, latency, f"内存使用率{mem.percent}%")
        return CheckResult("memory", HealthStatus.HEALTHY, latency, f"内存使用率{mem.percent}%")
    except Exception:
        return CheckResult("memory", HealthStatus.HEALTHY, 0, "psutil不可用，跳过")

async def check_tool_service() -> CheckResult:
    """检查工具服务是否可达。"""
    start = time.monotonic()
    try:
        await asyncio.sleep(0.02)  # 模拟ping
        latency = (time.monotonic() - start) * 1000
        return CheckResult("tools", HealthStatus.HEALTHY, round(latency, 1), "工具服务可达")
    except Exception as e:
        return CheckResult("tools", HealthStatus.UNHEALTHY, 0, str(e)[:100])


class HealthEndpoint:
    """健康检查HTTP端点模拟。"""

    def __init__(self, checker: HealthChecker):
        self.checker = checker
        self._monitor_task: Optional[asyncio.Task] = None
        self._check_interval = 15.0  # 每15秒检查一次

    async def liveness(self) -> dict:
        """存活探针端点——/health/live。"""
        report = self.checker.get_last_report()
        if report and report.is_live:
            return {"status": "alive", "uptime": report.uptime_seconds}
        return {"status": "dead", "reason": "进程异常"}

    async def readiness(self) -> dict:
        """就绪探针端点——/health/ready。"""
        report = await self.checker.run_checks()
        return {
            "status": report.overall.value,
            "ready": report.is_ready,
            "checks": [{"name": c.name, "status": c.status.value, "latency_ms": c.latency_ms, "detail": c.detail} for c in report.checks],
            "uptime": report.uptime_seconds,
        }

    async def start_monitoring(self):
        """启动后台监控。"""
        async def monitor():
            while True:
                await self.checker.run_checks()
                await asyncio.sleep(self._check_interval)
        self._monitor_task = asyncio.create_task(monitor())

    async def stop(self):
        if self._monitor_task:
            self._monitor_task.cancel()
```

### 使用示例

```python
import asyncio

async def main():
    checker = HealthChecker()
    checker.register("llm", check_llm_reachable)
    checker.register("vector_db", check_vector_db)
    checker.register("memory", check_memory)
    checker.register("tools", check_tool_service)

    endpoint = HealthEndpoint(checker)
    await endpoint.start_monitoring()

    # 模拟探针调用
    await asyncio.sleep(1)  # 等首次检查完成

    live = await endpoint.liveness()
    print(f"存活探针: {live}")

    ready = await endpoint.readiness()
    print(f"就绪探针: {ready['status']}, ready={ready['ready']}")
    for c in ready["checks"]:
        print(f"  {c['name']}: {c['status']} ({c['latency_ms']}ms)")

    await endpoint.stop()

asyncio.run(main())
```

---

## 三、探针配置参考

| 探针类型 | 检查间隔 | 超时 | 失败阈值 | 失败动作 |
|----------|----------|------|----------|----------|
| Liveness | 30s | 5s | 3次 | 重启进程 |
| Readiness | 10s | 3s | 1次 | 摘除流量 |
| Startup | 5s | 30s | 5次 | 阻止流量 |

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 存活就绪分离 | Liveness重进程，Readiness重依赖 | ★★★ |
| 检查项超时 | 单项最多5s | ★★★ |
| 后台定期检查 | 不等请求才检查 | ★★☆ |
| 降级而非全挂 | 部分依赖不可用标记degraded | ★★★ |
| 探针要轻量 | 不做复杂操作 | ★★☆ |
| 记录检查历史 | 追踪健康趋势 | ★☆☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有存活探针 | ☐ |
| 有就绪探针 | ☐ |
| 有多项检查 | ☐ |
| 有超时控制 | ☐ |
| 有后台监控 | ☐ |
| 有降级状态 | ☐ |
