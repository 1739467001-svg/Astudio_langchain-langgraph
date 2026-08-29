# Agent 对话压缩与长上下文管理深度图解

> 10万Token压缩到6000。本图解可视化五种压缩策略和混合压缩流程。

---

## 五种压缩策略

```mermaid
graph TB
    COMP["对话压缩"]

    COMP --> TRUNC["直接截断<br/>保留最近N轮<br/>丢信息"]
    COMP --> SUMM["摘要压缩<br/>LLM总结旧消息<br/>保留要点"]
    COMP --> EXTRACT["关键信息提取<br/>实体/事实<br/>结构化保留"]
    COMP --> LAYER["分层记忆<br/>工作+短期+长期<br/>分而治之"]
    COMP --> HYBRID["混合策略<br/>截断+摘要+提取<br/>✅生产推荐"]

    style HYBRID fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style LAYER fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

---

## 混合压缩流程

```mermaid
graph TB
    FULL["完整对话<br/>10万Token"] --> SPLIT["分离系统/对话"]
    SPLIT --> RECENT["保留最近N轮<br/>40%预算"]
    SPLIT --> OLD["旧消息"]
    OLD --> SUMM["LLM摘要<br/>30%预算"]
    OLD --> KEY["关键信息提取<br/>20%预算"]
    RECENT --> MERGE["组装"]
    SUMM --> MERGE
    KEY --> MERGE
    MERGE --> RESULT["压缩后<br/>6000Token"]

    style RESULT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## Token预算分配

```mermaid
graph TB
    BUDGET["8000 Token 预算"]
    BUDGET --> SYS["系统Prompt 10%"]
    BUDGET --> PREF["用户偏好 5%"]
    BUDGET --> SUMM_B["对话摘要 25%"]
    BUDGET --> KEY_B["关键信息 15%"]
    BUDGET --> RECENT_B["最近消息 35%"]
    BUDGET --> RET["检索文档 10%"]

    style BUDGET fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style RECENT_B fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 五种策略 | ☐ |
| 混合压缩 | ☐ |
| 增量摘要 | ☐ |
| Token预算 | ☐ |
