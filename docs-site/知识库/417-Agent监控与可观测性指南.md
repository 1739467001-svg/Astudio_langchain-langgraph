# Agent 监控与可观测性指南

> Agent 上线后，你怎么知道它在干什么？每个请求经过了哪些节点、调用了哪些工具、花了多少 Token、哪里慢了、哪里出错了？Agent 监控让你对系统的每个环节了如指掌，从"出了问题才知道"变成"出问题前就预警"。

---

## 1. 可观测性三支柱

### 监控 vs 日志 vs 追踪

```
┌─────────────────────────────────────────────┐
│                 可观测性                       │
├──────────┬──────────┬───────────────────────┤
│  指标     │  日志     │  分布式追踪             │
│ Metrics  │  Logs    │  Traces               │
│ 数值聚合  │ 事件记录  │ 请求级全链路            │
│ QPS/延迟 │ 错误/调试 │ span树+因果关系          │
│ 时序存储  │ 搜索过滤  │ 可视化调用链             │
└──────────┴──────────┴───────────────────────┘
```

### Agent 特有的监控维度

| 维度 | 传统应用 | Agent 应用 |
|------|---------|-----------|
| 延迟 | 请求-响应 | 多轮推理+多步工具调用 |
| 错误 | HTTP 5xx | LLM 幻觉/工具失败/循环 |
| 成本 | CPU/内存 | Token 消耗+API 调用费 |
| 链路 | 微服务调用 | LLM→工具→LLM→工具→... |
| 质量 | 功能正确 | 语义正确（主观） |

---

## 2. 指标采集系统

```python
from dataclasses import dataclass, field
from collections import defaultdict
import time
from typing import Any

@dataclass
class MetricPoint:
    """单个指标数据点"""
    name: str
    value: float
    timestamp: float
    tags: dict[str, str] = field(default_factory=dict)


class MetricsCollector:
    """指标采集器"""

    def __init__(self):
        self.metrics: list[MetricPoint] = []
        self.counters: dict[str, float] = defaultdict(float)
        self.histograms: dict[str, list[float]] = defaultdict(list)
        self.gauges: dict[str, float] = &#123;&#125;

    def increment(self, name: str, value: float = 1, tags: dict | None = None):
        """计数器：累加"""
        key = f"&#123;name&#125;:&#123;tags&#125;" if tags else name
        self.counters[key] += value
        self.metrics.append(MetricPoint(
            name=name, value=value, timestamp=time.time(), tags=tags or &#123;&#125;
        ))

    def observe(self, name: str, value: float, tags: dict | None = None):
        """直方图：记录分布"""
        self.histograms[name].append(value)
        self.metrics.append(MetricPoint(
            name=name, value=value, timestamp=time.time(), tags=tags or &#123;&#125;
        ))

    def set_gauge(self, name: str, value: float, tags: dict | None = None):
        """仪表盘：设置当前值"""
        self.gauges[name] = value
        self.metrics.append(MetricPoint(
            name=name, value=value, timestamp=time.time(), tags=tags or &#123;&#125;
        ))

    def summary(self) -> dict:
        """生成指标摘要"""
        import numpy as np
        result = &#123;&#125;

        for name, values in self.histograms.items():
            if values:
                result[name] = &#123;
                    "count": len(values),
                    "mean": float(np.mean(values)),
                    "p50": float(np.percentile(values, 50)),
                    "p95": float(np.percentile(values, 95)),
                    "p99": float(np.percentile(values, 99)),
                    "max": float(max(values)),
                    "min": float(min(values)),
                &#125;

        for name, value in self.counters.items():
            result[f"counter:&#123;name&#125;"] = value

        for name, value in self.gauges.items():
            result[f"gauge:&#123;name&#125;"] = value

        return result


# Agent 专用指标定义
class AgentMetrics:
    """Agent 标准指标"""

    METRICS = &#123;
        # 性能指标
        "agent.request_latency_ms": &#123;"type": "histogram", "unit": "ms", "desc": "请求总延迟"&#125;,
        "agent.llm_latency_ms": &#123;"type": "histogram", "unit": "ms", "desc": "LLM 调用延迟"&#125;,
        "agent.tool_latency_ms": &#123;"type": "histogram", "unit": "ms", "desc": "工具调用延迟"&#125;,
        "agent.retrieval_latency_ms": &#123;"type": "histogram", "unit": "ms", "desc": "检索延迟"&#125;,
        # 吞吐指标
        "agent.requests_total": &#123;"type": "counter", "unit": "", "desc": "总请求数"&#125;,
        "agent.requests_per_minute": &#123;"type": "gauge", "unit": "rpm", "desc": "每分钟请求"&#125;,
        # Token 指标
        "agent.input_tokens": &#123;"type": "histogram", "unit": "tokens", "desc": "输入 Token"&#125;,
        "agent.output_tokens": &#123;"type": "histogram", "unit": "tokens", "desc": "输出 Token"&#125;,
        "agent.total_cost_usd": &#123;"type": "counter", "unit": "USD", "desc": "总成本"&#125;,
        # 质量指标
        "agent.tool_calls_per_request": &#123;"type": "histogram", "unit": "", "desc": "每请求工具调用数"&#125;,
        "agent.retries_per_request": &#123;"type": "histogram", "unit": "", "desc": "每请求重试次数"&#125;,
        "agent.loop_detected": &#123;"type": "counter", "unit": "", "desc": "检测到循环"&#125;,
        # 错误指标
        "agent.errors_total": &#123;"type": "counter", "unit": "", "desc": "总错误数"&#125;,
        "agent.tool_errors": &#123;"type": "counter", "unit": "", "desc": "工具错误数"&#125;,
        "agent.llm_errors": &#123;"type": "counter", "unit": "", "desc": "LLM 错误数"&#125;,
        "agent.timeout_errors": &#123;"type": "counter", "unit": "", "desc": "超时错误数"&#125;,
    &#125;
```

