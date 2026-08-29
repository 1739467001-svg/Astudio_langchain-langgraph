# Agent 云原生与 Serverless 部署图解

> K8s常驻+Serverless弹性+边缘缓存。本图解可视化部署模式选型。

---

## 部署模式对比

```mermaid
graph TB
    MODE["部署模式"]

    MODE --> K8S["K8s常驻<br/>始终运行<br/>最低延迟<br/>高频/实时"]
    MODE --> SERVERLESS["Serverless<br/>按需启动<br/>零空闲成本<br/>低频/突发"]
    MODE --> EDGE["边缘部署<br/>就近计算<br/>极低延迟<br/>全球分布"]
    MODE --> HYBRID["混合<br/>常驻+弹性<br/>✅生产推荐"]

    style HYBRID fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style K8S fill:#E3F2FD,stroke:#1565C0
```

---

## 混合部署路由

```mermaid
graph TB
    REQ["请求"] --> CHECK&#123;"高优先级?"&#125;
    CHECK -->|"是"| K8S["K8s常驻<br/>低延迟"]
    CHECK -->|"否"| LAMBDA["Serverless<br/>省成本"]

    style K8S fill:#C8E6C9,stroke:#2E7D32
    style LAMBDA fill:#FFF9C4,stroke:#F9A825
```

---

## K8s 生产架构

```mermaid
graph TB
    ING["Ingress"] --> SVC["Service"] --> DEP["Deployment<br/>3副本"]
    DEP --> HPA["HPA<br/>3-20副本"]
    DEP --> PROBE["探针<br/>启动/存活/就绪"]

    style DEP fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style HPA fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 四种部署模式 | ☐ |
| Lambda部署 | ☐ |
| K8s生产配置 | ☐ |
| 混合部署路由 | ☐ |
| 边缘部署 | ☐ |
