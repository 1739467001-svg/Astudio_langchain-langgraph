# 推理预算与 Token 配额图解

> 每次推理前检查预算，推理后计量消耗并更新配额，超额自动降级。

---

```mermaid
graph TB
    REQ["Agent请求"] --> CHECK{"预算检查<br/>余额够?"}
    CHECK -->|有余额| EXEC["执行推理<br/>LLM+工具调用"]
    CHECK -->|超额| DEGRADE["降级<br/>简化提示/返回缓存"]
    EXEC --> TRACK["Token计量<br/>input+output"]
    TRACK --> UPDATE["更新配额"]
    UPDATE --> CHECK

    style CHECK fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style EXEC fill:#E3F2FD,stroke:#1565C0
    style DEGRADE fill:#FFCDD2,stroke:#C62828
    style TRACK fill:#C8E6C9
```

---

## 预算级别对比

| 级别 | 输入上限 | 输出上限 | 工具调用 | 适用 |
|------|----------|----------|----------|------|
| 宽松 | 8000 | 4000 | 20 | 深度研究 |
| 均衡 | 4000 | 2000 | 10 | 生产任务 |
| 严格 | 2000 | 1000 | 5 | 高并发 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有TokenBudget | ☐ |
| 有TokenUsage计量 | ☐ |
| 有预算检查 | ☐ |
| 有超额降级 | ☐ |
| 有上下文截断 | ☐ |
| 有消耗报告 | ☐ |