---

## 3. 分布式追踪

```python
from dataclasses import dataclass, field
from typing import Any
import uuid
import time

@dataclass
class Span:
    """追踪 Span"""
    trace_id: str
    span_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    parent_span_id: str | None = None
    name: str = ""
    start_time: float = field(default_factory=time.time)
    end_time: float | None = None
    tags: dict[str, Any] = field(default_factory=dict)
    events: list[dict] = field(default_factory=list)
    status: str = "ok"  # ok / error / timeout

    @property
    def duration_ms(self) -> float:
        end = self.end_time or time.time()
        return (end - self.start_time) * 1000

    def add_event(self, name: str, **kwargs):
        self.events.append(&#123;
            "name": name,
            "timestamp": time.time(),
            "attributes": kwargs,
        &#125;)

    def set_error(self, error: str):
        self.status = "error"
        self.tags["error"] = error


class TraceCollector:
    """追踪收集器"""

    def __init__(self):
        self.traces: dict[str, list[Span]] = &#123;&#125;
        self.current_spans: dict[str, Span] = &#123;&#125;  # thread/agent → current span

    def start_trace(self, name: str, tags: dict | None = None) -> str:
        """开始一个新追踪"""
        trace_id = str(uuid.uuid4())[:8]
        span = Span(
            trace_id=trace_id,
            name=name,
            tags=tags or &#123;&#125;,
        )
        self.traces[trace_id] = [span]
        return trace_id

    def start_span(
        self,
        trace_id: str,
        name: str,
        parent_span_id: str | None = None,
        tags: dict | None = None,
    ) -> Span:
        """开始一个子 Span"""
        span = Span(
            trace_id=trace_id,
            parent_span_id=parent_span_id,
            name=name,
            tags=tags or &#123;&#125;,
        )
        if trace_id not in self.traces:
            self.traces[trace_id] = []
        self.traces[trace_id].append(span)
        return span

    def end_span(self, span: Span):
        """结束 Span"""
        span.end_time = time.time()

    def get_trace(self, trace_id: str) -> list[Span]:
        """获取完整追踪"""
        return self.traces.get(trace_id, [])

    def get_slow_spans(self, threshold_ms: float = 1000) -> list[Span]:
        """获取慢 Span"""
        slow = []
        for spans in self.traces.values():
            for span in spans:
                if span.duration_ms > threshold_ms and span.end_time:
                    slow.append(span)
        return slow

    def get_error_traces(self) -> dict[str, list[Span]]:
        """获取有错误的追踪"""
        errors = &#123;&#125;
        for trace_id, spans in self.traces.items():
            if any(s.status == "error" for s in spans):
                errors[trace_id] = spans
        return errors


# Agent 集成追踪
class TracedAgent:
    """带追踪的 Agent"""

    def __init__(self, llm, tools: list, collector: TraceCollector):
        self.llm = llm
        self.tools = &#123;t.name: t for t in tools&#125;
        self.collector = collector

    def run(self, query: str) -> dict:
        """运行 Agent（带追踪）"""
        # 开始根追踪
        trace_id = self.collector.start_trace("agent_run", &#123;"query": query[:100]&#125;)

        total_tokens = 0
        tool_calls = 0

        try:
            # Span: LLM 推理
            llm_span = self.collector.start_span(
                trace_id, "llm_inference",
                tags=&#123;"model": "gpt-4o-mini"&#125;,
            )
            llm_response = self.llm.invoke(query)
            self.collector.end_span(llm_span)
            total_tokens += len(query) // 4  # 粗略估算

            # 如果需要调用工具
            while "tool_call" in llm_response:
                tool_name = llm_response["tool_call"]["name"]
                tool_args = llm_response["tool_call"]["args"]

                # Span: 工具调用
                tool_span = self.collector.start_span(
                    trace_id, f"tool:&#123;tool_name&#125;",
                    parent_span_id=llm_span.span_id,
                    tags=&#123;"tool": tool_name, "args": str(tool_args)[:200]&#125;,
                )

                try:
                    tool_result = self.tools[tool_name].invoke(tool_args)
                    tool_span.add_event("tool_success")
                except Exception as e:
                    tool_span.set_error(str(e))
                    tool_result = f"工具错误: &#123;e&#125;"

                self.collector.end_span(tool_span)
                tool_calls += 1

                # 再次调用 LLM
                llm_response = self.llm.invoke(f"工具结果: &#123;tool_result&#125;")
                total_tokens += len(str(tool_result)) // 4

            return &#123;
                "response": llm_response,
                "trace_id": trace_id,
                "tool_calls": tool_calls,
                "total_tokens": total_tokens,
            &#125;

        except Exception as e:
            # 标记追踪为错误
            spans = self.collector.get_trace(trace_id)
            if spans:
                spans[-1].set_error(str(e))
            raise
```

