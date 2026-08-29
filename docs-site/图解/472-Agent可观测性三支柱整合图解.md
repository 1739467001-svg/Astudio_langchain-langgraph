# Agent 可观测性三支柱整合图解

> Metrics+Tracing+Logging→Grafana统一面板。本图解可视化三支柱关联。

---

## 三支柱整合

```mermaid
graph TB
    AGENT["Agent"] --> M["Metrics<br/>Prometheus<br/>聚合统计"]
    AGENT --> T["Tracing<br/>Jaeger/Tempo<br/>调用链"]
    AGENT --> L["Logging<br/>Loki/ELK<br/>详细日志"]

    M <-->|"trace_id"| T
    T <-->|"span_id"| L

    M --> G["Grafana<br/>统一面板"]
    T --> G
    L --> G

    style AGENT fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style G fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 关联跳转流程

```mermaid
graph LR
    METRIC["Metrics发现<br/>P95延迟高"] --> TRACE["点击trace_id<br/>查看调用链"]
    TRACE --> SPAN["找到慢span"] --> LOG["点击span_id<br/>查看日志"]
    LOG --> ROOT["定位根因"]

    style METRIC fill:#FFCCBC,stroke:#D84315
    style ROOT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 三支柱职责

| 支柱 | 回答 | 工具 | 粒度 |
|------|------|------|------|
| Metrics | 系统健康吗? | Prometheus | 聚合数值 |
| Tracing | 请求经过什么? | Jaeger | 调用链 |
| Logging | 具体发生什么? | Loki | 文本日志 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| OpenTelemetry埋点 | ☐ |
| Prometheus指标 | ☐ |
| Grafana仪表盘 | ☐ |
| trace_id关联 | ☐ |
| 告警规则 | ☐ |
