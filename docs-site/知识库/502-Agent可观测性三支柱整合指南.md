# Agent 可观测性三支柱整合指南

> Metrics（指标）、Tracing（追踪）、Logging（日志）——可观测性三支柱各自独立但需要关联：一个错误出现在 Metrics 中，需要在 Tracing 中找到调用链，再在 Logging 中找到详细日志。本指南系统讲解三支柱整合架构、OpenTelemetry 统一标准、Grafana 全景仪表盘。

---

## 1. 三支柱整合架构

### 关联模型

```mermaid
graph TB
    AGENT["LangGraph Agent"]

    AGENT --> METRICS["Metrics<br/>Prometheus<br/>聚合统计"]
    AGENT --> TRACING["Tracing<br/>Jaeger/Tempo<br/>调用链"]
    AGENT --> LOGGING["Logging<br/>Loki/ELK<br/>详细日志"]

    METRICS <-->|"trace_id"| TRACING
    TRACING <-->|"span_id"| LOGGING
    LOGGING <-->|"labels"| METRICS

    GRAFANA["Grafana<br/>统一仪表盘"]
    METRICS --> GRAFANA
    TRACING --> GRAFANA
    LOGGING --> GRAFANA

    style AGENT fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style GRAFANA fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

### 三支柱职责

| 支柱 | 回答什么 | 工具 | 数据粒度 |
|------|---------|------|---------|
| Metrics | "系统健康吗？" | Prometheus | 聚合数值 |
| Tracing | "请求经过了什么？" | Jaeger/Tempo | 调用链 |
| Logging | "具体发生了什么？" | Loki/ELK | 文本日志 |

---

## 2. OpenTelemetry 统一标准

### 自动埋点

```python
# pip install opentelemetry-distro opentelemetry-instrumentation-langchain
# opentelemetry-bootstrap --action=install

from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.langchain import LangchainInstrumentor

# 初始化 OpenTelemetry
resource = Resource.create(&#123;
    "service.name": "agent-service",
    "service.version": "1.0.0",
    "deployment.environment": "production",
&#125;)

provider = TracerProvider(resource=resource)
provider.add_span_processor(
    BatchSpanProcessor(OTLPSpanExporter(endpoint="http://otel-collector:4317"))
)
trace.set_tracer_provider(provider)

# 一行代码自动埋点所有 LangChain 调用
LangchainInstrumentor().instrument()

# 之后所有 LLM 调用、工具调用、链执行都自动生成 Span
# 包括：LLM 推理时间、Token 消耗、工具调用参数和结果
```

### 手动埋点

```python
from opentelemetry import trace

tracer = trace.get_tracer("agent-service")

async def agent_node(state):
    """带手动 span 的节点"""
    with tracer.start_as_current_span("agent_reasoning") as span:
        span.set_attribute("query.length", len(state["messages"][-1].content))
        span.set_attribute("model", "gpt-4o-mini")

        # 子 span：LLM 调用
        with tracer.start_as_current_span("llm_call"):
            response = await llm.ainvoke(state["messages"])
            span.set_attribute("response.tokens", response.usage_metadata.get("total_tokens", 0))
            span.set_attribute("response.length", len(response.content))

        # 子 span：工具调用
        if hasattr(response, "tool_calls") and response.tool_calls:
            with tracer.start_as_current_span("tool_execution"):
                for tc in response.tool_calls:
                    span.set_attribute("tool.name", tc["name"])
                    result = await execute_tool(tc)
                    span.set_attribute("tool.success", True)

        return &#123;"messages": state["messages"] + [response]&#125;
```

### Prometheus 指标

```python
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from fastapi import FastAPI, Response

app = FastAPI()

# 定义指标
request_count = Counter("agent_requests_total", "Total requests", ["status", "model"])
request_latency = Histogram("agent_request_duration_seconds", "Request latency",
                             buckets=[0.5, 1, 2, 5, 10, 30, 60, 120])
token_usage = Counter("agent_tokens_total", "Token usage", ["type", "model"])
active_sessions = Gauge("agent_active_sessions", "Active sessions")
cost_gauge = Gauge("agent_cost_usd", "Cost in USD")

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type="text/plain")

