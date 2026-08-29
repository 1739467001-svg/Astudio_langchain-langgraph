# Agent 日志管理与审计追溯图解

> 结构化日志+脱敏+链式哈希审计。本图解可视化日志管理体系。

---

## 日志聚合架构

```mermaid
graph TB
    A1["Agent实例1"] --> COLLECT["日志收集<br/>Fluentd/Vector"]
    A2["Agent实例2"] --> COLLECT
    A3["Agent实例3"] --> COLLECT
    COLLECT --> BUFFER["消息队列<br/>Kafka"]
    BUFFER --> STORE["日志存储<br/>Elasticsearch/Loki"]
    STORE --> QUERY["查询分析<br/>Kibana/Grafana"]

    style COLLECT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style STORE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style QUERY fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 日志脱敏

```mermaid
graph LR
    RAW["原始日志<br/>含API Key/手机号"] --> MASK["脱敏管道<br/>正则替换"]
    MASK --> SAFE["安全日志<br/>sk-*** / 1**-****"]
    SAFE --> STORE["存储/传输"]

    style RAW fill:#FFCCBC,stroke:#D84315
    style SAFE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 审计链式哈希

```mermaid
graph LR
    E1["事件1<br/>hash=abc"] --> E2["事件2<br/>prev=abc<br/>hash=def"]
    E2 --> E3["事件3<br/>prev=def<br/>hash=ghi"]
    E3 --> VERIFY["链完整性验证<br/>篡改=断裂"]

    style VERIFY fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 结构化日志 | ☐ |
| 日志脱敏 | ☐ |
| 分布式聚合 | ☐ |
| request_id透传 | ☐ |
| 链式哈希审计 | ☐ |
| 日志智能分析 | ☐ |
