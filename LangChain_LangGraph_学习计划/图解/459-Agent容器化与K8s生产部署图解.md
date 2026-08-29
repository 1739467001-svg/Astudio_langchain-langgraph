# Agent 容器化与 K8s 生产部署图解

> Docker镜像+K8s编排+HPA弹性+Helm Chart。本图解可视化容器化部署架构。

---

## K8s 部署架构

```mermaid
graph TB
    ING["Ingress<br/>agent.example.com"]
    ING --> SVC["Service<br/>ClusterIP:80"]
    SVC --> P1["Pod 1<br/>Agent实例"]
    SVC --> P2["Pod 2<br/>Agent实例"]
    SVC --> P3["Pod 3<br/>Agent实例"]

    P1 --> DB["PostgreSQL<br/>状态/检查点"]
    P1 --> VEC["向量库<br/>Qdrant"]
    P1 --> REDIS["Redis<br/>缓存/队列"]

    HPA["HPA<br/>自动扩缩"] --> P1
    HPA --> P2
    HPA --> P3

    style SVC fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style HPA fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style DB fill:#C8E6C9,stroke:#2E7D32
```

---

## 健康探针

```mermaid
graph TB
    START["启动"] --> STARTUP["startupProbe<br/>最多等150秒"]
    STARTUP --> READY_CHECK{"就绪?"}
    READY_CHECK -->|"是"| RUNNING["运行中"]
    READY_CHECK -->|"否"| KILL["杀死重启"]
    RUNNING --> LIVE["livenessProbe<br/>每30秒检查存活"]
    RUNNING --> READY["readinessProbe<br/>每10秒检查就绪"]
    READY -->|"不就绪"| REMOVE["从负载均衡摘除"]

    style STARTUP fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style RUNNING fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style KILL fill:#FFCCBC,stroke:#D84315
```

---

## Helm Chart 结构

```
agent-chart/
├── Chart.yaml
├── values.yaml        ← 默认值
├── values-prod.yaml   ← 生产覆盖
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    ├── configmap.yaml
    ├── secret.yaml
    ├── hpa.yaml
    └── ingress.yaml
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| Docker镜像构建 | ☐ |
| K8s Deployment | ☐ |
| 存活+就绪探针 | ☐ |
| ConfigMap+Secret | ☐ |
| HPA自动扩缩 | ☐ |
| 优雅关闭 | ☐ |
| Helm Chart | ☐ |
| Ingress配置 | ☐ |