# 在 Agent 中记录
async def tracked_invoke(query: str):
    active_sessions.inc()
    start = time.time()

    try:
        response = await llm.ainvoke(query)
        request_count.labels(status="success", model="gpt-4o-mini").inc()
        token_usage.labels(type="input", model="gpt-4o-mini").inc(
            response.usage_metadata.get("prompt_tokens", 0)
        )
        token_usage.labels(type="output", model="gpt-4o-mini").inc(
            response.usage_metadata.get("completion_tokens", 0)
        )
        return response
    except Exception:
        request_count.labels(status="error", model="gpt-4o-mini").inc()
        raise
    finally:
        request_latency.observe(time.time() - start)
        active_sessions.dec()
```

---

## 3. Grafana 仪表盘

### 关键面板

```yaml
# Grafana Dashboard 配置要点
panels:
  # 第一行：概览
  - title: "请求总数"
    query: "rate(agent_requests_total[5m])"
  - title: "成功率"
    query: "sum(rate(agent_requests_total&#123;status='success'&#125;[5m])) / sum(rate(agent_requests_total[5m]))"

  # 第二行：延迟
  - title: "P50/P95/P99 延迟"
    query: "histogram_quantile(0.50, agent_request_duration_seconds_bucket)"
  - title: "延迟分布"
    query: "agent_request_duration_seconds_bucket"

  # 第三行：Token 与成本
  - title: "Token 消耗"
    query: "rate(agent_tokens_total[1h])"
  - title: "成本估算"
    query: "agent_cost_usd"

  # 第四行：追踪链接
  - title: "慢请求追踪"
    query: "agent_request_duration_seconds_bucket&#123;le='60'&#125;"  # >60s 的请求
    # 点击跳转到 Jaeger 查看调用链

  # 第五行：日志关联
  - title: "错误日志"
    datasource: "Loki"
    query: '&#123;app="agent-service"&#125; |= "ERROR"'
```

### trace_id 关联

```python
import structlog

# 结构化日志中注入 trace_id
logger = structlog.get_logger()

async def logged_with_trace(state):
    """日志和追踪关联"""
    span = trace.get_current_span()
    trace_id = format(span.get_span_context().trace_id, "032x")
    span_id = format(span.get_span_context().span_id, "016x")

    # 日志中带上 trace_id 和 span_id
    logger.info("node.start",
        trace_id=trace_id,
        span_id=span_id,
        node="llm_call",
        query_length=len(state["messages"][-1].content),
    )

    # 在 Grafana 中：Metrics → trace_id → Tracing → span_id → Logs
    # 完整关联链路
```

---

## 4. 告警规则

```yaml
# Prometheus 告警规则
groups:
  - name: agent_alerts
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(agent_requests_total&#123;status="error"&#125;[5m]))
          / sum(rate(agent_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "错误率超过 5%"

      - alert: HighLatency
        expr: histogram_quantile(0.95, agent_request_duration_seconds_bucket) > 30
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "P95 延迟超过 30 秒"

      - alert: HighTokenCost
        expr: increase(agent_tokens_total[1h]) > 1000000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "1小时内 Token 消耗超过 100 万"
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解三支柱各自职责 | ☐ |
| 配置了 OpenTelemetry 自动埋点 | ☐ |
| 实现了手动 span | ☐ |
| 配置了 Prometheus 指标 | ☐ |
| 配置了 Grafana 仪表盘 | ☐ |
| 实现了 trace_id 关联日志 | ☐ |
| 配置了告警规则 | ☐ |
| 能从 Metrics→Tracing→Logging 跳转 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 17 | LangSmith 可观测性 | LangSmith |
| 91 | SLO 与告警 | 告警 |
| 123 | LLM 应用可观测性体系 | 可观测性 |
| 134 | Agent 可观测性 | 可观测性 |
| 166 | Agent 可观测性深度 | 深度 |
| 249 | SLO 告警 | 告警 |
| 350 | 指标监控面板 | 面板 |
| 360 | 分布式追踪 | 追踪 |
| 362 | Agent 工具调用链追踪 | 调用链 |
| 380 | Agent 指标采集与监控面板 | 指标 |
| 390 | 分布式追踪与调用图谱 | 追踪 |
| 417 | Agent 监控与可观测性 | 监控 |
| 445 | Agent 调试与可观测工具链 | 调试 |
| 478 | AIOps 与智能运维 | 智能运维 |
| 480 | Agent 日志管理与审计 | 日志 |
