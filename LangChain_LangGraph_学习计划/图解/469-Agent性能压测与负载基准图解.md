# Agent 性能压测与负载基准图解

> 上线前压测、找极限、建基线。本图解可视化压测流程和瓶颈分析。

---

## 压测类型

```mermaid
graph TB
    TEST["压测类型"]

    TEST --> BASE["基准测试<br/>固定QPS<br/>建立基线"]
    TEST --> STEP["阶梯加压<br/>逐步增加<br/>找极限"]
    TEST --> ENDURE["持久测试<br/>长时间高负载<br/>查泄漏"]
    TEST --> BURST["突发测试<br/>瞬时高并发<br/>测弹性"]
    TEST --> MIXED["混合场景<br/>多种任务<br/>真实模拟"]

    style TEST fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style STEP fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style MIXED fill:#C8E6C9,stroke:#2E7D32
```

---

## 瓶颈分析

```mermaid
graph TB
    RESULT["压测结果"] --> ANALYZE{"瓶颈?"}
    ANALYZE -->|"P99>>P50"| TAIL["尾部延迟<br/>慢请求/GC"]
    ANALYZE -->|"错误率高"| ERROR["错误率高<br/>超时/OOM/限流"]
    ANALYZE -->|"QPS低"| QPS["吞吐不足<br/>GPU/CPU瓶颈"]
    ANALYZE -->|"GPU>95%"| GPU["GPU瓶颈<br/>扩容/量化"]
    ANALYZE -->|"内存>90%"| MEM["内存瓶颈<br/>泄漏/扩容"]

    style ANALYZE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style GPU fill:#FFCCBC,stroke:#D84315
```

---

## 性能基线

| 场景 | P50目标 | P95目标 | QPS目标 |
|------|---------|---------|---------|
| 简单问答 | 2秒 | 5秒 | 50 |
| 工具调用 | 5秒 | 15秒 | 20 |
| 长上下文 | 10秒 | 30秒 | 5 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| Locust压测脚本 | ☐ |
| 混合场景模拟 | ☐ |
| 性能基线 | ☐ |
| 瓶颈分析 | ☐ |
| CI/CD回归 | ☐ |
