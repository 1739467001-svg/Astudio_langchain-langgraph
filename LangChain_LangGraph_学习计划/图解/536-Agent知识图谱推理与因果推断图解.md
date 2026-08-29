# Agent 知识图谱推理与因果推断图解

> 因果链发现+反事实推理+多跳推理。本图解可视化因果推断。

---

```mermaid
graph TB
    Q["问题: A为什么导致C?"]
    Q --> GRAPH["图谱推理<br/>A→B→C"]
    Q --> CAUSAL["因果发现<br/>发现因果关系"]
    Q --> COUNTER["反事实推理<br/>如果A不发生?"]

    style GRAPH fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style CAUSAL fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style COUNTER fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 图谱推理vs向量 | ☐ |
| 因果发现 | ☐ |
| 反事实推理 | ☐ |
| 多跳推理 | ☐ |