---

## 4. 结构化日志

```python
import json
import logging
import time
from typing import Any

class AgentLogger:
    """Agent 结构化日志"""

    def __init__(self, name: str = "agent"):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter('%(message)s'))
        self.logger.addHandler(handler)

    def _log(self, level: str, event: str, **kwargs):
        entry = &#123;
            "timestamp": time.time(),
            "level": level,
            "event": event,
            **kwargs,
        &#125;
        self.logger.log(
            getattr(logging, level.upper(), logging.INFO),
            json.dumps(entry, ensure_ascii=False, default=str),
        )

    def info(self, event: str, **kwargs):
        self._log("INFO", event, **kwargs)

    def warn(self, event: str, **kwargs):
        self._log("WARN", event, **kwargs)

    def error(self, event: str, **kwargs):
        self._log("ERROR", event, **kwargs)

    def debug(self, event: str, **kwargs):
        self._log("DEBUG", event, **kwargs)

    # Agent 专用日志方法
    def log_request(self, request_id: str, query: str, user_id: str):
        self.info("request_received", request_id=request_id, query=query[:200], user_id=user_id)

    def log_llm_call(self, request_id: str, model: str, input_tokens: int):
        self.info("llm_call", request_id=request_id, model=model, input_tokens=input_tokens)

    def log_tool_call(self, request_id: str, tool: str, args: dict, latency_ms: float):
        self.info("tool_call", request_id=request_id, tool=tool,
                  args=str(args)[:200], latency_ms=latency_ms)

    def log_error(self, request_id: str, error: str, context: dict):
        self.error("error", request_id=request_id, error=error, context=context)

    def log_response(self, request_id: str, output_tokens: int, latency_ms: float):
        self.info("response_sent", request_id=request_id,
                  output_tokens=output_tokens, latency_ms=latency_ms)


# 使用
logger = AgentLogger("tax_agent")
logger.log_request("req_001", "帮我计算个税", "user_123")
logger.log_llm_call("req_001", "gpt-4o-mini", 500)
logger.log_tool_call("req_001", "search_tax_rate", &#123;"year": 2025&#125;, 45.2)
logger.log_response("req_001", 300, 1200.5)
```

