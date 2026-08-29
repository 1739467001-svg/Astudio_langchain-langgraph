# Agent 自动扩缩容与弹性图解

> 高峰扩容保性能，低谷缩容省成本。本图解可视化扩缩容策略和 K8s 集成。

---

## 扩缩容策略

```mermaid
graph TB
    SCALE["扩缩容策略"]

    SCALE --> TIME["定时扩缩<br/>可预测流量"]
    SCALE --> METRIC["指标驱动<br/>CPU/GPU/队列"]
    SCALE --> PREDICT["预测性<br/>历史趋势"]
    SCALE --> EVENT["事件驱动<br/>突发流量"]
    SCALE --> HYBRID["混合<br/>生产推荐"]

    style SCALE fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style HYBRID fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style METRIC fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

---

## 扩缩容决策

```mermaid
graph TB
    METRICS["实时指标"] --> EVAL&#123;"评估"&#125;
    EVAL -->|"利用率>70%"| UP["⬆️ 扩容<br/>+2副本"]
    EVAL -->|"利用率<30%"| DOWN["⬇️ 缩容<br/>-1副本"]
    EVAL -->|"正常"| STAY["➡️ 不变"]
    UP --> COOLDOWN["冷却期 5分钟"]
    DOWN --> COOLDOWN

    style UP fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style DOWN fill:#C8E6C9,stroke:#2E7D32
    style COOLDOWN fill:#FFF9C4,stroke:#F9A825
```

---

## 预热与排空

```mermaid
graph TB
    NEW["新实例启动"] --> WARM["预热<br/>加载模型+测试请求"]
    WARM --> READY["✅ 就绪<br/>接受流量"]
    READY --> DRAIN["标记排空"]
    DRAIN --> WAIT["等待请求完成"]
    WAIT --> SAVE["保存状态"]
    SAVE --> SHUTDOWN["安全关闭"]

    style WARM fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style READY fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style SHUTDOWN fill:#FFCCBC,stroke:#D84315
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 五种策略 | ☐ |
| 扩缩容决策器 | ☐ |
| K8s HPA | ☐ |
| KEDA事件驱动 | ☐ |
| GPU调度 | ☐ |
| 预热+排空 | ☐ |
