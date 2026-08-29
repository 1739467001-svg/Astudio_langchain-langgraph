# Agent 自适应图解

> 根据查询特征自动调整策略、推理深度和检索方式，实现"简单走快路、复杂走深路"。

---

```mermaid
graph TB
    QUERY["用户查询"] --> CLASSIFY&#123;"查询分类器"&#125;
    CLASSIFY -->|简单事实| FAST["快速模式<br/>单次检索+直接回答"]
    CLASSIFY -->|多步推理| DEEP["深度模式<br/>多轮检索+工具链"]
    CLASSIFY -->|创意生成| CREATIVE["创意模式<br/>高温度+few-shot"]

    FAST --> ADAPT["自适应配置<br/>temperature/top_k/max_iter"]
    DEEP --> ADAPT
    CREATIVE --> ADAPT
    ADAPT --> RESPONSE["输出响应"]

    style CLASSIFY fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style ADAPT fill:#E3F2FD,stroke:#1565C0
    style RESPONSE fill:#C8E6C9
```

---

## 自适应配置映射

| 查询类型 | temperature | top_k | max_iter | 检索方式 |
|----------|-------------|-------|----------|----------|
| 简单事实 | 0.0 | 3 | 1 | 语义检索 |
| 多步推理 | 0.1 | 10 | 5 | 多查询+重排 |
| 创意生成 | 0.7 | 5 | 2 | 上下文压缩 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有查询分类器 | ☐ |
| 至少3种自适应模式 | ☐ |
| 配置参数动态调整 | ☐ |
| 有降级回退策略 | ☐ |