---

## 5. 监控仪表盘

```python
class AgentDashboard:
    """Agent 监控仪表盘"""

    def __init__(self, metrics: MetricsCollector, traces: TraceCollector):
        self.metrics = metrics
        self.traces = traces

    def render(self) -> dict:
        """渲染仪表盘数据"""
        summary = self.metrics.summary()

        return &#123;
            "performance": &#123;
                "request_latency_p50": summary.get("agent.request_latency_ms", &#123;&#125;).get("p50", 0),
                "request_latency_p95": summary.get("agent.request_latency_ms", &#123;&#125;).get("p95", 0),
                "request_latency_p99": summary.get("agent.request_latency_ms", &#123;&#125;).get("p99", 0),
                "llm_latency_p50": summary.get("agent.llm_latency_ms", &#123;&#125;).get("p50", 0),
                "tool_latency_p50": summary.get("agent.tool_latency_ms", &#123;&#125;).get("p50", 0),
            &#125;,
            "throughput": &#123;
                "total_requests": summary.get("counter:agent.requests_total", 0),
                "errors": summary.get("counter:agent.errors_total", 0),
                "error_rate": self._error_rate(),
            &#125;,
            "tokens": &#123;
                "input_p50": summary.get("agent.input_tokens", &#123;&#125;).get("p50", 0),
                "output_p50": summary.get("agent.output_tokens", &#123;&#125;).get("p50", 0),
                "total_cost": summary.get("counter:agent.total_cost_usd", 0),
            &#125;,
            "quality": &#123;
                "tool_calls_avg": summary.get("agent.tool_calls_per_request", &#123;&#125;).get("mean", 0),
                "retries_avg": summary.get("agent.retries_per_request", &#123;&#125;).get("mean", 0),
                "loops_detected": summary.get("counter:agent.loop_detected", 0),
            &#125;,
            "traces": &#123;
                "total_traces": len(self.traces.traces),
                "slow_spans": len(self.traces.get_slow_spans(1000)),
                "error_traces": len(self.traces.get_error_traces()),
            &#125;,
            "alerts": self._check_alerts(summary),
        &#125;

    def _error_rate(self) -> float:
        total = self.metrics.counters.get("agent.requests_total", 0)
        errors = self.metrics.counters.get("agent.errors_total", 0)
        return errors / max(total, 1)

    def _check_alerts(self, summary: dict) -> list[dict]:
        """告警检查"""
        alerts = []

        # P99 延迟告警
        p99 = summary.get("agent.request_latency_ms", &#123;&#125;).get("p99", 0)
        if p99 > 10000:
            alerts.append(&#123;
                "level": "warning",
                "metric": "request_latency_p99",
                "value": f"&#123;p99:.0f&#125;ms",
                "threshold": "10000ms",
                "message": "P99 延迟超过 10 秒",
            &#125;)

        # 错误率告警
        error_rate = self._error_rate()
        if error_rate > 0.05:
            alerts.append(&#123;
                "level": "critical",
                "metric": "error_rate",
                "value": f"&#123;error_rate:.1%&#125;",
                "threshold": "5%",
                "message": "错误率超过 5%",
            &#125;)

        # Token 成本告警
        cost = self.metrics.counters.get("agent.total_cost_usd", 0)
        if cost > 100:
            alerts.append(&#123;
                "level": "warning",
                "metric": "total_cost",
                "value": f"$&#123;cost:.2f&#125;",
                "threshold": "$100",
                "message": "累计成本超过 $100",
            &#125;)

        # 循环检测告警
        loops = self.metrics.counters.get("agent.loop_detected", 0)
        if loops > 0:
            alerts.append(&#123;
                "level": "critical",
                "metric": "loop_detected",
                "value": loops,
                "threshold": 0,
                "message": f"检测到 &#123;loops&#125; 次循环",
            &#125;)

        return alerts
```

---

## 6. 告警规则

```python
@dataclass
class AlertRule:
    """告警规则"""
    name: str
    metric: str
    condition: str    # gt / lt / eq / gte / lte
    threshold: float
    window_seconds: int   # 检测窗口
    severity: str        # info / warning / critical
    message: str
    cooldown_seconds: int = 300  # 告警冷却

class AlertManager:
    """告警管理器"""

    def __init__(self):
        self.rules: list[AlertRule] = []
        self.last_alert: dict[str, float] = &#123;&#125;

    def add_rule(self, rule: AlertRule):
        self.rules.append(rule)

    def check(self, metrics: dict, current_time: float) -> list[dict]:
        """检查所有告警规则"""
        triggered = []
        for rule in self.rules:
            value = metrics.get(rule.metric, 0)
            condition_met = self._check_condition(value, rule.condition, rule.threshold)

            if condition_met:
                # 检查冷却
                last = self.last_alert.get(rule.name, 0)
                if current_time - last < rule.cooldown_seconds:
                    continue

                self.last_alert[rule.name] = current_time
                triggered.append(&#123;
                    "rule": rule.name,
                    "severity": rule.severity,
                    "value": value,
                    "threshold": rule.threshold,
                    "message": rule.message,
                &#125;)

        return triggered

    @staticmethod
    def _check_condition(value: float, condition: str, threshold: float) -> bool:
        ops = &#123;
            "gt": lambda a, b: a > b,
            "lt": lambda a, b: a < b,
            "gte": lambda a, b: a >= b,
            "lte": lambda a, b: a <= b,
            "eq": lambda a, b: a == b,
        &#125;
        return ops.get(condition, lambda a, b: False)(value, threshold)


# 预置告警规则
alert_mgr = AlertManager()
alert_mgr.add_rule(AlertRule(
    name="high_latency", metric="p99_latency_ms",
    condition="gt", threshold=10000, window_seconds=60,
    severity="warning", message="P99 延迟超过 10 秒",
))
alert_mgr.add_rule(AlertRule(
    name="high_error_rate", metric="error_rate",
    condition="gt", threshold=0.05, window_seconds=60,
    severity="critical", message="错误率超过 5%",
))
alert_mgr.add_rule(AlertRule(
    name="high_cost", metric="hourly_cost_usd",
    condition="gt", threshold=10, window_seconds=3600,
    severity="warning", message="每小时成本超过 $10",
))
```

---

## 7. 监控架构与工具链

```
Agent 应用
  ├── Metrics Collector → Prometheus → Grafana（仪表盘）
  ├── Trace Collector   → Jaeger / Tempo（调用链）
  └── Structured Logs   → ELK / Loki（日志搜索）
```

### LangSmith 集成

```python
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "ls__xxx"
os.environ["LANGCHAIN_PROJECT"] = "my-agent"

# 启用后，所有 LangChain 调用自动被追踪
# 可在 LangSmith 平台查看完整调用链
```

### OpenTelemetry 集成

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, BatchSpanProcessor

# 配置 OTel
provider = TracerProvider()
processor = BatchSpanProcessor(ConsoleSpanExporter())
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

tracer = trace.get_tracer("agent")

# 在 Agent 中使用
with tracer.start_as_current_span("agent_run") as span:
    span.set_attribute("query", query[:100])

    with tracer.start_as_current_span("llm_call"):
        response = llm.invoke(query)
        span.set_attribute("model", "gpt-4o")
        span.set_attribute("tokens", len(response.content) // 4)
```

---

## 8. 配置参考

| 指标 | 告警阈值 | 严重级别 |
|------|---------|---------|
| P50 延迟 | > 2s | warning |
| P99 延迟 | > 10s | warning |
| 错误率 | > 5% | critical |
| 循环检测 | > 0 | critical |
| 每小时成本 | > $10 | warning |
| Token 暴增 | > 2x 均值 | warning |
| 工具失败率 | > 10% | warning |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有指标采集器 | ☐ |
| 有分布式追踪 | ☐ |
| 有结构化日志 | ☐ |
| 有监控仪表盘 | ☐ |
| 有告警规则 | ☐ |
| 有 P50/P95/P99 延迟 | ☐ |
| 有 Token 成本追踪 | ☐ |
| 有循环检测告警 | ☐ |
| 有错误率告警 | ☐ |
| 有慢 Span 分析 | ☐ |
